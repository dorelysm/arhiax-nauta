import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Async audit stream with a local write-ahead log (D-4).
//
// Doctrine: the ledger HMAC is the structural attestation and stays
// synchronous (runtime/atk/ledger.mjs). The audit stream is observability:
// records emitted by Rego `audit[*]` rules are persisted to a WAL on disk
// before the HTTP response is sent (so a crash never loses an audit), and
// a background worker drains them to the external transport (Kafka,
// Pub/Sub, SIEM, etc.).
//
// File layout under walDir:
//   - wal.jsonl   append-only JSONL, one record per emitted audit
//   - offset      plain text, the count of records already drained
//
// Transport contract: object with `async send(record)` (throws on failure).
// Default transport appends to runtime/atk/.audit-stream/sink.jsonl.

const DEFAULT_WAL_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  ".audit-wal",
);
const DEFAULT_SINK_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  ".audit-stream",
  "sink.jsonl",
);

export function createFileTransport(path = DEFAULT_SINK_PATH) {
  mkdirSync(dirname(path), { recursive: true });
  return {
    async send(record) {
      appendFileSync(path, `${JSON.stringify(record)}\n`, "utf8");
    },
    path,
  };
}

function readOffset(offsetPath) {
  if (!existsSync(offsetPath)) return 0;
  const text = readFileSync(offsetPath, "utf8").trim();
  const n = Number.parseInt(text, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function writeOffset(offsetPath, offset) {
  writeFileSync(offsetPath, `${offset}\n`, "utf8");
}

function readWalLines(walPath) {
  if (!existsSync(walPath)) return [];
  return readFileSync(walPath, "utf8")
    .split("\n")
    .filter((line) => line.length > 0);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export class AuditStream {
  constructor({
    walDir = DEFAULT_WAL_DIR,
    transport = createFileTransport(),
    retryMs = 200,
    maxBackoffMs = 5000,
  } = {}) {
    this.walDir = walDir;
    this.walPath = join(walDir, "wal.jsonl");
    this.offsetPath = join(walDir, "offset");
    this.transport = transport;
    this.retryMs = retryMs;
    this.maxBackoffMs = maxBackoffMs;
    this.draining = null;
    this.stopped = false;
    mkdirSync(walDir, { recursive: true });
  }

  // Build the per-evaluation audit records from an evaluate envelope.
  static envelopeToRecords(envelope) {
    if (!envelope || !envelope.effects?.audit?.length) return [];
    return envelope.effects.audit.map((entry, index) => ({
      evaluation_id: envelope.evaluation_id,
      audit_index: index,
      outcome: envelope.outcome,
      evaluated_at: envelope.evaluated_at,
      source: entry.source,
      message: entry.message,
      rule: entry.rule,
      record: entry.record,
      policy_bundle_version: envelope.policy_bundle_version,
    }));
  }

  // Synchronous WAL append. Throws if disk write fails (caller maps to 503
  // per docs/RUNTIME_API_CONTRACT.md §4).
  recordEnvelope(envelope) {
    const records = AuditStream.envelopeToRecords(envelope);
    if (records.length === 0) return 0;
    const payload = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
    appendFileSync(this.walPath, payload, "utf8");
    this.scheduleDrain();
    return records.length;
  }

  scheduleDrain() {
    if (this.draining || this.stopped) return;
    this.draining = this.drain().finally(() => {
      this.draining = null;
    });
  }

  async drain() {
    let backoff = this.retryMs;
    while (!this.stopped) {
      const lines = readWalLines(this.walPath);
      let offset = readOffset(this.offsetPath);
      if (offset >= lines.length) return;

      const line = lines[offset];
      try {
        await this.transport.send(JSON.parse(line));
        offset += 1;
        writeOffset(this.offsetPath, offset);
        backoff = this.retryMs;
      } catch (err) {
        // Transport failed; keep record in WAL and retry with backoff.
        await sleep(backoff);
        backoff = Math.min(backoff * 2, this.maxBackoffMs);
      }
    }
  }

  async flush() {
    while (true) {
      const lines = readWalLines(this.walPath);
      const offset = readOffset(this.offsetPath);
      if (offset >= lines.length && !this.draining) return;
      if (!this.draining) this.scheduleDrain();
      await this.draining;
    }
  }

  async stop() {
    this.stopped = true;
    if (this.draining) {
      try {
        await this.draining;
      } catch {
        // swallow; stop is best-effort
      }
    }
  }

  metrics() {
    const lines = readWalLines(this.walPath);
    const offset = readOffset(this.offsetPath);
    const walSize = existsSync(this.walPath) ? statSync(this.walPath).size : 0;
    return {
      wal_records_total: lines.length,
      wal_records_drained: offset,
      wal_records_pending: Math.max(0, lines.length - offset),
      wal_size_bytes: walSize,
    };
  }
}
