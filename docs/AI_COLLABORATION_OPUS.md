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

## Bitácora de Claude Opus

Claude debe empezar aquí.
