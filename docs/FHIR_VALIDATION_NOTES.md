# Nota técnica · Validación FHIR para `BundlePatientStatementRDA`

Autor: Claude Code Opus 4.7 (carril paralelo)
Fecha: 2026-05-23
Estado: Recomendación. **No instalar nada hasta que Codex revise.**
Alcance: Identificar la forma más estable de validar bundles producidos por Nauta contra FHIR R4 + paquete colombiano `minsalud.fhir.co.rda#0.8.1`.

## 1. Contexto

El bundle de políticas evalúa la conformidad estructural del payload una vez aceptado, pero NO valida que el JSON sea un bundle FHIR R4 válido ni que cumpla los perfiles oficiales publicados en `https://fhir.minsalud.gov.co/rda/`. Esa validación es prerequisito: si el bundle falla FHIR, no tiene sentido pasarlo por Rego.

La cadena objetivo es:

```
input JSON → FHIR Validator (R4 + paquete CO) → OPA Rego → outcome ATK
```

## 2. Opciones evaluadas

### Opción A · HL7 FHIR Validator CLI (oficial)

- Repositorio: `hapifhir/org.hl7.fhir.core` (`validator_cli.jar`).
- Releases: <https://github.com/hapifhir/org.hl7.fhir.core/releases>.
- Dependencias: JRE 11+; el JAR resuelve paquetes desde `packages.simplifier.net` o `packages2.fhir.org` y los cachea en `~/.fhir/packages/`.
- Comando típico:

  ```bash
  java -jar validator_cli.jar bundle.json \
    -version 4.0.1 \
    -ig minsalud.fhir.co.rda#0.8.1 \
    -tx n/a \
    -output report.json
  ```

- `-tx n/a` deshabilita el terminology server externo. Para Nauta es deseable: no queremos llamadas salientes durante la validación local. Las terminologías `ColombianPersonIdentifier`, `ICD10CO`, `CUPS`, `DIVIPOLA` son CodeSystems definidos dentro del paquete `minsalud.fhir.co.rda`, no requieren tx externo.
- Ventajas: es el validador de referencia de HL7. Lo que él aprueba es lo que validará la plataforma IHCE.
- Riesgos:
  - JAR pesado (~80 MB) más ~100 MB de paquetes cacheados.
  - Requiere Java en el runtime. Si el runtime es Node/TS puro, se necesita sidecar.
  - Primer arranque descarga paquetes; en entornos sin egress falla. Mitigación: pre-cachear `~/.fhir/packages/` en el contenedor de CI/runtime.

### Opción B · `fhir-kit-validator` o equivalentes nativos JS/TS

- Existen wrappers Node (por ejemplo `@asymmetrik/node-fhir-server-core`, `fhir-validator-js`) pero ninguno implementa validación de perfiles `StructureDefinition` con la fidelidad del validador HL7. Quedan en validación estructural superficial.
- Veredicto: insuficiente para validar perfiles del paquete `minsalud.fhir.co.rda`. No es alternativa.

### Opción C · HAPI FHIR Validator embebido como librería Java

- Útil si el runtime fuera JVM. Para un runtime Node/TS (sugerido en `DEVELOPMENT_PLAN.md` Fase 2), agrega complejidad sin ganancia frente a Opción A.
- Veredicto: descartar salvo que Codex decida JVM para el runtime.

### Opción D · `inferno` (ONC) o validadores comerciales (Firely Terminal)

- `Firely Terminal` es de pago para uso comercial; bloqueador legal/operativo.
- `Inferno` está orientado a US Core, no a paquetes colombianos.
- Veredicto: descartar.

## 3. Recomendación

Adoptar **Opción A · HL7 FHIR Validator CLI** como sidecar invocado por el runtime ATK antes de delegar a OPA.

Diseño propuesto:

1. Imagen Docker base con JRE 11 + `validator_cli.jar` + paquete `minsalud.fhir.co.rda#0.8.1` pre-cacheado en `~/.fhir/packages/`.
2. Runtime Node/TS expone `/evaluate`. Internamente:
   1. Recibe payload JSON.
   2. Persiste el ledger HMAC (atestación previa).
   3. Ejecuta `java -jar validator_cli.jar <tmpfile> -version 4.0.1 -ig minsalud.fhir.co.rda#0.8.1 -tx n/a -output <report>`.
   3. Si el reporte tiene `severity in {fatal, error}` → outcome ATK `DENY` antes de OPA, con `rule = FHIR-VAL-01`.
   4. Si pasa → entrega `input` a OPA y resuelve outcome con precedencia ATK.
3. CI ejecuta validación FHIR como job separado del job OPA, porque la primera descarga del paquete puede ser lenta. Cachear `~/.fhir/packages/` con `actions/cache` en GitHub Actions.

## 4. Fixtures FHIR mínimos

Pendiente como entregable de Fase 3:

- `fixtures/fhir/valid-patient-statement-bundle.json` — Bundle `document` válido contra `BundlePatientStatementRDA`, autor `Patient`.
- `fixtures/fhir/invalid-author-practitioner.json` — Mismo bundle pero con `Composition.author = Practitioner`. Debe fallar tanto por FHIR (si el perfil lo restringe) como por R1888-01 / SAMD-05.
- `fixtures/fhir/missing-required-section.json` — Falta sección obligatoria del perfil.

No los incluyo en este PR porque requieren primero confirmar la versión exacta del paquete y descargar `StructureDefinition` reales para no inventar campos.

## 5. Riesgos abiertos

- `minsalud.fhir.co.rda#0.8.1` no aparece publicado todavía en `packages.simplifier.net` (verificar antes de cachear). Si no está publicado, hay que importar manualmente desde `vulcano.ihcecol.gov.co` y publicarlo en un registro privado.
- El validador trata `unknown extensions` como `warning` por defecto. Para Nauta conviene elevar warnings de extensiones desconocidas a `error` con `-strictExtensions` para no aceptar extensiones inventadas.
- Performance: el validador puede tardar 1-3 s por bundle en cold start. Para el endpoint `/evaluate` conviene mantener un worker en caliente (modo `-watch` o servidor HTTP del validador) en lugar de levantar JVM por request.

## 6. Próximos pasos sugeridos

1. Codex revisa esta nota y confirma stack del runtime (Node/TS asumido).
2. Decisión: ¿sidecar Docker o invocación directa local? Yo recomiendo sidecar HTTP del validador (modo servidor) para evitar overhead JVM por request.
3. Cuando Codex apruebe, se levanta un PR específico con:
   - `runtime/fhir-validator/` (cliente HTTP del sidecar).
   - `docker/fhir-validator.Dockerfile`.
   - `fixtures/fhir/*`.
   - Job `fhir-validate` en `.github/workflows/`.

No agrego dependencias en este PR.
