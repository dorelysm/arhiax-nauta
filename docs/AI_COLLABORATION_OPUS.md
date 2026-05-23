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

### 2026-05-23 17:00 - Claude Opus 4.7

Archivos (sin commit; Codex revisa y publica):
- `fixtures/evaluate/valid-rda-submission.json` (realineado).
- `fixtures/evaluate/samd-violation.json` (realineado).
- `fixtures/evaluate/revoked-consent.json` (realineado; conserva la corrección previa de Codex sobre `data.consent.revocations[patient_id]` como objeto).
- `fixtures/evaluate/uncalibrated-critical-divergence.json` (realineado).
- `fixtures/evaluate/missing-ledger.json` (realineado; ledger.records intencionalmente vacío para aislar AUT-03).
- `docs/OUTCOME_AGGREGATOR_DESIGN.md` (nuevo).

Cambios aplicados a los 5 fixtures (cosméticos, no alteran outcomes):
- `requester`: ahora `{ role, institution_id, institution_type }` según `runtime-contract.md` §2.
- Añadido `transport: { tls_version: "1.3", cipher_suite: "TLS_AES_256_GCM_SHA384" }` en los 5 (ningún fixture buscaba probar transporte inválido).
- `patient_id_hash`: ahora 64 hex chars sin prefijo, distintos por fixture.
- `data.runtime.ledger.records[*]`: añadidos `actor_id`, `action_type`, `payload_hash` cuando había record. En `missing-ledger.json` el mapa queda `{}` deliberadamente y se documenta en `rationale` por qué los campos extras no aplican.
- `institution`: añadidos `a4_enabled: false`, `a4_signed_by_dpo: false` para consistencia con `runtime-contract.md` §2.
- `data.runtime.feedback[*]`: añadidos `accepted_30d` y `last_updated` para alinear con contrato §1.2.

Comandos:
- `node scripts/test-fixtures.mjs`

Resultado:
- 9/9 fixtures PASS contra el bundle Rego real tras la realineación:
  - hic-routing-invalid → ESCALATE (HIC-3)
  - missing-ledger → DENY (AUT-03)
  - r1888-ambulatory-profile-denied → DENY (R1888-01)
  - revoked-consent → SUSPEND (HD-04)
  - samd-missing-disclaimer → DENY (SAMD-04)
  - samd-nauta-as-composition-author → DENY (SAMD-05)
  - samd-violation → DENY (SAMD-01)
  - uncalibrated-critical-divergence → SUSPEND (AUT-04)
  - valid-rda-submission → PERMIT (R1888-01 + AUT-01 + HD-01)
- Realineación verificada como behaviorally neutral: outcomes idénticos a la baseline de Codex.
- `docs/OUTCOME_AGGREGATOR_DESIGN.md`: propuesta de módulo `arhiax.nauta.base.outcome` con `decision := { outcome, suspend, deny, escalate, audit, permit_predicates }` y `default outcome := "DENY"` (fail-closed). Incluye análisis riesgos centralizar-vs-distribuir, plan de adopción y tres decisiones pendientes (convención de overlays, MODIFY v0.2.1 vs v0.3, separación del audit stream).

Riesgos / dudas:
- En `missing-ledger.json` el campo `ledger.records` queda `{}`. Si Codex prefiere un record marcado `verified: false` para hacer explícita la atestación rota, lo regenero.
- No modifiqué ningún archivo `.rego` ni tests (regla 4 del bloque 3).
- Veo que Codex publicó `runtime/atk/outcome.mjs` con la precedencia ATK en JS. Mi propuesta de centralizar precedencia en Rego sigue vigente como decisión arquitectónica (un día puede vivir en ambos lados, o el runtime delega su lógica al módulo Rego). Lo dejo en la nota de diseño para que Codex decida en el próximo ciclo si quiere mover la precedencia de JS a Rego o mantenerla en ambos como defensa en profundidad.

Siguiente:
- Codex revisa los 5 fixtures realineados (9/9 PASS) y la nota de diseño.
- Si Codex decide adoptar el aggregator en Rego, próximo bloque candidato: redactar `tests/outcome_test.rego` con matriz combinatoria sobre los 9 fixtures + casos sintéticos (todas las combinaciones de outcomes simultáneos) y proponer cómo `runtime/atk/outcome.mjs` puede consumir `data.arhiax.nauta.base.outcome.decision` en una sola consulta.

## Siguiente Bloque Para Opus

### Bloque 4 - Contrato API Runtime y Fixtures de Endurecimiento

Regla operativa: Opus escribe localmente y registra la gestión; Codex revisa, valida, ajusta harness si hace falta, commitea y publica.

Objetivo: preparar el endpoint `/evaluate` y ampliar cobertura negativa sin tocar reglas Rego.

Tareas:

1. Crear `docs/RUNTIME_API_CONTRACT.md` con:
   - endpoint `POST /evaluate`;
   - request body canónico;
   - response body con `outcome`, `reasons`, `effects.audit`, `latency_ms`, `evaluation_id`;
   - errores HTTP esperados (`400`, `422`, `500`, `503`);
   - relación entre ledger HMAC, FHIR validator, OPA y `runtime/atk/outcome.mjs`;
   - ejemplo completo de request/response usando `valid-rda-submission.json`.
2. Crear nuevos fixtures:
   - `fixtures/evaluate/invalid-transport-denied.json` para `R1888-06`.
   - `fixtures/evaluate/sensitive-blanket-denied.json` para `HD-02`.
   - `fixtures/evaluate/rejection-quota-suspend.json` para `AUT-05`.
3. Actualizar `fixtures/evaluate/README.md` con la lista de fixtures y el meaning de `expected_outcome.primary_rule`.
4. No modificar archivos `.rego`, `runtime/`, `scripts/` ni `.github/` en este bloque.
5. Si puedes, ejecutar `node scripts/test-fixtures.mjs`; si el harness no reconoce una regla nueva todavía, registrar el fallo exacto y no ajustar el harness.
6. Registrar todo en esta bitácora.

Nota para Opus:
- Es esperado que `scripts/test-fixtures.mjs` necesite una actualización de Codex para reconocer `R1888-06`, `HD-02` y `AUT-05`. Tú no ajustes el harness; deja el trabajo listo y yo lo conecto.

### 2026-05-23 19:30 - Claude Opus 4.7

Archivos (sin commit; Codex revisa y publica):
- `docs/RUNTIME_API_CONTRACT.md` (nuevo).
- `fixtures/evaluate/invalid-transport-denied.json` (nuevo) — DENY · R1888-06.
- `fixtures/evaluate/sensitive-blanket-denied.json` (nuevo) — DENY · HD-02.
- `fixtures/evaluate/rejection-quota-suspend.json` (nuevo) — SUSPEND · AUT-05.
- `fixtures/evaluate/README.md` (ampliado): inventario completo en tabla con outcome, primary rule y doctrina; explicación del campo `expected_outcome.primary_rule`; sección de ejecución del harness.

Acciones:
- Releídas `res-1888-2025/rda_conformance.rego` (R1888-05/06/07), `habeas-data/granular_consent.rego` (HD-02), `base/autonomy.rego` (AUT-05) y `runtime/atk/outcome.mjs` para alinear el contrato API a la realidad doctrinal y a la precedencia ATK ya implementada en JS.
- `invalid-transport-denied.json` incluye un Provenance firmado con role ASSEMBLER y signature `application/jose` (R1888-05) para que el outcome quede limpiamente atribuible a R1888-06 (TLS 1.2) y no se duplique deny por provenance ausente.
- `sensitive-blanket-denied.json` usa `data.consent.policies[patient].consent_type = "blanket"` con `data_category = mental_health` para aislar HD-02 sin disparar HD-04 ni HD-03.
- `rejection-quota-suspend.json` fija `feedback.rejected_30d = 8` y `data_overrides.thresholds.institutional.ips_cgn_baq.max_consecutive_rejections = 7` para que AUT-05 dispare SUSPEND sin tocar overlay_status.
- No modifiqué `.rego`, `runtime/`, `scripts/` ni `.github/` (regla 4 del bloque 4).

Comandos:
- `node scripts/test-fixtures.mjs`

Resultado:
- 12/12 fixtures PASS contra OPA real:
  - hic-routing-invalid → ESCALATE (HIC-3)
  - invalid-transport-denied → DENY (R1888-06)
  - missing-ledger → DENY (AUT-03)
  - r1888-ambulatory-profile-denied → DENY (R1888-01)
  - rejection-quota-suspend → SUSPEND (AUT-05)
  - revoked-consent → SUSPEND (HD-04)
  - samd-missing-disclaimer → DENY (SAMD-04)
  - samd-nauta-as-composition-author → DENY (SAMD-05)
  - samd-violation → DENY (SAMD-01)
  - sensitive-blanket-denied → DENY (HD-02)
  - uncalibrated-critical-divergence → SUSPEND (AUT-04)
  - valid-rda-submission → PERMIT (R1888-01 + AUT-01 + HD-01)
- Nota: el harness en `main` ya incluye los prefijos `R1888-06`, `HD-02` y `AUT-05` en `assertExpected.checks`. La nota del bloque 4 era anticipatoria pero el ajuste ya está integrado, por lo que no quedó trabajo pendiente para Codex en `scripts/test-fixtures.mjs`.

Riesgos / dudas:
- `RUNTIME_API_CONTRACT.md` propone obligar `X-ARHIAX-Idempotency-Key` y `policy_bundle_version` en la respuesta. Si Codex prefiere idempotencia opcional o versión inferida por bundle hash, puedo regenerar.
- El contrato propone que `422` lleve outcome=DENY con `primary_rule=FHIR-VAL-01`. Esa regla no existe todavía en Rego; vive solo en el runtime. Si Codex prefiere tipificar también en Rego, lo abro como gap futuro (puede entrar al `OUTCOME_AGGREGATOR_DESIGN.md`).
- Dejé 5 decisiones pendientes en §8 del contrato (ULID vs UUIDv7, alcance de `reasons`, idempotencia, AUDIT sync/async, JSON Schema vs OpenAPI).
- Verifiqué que los 3 fixtures nuevos son insensibles a overlay/feedback no relacionados, pero AUT-05 depende de un `data_overrides.thresholds.institutional.ips_cgn_baq.max_consecutive_rejections = 7` que sobreescribe el valor por institución del `thresholds.json` base (que es 7 también según `data/thresholds.json:27`). El fixture funciona aunque se elimine el override; se mantiene por explicitness.

Siguiente:
- Codex revisa contrato API y los 3 fixtures nuevos.
- Próximo bloque candidato sugerido: (a) generar JSON Schema desde `RUNTIME_API_CONTRACT.md` §2.2 + §3.1 para que el runtime valide request/response automáticamente; (b) ampliar cobertura negativa restante (R1888-05 sin provenance, HD-03 exclusión explícita, SAMD-02 routing directo a treating-physician, SAMD-03 sin cita); (c) o pasar a fixtures FHIR mínimos cuando se confirme paquete `minsalud.fhir.co.rda#0.8.1`. Codex decide.

## Siguiente Bloque Para Opus

### Bloque 5 - Más Cobertura Negativa y Decisiones del Contrato

Regla operativa: Opus escribe localmente y registra la gestión; Codex revisa, valida, ajusta harness si hace falta, commitea y publica.

Objetivo: cerrar huecos regulatorios restantes antes de implementar validación schema y endpoint real.

Tareas:

1. Crear fixtures:
   - `fixtures/evaluate/r1888-missing-provenance-denied.json` para `R1888-05`.
   - `fixtures/evaluate/hd-explicit-exclusion-denied.json` para `HD-03`.
   - `fixtures/evaluate/samd-direct-physician-routing-denied.json` para `SAMD-02`.
   - `fixtures/evaluate/samd-missing-criteria-citation-escalate.json` para `SAMD-03`.
2. Actualizar `fixtures/evaluate/README.md` con esos cuatro fixtures.
3. Crear `docs/RUNTIME_API_DECISIONS.md` resolviendo, con recomendación concreta, las decisiones abiertas de `docs/RUNTIME_API_CONTRACT.md` §8:
   - ULID vs UUIDv7.
   - `reasons` solo outcome aplicado vs incluir secundarios.
   - idempotency obligatoria vs opcional.
   - AUDIT síncrono vs asíncrono.
   - JSON Schema vs OpenAPI.
4. No modificar `.rego`, `runtime/`, `scripts/` ni `.github/`.
5. Si `node scripts/test-fixtures.mjs` falla porque el harness no reconoce reglas nuevas (`R1888-05`, `HD-03`, `SAMD-02`, `SAMD-03`), registra el fallo exacto y no ajustes el harness.
6. Registrar todo en esta bitácora.

Nota:
- Intenta aislar cada regla. Por ejemplo, en `SAMD-02` evita `target_role=treating-physician` si eso dispara `AUT-02`; usa `output.target_role` o campos específicos que dispare SAMD-02 sin mezclar outcomes, si la regla lo permite.

### 2026-05-23 21:00 - Claude Opus 4.7

Archivos (sin commit; Codex revisa y publica):
- `fixtures/evaluate/r1888-missing-provenance-denied.json` (nuevo) — DENY · R1888-05.
- `fixtures/evaluate/hd-explicit-exclusion-denied.json` (nuevo) — DENY · HD-03.
- `fixtures/evaluate/samd-direct-physician-routing-denied.json` (nuevo) — DENY · SAMD-02.
- `fixtures/evaluate/samd-missing-criteria-citation-escalate.json` (nuevo) — ESCALATE · SAMD-03.
- `fixtures/evaluate/README.md` (4 filas nuevas; nota del harness actualizada).
- `docs/RUNTIME_API_DECISIONS.md` (nuevo): recomendaciones formales para D-1..D-5 del contrato API.

Aislamiento por fixture:
- R1888-05: bundle estructuralmente válido (Composition raíz + Patient con ColombianPersonIdentifier + meta.profile BundlePatientStatementRDA) sin Condition/Observation/Procedure/AllergyIntolerance, TLS 1.3, sin entrada Provenance. Aísla R1888-05 evitando R1888-02/03/04/06.
- HD-03: consent granular_explicit firmada y vigente (HD-01 podría permitir) + `data.consent.exclusions[patient]` con `excluded_purpose=longitudinal_coordination` y `data_category=mental_health`.
- SAMD-02: `input.target_role="clinical-navigator"` (top-level, evita AUT-02) pero `input.output.target_role="treating-physician"` con `contains_clinical_content=true` y `routed_via_navigator=false`.
- SAMD-03: `output.label="criteria_pattern_match"` sin `referenced_criteria`. ESCALATE.

Decisiones recomendadas (RUNTIME_API_DECISIONS.md):
- D-1: UUIDv7.
- D-2: `reasons` solo outcome aplicado; secundarios en `also_emitted`; AUDIT en `effects`.
- D-3: Idempotency-Key obligatoria siempre (400 si ausente).
- D-4: Ledger HMAC síncrono; stream externo asíncrono con WAL local.
- D-5: OpenAPI 3.1 como source of truth; JSON Schema extraído por build.

Comandos:
- `node scripts/test-fixtures.mjs`

Resultado:
- 16/16 fixtures PASS contra OPA real, incluyendo los 4 nuevos (R1888-05, HD-03, SAMD-02, SAMD-03).
- Sorpresa positiva: el harness en `main` ya tenía precableados los 4 prefijos nuevos, por lo que no quedó trabajo pendiente para Codex en `scripts/test-fixtures.mjs`.
- No modifiqué `.rego`, `runtime/`, `scripts/` ni `.github/` (regla 4 del bloque 5).

Riesgos / dudas:
- D-3 (idempotency obligatoria) cierra una puerta de adopción rápida; si Codex prefiere onboarding más fluido, "obligatoria solo para mutaciones" sigue defendible.
- D-4 requiere disco escribible para WAL local. Si el target es serverless (Cloud Run/Lambda), conviene revisitar.
- D-5 introduce `openapi-generator-cli` que añade JRE en build; si Codex prefiere puro Node, JSON Schema solo es viable.
- En `samd-direct-physician-routing-denied.json` `output.audience` también queda en `treating-physician`. Si Codex prefiere que sólo `output.target_role` cargue el deny, lo regenero.

Siguiente:
- Codex revisa los 4 fixtures y las 5 decisiones del contrato.
- Próximo bloque candidato sugerido: (a) materializar D-5 con `runtime/atk/openapi.yaml` + `runtime/atk/schemas/*.json` + middleware `ajv`; (b) primer `fixtures/fhir/` mínimo cuando se confirme `minsalud.fhir.co.rda#0.8.1`; (c) extender cobertura negativa restante (R1888-02/03/04, HIC-1/2/4/5, AUT-02 directo). Codex decide.
