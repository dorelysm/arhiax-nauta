# ARHIAX Nauta

Repositorio de construcción para **ARHIAX Nauta**, navegador clínico longitudinal de Sinergia Consulting Group. El activo técnico inicial es el bundle de políticas OPA/Rego `policy-bundle-nauta-colombia` v0.2.0, orientado a gobernanza ejecutable, conformidad RDA Colombia, consentimiento granular y contención del perímetro SaMD.

## Estado actual

- Base técnica importada desde `nauta-policy-bundle-v0.2.tar.gz`.
- Documentación fuente preservada en `references/source-material/`.
- Bundle original preservado en `references/bundles/`.
- Plan maestro en `docs/DEVELOPMENT_PLAN.md`.
- Coordinación con Claude Code Opus 4.7 en `docs/AI_COLLABORATION_OPUS.md`.

## Estructura

```text
.
├── policy-bundle-nauta-colombia/   # Políticas Rego, datos, pruebas y contrato runtime
├── fixtures/
│   ├── evaluate/                   # Golden fixtures end-to-end para harness OPA (21 fixtures)
│   └── fhir/                      # Bundles FHIR R4 para validación de perfiles (3 fixtures)
├── docs/                           # Plan senior, revisión y coordinación multi-IA
├── references/                     # PDFs, PPTX y bundle original entregado
├── scripts/                        # Utilidades de validación local
└── .github/workflows/              # CI de validación OPA
```

## Validación local

Requiere `opa` instalado en PATH.

```powershell
.\scripts\validate.ps1
```

Si `opa` no está instalado, el script descarga un binario temporal para validación local en Windows. La validación completa queda además automatizada en GitHub Actions.

La validación ejecuta:

- `opa fmt --diff`
- `opa check`
- `opa test`
- `opa build`
- golden fixtures en `fixtures/evaluate/*.json`

### Validación FHIR (pendiente)

Los fixtures en `fixtures/fhir/` están diseñados para ser consumidos por el [HL7 FHIR Validator CLI](https://github.com/hapifhir/org.hl7.fhir.core) con el paquete `minsalud.fhir.co.rda#0.8.1`. Ver `docs/FHIR_VALIDATION_NOTES.md` para la nota técnica completa.

## Doctrina de ingeniería

Nauta **media, no decide**. El repositorio debe preservar tres propiedades: atestación antes de acción, separación constructor/auditor y producción exclusiva de RDA Paciente. Cualquier cambio que debilite esas propiedades debe bloquearse en revisión.

