package arhiax.nauta.base.outcome

import future.keywords.in
import future.keywords.if

import data.arhiax.nauta.base.autonomy
import data.arhiax.nauta.base.hic
import data.arhiax.nauta.co.habeas_data
import data.arhiax.nauta.co.res_1888_2025
import data.arhiax.nauta.co.decreto_4725_2005
import data.arhiax.nauta.clinical.graus_2016

map_reasons(src, msgs) := [ {"source": src, "message": msg} | msg := msgs[_] ]

all_suspend := array.concat(
	map_reasons("autonomy_suspend", autonomy.suspend),
	map_reasons("habeas_suspend", habeas_data.suspend)
)

all_deny := array.concat(
	array.concat(map_reasons("autonomy_deny", autonomy.deny), map_reasons("res_deny", res_1888_2025.deny)),
	array.concat(map_reasons("habeas_deny", habeas_data.deny), map_reasons("samd_deny", decreto_4725_2005.deny))
)

all_escalate := array.concat(
	map_reasons("hic_escalate", hic.escalate),
	map_reasons("samd_escalate", decreto_4725_2005.escalate)
)

all_modify := []

all_audit := array.concat(
	array.concat(map_reasons("samd_audit", decreto_4725_2005.audit), map_reasons("res_audit", res_1888_2025.audit)),
	array.concat(map_reasons("habeas_audit", habeas_data.audit), map_reasons("graus_audit", graus_2016.audit))
)

is_allowed if autonomy.allow
is_allowed if decreto_4725_2005.allow
is_allowed if habeas_data.allow
default is_allowed := false

final_outcome := "SUSPEND" if count(all_suspend) > 0
else := "DENY" if count(all_deny) > 0
else := "ESCALATE" if count(all_escalate) > 0
else := "MODIFY" if count(all_modify) > 0
else := "PERMIT" if is_allowed
else := "AUDIT" if count(all_audit) > 0
else := "DENY"

default final_reasons := []

permit_reason := [{"source": "allow", "message": "At least one policy package allowed the action."}]

final_reasons := all_suspend if final_outcome == "SUSPEND"
else := all_deny if final_outcome == "DENY"
else := all_escalate if final_outcome == "ESCALATE"
else := all_modify if final_outcome == "MODIFY"
else := permit_reason if final_outcome == "PERMIT"
else := all_audit if final_outcome == "AUDIT"

also_emitted := {
    k: v |
    some k, v in {
        "SUSPEND": all_suspend,
        "DENY": all_deny,
        "ESCALATE": all_escalate,
        "MODIFY": all_modify
    }
    k != final_outcome
    count(v) > 0
}

effects := {
    "audit": all_audit
}
