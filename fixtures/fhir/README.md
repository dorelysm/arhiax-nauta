# Fixtures FHIR para validación de perfiles

Estos fixtures son bundles FHIR R4 diseñados para validación contra los perfiles oficiales del paquete `minsalud.fhir.co.rda#0.8.1`.

## Consumo

Estos fixtures son consumidos por el **HL7 FHIR Validator CLI** (`validator_cli.jar`) como paso previo a la evaluación OPA. La cadena completa es:

```
input JSON → FHIR Validator (R4 + paquete CO) → OPA Rego → outcome ATK
```

### Comando de validación

```bash
java -jar validator_cli.jar <fixture.json> \
  -version 4.0.1 \
  -ig minsalud.fhir.co.rda#0.8.1 \
  -tx n/a \
  -output report.json
```

> **Nota:** El validador FHIR no está integrado en el harness actual (`scripts/test-fixtures.mjs`). Estos fixtures están preparados para cuando se levante el sidecar del validador (ver `docs/FHIR_VALIDATION_NOTES.md` §3).

## Inventario

| Fixture | Validación FHIR | Reglas OPA relacionadas | Descripción |
|---|---|---|---|
| `valid-patient-statement-bundle.json` | ✅ PASS | Ninguna (PERMIT) | Bundle `document` conforme: Composition raíz con perfil PatientStatement, Patient como author con ColombianPersonIdentifier, secciones obligatorias presentes, codificaciones ICD10CO/SNOMED |
| `invalid-author-practitioner.json` | ❌ FAIL | SAMD-05, R1888-01 | Composition.author es Practitioner en vez de Patient. Falla perfil FHIR + reglas OPA de contención SaMD |
| `missing-required-section.json` | ❌ FAIL | Ninguna (no llegaría a OPA) | Composition sin secciones obligatorias. Author correcto (Patient). Falla por cardinalidad mínima del perfil |

## Relación con `fixtures/evaluate/`

Los fixtures en `fixtures/evaluate/` alimentan el harness OPA directamente y usan el formato `{expected_outcome, input, data_overrides}`. Los fixtures FHIR en este directorio son bundles FHIR R4 puros (no envueltos en el formato evaluate) porque se validan con una herramienta diferente (el FHIR Validator, no OPA).

En el runtime de producción, un bundle debe pasar **primero** la validación FHIR y **después** la evaluación OPA. Si falla FHIR, el runtime emite `DENY` con `rule = FHIR-VAL-01` sin consultar a OPA.

## Convenciones

- Los fixtures contienen un campo `_fixture_meta` (no estándar FHIR) que documenta el propósito, resultado esperado y reglas OPA relacionadas. El validador FHIR lo reportará como extensión desconocida (`warning`); no afecta la validación de conformidad del perfil.
- Los datos de firma en `Provenance.signature.data` usan placeholders (`FIXTURE_PLACEHOLDER`). En producción, el runtime genera firmas JWS ES256 reales.
- Los recursos usan URNs (`urn:uuid:*`) como `fullUrl` siguiendo la convención FHIR R4 para bundles de tipo `document`.
