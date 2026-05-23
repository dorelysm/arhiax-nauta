import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { AuditStream } from "./audit-stream.mjs";

function memoryTransport({ failNext = 0 } = {}) {
  const records = [];
  let remainingFailures = failNext;
  return {
    records,
    async send(record) {
      if (remainingFailures > 0) {
        remainingFailures -= 1;
        throw new Error("transport temporary failure");
      }
      records.push(record);
    },
  };
}

function envelope({ evaluationId = "01j0cxy", auditCount = 2 } = {}) {
  return {
    evaluation_id: evaluationId,
    outcome: "PERMIT",
    evaluated_at: "2026-05-23T10:15:00-05:00",
    policy_bundle_version: "0.2.0",
    effects: {
      audit: Array.from({ length: auditCount }, (_, i) => ({
        source: "samd_audit",
        message: `boundary event ${i}`,
      })),
    },
  };
}

describe("AuditStream", () => {
  let dir;
  let stream;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nauta-audit-"));
  });

  afterEach(async () => {
    if (stream) {
      await stream.stop();
      stream = null;
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it("appends one WAL line per audit entry in the envelope", async () => {
    const transport = memoryTransport();
    stream = new AuditStream({ walDir: dir, transport, retryMs: 1 });
    const written = stream.recordEnvelope(envelope({ auditCount: 3 }));
    assert.equal(written, 3);
    const walContent = readFileSync(join(dir, "wal.jsonl"), "utf8");
    assert.equal(walContent.trim().split("\n").length, 3);
  });

  it("drains records through the transport via flush()", async () => {
    const transport = memoryTransport();
    stream = new AuditStream({ walDir: dir, transport, retryMs: 1 });
    stream.recordEnvelope(envelope({ evaluationId: "eval-1", auditCount: 2 }));
    await stream.flush();
    assert.equal(transport.records.length, 2);
    assert.equal(transport.records[0].evaluation_id, "eval-1");
    assert.equal(transport.records[0].audit_index, 0);
    assert.equal(transport.records[1].audit_index, 1);
  });

  it("retries on transient transport failure and eventually drains", async () => {
    const transport = memoryTransport({ failNext: 3 });
    stream = new AuditStream({ walDir: dir, transport, retryMs: 1, maxBackoffMs: 10 });
    stream.recordEnvelope(envelope({ auditCount: 1 }));
    await stream.flush();
    assert.equal(transport.records.length, 1);
  });

  it("survives crash: a fresh AuditStream over the same walDir re-drains pending records", async () => {
    const transport1 = memoryTransport({ failNext: 100 });
    stream = new AuditStream({ walDir: dir, transport: transport1, retryMs: 1, maxBackoffMs: 5 });
    stream.recordEnvelope(envelope({ evaluationId: "crash-1", auditCount: 2 }));
    // Give the worker a tick to attempt and fail once.
    await new Promise((r) => setTimeout(r, 20));
    await stream.stop();
    assert.equal(transport1.records.length, 0);

    const transport2 = memoryTransport();
    stream = new AuditStream({ walDir: dir, transport: transport2, retryMs: 1 });
    await stream.flush();
    assert.equal(transport2.records.length, 2);
    assert.equal(transport2.records[0].evaluation_id, "crash-1");
  });

  it("reports metrics on pending vs drained records", async () => {
    const transport = memoryTransport();
    stream = new AuditStream({ walDir: dir, transport, retryMs: 1 });
    stream.recordEnvelope(envelope({ auditCount: 4 }));
    const before = stream.metrics();
    assert.equal(before.wal_records_total, 4);
    assert.ok(before.wal_size_bytes > 0);

    await stream.flush();
    const after = stream.metrics();
    assert.equal(after.wal_records_drained, 4);
    assert.equal(after.wal_records_pending, 0);
  });

  it("returns 0 and writes nothing for envelopes without audit entries", () => {
    const transport = memoryTransport();
    stream = new AuditStream({ walDir: dir, transport, retryMs: 1 });
    const written = stream.recordEnvelope({ evaluation_id: "x", outcome: "DENY", effects: { audit: [] } });
    assert.equal(written, 0);
    assert.equal(existsSync(join(dir, "wal.jsonl")), false);
  });
});
