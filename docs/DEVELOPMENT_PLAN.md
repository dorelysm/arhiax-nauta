# Plan Completo de Desarrollo

Fecha: 2026-05-23  
Proyecto: ARHIAX Nauta  
Responsable senior: Codex  
Colaborador IA: Claude Code Opus 4.7

## Objetivo

Dejar ARHIAX Nauta como un repositorio profesional, verificable y listo para construcción acelerada del MVP: policy bundle OPA/Rego endurecido, runtime ATK mínimo, validación CI/CD, trazabilidad regulatoria, documentación ejecutiva y protocolo de colaboración multi-IA.

## Principios no negociables

- Nauta media; Nauta no decide clínicamente.
- Nauta produce únicamente RDA Paciente.
- Toda acción debe estar atestada antes de ejecutarse.
- El sistema falla cerrado: timeout, ledger ausente, consentimiento ausente o conflicto de overlay no pueden producir `PERMIT`.
- Las reglas base solo pueden endurecerse; overlays institucionales no pueden neutralizar `deny`.
- La validación legal/regulatoria se documenta como asistencia técnica, nunca como certificación oficial.

## Fase 0 - Repositorio y Gobierno de Cambios

Estado: iniciado.

Entregables:

- Repositorio Git local.
- Repositorio GitHub privado.
- README raíz.
- CI base para OPA.
- Documento `docs/AI_COLLABORATION_OPUS.md` como bitácora viva.
- Convención de ramas: `main`, `feat/*`, `fix/*`, `docs/*`, `release/*`.
- Política de commits: mensajes claros, un cambio lógico por commit.

Criterio de salida:

- `main` protegido en GitHub.
- CI ejecutándose en push y pull request.
- Primer commit publicado.

## Fase 1 - Endurecimiento del Policy Bundle

Responsable principal: Codex.  
Apoyo: Claude Opus en revisión independiente y ampliación de fixtures.

Tareas:

- Ejecutar `opa fmt`, `opa test` y `opa build`.
- Corregir incompatibilidades Rego si aparecen.
- Agregar fixtures JSON representativos para:
  - submission RDA válida;
  - composición prohibida por SaMD;
  - consentimiento granular válido;
  - consentimiento revocado;
  - overlay no calibrado;
  - paciente con datos clínicos incompletos.
- Separar tests unitarios, integración y regresión clínica.
- Crear matriz de reglas: regla, fuente, outcome, fixture positivo, fixture negativo.
- Preparar release `policy-bundle-nauta-colombia@0.2.1`.

Criterio de salida:

- CI verde.
- Cobertura de pruebas por cada regla crítica.
- Bundle generado como artefacto de CI.

## Fase 2 - Runtime ATK Mínimo

Responsable principal: Codex.

Stack sugerido:

- TypeScript/Node.js para API y orquestación.
- OPA CLI o OPA server como motor inicial.
- JSON Schema/Zod para contratos de input.
- HMAC-SHA256 con clave local de desarrollo y abstracción Vault-ready.

Componentes:

- `atk-runtime`:
  - endpoint `/evaluate`;
  - carga de bundle;
  - resolución de precedencia `SUSPEND > DENY > ESCALATE > MODIFY > AUDIT > PERMIT`;
  - ledger HMAC pre-evaluación;
  - logging estructurado.
- `consent-service` mínimo:
  - policies;
  - revocations;
  - exclusions;
  - hot reload o recarga controlada.
- `observability` mínimo:
  - conteos por outcome;
  - latencia p50/p95;
  - tasa de `deny` por regla.

Criterio de salida:

- Evaluación end-to-end desde fixture JSON hasta outcome ATK.
- Pruebas automatizadas del runtime.
- Latencia medida localmente.

## Fase 3 - Validación RDA/FHIR

Responsable principal: Claude Opus para investigación e integración inicial. Codex revisa y estabiliza.

Tareas:

- Identificar forma más robusta de invocar HL7 FHIR Validator para FHIR R4 y paquete `minsalud.fhir.co.rda#0.8.1`.
- Crear fixture FHIR mínimo de `BundlePatientStatementRDA`.
- Integrar validación antes de evaluación Rego para submissions IHCE.
- Persistir reporte de validación como evidencia auditable.

Criterio de salida:

- Un bundle válido pasa FHIR + Rego.
- Un bundle inválido falla antes de llegar a submission.
- CI puede ejecutar validación o dejarla como job separado cuando dependa de descargas pesadas.

## Fase 4 - Seguridad, Auditoría y Release

Responsable principal: Codex.

Tareas:

- Firmar bundles generados o preparar interfaz de firma.
- Definir formato de audit event.
- Añadir SBOM o inventario de dependencias.
- Crear plantilla de release notes.
- Añadir checklist legal/regulatorio para cada release.
- Documentar procedimiento de rotación HMAC y manejo de secretos.

Criterio de salida:

- Release reproducible.
- Evidencia de pruebas adjunta.
- Checklist de seguridad completo.

## Fase 5 - Producto Demo / Hackathon

Responsable principal: compartido.

Tareas:

- Demo local con flujo:
  1. paciente aporta datos;
  2. runtime atesta acción;
  3. políticas evalúan;
  4. outcome se muestra al clinical-navigator;
  5. audit log evidencia la decisión.
- Vista mínima para explicar outcomes sin revelar datos sensibles.
- Guion técnico alineado con `ARHIAX_Nauta_Hackathon.pptx`.

Criterio de salida:

- Demo reproducible en una máquina limpia.
- README con comandos.
- Capturas o video corto de flujo.

## Backlog Priorizado

P0:

- Instalar o automatizar OPA.
- CI verde para el bundle.
- Runtime mínimo `/evaluate`.
- Fixtures críticos.

P1:

- Validación FHIR RDA.
- Ledger HMAC persistente.
- Métricas por outcome.
- Release `0.2.1`.

P2:

- Tabla 6 Graus 2016.
- Linter estático para prohibir `Nauta` como `Composition.author`.
- Overlays institucionales con monotonicidad verificable.
- Interfaz demo para hackathon.

## Definición de Listo

Una tarea se considera lista cuando:

- tiene prueba o evidencia manual documentada;
- no debilita las propiedades doctrinales;
- actualiza documentación si cambia contrato o comportamiento;
- pasa CI;
- deja bitácora en `docs/AI_COLLABORATION_OPUS.md` si fue trabajada por una IA.
