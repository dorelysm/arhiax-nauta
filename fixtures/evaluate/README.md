# Fixtures de evaluación end-to-end

Estos fixtures son la entrada canónica para probar el runtime ATK contra el `policy-bundle-nauta-colombia`. Cada archivo tiene la forma:

```json
{
  "expected_outcome": {
    "outcome": "PERMIT | DENY | ESCALATE | MODIFY | AUDIT | SUSPEND",
    "primary_rule": "<código-de-regla>",
    "rationale": "<por qué este input debe producir este outcome>",
    "also_emits": ["<outcomes secundarios, si aplican>"]
  },
  "input": { ... payload que el runtime envía a OPA ... },
  "data_overrides": { ... fragmentos de `data.*` necesarios para que la regla se evalúe (ledger, consent, thresholds, etc.) ... }
}
```

## Convenciones

- `input` reproduce lo que el endpoint `/evaluate` del runtime debe construir antes de delegar a OPA. La forma canónica está documentada en `policy-bundle-nauta-colombia/docs/runtime-contract.md` §2 y en `docs/RUNTIME_API_CONTRACT.md`.
- `data_overrides` se mergea sobre `policy-bundle-nauta-colombia/data/` antes de la evaluación. El runtime real lo carga desde su capa de persistencia (ledger HMAC, consent-service, thresholds.json).
- `expected_outcome.outcome` sigue la precedencia ATK `SUSPEND > DENY > ESCALATE > MODIFY > AUDIT > PERMIT`. Si una regla emite `audit` además del outcome principal, se indica en `also_emits`.
- `expected_outcome.primary_rule` identifica la regla doctrinal/regulatoria responsable del outcome. Formato: `<código>` (por ejemplo, `AUT-03`, `R1888-06`, `HD-02`, `SAMD-04`). En casos compuestos (PERMIT que satisface varias reglas) se usa `R1 + R2 + ...`. El código permite que el harness sepa qué query de OPA debe disparar la regla y que el runtime emita la cita correcta en el campo `reasons[].rule` de la respuesta.
- Los fixtures son **insensibles a tiempo**: usan timestamps RFC3339 fijos para que la prueba sea determinista.

## Inventario actual

| Fixture | Outcome | Primary rule | Doctrina/Norma |
|---|---|---|---|
| `valid-rda-submission.json` | PERMIT | R1888-01 + AUT-01 + HD-01 | Bundle Patient Statement conforme |
| `samd-violation.json` | DENY | SAMD-01 | Output con label prohibida (Decreto 4725/2005) |
| `revoked-consent.json` | SUSPEND | HD-04 | Consentimiento revocado (Ley 1581/2012 Art. 8) |
| `uncalibrated-critical-divergence.json` | SUSPEND | AUT-04 | Divergencia crítica con overlay no calibrado |
| `missing-ledger.json` | DENY | AUT-03 | Acción sin atestación HMAC pre-evaluación |
| `hic-routing-invalid.json` | ESCALATE | HIC-3 | Routing de divergencia high/critical fuera de clinical-navigator |
| `samd-missing-disclaimer.json` | DENY | SAMD-04 | Output a paciente sin disclaimer médico |
| `r1888-ambulatory-profile-denied.json` | DENY | R1888-01 | Intento de producir Composition Ambulatory (Practitioner-as-author) |
| `samd-nauta-as-composition-author.json` | DENY | SAMD-05 | Nauta declarado como `Composition.author` |
| `invalid-transport-denied.json` | DENY | R1888-06 | Submission al IHCE sin TLS 1.3 (Anexo Técnico Res. 1888/2025) |
| `sensitive-blanket-denied.json` | DENY | HD-02 | Categoría sensible con consent_type `blanket` (Ley 1581/2012 Art. 6) |
| `rejection-quota-suspend.json` | SUSPEND | AUT-05 | IPS supera cuota de rechazos consecutivos (TR-032/CT-03) |

## Ejecución

Desde la raíz del repo, con OPA instalado o disponible vía `OPA_BIN`:

```bash
node scripts/test-fixtures.mjs
```

El harness imprime `PASS <archivo> -> <outcome> (<primary_rule>)` por cada fixture. Para correr uno solo:

```bash
node scripts/test-fixtures.mjs fixtures/evaluate/sensitive-blanket-denied.json
```

Nota: el harness aún no conoce los prefijos `R1888-06`, `HD-02` ni `AUT-05`. Codex agregará las entradas necesarias en `scripts/test-fixtures.mjs` cuando integre este bloque.
