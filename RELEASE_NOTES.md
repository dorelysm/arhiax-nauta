# Notas de Lanzamiento - ARHIAX Nauta v0.3.0
## "Endurecimiento de Seguridad, Gobernanza y Trazabilidad Regulatoria"

---

## 1. Resumen Ejecutivo
ARHIAX Nauta v0.3.0 marca la transición del motor de políticas a un estado de **producción y auditoría regulado**. Esta versión se enfoca en eliminar cualquier posibilidad de falsos negativos silenciados, garantizando que el motor de políticas de OPA (Open Policy Agent) actúe como la **única fuente de verdad criptográfica y regulatoria**, eliminando lógica de precedencia en el runtime de JavaScript y endureciendo el canal de distribución mediante firmas RSA de bundles.

Nauta opera bajo una premisa doctrinal estricta: **Nauta media, pero no decide clínicamente** y **falla cerrado** ante cualquier inconsistencia de seguridad o de integridad de datos.

---

## 2. Hitos y Logros Técnicos

### A. Firma Criptográfica de Bundles (Fase 4 - Seguridad)
- **Integridad y Autenticidad**: Se ha integrado la firma de políticas OPA en el ciclo de validación local y en el pipeline de CI/CD. Los bundles de producción se firman digitalmente con algoritmos RSA-256 (`RS256`).
- **Manifesto de Firma**: Cada compilación del bundle (`nauta-policy-bundle.tar.gz`) ahora incluye un archivo `.signatures.json` que valida el hash de cada regla Rego contra la llave privada del emisor.
- **Herramienta de Llaves**: Creación de `scripts/generate-keys.mjs` que permite generar de forma nativa e independiente llaves de desarrollo sin depender de paquetes externos o herramientas del sistema operativo.

### B. Módulo de Precedencia Rego `base.outcome` (P2.9 / Gap 7)
- **Defensa en Profundidad**: Toda la lógica de precedencia crítica (`SUSPEND > DENY > ESCALATE > MODIFY > AUDIT > PERMIT`) fue migrada desde la capa de aplicación (JavaScript) directamente al bundle de OPA (`policy-bundle-nauta-colombia/base/outcome.rego`).
- **Pass-through Seguro**: El runtime de Node.js actúa como un mero canalizador de datos de entrada y salida, asegurando que las decisiones de control de acceso y conformidad regulatoria nunca se alteren por fallos lógicos a nivel de JavaScript.

### C. Mitigación de 8 Gaps del Contrato de Runtime (P2.8)
Se corrigieron todas las debilidades del contrato detalladas en `docs/RUNTIME_ATK_CONTRACT_GAPS.md`:
1. **Inconsistencia de `input.requester`**: Estandarizado en todos los fixtures y políticas utilizando `institution_type` para evitar fallos de bypass de consentimiento.
2. **`action_category` Desconocidas**: Se endureció OPA para que cualquier categoría de acción no mapeada explícitamente resulte en `DENY` automático (fail-closed).
3. **Validación de `actor_id` y `payload_hash`**: Validación rigurosa de metadatos de atestación mediante la regla `AUT-06`.
4. **Consentimiento Granular**: Se integró soporte para que las revocaciones específicas por categoría apliquen correctamente a nivel de alcance (scope).
5. **Fixtures Golden y `transport`**: Todos los 21 fixtures golden y los unitarios integran la capa de red `transport` asegurando cumplimiento no determinista.
6. **Hash de Pacientes**: Implementación de verificación criptográfica de coherencia en los identificadores de pacientes.
7. **Consolidación Canónica de Outcomes**: OPA es ahora el agregador definitivo de outcomes.
8. **Severidad SaMD Unificada**: Mapeo canónico a través del campo estandarizado `input.divergence_severity`.

---

## 3. Matriz de Reglas Reguladas
El bundle de OPA procesa políticas bajo los siguientes marcos legales de la República de Colombia:

| Código de Regla | Módulo / Paquete | Marco de Referencia | Comportamiento en Fallo |
|-----------------|------------------|---------------------|------------------------|
| **AUT-01 a AUT-06** | `arhiax.nauta.base.autonomy` | Autonomía Médica, Ley 1751/2015 | `DENY` / `SUSPEND` |
| **HD-01 a HD-04** | `arhiax.nauta.co.habeas_data` | Ley Estatutaria 1581/2012 (Protección Datos) | `SUSPEND` |
| **R1888-01 a R1888-06**| `arhiax.nauta.co.res_1888_2025` | Resolución 1888 de 2025 (Interoperabilidad HIC)| `DENY` |
| **DEC-01 a DEC-03** | `arhiax.nauta.co.decreto_4725` | Decreto 4725 de 2005 (Dispositivos Médicos) | `DENY` |
| **GRA-01 a GRA-03** | `arhiax.nauta.base.clinical` | Criterios Clínicos (Escala de Graus 2016) | `AUDIT` |

---

## 4. Guía de Operaciones y Seguridad

### A. Protocolo de Rotación de Secretos (HMAC)
El ledger local atesta la pre-evaluación utilizando firmas HMAC-SHA256. 
1. Los secretos deben rotarse cada **90 días** o inmediatamente ante cualquier sospecha de fuga de credenciales.
2. Para rotar la llave local:
   - Defina la nueva llave en el entorno de producción (`PROCESS.env.HMAC_KEY`).
   - El sistema cargará el nuevo secreto en caliente. 
   - Las atestaciones antiguas se mantendrán archivadas en el ledger y serán auditadas históricamente con la clave pública de auditoría respectiva.

### B. Procedimiento de Verificación en Producción
Para desplegar el bundle firmado de manera segura en un clúster OPA:
1. Distribuya la llave pública `keys/development-public.pem` al pod/sidecar de OPA.
2. Defina la configuración de bundles en `opa-config.yaml` requiriendo verificación de firmas:
   ```yaml
   bundles:
     nauta:
       service: local
       resource: nauta-policy-bundle.tar.gz
       signing:
         keyid: arhiax-nauta-release
         scope: write
   ```

---

## 5. Checklist de Preparación Regulatoria y Seguridad

- [x] **Suite de Pruebas Verdes**: Los 21 fixtures golden de regresión y las pruebas unitarias pasan sin errores.
- [x] **Firma de Bundle Habilitada**: El empaquetador local genera y empaqueta el JWT en `.signatures.json`.
- [x] **Garantía SBOM**: Inventario de dependencias CycloneDX exportado libre de vulnerabilidades conocidas.
- [x] **Doctrina Fail-Closed**: Verificación estricta de que la falta de tokens, consentimientos o llaves provoca un estado de bloqueo seguro (`DENY` o `SUSPEND`).
