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
  // Si viene con este nuevo formato pre-computado por OPA, lo consumimos directamente.
  if (policyResult && policyResult.outcome && typeof policyResult.outcome === "object") {
    const outcomeData = policyResult.outcome;
    return {
      outcome: outcomeData.final_outcome || "DENY",
      precedence: PRECEDENCE,
      reasons: outcomeData.final_reasons || [],
      also_emitted: outcomeData.also_emitted || {},
      effects: outcomeData.effects || { audit: [] },
    };
  }

  // De lo contrario, aplicar la lógica tradicional en JavaScript
  // para retrocompatibilidad con la suite de pruebas unitarias heredadas.
  const buckets = {
    SUSPEND: collect(policyResult, ["autonomy_suspend", "habeas_suspend"]),
    DENY: collect(policyResult, [
      "autonomy_deny",
      "samd_deny",
      "habeas_deny",
      "res_deny",
    ]),
    ESCALATE: collect(policyResult, ["hic_escalate", "samd_escalate"]),
    MODIFY: collect(policyResult, ["all_modify"]),
    AUDIT: collect(policyResult, [
      "samd_audit",
      "res_audit",
      "habeas_audit",
      "graus_audit",
    ]),
    PERMIT:
      policyResult.autonomy_allow === true ||
      policyResult.samd_allow === true ||
      policyResult.habeas_allow === true
        ? [{ source: "allow", message: "At least one policy package allowed the action." }]
        : [],
  };

  let appliedOutcome = "DENY";
  let appliedReasons = [];

  // 1. Revisar si hay estados de bloqueo o escalación de mayor precedencia
  const blockingOutcomes = ["SUSPEND", "DENY", "ESCALATE", "MODIFY"];
  let foundBlocking = false;

  for (const outcome of blockingOutcomes) {
    if (buckets[outcome] && buckets[outcome].length > 0) {
      appliedOutcome = outcome;
      appliedReasons = buckets[outcome];
      foundBlocking = true;
      break;
    }
  }

  // 2. Si no hay bloqueos, pero sí hay allow explícito, es PERMIT
  if (!foundBlocking && buckets.PERMIT.length > 0) {
    appliedOutcome = "PERMIT";
    appliedReasons = buckets.PERMIT;
  }
  // 3. Si no hay bloqueos, ni PERMIT, pero sí hay auditorías, es AUDIT
  else if (!foundBlocking && buckets.AUDIT.length > 0) {
    appliedOutcome = "AUDIT";
    appliedReasons = buckets.AUDIT;
  }

  const alsoEmitted = {};
  for (const outcome of PRECEDENCE) {
    if (outcome !== appliedOutcome && outcome !== "AUDIT" && buckets[outcome] && buckets[outcome].length > 0) {
      alsoEmitted[outcome] = buckets[outcome];
    }
  }

  return {
    outcome: appliedOutcome,
    precedence: PRECEDENCE,
    reasons: appliedReasons,
    also_emitted: alsoEmitted,
    effects: {
      audit: buckets.AUDIT,
    },
  };
}

export { PRECEDENCE };
