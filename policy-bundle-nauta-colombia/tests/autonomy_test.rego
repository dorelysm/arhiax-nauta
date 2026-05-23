# ============================================================================
# Tests · ARHIAX Nauta · Base Autonomy v0.2
# ============================================================================
package arhiax.nauta.base.autonomy_test

import data.arhiax.nauta.base.autonomy

# ---- PERMIT path: válido + ledger pre-registrado ----
test_permit_a3_with_verified_ledger if {
	autonomy.allow with input as {
		"autonomy_level": "A3",
		"action_id": "act_001",
		"target_role": "clinical-navigator",
	}
		with data.runtime.ledger.records as {"act_001": {"verified": true, "hmac_signature_valid": true, "timestamp": "2026-04-20T10:00:00Z"}}
}

# ---- DENY: routing a treating-physician ----
test_deny_routing_treating_physician if {
	autonomy.deny[_] with input as {
		"autonomy_level": "A3",
		"action_id": "act_002",
		"target_role": "treating-physician",
	}
		with data.runtime.ledger.records as {"act_002": {"verified": true, "hmac_signature_valid": true, "timestamp": "2026-04-20T10:00:00Z"}}
}

# ---- DENY: sin ledger record ----
test_deny_missing_ledger_record if {
	autonomy.deny[_] with input as {
		"autonomy_level": "A3",
		"action_id": "act_003",
		"target_role": "clinical-navigator",
	}
		with data.runtime.ledger.records as {}
}

# ---- DENY: HMAC signature inválida ----
test_deny_invalid_hmac if {
	autonomy.deny[_] with input as {
		"autonomy_level": "A3",
		"action_id": "act_004",
		"target_role": "clinical-navigator",
	}
		with data.runtime.ledger.records as {"act_004": {"verified": true, "hmac_signature_valid": false, "timestamp": "2026-04-20T10:00:00Z"}}
}

# ---- DENY: A4 sin firma DPO ----
test_deny_a4_without_dpo_signature if {
	not autonomy.allow with input as {
		"autonomy_level": "A4",
		"action_id": "act_a4_001",
		"target_role": "clinical-navigator",
		"institution": {"a4_enabled": true, "a4_signed_by_dpo": false},
	}
		with data.runtime.ledger.records as {"act_a4_001": {"verified": true, "hmac_signature_valid": true, "timestamp": "2026-04-20T10:00:00Z"}}
}

# ---- PERMIT: A4 con doble firma ----
test_permit_a4_with_full_optin if {
	autonomy.allow with input as {
		"autonomy_level": "A4",
		"action_id": "act_a4_002",
		"target_role": "clinical-navigator",
		"institution": {"a4_enabled": true, "a4_signed_by_dpo": true},
	}
		with data.runtime.ledger.records as {"act_a4_002": {"verified": true, "hmac_signature_valid": true, "timestamp": "2026-04-20T10:00:00Z"}}
}

# ---- SUSPEND: overlay no calibrado + divergencia crítica ----
test_suspend_uncalibrated_critical if {
	autonomy.suspend[_] with input as {
		"autonomy_level": "A3",
		"action_id": "act_susp_001",
		"target_role": "clinical-navigator",
		"institution": {"id": "ips_test", "overlay_status": "uncalibrated"},
		"divergence_severity": "critical",
	}
		with data.runtime.ledger.records as {"act_susp_001": {"verified": true, "hmac_signature_valid": true, "timestamp": "2026-04-20T10:00:00Z"}}
}

# ---- SUSPEND: cuota de rechazos superada ----
test_suspend_rejection_quota_exceeded if {
	autonomy.suspend[_] with input as {
		"autonomy_level": "A3",
		"action_id": "act_susp_002",
		"target_role": "clinical-navigator",
		"institution": {"id": "ips_test"},
		"divergence_severity": "warning",
	}
		with data.runtime.ledger.records as {"act_susp_002": {"verified": true, "hmac_signature_valid": true, "timestamp": "2026-04-20T10:00:00Z"}}
		with data.runtime.feedback as {"ips_test": {"rejected_30d": 10}}
		with data.thresholds.institutional as {"ips_test": {"max_consecutive_rejections": 5}}
}
