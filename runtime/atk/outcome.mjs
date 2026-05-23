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
  const reasons = {
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

  const outcome = PRECEDENCE.find((candidate) => reasons[candidate].length > 0) || "DENY";

  return {
    outcome,
    precedence: PRECEDENCE,
    reasons: reasons[outcome],
    effects: {
      audit: reasons.AUDIT,
    },
  };
}

export { PRECEDENCE };
