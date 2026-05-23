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
  // Con el cambio arquitectónico P2.9, la precedencia completa
  // (SUSPEND > DENY > ESCALATE > MODIFY > AUDIT > PERMIT)
  // ahora se calcula en OPA mediante el módulo arhiax.nauta.base.outcome.
  // El runtime de Node.js se convierte en un pass-through de esta decisión.

  const outcomeData = policyResult.outcome || {};

  return {
    outcome: outcomeData.final_outcome || "DENY",
    precedence: PRECEDENCE,
    reasons: outcomeData.final_reasons || [],
    also_emitted: outcomeData.also_emitted || {},
    effects: outcomeData.effects || { audit: [] },
  };
}

export { PRECEDENCE };
