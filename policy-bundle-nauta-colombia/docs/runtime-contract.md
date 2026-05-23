# Runtime Contract · ARHIAX Nauta Policy Bundle v0.2

**Audiencia:** desarrolladores del ARHIAX Agent Trust Kernel (ATK) que cargarán este bundle en runtime.

**Propósito:** documentar las dependencias que el bundle Rego asume del runtime, para que la implementación del ATK las provea de forma consistente. Este documento cierra la Debilidad 6 identificada en Kill Critic v0.1.

---

## 1. Estructuras de datos requeridas en `data.*`

El bundle Rego asume que las siguientes estructuras existen en el árbol `data` del OPA en runtime. Es responsabilidad del runtime ARHIAX cargarlas y mantenerlas actualizadas.

### 1.1 `data.runtime.ledger.records`

Map de `action_id → record`. Cada record:

```json
{
  "verified": boolean,
  "hmac_signature_valid": boolean,
  "timestamp": "ISO 8601 datetime",
  "actor_id": "string",
  "action_type": "string",
  "payload_hash": "SHA-256 hex string"
}
```

**Contrato de actualización:** el ATK debe escribir el record ANTES de invocar la evaluación de política. Si el record no existe, todas las reglas con precondicional `ledger_recorded` deniegan.

**Algoritmo HMAC:** HMAC-SHA256 con clave gestionada por el módulo Vault del ARHIAX runtime. Rotación cada 90 días.

### 1.2 `data.runtime.feedback`

Map de `institution_id → feedback_metrics`. Cada métrica:

```json
{
  "rejected_30d": integer,
  "accepted_30d": integer,
  "last_updated": "ISO 8601 datetime"
}
```

**Contrato de actualización:** actualización en background cada hora desde el stream de feedback del clinical-navigator (aceptar/rechazar notificación).

### 1.3 `data.consent.policies`

Map de `patient_id → array de policies`. Cada policy:

```json
{
  "requester_role": "string",
  "data_category": "string",
  "purpose": "string",
  "consent_type": "granular_explicit | blanket",
  "status": "active | suspended | expired",
  "signed_timestamp": "ISO 8601 datetime",
  "expiration_timestamp": "ISO 8601 datetime (optional)"
}
```

**Contrato de actualización:** el paciente edita estas estructuras vía UI dedicada. El backend de consent management las persiste y notifica al ATK para hot-reload del bundle de datos.

### 1.4 `data.consent.revocations`

Map de `patient_id → revocation`:

```json
{
  "timestamp": "ISO 8601 datetime",
  "reason": "string (optional)",
  "scope": "global | specific_category"
}
```

**Contrato:** revocación es inmediata. El backend debe propagar al ATK en ≤ 1 segundo.

### 1.5 `data.consent.exclusions`

Map de `patient_id → array de exclusions`:

```json
{
  "data_category": "string",
  "excluded_requester_type": "string (optional)",
  "excluded_purpose": "string (optional)",
  "status": "active | inactive",
  "signed_timestamp": "ISO 8601 datetime"
}
```

### 1.6 `data.runtime.authorized_roles`

Set de roles operacionales actualmente autorizados en el sistema. Bootstrap desde `data/entity_types.json`.

---

## 2. Estructura del `input` esperado

El ATK debe construir el objeto `input` para cada evaluación con la siguiente forma:

```json
{
  "action_category": "submit_bundle_to_ihce | data_access | produce_composition | divergence_notification | ...",
  "action_id": "string (único por acción)",
  "autonomy_level": "A0 | A1 | A2 | A3 | A4",
  "target_role": "string",
  "patient_id": "string",
  "patient_id_hash": "SHA-256 of patient_id",
  "timestamp": "ISO 8601 datetime",
  "requester": {
    "role": "string",
    "institution_id": "string",
    "institution_type": "string"
  },
  "institution": {
    "id": "string",
    "overlay_status": "calibrated | uncalibrated",
    "a4_enabled": boolean,
    "a4_signed_by_dpo": boolean,
    "authorization_status": "active | suspended | expired"
  },
  "transport": {
    "tls_version": "1.3",
    "cipher_suite": "string"
  },
  "bundle": "FHIR Bundle resource (cuando aplica)",
  "output": "Object describing the proposed output (cuando aplica)",
  "patient_graph": "Object con observaciones longitudinales del paciente (cuando aplica)",
  "consent_policy_id": "string (cuando aplica)"
}
```

**Hashing de `patient_id`:** los registros AUDIT usan `patient_id_hash` (no el id en claro) para minimizar exposición en logs de auditoría. El runtime debe computar el hash antes de pasar a la evaluación.

---

## 3. Outcomes ATK y su mapeo a Rego

| Outcome ATK | Patrón Rego | Acción del runtime al recibirlo |
|---|---|---|
| `PERMIT` | `allow == true` y `count(deny) == 0` | Ejecutar la acción |
| `DENY` | `count(deny) > 0` | Bloquear la acción; loggear el `msg` |
| `ESCALATE` | `count(escalate) > 0` | Enrutar a checkpoint humano; pausar hasta resolución |
| `MODIFY` | `count(modify) > 0` (reservado v0.3) | Ejecutar con parámetros ajustados |
| `AUDIT` | `count(audit) > 0` | Permitir, pero escribir registros en stream de auditoría |
| `SUSPEND` | `count(suspend) > 0` | Reducir autonomía del agente; requerir intervención |

**Precedencia en caso de múltiples outcomes simultáneos:**

```
SUSPEND  >  DENY  >  ESCALATE  >  MODIFY  >  AUDIT  >  PERMIT
```

El runtime aplica el outcome de mayor precedencia.

---

## 4. Hot reload de configuración

El runtime debe soportar hot reload de los siguientes archivos sin reiniciar el ATK:

- `data/thresholds.json` (cambio de umbrales por IPS)
- `data/entity_types.json` (cambio de catálogo de roles/instituciones)
- `data.consent.*` (cambios de consentimiento del paciente)
- `data.runtime.authorized_roles`

El bundle Rego en sí (los archivos `.rego`) NO es hot-reloadable: requiere despliegue versionado con validación pre-deploy.

---

## 5. Pipeline de despliegue (responsabilidad del runtime, no del bundle)

El runtime debe ejecutar las siguientes validaciones antes de aceptar un nuevo bundle o overlay:

1. **Validación de sintaxis Rego:** `opa parse` debe pasar sin errores.
2. **Validación de tests:** `opa test` debe pasar al 100%.
3. **Validación de monotonicidad:** un overlay solo puede AGREGAR reglas `deny`, nunca neutralizar reglas `deny` del bundle base. Esto se valida computando el conjunto de reglas deny activas antes y después del overlay.
4. **Validación de firmas:** el bundle debe estar firmado por Sinergia (clave conocida). Los overlays deben estar firmados por director médico Y oficial de protección de datos de la IPS.
5. **Versionado inmutable:** una vez desplegado, un bundle versionado nunca se modifica. Los cambios requieren nueva versión.

---

## 6. Modelo de errores

El runtime debe manejar los siguientes casos de error:

| Condición | Comportamiento esperado |
|---|---|
| `data.runtime.ledger` no disponible | DENY universal (fail-safe) |
| `data.consent.*` no disponible para un paciente | DENY universal para ese paciente |
| Bundle Rego mal formado | Rechazar deploy; no degradar a versión anterior automáticamente |
| Timeout en evaluación (> 100ms) | Log + ESCALATE (no PERMIT por timeout) |
| Conflicto entre overlay y base | Aplicar el conjunto restrictivo (intersección de allow, unión de deny) |

---

## 7. Observabilidad mínima

El runtime debe exponer las siguientes métricas para el rol `auditor` (no para `constructor`):

- Total de evaluaciones por outcome (PERMIT/DENY/ESCALATE/AUDIT/SUSPEND)
- Latencia p50/p95/p99 de evaluación
- Tasa de DENY por regla específica (para detectar reglas potencialmente mal calibradas)
- Tasa de SUSPEND por institución (para detectar problemas de calibración)
- Audit stream rate (registros por minuto)

La separación física de las métricas del auditor respecto del runtime operacional materializa la bifurcación epistémica (CF-01).

---

**Versión documento:** 0.2.0
**Última revisión:** 2026-05-23
**Mantenedor:** Sinergia Consulting Group · ARHIAX Architecture Team
