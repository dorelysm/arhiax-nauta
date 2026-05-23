import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { Ledger, hashPayload } from "./ledger.mjs";

function freshLedger() {
  const dir = mkdtempSync(join(tmpdir(), "nauta-ledger-"));
  const path = join(dir, "ledger.jsonl");
  return {
    dir,
    ledger: new Ledger({ path, key: "test-key-123" }),
  };
}

describe("Ledger", () => {
  let ctx;

  beforeEach(() => {
    ctx = freshLedger();
  });

  afterEach(() => {
    rmSync(ctx.dir, { recursive: true, force: true });
  });

  it("records an action with HMAC signature and idempotent payload hash", () => {
    const record = ctx.ledger.recordAction({
      action_id: "act-1",
      actor_id: "nauta-agent-001",
      action_type: "produce_composition",
      payload: { hello: "world" },
      timestamp: "2026-05-23T10:00:00-05:00",
    });

    assert.equal(record.action_id, "act-1");
    assert.equal(record.payload_hash, hashPayload({ hello: "world" }));
    assert.match(record.hmac_signature, /^[0-9a-f]{64}$/);
    assert.equal(record.verified, true);
    assert.equal(record.hmac_signature_valid, true);
  });

  it("verifies its own records and rejects tampered ones", () => {
    const record = ctx.ledger.recordAction({
      action_id: "act-2",
      actor_id: "nauta-agent-001",
      action_type: "data_access",
      payload: { x: 1 },
      timestamp: "2026-05-23T10:00:00-05:00",
    });

    assert.equal(ctx.ledger.verify(record), true);

    const tampered = { ...record, action_type: "transfer_graph" };
    assert.equal(ctx.ledger.verify(tampered), false);
  });

  it("rejects records signed by a different key", () => {
    const original = ctx.ledger.recordAction({
      action_id: "act-3",
      actor_id: "nauta-agent-001",
      action_type: "emit_output",
      payload: { z: 9 },
      timestamp: "2026-05-23T10:00:00-05:00",
    });

    const other = new Ledger({ path: ctx.ledger.path, key: "rotated-key-456" });
    assert.equal(other.verify(original), false);
  });

  it("exposes a data.runtime.ledger.records map for OPA", () => {
    ctx.ledger.recordAction({
      action_id: "act-a",
      actor_id: "nauta-agent-001",
      action_type: "produce_composition",
      payload: { a: 1 },
      timestamp: "2026-05-23T10:00:00-05:00",
    });
    ctx.ledger.recordAction({
      action_id: "act-b",
      actor_id: "nauta-agent-001",
      action_type: "data_access",
      payload: { b: 2 },
      timestamp: "2026-05-23T10:01:00-05:00",
    });

    const data = ctx.ledger.asOpaData();
    assert.deepEqual(Object.keys(data.records).sort(), ["act-a", "act-b"]);
    assert.equal(data.records["act-a"].hmac_signature_valid, true);
    assert.equal(data.records["act-a"].verified, true);
  });

  it("marks asOpaData entries invalid when the file is tampered with", async () => {
    ctx.ledger.recordAction({
      action_id: "act-tamper",
      actor_id: "nauta-agent-001",
      action_type: "produce_composition",
      payload: { ok: true },
      timestamp: "2026-05-23T10:00:00-05:00",
    });

    const { readFileSync, writeFileSync } = await import("node:fs");
    const raw = readFileSync(ctx.ledger.path, "utf8");
    const tampered = raw.replace("produce_composition", "transfer_graph");
    writeFileSync(ctx.ledger.path, tampered);

    const data = ctx.ledger.asOpaData();
    assert.equal(data.records["act-tamper"].hmac_signature_valid, false);
    assert.equal(data.records["act-tamper"].verified, false);
  });

  it("throws on missing required fields", () => {
    assert.throws(
      () =>
        ctx.ledger.recordAction({
          actor_id: "x",
          action_type: "y",
          payload: {},
        }),
      /action_id is required/,
    );
  });
});
