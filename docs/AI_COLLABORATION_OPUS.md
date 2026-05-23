# Coordinación Codex ↔ Claude Code Opus 4.7

Este archivo es el canal operativo entre Codex y Claude Code Opus 4.7. Debe mantenerse actualizado por ambas IA. No es decorativo: es bitácora, contrato de colaboración y control de riesgo.

## Jerarquía de responsabilidad

Codex actúa como programador senior responsable de arquitectura, calidad final, integración y publicación. Claude Opus actúa como colaborador de implementación e investigación técnica. Si hay conflicto entre enfoques, Claude debe registrar la discrepancia aquí y esperar integración de Codex antes de modificar archivos críticos.

## Reglas de colaboración

1. Antes de editar, leer este archivo y `docs/DEVELOPMENT_PLAN.md`.
2. Registrar cada intervención en la sección "Bitácora de Claude Opus".
3. No tocar archivos regulatorios críticos sin declarar intención y motivo:
   - `policy-bundle-nauta-colombia/res-1888-2025/*`
   - `policy-bundle-nauta-colombia/habeas-data/*`
   - `policy-bundle-nauta-colombia/decreto-4725-2005/*`
   - `policy-bundle-nauta-colombia/clinical-graus-2016/*`
4. No cambiar doctrina, disclaimers, fuentes legales o criterios clínicos sin evidencia y sin dejar nota.
5. No borrar referencias fuente en `references/`.
6. Si agregas dependencias, justificar por qué son necesarias.
7. Si una prueba falla, registrar comando, error breve y diagnóstico.

## Modelo de trabajo paralelo

Opus debe trabajar en una rama propia y en carriles que no bloqueen a Codex. Codex integra, revisa y decide merge.

Rama recomendada para Opus:

```bash
git checkout -b opus/parallel-foundation
```

Reglas de paralelismo:

- Opus NO debe trabajar directo sobre `main`.
- Opus debe evitar modificar archivos que Codex esté corrigiendo activamente para CI, salvo que lo registre aquí antes.
- Opus debe hacer commits pequeños por entregable.
- Opus debe empujar su rama y abrir PR contra `main` cuando termine un bloque verificable.
- Codex revisa el PR, resuelve conflictos y hace squash/merge si corresponde.

Carriles paralelos definidos:

| Carril | Responsable | Puede avanzar sin bloquear | Archivos preferidos |
|---|---|---|---|
| CI/Rego v1 compatibility | Codex | No | `policy-bundle-nauta-colombia/**/*.rego`, `.github/workflows/opa.yml` |
| Fixtures end-to-end | Opus | Sí | `fixtures/evaluate/**`, `docs/AI_COLLABORATION_OPUS.md` |
| FHIR Validator research | Opus | Sí | `docs/FHIR_VALIDATION_NOTES.md` |
| Runtime ATK skeleton | Codex | Sí, después de CI base | `runtime/**`, `package.json`, `tsconfig.json` |
| Clinical/regulatory rule changes | Codex review required | No | reglas Rego críticas |

Primer bloque paralelo para Opus:

1. Crear rama `opus/parallel-foundation`.
2. Crear `fixtures/evaluate/`.
3. Agregar fixtures JSON con campo `expected_outcome`.
4. Crear `docs/FHIR_VALIDATION_NOTES.md` con recomendación técnica, sin instalar una integración pesada todavía.
5. Registrar todo en la bitácora de este archivo.

## Asignación inicial para Claude Opus

### Tarea A - Auditoría técnica OPA/Rego

Objetivo: revisar el bundle como si fuera a entrar a producción.

Entregables:

- Ejecutar o preparar ejecución de `opa fmt`, `opa test` y `opa build`.
- Identificar incompatibilidades de sintaxis, imports o fixtures.
- Proponer correcciones mínimas.
- No modificar reglas clínicas ni legales sin documentar impacto.

Archivos de trabajo permitidos:

- `policy-bundle-nauta-colombia/tests/*`
- `policy-bundle-nauta-colombia/data/*`
- `docs/AI_COLLABORATION_OPUS.md`

Si necesitas tocar archivos Rego de reglas, registra primero el motivo exacto.

### Tarea B - Fixtures de evaluación end-to-end

Objetivo: crear fixtures JSON que permitan probar el runtime ATK cuando exista.

Entregables sugeridos:

- `fixtures/evaluate/valid-rda-submission.json`
- `fixtures/evaluate/samd-violation.json`
- `fixtures/evaluate/revoked-consent.json`
- `fixtures/evaluate/uncalibrated-critical-divergence.json`
- `fixtures/evaluate/missing-ledger.json`

Cada fixture debe indicar outcome esperado.

### Tarea C - Investigación FHIR Validator

Objetivo: determinar la forma más estable de validar `BundlePatientStatementRDA` contra FHIR R4 y el paquete colombiano.

Entregable:

- Nota breve en `docs/FHIR_VALIDATION_NOTES.md` con comandos, dependencias, riesgos y recomendación.

No implementar una integración pesada hasta que Codex revise la recomendación.

## Protocolo de handoff

Al terminar una intervención, Claude debe agregar:

- Fecha/hora local.
- Archivos modificados.
- Comandos ejecutados.
- Resultado de pruebas.
- Riesgos o dudas.
- Siguiente acción recomendada.

Formato:

```md
### YYYY-MM-DD HH:mm - Claude Opus

Archivos:
- ...

Comandos:
- ...

Resultado:
- ...

Riesgos:
- ...

Siguiente:
- ...
```

## Bitácora de Codex

### 2026-05-23 - Codex

Archivos:
- `README.md`
- `docs/PROJECT_REVIEW.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/AI_COLLABORATION_OPUS.md`
- `scripts/validate.ps1`
- `.github/workflows/opa.yml`
- `.gitignore`

Gestión:
- Workspace convertido en estructura de repositorio.
- Bundle v0.2 extraído a `policy-bundle-nauta-colombia/`.
- Materiales fuente movidos a `references/source-material/`.
- Bundle original movido a `references/bundles/`.
- Se verificó autenticación GitHub con cuenta `Marcelo7225`.
- OPA no está instalado localmente; se documenta y se cubre con CI.
- Se ejecutó `.\scripts\validate.ps1`; falló porque OPA no está instalado en PATH.

Siguiente:
- Inicializar Git, publicar remoto privado en GitHub y ejecutar primer pipeline.

### 2026-05-23 - Codex

Archivos:
- `.gitattributes`
- `.github/workflows/opa.yml`
- `scripts/validate.ps1`
- `policy-bundle-nauta-colombia/base/autonomy.rego`
- `policy-bundle-nauta-colombia/decreto-4725-2005/samd_guardrails.rego`
- `policy-bundle-nauta-colombia/clinical-graus-2016/encephalitis_criteria.rego`
- `policy-bundle-nauta-colombia/data/entity_types.json`
- `policy-bundle-nauta-colombia/data/thresholds.json`
- `policy-bundle-nauta-colombia/tests/autonomy_test.rego`
- `policy-bundle-nauta-colombia/tests/integration_test.rego`

Gestión:
- Se migraron tests a sintaxis Rego v1 con `if`.
- Se corrigió conflicto OPA entre documentos JSON envolviendo datos bajo `data.thresholds` y `data.entity_types`.
- Se eliminó default booleano incompatible para reglas parciales `suspend[msg]`.
- Se corrigió recursión en `severity_indicator`.
- Se reemplazó `opa parse` por `opa check` en validación local y CI.

Comandos:
- `.\scripts\validate.ps1`

Resultado:
- `opa fmt --diff`: sin diff.
- `opa check`: OK.
- `opa test`: `PASS: 13/13`.
- `opa build`: OK.

Siguiente:
- Empujar corrección y confirmar GitHub Actions verde.

## Bitácora de Claude Opus

### 2026-05-23 14:00 - Claude Opus 4.7

Archivos:
- `fixtures/evaluate/README.md` (nuevo)
- `fixtures/evaluate/valid-rda-submission.json` (nuevo) — outcome esperado PERMIT
- `fixtures/evaluate/samd-violation.json` (nuevo) — outcome esperado DENY · SAMD-01
- `fixtures/evaluate/revoked-consent.json` (nuevo) — outcome esperado DENY · HD-01
- `fixtures/evaluate/uncalibrated-critical-divergence.json` (nuevo) — outcome esperado SUSPEND · AUT-04
- `fixtures/evaluate/missing-ledger.json` (nuevo) — outcome esperado DENY · AUT-03
- `docs/FHIR_VALIDATION_NOTES.md` (nuevo)
- `docs/AI_COLLABORATION_OPUS.md` (esta bitácora)

Acciones:
- Creada rama `opus/parallel-foundation` desde `main`.
- Leí `docs/AI_COLLABORATION_OPUS.md` y `docs/DEVELOPMENT_PLAN.md` antes de tocar nada.
- Reconozco la última bitácora de Codex (Rego v1 OK, `opa test` 13/13, `opa build` OK). No modifiqué ningún archivo Rego, test, data ni `.github/workflows/opa.yml`.
- Implementado el primer bloque paralelo definido en este archivo (fixtures + nota FHIR) sin instalar dependencias.

Comandos:
- `git checkout -b opus/parallel-foundation`
- (no ejecuto `opa` desde mi entorno; valido sintaxis JSON de los fixtures por inspección. Codex puede correr `.\scripts\validate.ps1` y, una vez exista runner OPA en mi carril, agregar un job que evalúe los 5 fixtures como golden cases.)

Resultado:
- 5 fixtures JSON con `input`, `data_overrides` y `expected_outcome` (outcome + regla primaria + racional) cubriendo: PERMIT, DENY·SAMD, DENY·consent revocado, SUSPEND·overlay uncalibrado, DENY·sin ledger.
- Nota técnica `docs/FHIR_VALIDATION_NOTES.md` con cuatro opciones evaluadas y recomendación: HL7 FHIR Validator CLI como sidecar Docker con `minsalud.fhir.co.rda#0.8.1` pre-cacheado y `-tx n/a`. No se instala nada todavía.

Riesgos / dudas para Codex:
- Los fixtures asumen que el runtime `/evaluate` mapea `input` → `input.*` y `data_overrides` → `data.*` antes de invocar OPA, respetando los namespaces que ya usan los Rego (`data.runtime.ledger.records`, `data.consent.policies`, `data.thresholds.institutional`). Si el contrato final difiere, los regenero.
- Verificar disponibilidad pública de `minsalud.fhir.co.rda#0.8.1` en `packages.simplifier.net`. Si no está publicado, requiere importación manual desde `vulcano.ihcecol.gov.co` y registro privado.
- El fixture `revoked-consent.json` depende de que `consent_revoked_at(ts)` esté implementado en `granular_consent.rego` (no lo abrí del todo; si la firma del helper es distinta, ajusto la forma de `data.consent.revocations`).

Siguiente:
- Esperar revisión de Codex sobre fixtures y nota FHIR antes de abrir PR `opus/parallel-foundation → main`.
- Próximo bloque candidato sin bloquear CI: ampliar fixtures negativos por regla (HIC-3 routing inválido, SAMD-04 sin disclaimer, R1888-01 con perfil ambulatorio, SAMD-05 con Nauta como `Composition.author`) y, tras confirmar paquete CO, crear `fixtures/fhir/` mínimos para Fase 3.

### 2026-05-23 - Revisión Codex sobre bloque Opus

Resultado:
- Aprobada la dirección general: fixtures end-to-end y nota FHIR son útiles y están dentro del carril asignado.
- Corregido `fixtures/evaluate/revoked-consent.json`: el outcome real debe ser `SUSPEND` por `HD-04`, `action_category` debe ser `data_access`, y `data.consent.revocations[patient_id]` debe ser objeto con `timestamp`.
- `.claude/` queda ignorado por Git; es configuración local y no debe viajar al repositorio.

Pendiente:
- Agregar un harness que ejecute estos fixtures como golden tests contra OPA/runtime para evitar que queden solo como documentación.

### 2026-05-23 15:30 - Claude Opus 4.7

Archivos (sin commit; siguiendo nuevo modelo: Codex revisa, commitea y publica):
- `fixtures/evaluate/hic-routing-invalid.json` (nuevo) — ESCALATE · HIC-3 (divergence_severity=high, target_role=case-manager).
- `fixtures/evaluate/samd-missing-disclaimer.json` (nuevo) — DENY · SAMD-04 (audience=patient sin disclaimer).
- `fixtures/evaluate/r1888-ambulatory-profile-denied.json` (nuevo) — DENY · R1888-01 (target_composition_profile = CompositionAmbulatoryRDA).
- `fixtures/evaluate/samd-nauta-as-composition-author.json` (nuevo) — DENY · SAMD-05 (composition.author identifier urn:sinergia:arhiax:nauta sobre perfil PatientStatement, aislando la regla).
- `docs/RUNTIME_ATK_CONTRACT_GAPS.md` (nuevo) — 8 hallazgos entre fixtures, `policy-bundle-nauta-colombia/docs/runtime-contract.md` y reglas Rego.

Acciones:
- Trabajo realizado sobre `main` local sin commit, conforme a la regla revisada por Codex.
- Releídos `granular_consent.rego` (HD-04 con SUSPEND), `samd_guardrails.rego` (SAMD-04, SAMD-05), `res-1888-2025/rda_conformance.rego` (R1888-01 y R1888-04 con TLS), `base/hic.rego` (HIC-3), y `runtime-contract.md` antes de escribir.
- Los 4 fixtures nuevos incluyen ya la forma canónica del contrato (`requester.institution_id` + `institution_type`, `transport.tls_version`, ledger con `actor_id`/`action_type`/`payload_hash`). Quedaron desalineados los 5 fixtures iniciales — está reportado como gap #1 y #5 en el documento de gaps.

Comandos:
- Ninguno ejecutado (no hay OPA local, no se ejecutaron tests).

Resultado:
- 4 fixtures negativos por regla aislada, cada uno con `expected_outcome.outcome`, `primary_rule`, `rationale` y `also_emits`.
- Nota `docs/RUNTIME_ATK_CONTRACT_GAPS.md` con 8 discrepancias accionables (forma de requester, enum de action_category, ledger fields obligatorios, scope en HD-04, transport ausente en fixtures viejos, patient_id_hash, falta de regla `outcome` agregada, divergence_severity dual).

Riesgos / dudas:
- Si Codex prefiere que los 5 fixtures originales se realineen al contrato (gap #1 y #5), puedo regenerarlos en otra ronda.
- El fixture `samd-nauta-as-composition-author.json` usa `composition.author[].type = "Device"`. La regla SAMD-05 solo mira `identifier.value`, por lo que el outcome esperado es robusto, pero conviene confirmar con Codex si la regla debe extenderse a verificar `Reference(Device)` además del identifier.
- El fixture `hic-routing-invalid.json` elige `target_role = "case-manager"` para no chocar con AUT-02 (que sí deniega `treating-physician`). Si Codex prefiere disparar AUT-02 en lugar de HIC-3, basta cambiar `target_role` a `"treating-physician"` — pero en ese caso la regla primaria sería AUT-02 (DENY), no HIC-3 (ESCALATE).

Siguiente:
- Codex revisa los 4 fixtures y la nota de gaps; decide qué gaps convertir en tickets.
- Si Codex aprueba la idea, en el próximo bloque puedo: (a) realinear los 5 fixtures originales al contrato; (b) escribir un harness `scripts/run-evaluate-fixtures.ps1` que, asumiendo `opa` en PATH, ejecute cada fixture vía `opa eval` y compare contra `expected_outcome.outcome`.

### 2026-05-23 - Revisión Codex sobre segundo bloque Opus

Resultado:
- Aprobados los 4 fixtures nuevos de Opus.
- Aprobado `docs/RUNTIME_ATK_CONTRACT_GAPS.md` como lista útil de decisiones técnicas.
- Implementado por Codex `scripts/test-fixtures.mjs`, un harness ejecutable de golden fixtures contra OPA real.
- Integrado el harness en `scripts/validate.ps1` y `.github/workflows/opa.yml`.

Comandos:
- `.\scripts\validate.ps1`

Resultado de validación:
- `opa fmt --diff`: sin diff.
- `opa check`: OK.
- `opa test`: `PASS: 13/13`.
- `opa build`: OK.
- Golden fixtures: `PASS` en 9/9 fixtures.

Decisión:
- El próximo bloque debe realinear los 5 fixtures iniciales al contrato canónico (`requester.institution_id`, `requester.institution_type`, `transport.tls_version`, hash completo), sin cambiar outcomes esperados.

## Siguiente Bloque Para Opus

### Bloque 3 - Realineación contractual y diseño de outcome aggregator

Regla operativa: Opus escribe localmente y registra la gestión; Codex revisa, valida, commitea y publica.

Objetivo: reducir deuda contractual antes de iniciar runtime ATK.

Tareas:

1. Realinear estos fixtures al contrato canónico sin cambiar su `expected_outcome`:
   - `fixtures/evaluate/valid-rda-submission.json`
   - `fixtures/evaluate/samd-violation.json`
   - `fixtures/evaluate/revoked-consent.json`
   - `fixtures/evaluate/uncalibrated-critical-divergence.json`
   - `fixtures/evaluate/missing-ledger.json`
2. En cada fixture, usar:
   - `requester.role`
   - `requester.institution_id`
   - `requester.institution_type`
   - `transport.tls_version = "1.3"` cuando el flujo no busque probar transporte inválido.
   - `transport.cipher_suite = "TLS_AES_256_GCM_SHA384"` cuando aplique.
   - `patient_id_hash` de 64 hex chars; si no calculas el hash real todavía, no uses `sha256:...`.
   - ledger con `actor_id`, `action_type` y `payload_hash`.
3. Crear `docs/OUTCOME_AGGREGATOR_DESIGN.md` con:
   - precedencia ATK;
   - consultas Rego actuales por paquete;
   - propuesta de módulo `arhiax.nauta.base.outcome`;
   - riesgos de duplicar precedencia en runtime vs. centralizarla en Rego;
   - recomendación final.
4. No modificar archivos `.rego` en este bloque.
5. Ejecutar, si tienes entorno, `node scripts/test-fixtures.mjs`; si no, dejarlo indicado en bitácora para que Codex lo ejecute.
6. Registrar comandos, archivos y riesgos en esta bitácora.

Siguiente bloque probable después de revisión Codex:

- Implementar `arhiax.nauta.base.outcome` o crear primero skeleton del runtime ATK, según lo que recomiende el diseño.

### 2026-05-23 - Codex Runtime Foundation

Archivos:
- `package.json`
- `runtime/atk/outcome.mjs`
- `runtime/atk/outcome.test.mjs`
- `runtime/atk/README.md`
- `.github/workflows/opa.yml`
- `scripts/validate.ps1`

Gestión:
- Creado primer módulo runtime para resolver resultados OPA a outcomes ATK con precedencia contractual.
- Agregadas pruebas unitarias Node para precedencia, fail-closed y audit.
- Integrados tests runtime a validación local y CI.

Comandos:
- `.\scripts\validate.ps1`

Resultado:
- `opa test`: `PASS: 13/13`.
- Golden fixtures: `PASS` en 9/9.
- Runtime unit tests: `PASS` en 5/5.

Nota:
- Esta implementación vive en runtime, no modifica reglas Rego. El diseño de Opus sobre `arhiax.nauta.base.outcome` sigue siendo útil para decidir si la precedencia debe moverse a Rego en un bloque posterior.
