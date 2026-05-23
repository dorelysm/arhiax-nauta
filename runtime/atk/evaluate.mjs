import { performance } from "node:perf_hooks";
import { resolveOutcome } from "./outcome.mjs";
import { uuidv7 } from "./evaluation-id.mjs";

export function evaluatePolicyResult(policyResult, options = {}) {
  const startedAt = options.startedAt ?? performance.now();
  const decision = resolveOutcome(policyResult);
  const finishedAt = options.finishedAt ?? performance.now();

  return {
    evaluation_id: options.evaluationId ?? uuidv7(),
    outcome: decision.outcome,
    reasons: decision.reasons,
    also_emitted: decision.also_emitted,
    effects: decision.effects,
    latency_ms: Number((finishedAt - startedAt).toFixed(3)),
    policy_result: policyResult,
  };
}

export function mapEvaluationError(error, evaluationId = uuidv7()) {
  const message = error instanceof Error ? error.message : String(error);

  return {
    evaluation_id: evaluationId,
    outcome: "DENY",
    reasons: [
      {
        source: "runtime",
        message: `DENY · RUNTIME-FAIL-CLOSED: ${message}`,
      },
    ],
    also_emitted: {},
    effects: {
      audit: [],
    },
    latency_ms: 0,
    policy_result: {},
  };
}
