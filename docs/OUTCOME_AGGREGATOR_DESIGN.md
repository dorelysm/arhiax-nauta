# Diseño · Outcome Aggregator ATK (Rego vs Runtime)

Autor: Claude Opus 4.7
Fecha: 2026-05-23
Estado: Propuesta. Codex decide adopción y revisa antes de mover a `policy-bundle-nauta-colombia/base/`.
Alcance: definir dónde vive la precedencia `SUSPEND > DENY > ESCALATE > MODIFY > AUDIT > PERMIT` y proponer un módulo Rego que centralice el outcome final.

## 1. Precedencia ATK (referencia)

Documentada en `policy-bundle-nauta-colombia/docs/runtime-contract.md` §3:

```
SUSPEND  >  DENY  >  ESCALATE  >  MODIFY  >  AUDIT  >  PERMIT
```

Reglas:

- SUSPEND domina todo: detiene autonomía del agente hasta intervención humana.
- DENY bloquea la acción; coexiste con AUDIT del mismo evento.
- ESCALATE pausa hasta checkpoint humano; no es bloqueo definitivo.
- MODIFY (reservado v0.3) permite con parámetros ajustados.
- AUDIT permite + registra; nunca por sí solo decide.
- PERMIT solo si nada de lo anterior aplica y `allow == true` en los paquetes correspondientes.

## 2. Estado actual: precedencia distribuida

### 2.1 Consultas Rego por paquete (lo que el harness ya hace)

`scripts/test-fixtures.mjs:71-83` consulta independientemente:

| Paquete | allow | deny | escalate | suspend | audit |
|---|---|---|---|---|---|
| `arhiax.nauta.base.autonomy` | ✓ | ✓ | — | ✓ | — |
| `arhiax.nauta.base.hic` | — | — | ✓ | — | — |
| `arhiax.nauta.co.res_1888_2025` | (via may_produce) | ✓ | — | — | — |
| `arhiax.nauta.co.habeas_data` | ✓ | ✓ | — | ✓ | — |
| `arhiax.nauta.co.decreto_4725_2005` | ✓ | ✓ | ✓ | — | ✓ |
| `arhiax.nauta.clinical.graus_2016` | — | — | — | — | — (deriva pattern_match, no outcomes) |

### 2.2 Quién calcula el outcome final hoy

Hoy nadie lo calcula como un único valor. El harness (`assertExpected`) y, mañana, el runtime ATK tienen que:

1. Recolectar los 11 valores devueltos por la query agregada.
2. Aplicar la precedencia en código de host.
3. Resolver empates y compatibilidad MODIFY+AUDIT manualmente.

Esto duplica conocimiento doctrinal en dos lugares (Rego y host) y crea riesgo de drift: una versión nueva del bundle que agregue un paquete con su propia regla `suspend` no se reflejará automáticamente en el runtime si éste no recompila el reductor de outcomes.

## 3. Propuesta: módulo `arhiax.nauta.base.outcome`

Archivo: `policy-bundle-nauta-colombia/base/outcome.rego` (paquete `arhiax.nauta.base.outcome`).

### 3.1 Forma del módulo (sin instalar; solo diseño)

```rego
package arhiax.nauta.base.outcome

import data.arhiax.nauta.base.autonomy
import data.arhiax.nauta.base.hic
import data.arhiax.nauta.co.res_1888_2025
import data.arhiax.nauta.co.habeas_data
import data.arhiax.nauta.co.decreto_4725_2005

# Agregadores por outcome ATK (unión sobre todos los paquetes).
all_suspend := union_msgs([autonomy.suspend, habeas_data.suspend])
all_deny    := union_msgs([autonomy.deny, res_1888_2025.deny, habeas_data.deny, decreto_4725_2005.deny])
all_escalate := union_msgs([hic.escalate, decreto_4725_2005.escalate])
all_audit    := union_records([decreto_4725_2005.audit])

# Reglas allow por paquete que aplican al input actual.
allow_autonomy := autonomy.allow
allow_habeas   := habeas_data.allow
allow_samd     := decreto_4725_2005.allow

# Outcome final aplicando precedencia.
outcome := "SUSPEND" if count(all_suspend) > 0
outcome := "DENY"    if { count(all_suspend) == 0; count(all_deny) > 0 }
outcome := "ESCALATE" if { count(all_suspend) == 0; count(all_deny) == 0; count(all_escalate) > 0 }
outcome := "AUDIT"   if {
  count(all_suspend) == 0
  count(all_deny) == 0
  count(all_escalate) == 0
  count(all_audit) > 0
  permit_predicates_satisfied
}
outcome := "PERMIT"  if {
  count(all_suspend) == 0
  count(all_deny) == 0
  count(all_escalate) == 0
  count(all_audit) == 0
  permit_predicates_satisfied
}

# Por defecto, si nada decide, fail-closed.
default outcome := "DENY"

permit_predicates_satisfied if {
  allow_autonomy
  allow_samd
  habeas_required_implies_allowed
}

habeas_required_implies_allowed if {
  input.data_category
  allow_habeas
}
habeas_required_implies_allowed if {
  not input.data_category
}

# Payload de respuesta completo para el runtime (incluye razones de cada paquete).
decision := {
  "outcome": outcome,
  "suspend": all_suspend,
  "deny": all_deny,
  "escalate": all_escalate,
  "audit": all_audit,
  "permit_predicates": {
    "autonomy": allow_autonomy,
    "samd": allow_samd,
    "habeas": habeas_required_implies_allowed
  }
}
```

(Sintaxis pseudo-Rego v1; `union_msgs` y `union_records` son helpers triviales sobre `array.concat` + dedupe. La forma final la decide Codex.)

### 3.2 Consumo desde el harness y el runtime

- Harness: `scripts/test-fixtures.mjs` reemplaza la query agregada por `data.arhiax.nauta.base.outcome.decision` y compara `expected_outcome.outcome` contra `decision.outcome`. El bucle `assertExpected` se reduce a una igualdad.
- Runtime ATK: el endpoint `/evaluate` recibe `decision` en una sola consulta y propaga `outcome`, mensajes de razón y stream de AUDIT sin reimplementar precedencia.

### 3.3 Default fail-closed

`default outcome := "DENY"` cubre tres modos de falla:
1. Algún paquete no carga (typo, build incompleto): `count(all_*) == 0` no se cumple porque la referencia falla.
2. `permit_predicates_satisfied` falsa: si `allow_*` no se evalúa true, no caemos a PERMIT por omisión.
3. Caso desconocido futuro: una regla nueva sin outcome explícito no escapa como PERMIT.

## 4. Riesgos de centralizar en Rego

| Riesgo | Mitigación |
|---|---|
| Una regla con bug en `outcome.rego` puede bloquear toda evaluación. | Pruebas dedicadas en `tests/outcome_test.rego` con matriz completa de combinaciones. |
| Imports rotos al agregar paquetes nuevos del bundle. | CI debe rechazar build si `outcome.rego` no importa todos los paquetes de outcomes; agregar lint que escanee `package` declarations. |
| Drift entre `runtime-contract.md` §3 y la implementación. | Generar la tabla de §3 desde tests del módulo, no a mano. |
| Overhead de evaluación al consolidar muchas reglas en una query. | OPA evalúa lazy; el costo dominante es el ledger lookup, no el agregador. Confirmable con benchmark. |
| Overlays institucionales que agreguen reglas `suspend`/`deny` quedan invisibles si no se importan aquí. | Convención: overlays viven bajo `arhiax.nauta.overlay.<ips>` y `outcome.rego` itera con `walk(data.arhiax.nauta.overlay)` para descubrirlos sin imports estáticos. |

## 5. Riesgos de NO centralizar (mantener distribuido)

- Cada cliente del bundle (runtime, harness, demos, futuros adaptadores Java/Python) reimplementa la precedencia.
- Cambios doctrinales (por ejemplo, intercambiar MODIFY y AUDIT) requieren updates sincronizados en cada cliente.
- El audit log puede divergir: un cliente podría reportar PERMIT cuando otro reporta AUDIT por leer subconjuntos distintos.

## 6. Recomendación

Adoptar el módulo `arhiax.nauta.base.outcome` con `decision` como única superficie pública de evaluación.

Pasos sugeridos (Codex decide ritmo):

1. Codex aprueba forma final del módulo. (Decisión arquitectónica.)
2. Codex (carril `policy-bundle-nauta-colombia/**/*.rego`) implementa el módulo y `tests/outcome_test.rego` con al menos los 9 fixtures actuales como casos.
3. Codex adapta `scripts/test-fixtures.mjs` para consultar `data.arhiax.nauta.base.outcome.decision`. Opus puede ayudar con la adaptación una vez Codex publique el módulo.
4. Cuando arranque el runtime ATK (Fase 2), el endpoint `/evaluate` consume `decision` directo. No reimplementa precedencia.
5. `runtime-contract.md` §3 cita el módulo como fuente normativa; la tabla deja de ser doctrina suelta.

## 7. Decisión pendiente para Codex

- ¿Convención de overlays institucionales? Si se acepta `walk(data.arhiax.nauta.overlay)`, hay que decidir el namespace (`overlay.<ips_id>` o `overlay.<ips_id>.<package_name>`) y prohibir paquetes overlay que no expongan exclusivamente reglas restrictivas (monotonicidad ya enunciada en P-03).
- ¿MODIFY entra ahora (v0.2.1) o se difiere a v0.3 como dice `manifest.json`? Si se difiere, `outcome.rego` puede omitir la rama `MODIFY` y `default outcome := "DENY"` cubre el caso.
- ¿Dónde vive `audit`? Hoy `decreto_4725_2005.audit` es el único productor; al centralizar, ¿el runtime sigue consumiendo el stream completo de `decision.audit` o se mueve a un canal separado (`data.arhiax.nauta.base.outcome.audit_stream`) para no bloquear el evaluador con I/O?

Sin estas decisiones, el módulo aún se puede entregar como v0.2.1-rc1 con scope reducido (sin MODIFY, sin overlays dinámicos, AUDIT en el mismo `decision`).
