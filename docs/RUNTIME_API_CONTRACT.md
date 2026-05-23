# Runtime API Contract · ARHIAX Nauta ATK · `POST /evaluate`

Autor: Claude Opus 4.7
Fecha: 2026-05-23
Estado: Borrador para revisión de Codex. No implementa nada; define el contrato externo del runtime ATK que consumirá `policy-bundle-nauta-colombia`.
Documentos relacionados:
- `policy-bundle-nauta-colombia/docs/runtime-contract.md` (contrato interno OPA ↔ runtime)
- `docs/FHIR_VALIDATION_NOTES.md` (sidecar FHIR Validator)
- `docs/OUTCOME_AGGREGATOR_DESIGN.md` (precedencia ATK)
- `runtime/atk/outcome.mjs` (implementación actual del aggregator en JS)

---

## 1. Resumen del flujo

```
cliente HTTP
   │ POST /evaluate
   ▼
runtime ATK (Node/TS)
   │ 1. validar request body (JSON Schema)
   │ 2. construir input canónico + computar patient_id_hash
   │ 3. ledger HMAC: pre-registrar (action_id, payload_hash, timestamp) ANTES del paso 4
   │ 4. FHIR Validator sidecar (si action_category requiere bundle)
   │ 5. OPA evaluación: bundle Rego + data overlays
   │ 6. resolveOutcome(policyResult) → outcome ATK con precedencia
   │ 7. persistir AUDIT stream (si effects.audit no vacío)
   ▼
response JSON
```

Reglas estructurales:

- Cualquier fallo en pasos 1-3 produce `400` o `503` SIN llegar a OPA.
- Fallo del FHIR Validator (paso 4) produce `422` con `outcome=DENY` y `primary_rule=FHIR-VAL-01`.
- Cualquier paso ≥ 4 que escriba ledger debe haber pasado el paso 3 (atestación previa, doctrina TR-032/P-05).
- Timeout (> 100 ms) sobre OPA se trata como `ESCALATE`, nunca `PERMIT` (contrato §6 OPA).

## 2. Request: `POST /evaluate`

### 2.1 Headers obligatorios

| Header | Valor | Notas |
|---|---|---|
| `Content-Type` | `application/json` | UTF-8 |
| `Authorization` | `Bearer <jwt>` | JWT firmado por institución habilitada |
| `X-ARHIAX-Institution-Id` | `<ips_id>` | Debe coincidir con `requester.institution_id` |
| `X-ARHIAX-Idempotency-Key` | UUIDv4 | Misma key + mismo body ⇒ misma respuesta |

### 2.2 Body canónico

El body es exactamente `input` del fixture, sin `expected_outcome` ni `data_overrides`. Forma estable:

```json
{
  "action_id": "string (UUID o action_id local únicos por acción)",
  "action_category": "produce_composition | data_access | emit_output | emit_divergence_notification | divergence_notification | submit_bundle_to_ihce | enroll_patient | deploy_overlay | modify_consent | transfer_graph",
  "autonomy_level": "A0 | A1 | A2 | A3 | A4",
  "target_role": "string",
  "target_composition_profile": "string (URI canonical, requerido si action_category=produce_composition)",
  "target_bundle_profile": "string (URI canonical, requerido si action_category=produce_composition o submit_bundle_to_ihce)",
  "timestamp": "ISO 8601 datetime",
  "access_timestamp": "ISO 8601 datetime (requerido si action_category=data_access)",
  "access_purpose": "string (requerido si action_category=data_access)",
  "data_category": "string (requerido si action_category=data_access)",
  "patient_id": "string",
  "patient_id_hash": "string (SHA-256 hex de patient_id; el runtime lo recomputa y rechaza mismatches)",
  "requester": {
    "role": "string",
    "institution_id": "string",
    "institution_type": "string"
  },
  "institution": {
    "id": "string",
    "authorization_status": "active | suspended | expired",
    "overlay_status": "calibrated | uncalibrated",
    "a4_enabled": "boolean",
    "a4_signed_by_dpo": "boolean"
  },
  "transport": {
    "tls_version": "1.3",
    "cipher_suite": "string"
  },
  "composition": { "...": "FHIR Composition partial (requerido para produce_composition)" },
  "bundle": { "...": "FHIR Bundle (requerido para submit_bundle_to_ihce)" },
  "output": {
    "label": "string (uno de permitted_output_labels o forbidden_output_labels)",
    "audience": "patient | clinical-navigator | case-manager | ...",
    "target_role": "string",
    "contains_clinical_content": "boolean",
    "routed_via_navigator": "boolean",
    "contains_medical_disclaimer": "boolean",
    "severity": "low | moderate | high | critical",
    "referenced_criteria": {
      "citation": "string",
      "publication_doi": "string"
    }
  },
  "divergence_severity": "low | moderate | high | critical",
  "consent": { "granted": "boolean" }
}
```

Notas:

- El runtime NO acepta campos desconocidos en el primer nivel: 400 con `code=unknown_field`. Esto protege contra typos del cliente que podrían dejar reglas Rego sin disparar.
- `patient_id_hash` se recomputa siempre; el campo entrante existe solo para depuración.
- Los catálogos cerrados (`action_category`, `audience`, `severity`) se publican en `runtime/atk/schema.json` (responsabilidad de Codex).

## 3. Response

### 3.1 Forma canónica

```json
{
  "evaluation_id": "01J0CXY...",
  "outcome": "SUSPEND | DENY | ESCALATE | MODIFY | AUDIT | PERMIT",
  "precedence": ["SUSPEND", "DENY", "ESCALATE", "MODIFY", "AUDIT", "PERMIT"],
  "reasons": [
    {
      "source": "autonomy_deny | res_deny | habeas_deny | samd_deny | autonomy_suspend | habeas_suspend | hic_escalate | samd_escalate | allow",
      "rule": "AUT-03 | R1888-06 | HD-04 | ...",
      "message": "DENY · AUT-03 · ..."
    }
  ],
  "effects": {
    "audit": [
      {
        "source": "samd_audit | res_audit | habeas_audit",
        "rule": "SAMD-06 | R1888-07 | ...",
        "record": { "...": "Audit record completo emitido por la regla Rego" }
      }
    ]
  },
  "latency_ms": 12,
  "evaluated_at": "2026-05-23T17:30:00.123-05:00",
  "policy_bundle_version": "0.2.0",
  "fhir_validation": {
    "performed": true,
    "report_uri": "s3://arhiax-runtime/audit/2026-05-23/eval/01J0CXY.json",
    "issues_summary": { "fatal": 0, "error": 0, "warning": 1, "information": 0 }
  }
}
```

### 3.2 Reglas de respuesta

- `evaluation_id` es ULID generado por el runtime. Único por evaluación. Aparece en `audit` records, ledger y logs.
- `precedence` se devuelve por contrato — el cliente no necesita conocerla a priori.
- `reasons` contiene SOLO las del outcome aplicado. Las demás (por ejemplo `audit`) se exponen en `effects`.
- `effects.audit` lista los records emitidos por reglas `audit[*]`, aunque el outcome final sea DENY/SUSPEND. Razón doctrinal: la bifurcación epistémica obliga a registrar siempre lo que pasó, no solo lo permitido.
- `latency_ms` es el tiempo total del endpoint (incluye FHIR Validator + OPA + persistencia ledger), no solo OPA. Para latencia de OPA aislada el cliente debe leer las métricas Prometheus.
- `fhir_validation` solo aparece cuando se ejecutó FHIR Validator (acciones que llevan bundle).

## 4. Errores HTTP

| Código | Causa | Body |
|---|---|---|
| `400 Bad Request` | JSON malformado, campo desconocido, `patient_id_hash` mismatch, action_category fuera del catálogo. | `{ "error": { "code": "unknown_field", "field": "foo", "message": "..." } }` |
| `401 Unauthorized` | JWT ausente, firma inválida o expirado. | `{ "error": { "code": "auth_required", "message": "..." } }` |
| `403 Forbidden` | `requester.institution_id` ≠ `X-ARHIAX-Institution-Id` o institución no habilitada (REPS). | `{ "error": { "code": "institution_mismatch", "message": "..." } }` |
| `409 Conflict` | Idempotency-key repetida con body distinto. | `{ "error": { "code": "idempotency_conflict" } }` |
| `422 Unprocessable Entity` | FHIR Validator devolvió `severity in {fatal, error}`. Response incluye `outcome=DENY`, `primary_rule=FHIR-VAL-01` y reporte. | Estructura completa de response con outcome=DENY, más `fhir_validation.issues` con detalle. |
| `500 Internal Server Error` | OPA crash, ledger no escribible, FHIR Validator caído, panic no controlado. NUNCA devuelve PERMIT. | `{ "error": { "code": "internal_error", "evaluation_id": "..." } }` |
| `503 Service Unavailable` | Dependencias degradadas: OPA cold start, FHIR cache vacío, consent-service inaccesible. Fail-closed: nunca PERMIT. | `{ "error": { "code": "dependency_unavailable", "dependencies": ["fhir_validator"] } }` |

Reglas:

- Cuando un error ≥ 500 ocurre con `action_category` que afecta paciente, el runtime también escribe un registro AUDIT con `compliance_status=evaluation_failed` para evidenciar el intento.
- `422` es la única vía por la que un FHIR-rechazo aparece como respuesta JSON con outcome (en lugar de 4xx puro): la auditoría regulatoria necesita que el rechazo quede tipificado, no como error genérico.

## 5. Relación entre componentes

```
ledger HMAC (Vault-backed)
   ▲           │
   │ (3)       │ (5)
   │           ▼
runtime ATK ── FHIR Validator (sidecar, opción A de FHIR_VALIDATION_NOTES.md)
   │
   ▼ (5)
OPA con bundle policy-bundle-nauta-colombia
   │
   ▼ (6)
runtime/atk/outcome.mjs → resolveOutcome(policyResult)
   │
   ▼ (7)
AUDIT stream (Kafka / Pub/Sub) + Response JSON
```

Responsabilidades:

| Componente | Decide | NO decide |
|---|---|---|
| Runtime ATK (Node/TS) | Validación schema, computo de hash, orquestación, ledger HMAC, persistencia AUDIT, manejo HTTP. | Outcome ATK; razones doctrinales. |
| FHIR Validator | Conformidad estructural FHIR R4 + paquete CO. | Doctrina Nauta; consent. |
| OPA + bundle Rego | Reglas regulatorias y doctrinales; emisión de deny/escalate/suspend/audit/allow. | Latencia HTTP; persistencia. |
| `outcome.mjs` | Precedencia ATK sobre los outcomes parciales devueltos por OPA. | Reglas Rego; latencia. |

## 6. Ejemplo completo (usando `valid-rda-submission.json`)

### 6.1 Request

```
POST /evaluate HTTP/1.1
Host: atk.arhiax.example
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJFUzI1NiJ9...
X-ARHIAX-Institution-Id: ips_cgn_baq
X-ARHIAX-Idempotency-Key: 7d7c3f0c-9b1e-4a1c-9b4e-1c4f3e2a0b11
```

```json
{
  "action_id": "act-2026-05-23-0001",
  "action_category": "produce_composition",
  "autonomy_level": "A3",
  "target_composition_profile": "https://fhir.minsalud.gov.co/rda/StructureDefinition/CompositionPatientStatementRDA",
  "target_bundle_profile": "https://fhir.minsalud.gov.co/rda/StructureDefinition/BundlePatientStatementRDA",
  "target_role": "clinical-navigator",
  "timestamp": "2026-05-23T10:15:00-05:00",
  "access_timestamp": "2026-05-23T10:15:00-05:00",
  "access_purpose": "longitudinal_coordination",
  "data_category": "mental_health",
  "patient_id": "pt-co-cc-1010101010",
  "patient_id_hash": "0101010101010101010101010101010101010101010101010101010101010101",
  "requester": {
    "role": "clinical-navigator",
    "institution_id": "ips_cgn_baq",
    "institution_type": "ips_hospital"
  },
  "consent": { "granted": true },
  "institution": {
    "id": "ips_cgn_baq",
    "authorization_status": "active",
    "overlay_status": "calibrated",
    "a4_enabled": false,
    "a4_signed_by_dpo": false
  },
  "transport": { "tls_version": "1.3", "cipher_suite": "TLS_AES_256_GCM_SHA384" },
  "composition": {
    "author": [
      {
        "type": "Patient",
        "identifier": {
          "system": "https://fhir.minsalud.gov.co/rda/CodeSystem/ColombianPersonIdentifier",
          "value": "1010101010"
        }
      }
    ]
  },
  "output": {
    "label": "criteria_pattern_match",
    "audience": "clinical-navigator",
    "target_role": "clinical-navigator",
    "contains_clinical_content": true,
    "routed_via_navigator": true,
    "contains_medical_disclaimer": true,
    "severity": "moderate",
    "referenced_criteria": {
      "citation": "Graus F, et al. Lancet Neurol 2016;15:391-404.",
      "publication_doi": "10.1016/S1474-4422(15)00401-9"
    }
  },
  "divergence_severity": "moderate"
}
```

### 6.2 Response

```
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "evaluation_id": "01J0CXY1A2B3C4D5E6F7G8H9JK",
  "outcome": "PERMIT",
  "precedence": ["SUSPEND", "DENY", "ESCALATE", "MODIFY", "AUDIT", "PERMIT"],
  "reasons": [
    {
      "source": "allow",
      "rule": "R1888-01 + AUT-01 + HD-01",
      "message": "At least one policy package allowed the action and no deny/escalate/suspend fired."
    }
  ],
  "effects": {
    "audit": [
      {
        "source": "samd_audit",
        "rule": "SAMD-06",
        "record": {
          "action": "samd_boundary_event",
          "regulatory_basis": "Decreto 4725 de 2005",
          "output_label": "criteria_pattern_match",
          "referenced_criteria": "Graus F, et al. Lancet Neurol 2016;15:391-404.",
          "severity": "moderate",
          "target_role": "clinical-navigator",
          "patient_id_hash": "0101010101010101010101010101010101010101010101010101010101010101",
          "samd_perimeter_check": "passed",
          "timestamp": "2026-05-23T10:15:00-05:00",
          "ledger_action_id": "act-2026-05-23-0001"
        }
      }
    ]
  },
  "latency_ms": 18,
  "evaluated_at": "2026-05-23T10:15:00.087-05:00",
  "policy_bundle_version": "0.2.0",
  "fhir_validation": {
    "performed": false,
    "report_uri": null,
    "issues_summary": { "fatal": 0, "error": 0, "warning": 0, "information": 0 }
  }
}
```

(Nota: en este ejemplo `fhir_validation.performed=false` porque `produce_composition` puede no requerir bundle completo; cuando se haga `submit_bundle_to_ihce`, sí.)

## 7. Versionado del contrato

- Path versionado: `/v1/evaluate`. Una vez publicado `v1`, los cambios breaking obligan `/v2/evaluate` con doble-stack durante 90 días.
- El campo `policy_bundle_version` permite al cliente decidir si el outcome es vinculante; un cliente prudente rechaza `policy_bundle_version` distinto al esperado.
- El `evaluation_id` ULID permite ordenar por tiempo de creación y correlacionar con ledger, OPA logs y AUDIT stream.

## 8. Decisiones pendientes para Codex

1. ¿`evaluation_id` ULID o UUIDv7? Mi preferencia ULID por legibilidad humana y ordenamiento; UUIDv7 si Codex quiere mantener compatibilidad con tooling existente.
2. ¿`reasons` en respuesta incluye SOLO el outcome aplicado o también los outcomes secundarios? Hoy `outcome.mjs` ya devuelve solo el aplicado; este contrato propone mantener esa semántica y exponer el resto vía `effects` (AUDIT).
3. ¿`X-ARHIAX-Idempotency-Key` es obligatorio o opcional? Recomiendo obligatorio para evitar dobles atestaciones cuando un cliente reintente.
4. ¿AUDIT stream síncrono o asíncrono respecto al response? Recomiendo síncrono para coherencia con el ledger HMAC; mide en stress tests si penaliza latencia inaceptablemente.
5. ¿Schema JSON Schema publicado en `runtime/atk/schema.json` (sugerido) o en `openapi.yaml`? Si Codex prefiere OpenAPI, podemos generar JSON Schema desde ahí.
