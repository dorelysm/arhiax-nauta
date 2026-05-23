# Decisiones del Contrato API Runtime

Autor: Claude Opus 4.7
Fecha: 2026-05-23
Estado: Recomendaciones para resolver `docs/RUNTIME_API_CONTRACT.md` §8. Codex aprueba, ajusta o rechaza punto por punto.
Alcance: las 5 decisiones abiertas dejadas en el contrato API.

Cada decisión está estructurada como:

1. **Pregunta**
2. **Opciones consideradas** (con trade-offs específicos)
3. **Recomendación**
4. **Implicación operativa** (qué cambia en el código una vez aceptada)

---

## D-1 · ULID vs UUIDv7 para `evaluation_id`

**Pregunta:** ¿Qué formato usa el `evaluation_id` que el runtime asigna a cada llamada `POST /evaluate`?

**Opciones:**

| Opción | Pros | Contras |
|---|---|---|
| ULID (Crockford base32, 26 chars) | Legible, ordenable lexicográficamente por tiempo, 80 bits de aleatoriedad, sin guiones (logs/Kibana más limpios), librerías estables en Node (`ulid`). | Menos canónico fuera del ecosistema "operadores". Algunas herramientas (Postgres) requieren cast a `text`. |
| UUIDv7 (RFC 9562, hex con guiones) | Estándar IETF reciente, soporte nativo en Postgres 18+, herramientas de tracing (OTel) lo entienden out-of-the-box, ordenable por tiempo. | Algo más largo (36 chars con guiones), todavía menos común que ULID en logs operacionales. |

**Recomendación:** **UUIDv7**.

- Razón principal: la cadena OTel/tracing/SIEM ya manipula UUIDs como first-class. Introducir ULID obliga a normalizar en cada borde (export a SIEM, audit stream, ledger). El costo de legibilidad es marginal.
- Riesgo secundario: ULID `Crockford base32` colisiona visualmente entre `0/O` y `1/I/L` en fuentes monoespaciadas, lo que ha generado bugs reales en triage de incidentes en otras plataformas regulatorias.
- Si Codex prefiere ULID, la diferencia operativa es contenida; la decisión es reversible si el campo se versiona.

**Implicación operativa:** dependencia `uuid` (>= v11 con soporte v7) en `package.json`. Generación en `runtime/atk/evaluate.mjs:newEvaluationId()`. Persistencia en ledger HMAC como `evaluation_id` columna `uuid`.

---

## D-2 · `reasons` solo outcome aplicado vs incluir secundarios

**Pregunta:** El campo `reasons[]` de la respuesta, ¿lista solamente las razones del outcome aplicado (PERMIT/DENY/...) o también las razones de outcomes secundarios que no se ejecutaron pero estuvieron presentes?

**Opciones:**

| Opción | Pros | Contras |
|---|---|---|
| Solo outcome aplicado | Coincide con `runtime/atk/outcome.mjs:resolveOutcome` actual. Cliente recibe una sola "verdad" doctrinal. Respuesta pequeña. | Pierde señal: un caso con DENY+SUSPEND simultáneo se reporta solo como SUSPEND; un auditor que revise post-hoc no ve qué reglas DENY también dispararon. |
| Aplicado + secundarios | Auditoría más rica. Útil para detectar reglas que casi-disparan. Permite al cliente entender por qué un caso es "casi PERMIT pero falló por X". | Cliente puede confundir secundarios con el outcome aplicado si no lee la precedencia. Respuesta más grande. |

**Recomendación:** **Solo outcome aplicado en `reasons`. Secundarios disponibles en un campo separado `also_emitted` cuando aplique.**

```json
{
  "outcome": "SUSPEND",
  "reasons": [ { "rule": "AUT-04", "..." } ],
  "also_emitted": {
    "DENY": [ { "rule": "SAMD-01", "..." } ]
  },
  "effects": { "audit": [...] }
}
```

- Mantiene la simplicidad doctrinal (`reasons` es lo que el agente debe leer para actuar).
- Auditoría queda intacta vía `also_emitted` + `effects.audit` para AUDIT.
- Compatible con la implementación actual `outcome.mjs`: requiere extender `resolveOutcome` para no descartar los buckets superiores; mínimo cambio.

**Implicación operativa:** ajuste menor en `runtime/atk/outcome.mjs` (devolver buckets completos en lugar de un solo `reasons`). Tests `outcome.test.mjs` cubren la nueva forma. Sin cambios en Rego.

---

## D-3 · Idempotency-Key obligatoria vs opcional

**Pregunta:** `X-ARHIAX-Idempotency-Key`, ¿se exige siempre o queda opcional como mejora de robustez del cliente?

**Opciones:**

| Opción | Pros | Contras |
|---|---|---|
| Obligatoria (400 si ausente) | Garantiza protección contra dobles atestaciones bajo retry de red. Limpia la responsabilidad: el ledger HMAC siempre puede deduplicar. | Clientes ingenuos fallan en su primera integración. Curva de adopción más alta. |
| Opcional (genera UUID si falta) | Onboarding fácil. El runtime genera idempotency-key derivada de hash(body) si no llega. | El servidor adivina; si el cliente cambia un campo irrelevante en retry, queda un nuevo registro. Aumenta el ruido en el ledger. |
| Obligatoria solo para `action_category` que muta estado | Compromiso: idempotency obligatoria para `produce_composition`, `submit_bundle_to_ihce`, `modify_consent`, `deploy_overlay`, `transfer_graph`. Opcional para `data_access` y queries de solo lectura. | Lógica de borde compleja: el cliente debe saber qué acciones la requieren; aumenta la superficie del contrato. |

**Recomendación:** **Obligatoria SIEMPRE. 400 con `code=missing_idempotency_key` si falta.**

- Razón doctrinal: el ledger HMAC (TR-032/P-05) es el contrato estructural del sistema. Si el cliente no aporta una clave de deduplicación, el ledger pierde su propiedad de "una acción ↔ un registro firmado". Esto es peor que la fricción de onboarding.
- Mitigación de fricción: documentar en `RUNTIME_API_CONTRACT.md` un ejemplo de cliente con `crypto.randomUUID()` por request, y un SDK fino que lo genere por default.
- La opción intermedia (obligatoria solo para mutaciones) sería razonable, pero todas las acciones del catálogo escriben al menos una entrada AUDIT, por lo que la asimetría no es real.

**Implicación operativa:** middleware en `runtime/atk/server.mjs` que verifica header antes de orquestar. Storage del key en ledger HMAC. Test de integración: dos POST con misma key + mismo body → misma respuesta + misma row de ledger.

---

## D-4 · AUDIT síncrono vs asíncrono respecto a la respuesta

**Pregunta:** Las escrituras al AUDIT stream, ¿bloquean el response o son fire-and-forget tras devolver el outcome?

**Opciones:**

| Opción | Pros | Contras |
|---|---|---|
| Síncrono (response espera al ack del stream) | Garantía estricta: si el cliente recibe `200`, el AUDIT fue persistido. Coherente con el ledger HMAC, que también es síncrono. | Latencia acoplada al stream. Si Kafka/Pub-Sub se degrada, `/evaluate` se degrada. |
| Asíncrono (queue local + worker) | Latencia más estable. Si el stream cae, la queue acumula y reintenta. | Pérdida posible si el worker crashea antes de drenar la queue. Cliente no puede asumir que "respuesta 200 ⇒ AUDIT escrito". |
| Síncrono al ledger HMAC + asíncrono al stream agregado | El ledger HMAC es síncrono (atestación estructural, no opcional). El stream externo (SIEM, observability) es asíncrono. | Más componentes, pero refleja mejor lo que el sistema necesita doctrinalmente. |

**Recomendación:** **Síncrono al ledger HMAC; asíncrono al stream externo (queue durable con WAL local + retry).**

- Razón: el ledger HMAC es parte del contrato estructural Nauta (paso 3 del flujo en `RUNTIME_API_CONTRACT.md` §1) y NO puede degradarse a asíncrono sin romper la bifurcación epistémica. El stream externo (Kafka/Pub-Sub) es observabilidad operacional; su pérdida temporal afecta auditoría externa pero no la atestación de la acción.
- Implementación: queue local en disco (WAL append-only) que un worker drena al stream. Si el disco también falla, devolvemos `503 dependency_unavailable` y el evento se reintenta cuando el WAL vuelve a estar escribible.
- Trade-off: latencia `/evaluate` queda dominada por ledger HMAC (~5-15 ms en HSM/Vault local), no por Kafka.

**Implicación operativa:** dos componentes en `runtime/atk/`: `ledger.mjs` (síncrono, ya implícito) y `audit-stream.mjs` (worker async con WAL en `runtime/atk/.audit-wal/`). Métricas: `audit_stream_lag_seconds`, `audit_wal_size_bytes`.

---

## D-5 · JSON Schema vs OpenAPI

**Pregunta:** ¿Dónde vive la especificación normativa del request/response?

**Opciones:**

| Opción | Pros | Contras |
|---|---|---|
| JSON Schema (`runtime/atk/schema.json`) | Compatible con `ajv` (ya estándar en runtime Node). Reusable directo por el harness golden para validar fixtures. Cero dependencias externas para clientes Node. | No describe semántica HTTP (status codes, headers, errores tipados). Doc humana queda en markdown separado. |
| OpenAPI 3.1 (`runtime/atk/openapi.yaml`) | Describe HTTP completo: paths, status, headers, securitySchemes. Genera clientes para Java/Python/Go con `openapi-generator`. Renderiza Swagger UI. OpenAPI 3.1 ya usa JSON Schema 2020-12 internamente, así que es compatible. | Más herramienta que mantener. Curva inicial mayor. La generación de tipos TypeScript desde OpenAPI introduce churn en CI. |

**Recomendación:** **OpenAPI 3.1, con los schemas extraíbles a JSON Schema para uso interno.**

- Razón principal: ARHIAX se integrará con clientes externos (consent-service, FHIR validator sidecar, harness Node, futuras integraciones LATAM en Brasil/EU que están fuera del scope CO pero modeladas en el doc). OpenAPI da un único contrato versionable que cubre HTTP, headers, errores y schemas en un solo archivo.
- JSON Schema sigue disponible: OpenAPI 3.1 referencia schemas (`#/components/schemas/EvaluateRequest`) que pueden exportarse 1:1 a `runtime/atk/schemas/*.json` por un script de build. El harness golden y el middleware de validación usan esos JSON Schemas directamente.
- El "churn" en CI es controlable: lockear versión de `openapi-generator-cli` y regenerar solo cuando el spec cambia (pre-commit hook + diff check en CI).

**Implicación operativa:** `runtime/atk/openapi.yaml` como source of truth. Script `npm run schema:emit` genera `runtime/atk/schemas/EvaluateRequest.json` y `EvaluateResponse.json`. El middleware del runtime usa `ajv` con esos schemas. La doc renderizada (`/docs`) es Swagger UI servida estáticamente.

---

## Tabla resumen

| Decisión | Recomendación corta |
|---|---|
| D-1 evaluation_id | UUIDv7 |
| D-2 reasons | Solo outcome aplicado; secundarios en `also_emitted` |
| D-3 Idempotency | Obligatoria siempre (400 si ausente) |
| D-4 AUDIT | Ledger HMAC sync; stream externo async con WAL |
| D-5 Spec | OpenAPI 3.1; JSON Schema extraído por build |

## Pendientes derivados

Si Codex acepta el bundle de decisiones:

- `RUNTIME_API_CONTRACT.md` se actualiza para citar las decisiones aprobadas y eliminar §8.
- `runtime/atk/outcome.mjs` cambia output (D-2).
- `runtime/atk/server.mjs` agrega middleware de idempotency (D-3) y validación JSON Schema (D-5).
- Nuevo módulo `runtime/atk/audit-stream.mjs` (D-4).
- Dependencias justificadas:
  - `uuid` v11 (D-1)
  - `ajv` (D-5, validación)
  - `js-yaml` solo en pipeline build de schemas (D-5, devDependency)

No se propone ninguna instalación todavía; Codex decide ritmo.
