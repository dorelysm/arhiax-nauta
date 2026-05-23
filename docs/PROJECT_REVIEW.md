# Revisión Inicial del Proyecto

Fecha: 2026-05-23  
Responsable senior: Codex

## Lectura del material recibido

El proyecto no partía como repositorio Git. El workspace contenía documentación de producto, arquitectura, legal/roadmap, guion de hackathon, una presentación y el artefacto `nauta-policy-bundle-v0.2.tar.gz`.

El bundle extraído contiene:

- Políticas OPA/Rego para autonomía, checkpoints humanos, conformidad RDA Colombia, habeas data, perímetro SaMD y criterios clínicos Graus 2016.
- Datos JSON para roles, entidades y umbrales institucionales.
- Pruebas Rego unitarias e integrales.
- Contrato runtime ATK y FMEA.

## Diagnóstico técnico

El activo más maduro es el **policy bundle**. La capa runtime ATK todavía está representada como contrato, no como implementación. Por tanto, el desarrollo debe avanzar con dos carriles coordinados:

- Endurecer el bundle: pruebas, CI, calidad Rego, fixtures, release, firmas y compatibilidad OPA.
- Construir el runtime: evaluador, ledger HMAC, consentimiento, observabilidad, carga de datos y API de evaluación.

## Riesgos principales

1. **OPA no está instalado localmente** en esta máquina al momento de la revisión. Se dejó validación reproducible y CI para cerrar esa brecha.
2. **La validación IHCE/FHIR aún es contractual**. Debe integrarse un validador FHIR real antes de declarar conformidad operativa.
3. **El bundle no implementa aún Tabla 6 de Graus 2016**, reconocida en FMEA como riesgo de falso negativo.
4. **No existe todavía runtime ATK ejecutable**. Sin runtime, el bundle es correcto como especificación ejecutable, pero no opera como producto.
5. **La coordinación multi-IA requiere control de cambios estricto** para evitar ediciones paralelas sobre los mismos archivos regulatorios.

## Decisiones tomadas

- Se convirtió el workspace en repositorio organizado.
- Se preservaron los materiales fuente como referencias, sin mezclarlos con código operativo.
- Se creó un documento de coordinación con Claude Opus que define dueños de archivos, protocolo de handoff y registro obligatorio.
- Se agregó CI de OPA para validar sintaxis, pruebas y construcción del bundle.

## Próxima prioridad

La prioridad inmediata es lograr un **MVP verificable**:

1. CI verde para el bundle v0.2.
2. Runtime mínimo que evalúe input JSON contra OPA.
3. Fixtures clínicos/regulatorios versionados.
4. Trazabilidad HMAC simulada y luego real.
5. Release `v0.2.1` con correcciones de validación.
