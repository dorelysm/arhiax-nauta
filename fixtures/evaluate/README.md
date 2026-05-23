# Fixtures de evaluación end-to-end

Estos fixtures son la entrada canónica para probar el runtime ATK contra el `policy-bundle-nauta-colombia`. Cada archivo tiene la forma:

```json
{
  "expected_outcome": {
    "outcome": "PERMIT | DENY | ESCALATE | MODIFY | AUDIT | SUSPEND",
    "primary_rule": "<código-de-regla>",
    "rationale": "<por qué este input debe producir este outcome>"
  },
  "input": { ... payload que el runtime envía a OPA ... },
  "data_overrides": { ... fragmentos de `data.*` necesarios para que la regla se evalúe (ledger, consent, thresholds, etc.) ... }
}
```

Convenciones:

- `input` reproduce lo que el endpoint `/evaluate` del runtime debe construir antes de delegar a OPA.
- `data_overrides` se mergea sobre `policy-bundle-nauta-colombia/data/` antes de la evaluación. El runtime real lo carga desde su capa de persistencia (ledger HMAC, consent-service, thresholds.json).
- `expected_outcome.outcome` sigue la precedencia ATK `SUSPEND > DENY > ESCALATE > MODIFY > AUDIT > PERMIT`. Si una regla emite `audit` además del outcome principal, se indica en `also_emits`.
- Los fixtures son **insensibles a tiempo**: usan timestamps RFC3339 fijos para que la prueba sea determinista.

Estado: bloque inicial para Fase 1 (Codex) y Fase 2 (runtime). No instalan dependencias.

Carril: Opus · `opus/parallel-foundation`.
