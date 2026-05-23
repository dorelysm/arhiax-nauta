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

  it("exposes lower-precedence buckets that also fired in also_emitted", () => {
    const result = resolveOutcome({
      autonomy_allow: true,
      autonomy_deny: { "deny message": true },
      hic_escalate: { "escalate message": true },
      habeas_suspend: { "suspend message": true },
    });

    assert.equal(result.outcome, "SUSPEND");
    assert.ok(result.also_emitted.DENY, "DENY bucket should appear in also_emitted");
    assert.equal(result.also_emitted.DENY[0].message, "deny message");
    assert.ok(result.also_emitted.ESCALATE, "ESCALATE bucket should appear in also_emitted");
    assert.equal(result.also_emitted.PERMIT[0].source, "allow");
  });

  it("omits the applied outcome from also_emitted", () => {
    const result = resolveOutcome({
      autonomy_deny: { "deny message": true },
    });

    assert.equal(result.outcome, "DENY");
    assert.equal(result.also_emitted.DENY, undefined);
  });

  it("never lists AUDIT in also_emitted; AUDIT lives only in effects.audit", () => {
    const result = resolveOutcome({
      autonomy_deny: { "deny message": true },
      samd_audit: { "boundary event": true },
    });

    assert.equal(result.outcome, "DENY");
    assert.equal(result.also_emitted.AUDIT, undefined);
    assert.equal(result.effects.audit[0].message, "boundary event");
  });
});
