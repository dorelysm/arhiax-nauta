const PRECEDENCE = ["SUSPEND", "DENY", "ESCALATE", "MODIFY", "AUDIT", "PERMIT"];

function entries(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return Object.keys(value);
  return value === true ? ["true"] : [];
}

function collect(policyResult, fields) {
  return fields.flatMap((field) =>
    entries(policyResult[field]).map((message) => ({
      source: field,
      message,
    })),
  );
}

export function resolveOutcome(policyResult) {
  const buckets = {
    SUSPEND: collect(policyResult, ["autonomy_suspend", "habeas_suspend"]),
    DENY: collect(policyResult, ["autonomy_deny", "res_deny", "habeas_deny", "samd_deny"]),
    ESCALATE: collect(policyResult, ["hic_escalate", "samd_escalate"]),
    MODIFY: collect(policyResult, ["modify"]),
    AUDIT: collect(policyResult, ["audit", "samd_audit", "habeas_audit", "res_audit", "graus_audit"]),
    PERMIT:
      policyResult.autonomy_allow === true ||
      policyResult.samd_allow === true ||
      policyResult.habeas_allow === true
        ? [{ source: "allow", message: "At least one policy package allowed the action." }]
        : [],
  };

  // Precedence: SUSPEND > DENY > ESCALATE > MODIFY > PERMIT (when explicit
  // allow) > AUDIT (audit alone, no allow) > DENY (fail-closed).
  // AUDIT outranks PERMIT only when there is no explicit allow signal; per
  // RUNTIME_API_CONTRACT.md §3 ("Permitir, pero escribir registros"), audit
  // records co-exist with PERMIT and live in effects.audit, not as the
  // user-facing outcome.
  let outcome;
  if (buckets.SUSPEND.length > 0) outcome = "SUSPEND";
  else if (buckets.DENY.length > 0) outcome = "DENY";
  else if (buckets.ESCALATE.length > 0) outcome = "ESCALATE";
  else if (buckets.MODIFY.length > 0) outcome = "MODIFY";
  else if (buckets.PERMIT.length > 0) outcome = "PERMIT";
  else if (buckets.AUDIT.length > 0) outcome = "AUDIT";
  else outcome = "DENY";

  const also_emitted = {};
  for (const candidate of PRECEDENCE) {
    if (candidate === outcome) continue;
    if (candidate === "AUDIT") continue;
    if (buckets[candidate].length > 0) {
      also_emitted[candidate] = buckets[candidate];
    }
  }

  return {
    outcome,
    precedence: PRECEDENCE,
    reasons: buckets[outcome],
    also_emitted,
    effects: {
      audit: buckets.AUDIT,
    },
  };
}

export { PRECEDENCE };
