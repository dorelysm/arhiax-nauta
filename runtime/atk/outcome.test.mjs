import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PRECEDENCE, resolveOutcome } from "./outcome.mjs";

describe("resolveOutcome", () => {
  it("uses contractual precedence", () => {
    assert.deepEqual(PRECEDENCE, ["SUSPEND", "DENY", "ESCALATE", "MODIFY", "AUDIT", "PERMIT"]);
  });

  it("chooses SUSPEND over DENY and PERMIT", () => {
    const result = resolveOutcome({
      autonomy_allow: true,
      autonomy_deny: { "deny message": true },
      habeas_suspend: { "revoked consent": true },
    });

    assert.equal(result.outcome, "SUSPEND");
    assert.equal(result.reasons[0].message, "revoked consent");
  });

  it("chooses DENY over ESCALATE", () => {
    const result = resolveOutcome({
      samd_deny: { "forbidden output": true },
      hic_escalate: { "human checkpoint": true },
    });

    assert.equal(result.outcome, "DENY");
  });

  it("chooses AUDIT over PERMIT and keeps audit details", () => {
    const result = resolveOutcome({
      autonomy_allow: true,
      samd_audit: { "boundary event": true },
    });

    assert.equal(result.outcome, "AUDIT");
    assert.equal(result.effects.audit[0].message, "boundary event");
  });

  it("fails closed when no package emits allow or another outcome", () => {
    const result = resolveOutcome({});

    assert.equal(result.outcome, "DENY");
    assert.deepEqual(result.reasons, []);
  });
});
