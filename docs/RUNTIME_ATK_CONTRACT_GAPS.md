# Gaps entre fixtures, `runtime-contract.md` y reglas Rego

Autor: Claude Opus 4.7
Fecha: 2026-05-23
Alcance: catálogo breve de discrepancias detectadas al construir los 9 fixtures (`fixtures/evaluate/*.json`) contra `policy-bundle-nauta-colombia/docs/runtime-contract.md` y los `.rego` del bundle base. No propone cambios a las reglas; describe lo que Codex debe decidir.

## 1. Forma de `input.requester` [CERRADO]

- `runtime-contract.md` §2 define `requester = { role, institution_id, institution_type }`.
- Los primeros 5 fixtures (commit Codex `e851404`) usan `requester = { role, id }` con `id` sin namespace.
- `granular_consent.rego` HD-03 lee `input.requester.institution_type`; sin ese campo, la exclusión nunca dispara aunque exista en `data.consent.exclusions`. Es un falso negativo silencioso.

Acción sugerida: Codex decide canónico. Mi recomendación: alinear todos los fixtures a la forma del contrato (`institution_id` + `institution_type`) y dejar `id` solo para identificación del actor humano cuando aplique (`requester.actor_id`).

## 2. Catálogo de `action_category` [CERRADO]

- `runtime-contract.md` §2 ejemplifica `submit_bundle_to_ihce | data_access | produce_composition | divergence_notification | ...` (con elipsis).
- Las reglas Rego usan además: `enroll_patient`, `deploy_overlay`, `modify_consent`, `transfer_graph`, `emit_output`.
- No hay enum cerrado.

Acción sugerida: publicar enum cerrado en el contrato, o agregar regla Rego que rechace `action_category` desconocida (fail-closed). Sin enum, un typo en runtime se traduce en PERMIT silencioso.

## 3. `data.runtime.ledger.records[].actor_id|action_type|payload_hash` [CERRADO]

- Contrato §1.1 los documenta como obligatorios.
- `ledger_recorded()` en `base/autonomy.rego` solo evalúa `verified`, `hmac_signature_valid`, `timestamp`. Los demás campos son verificados solo por el runtime fuera de OPA.

Acción sugerida: agregar regla AUT-06 que falle si `actor_id` o `payload_hash` están vacíos, para mantener la propiedad estructural ("atestación precede acción" implica trazabilidad de quién y de qué). Hoy un runtime defectuoso podría rellenar solo los tres campos críticos y pasar OPA.

## 4. `consent_revoked_at` y forma de `data.consent.revocations`

- Codex corrigió el fixture `revoked-consent.json` para que use `data.consent.revocations[patient_id]` como objeto único `{ timestamp, reason, scope }`, consistente con contrato §1.4 y con la regla HD-04.
- Sin embargo, la sub-clave `scope` (`global | specific_category`) no se evalúa en HD-04: la revocación dispara SUSPEND incluso si `scope == specific_category` pero la categoría revocada no coincide con `input.data_category`.

Acción sugerida: o (a) HD-04 toma en cuenta `scope` y `data_category` antes de SUSPEND, o (b) el contrato deja explícito que toda revocación se trata como global por seguridad.

## 5. `transport.tls_version` y `R1888-04` [CERRADO]

- `res-1888-2025/rda_conformance.rego:279` deniega cuando `not input.transport.tls_version == "1.3"`.
- Los primeros 5 fixtures NO incluyen `transport`. En OPA esto se evalúa como undefined → la negación en la regla colombiana puede comportarse como verdadera o falsa según la versión de Rego y la presencia de `not`. Riesgo de outcome no determinista.
- Los 4 fixtures nuevos (`hic-routing-invalid`, `samd-missing-disclaimer`, `r1888-ambulatory-profile-denied`, `samd-nauta-as-composition-author`) sí incluyen `transport.tls_version: "1.3"`.

Acción sugerida: añadir `transport` al stub de inputs de los primeros 5 fixtures (Codex puede patchear), o ajustar R1888-04 para tratar transport ausente como `DENY` explícito en lugar de depender de la semántica de `not` con undefined.

## 6. `patient_id_hash`

- Contrato §2 dice "SHA-256 of patient_id" (64 hex chars).
- Los primeros 5 fixtures usan tokens cortos pseudo-hash (`sha256:9a6f...c4`). Los 4 nuevos usan 64 hex caracteres válidos pero no son el SHA-256 real de `patient_id`.

Acción sugerida: para fixtures golden no es crítico (ninguna regla Rego computa el hash), pero el harness de tests podría incluir un assert opcional `sha256(patient_id) == patient_id_hash` para detectar fixtures inconsistentes.

## 7. Outcome explícito ausente

- Las reglas Rego usan colecciones parciales (`deny[msg]`, `escalate[msg]`, `suspend[msg]`, `audit[record]`) más `allow := true | false`.
- `runtime-contract.md` §3 mapea esto a outcomes ATK pero el bundle no expone una regla que retorne directamente el outcome final aplicando precedencia. Hoy esa lógica vive en el runtime.

Acción sugerida: agregar en `base/` un módulo `arhiax.nauta.base.outcome` con regla `outcome := "SUSPEND" if count(suspend) > 0 else "DENY" if ...` que el runtime pueda consultar directamente. Beneficio: el harness de fixtures golden compara contra una única consulta OPA en lugar de reproducir la precedencia en código del runtime.

## 8. `divergence_severity` doble fuente

- `input.divergence_severity` (top-level) y `input.output.severity` coexisten en los fixtures.
- `base/autonomy.rego` y `base/hic.rego` leen `input.divergence_severity`. `decreto-4725-2005/samd_guardrails.rego` AUDIT lee `input.output.severity`.

Acción sugerida: el contrato debe declarar cuál es canónico. Recomiendo dejar solo `input.divergence_severity` y derivar `output.severity` en el runtime si es necesario.

---

Estado: lista de hallazgos, no acciones. Codex decide cuáles convertir en tareas. No se modifica ningún archivo Rego en este bloque.
