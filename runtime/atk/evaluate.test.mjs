import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluatePolicyResult, mapEvaluationError } from "./evaluate.mjs";
import { extractOpaValue } from "./policy-query.mjs";

describe("evaluatePolicyResult", () => {
  it("returns a runtime response envelope", () => {
    const response = evaluatePolicyResult(
      {
        autonomy_allow: true,
        samd_allow: true,
      },
      {
        evaluationId: "eval-test-001",
        startedAt: 10,
        finishedAt: 12.3456,
      },
    );

    assert.equal(response.evaluation_id, "eval-test-001");
    assert.equal(response.outcome, "PERMIT");
    assert.equal(response.latency_ms, 2.346);
    assert.deepEqual(response.effects.audit, []);
  });

  it("fails closed on runtime errors", () => {
    const response = mapEvaluationError(new Error("OPA timeout"), "eval-timeout-001");

    assert.equal(response.evaluation_id, "eval-timeout-001");
    assert.equal(response.outcome, "DENY");
    assert.match(response.reasons[0].message, /RUNTIME-FAIL-CLOSED/);
  });
});

describe("extractOpaValue", () => {
  it("extracts the first OPA expression value", () => {
    const value = extractOpaValue({
      result: [
        {
          expressions: [
            {
              value: { autonomy_allow: true },
            },
          ],
        },
      ],
    });

    assert.deepEqual(value, { autonomy_allow: true });
  });

  it("returns an empty object for empty OPA responses", () => {
    assert.deepEqual(extractOpaValue({}), {});
  });
});
