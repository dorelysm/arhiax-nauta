import { createHash, createHmac } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// HMAC-SHA256 ledger that materialises TR-032/CT-07/P-05: atestación precede
// acción. Each action_id is appended exactly once; the record is then visible
// to OPA via data.runtime.ledger.records so rule AUT-03 can verify it.
//
// Contract reference: policy-bundle-nauta-colombia/docs/runtime-contract.md §1.1
// Decision reference: docs/RUNTIME_API_DECISIONS.md D-4 (ledger writes are
// synchronous; only the external audit stream is async).

const DEFAULT_LEDGER_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  ".ledger",
  "ledger.jsonl",
);

// Development-only key. Production MUST supply ARHIAX_LEDGER_HMAC_KEY via
// the secret manager (Vault, AWS Secrets Manager, etc). The runtime refuses
// to boot in NODE_ENV=production if the env var is missing.
const DEV_HMAC_KEY = "dev-hmac-key-not-for-production";

function resolveKey() {
  const fromEnv = process.env.ARHIAX_LEDGER_HMAC_KEY;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "ARHIAX_LEDGER_HMAC_KEY is required in production. Refusing to use dev key.",
    );
  }
  return DEV_HMAC_KEY;
}

export function hashPayload(payload) {
  const serialized = typeof payload === "string" ? payload : JSON.stringify(payload);
  return createHash("sha256").update(serialized).digest("hex");
}

function computeSignature(record, key) {
  // Sign the canonical tuple, not the whole record (so we can later add
  // observability fields without invalidating signatures).
  const canonical = [
    record.action_id,
    record.actor_id,
    record.action_type,
    record.payload_hash,
    record.timestamp,
  ].join("|");
  return createHmac("sha256", key).update(canonical).digest("hex");
}

export class Ledger {
  constructor({ path = DEFAULT_LEDGER_PATH, key = resolveKey() } = {}) {
    this.path = path;
    this.key = key;
    mkdirSync(dirname(this.path), { recursive: true });
  }

  recordAction({ action_id, actor_id, action_type, payload, timestamp }) {
    if (!action_id) throw new Error("ledger.recordAction: action_id is required");
    if (!actor_id) throw new Error("ledger.recordAction: actor_id is required");
    if (!action_type) throw new Error("ledger.recordAction: action_type is required");
    if (payload === undefined) throw new Error("ledger.recordAction: payload is required");

    const ts = timestamp ?? new Date().toISOString();
    const payload_hash = hashPayload(payload);
    const partial = { action_id, actor_id, action_type, payload_hash, timestamp: ts };
    const hmac_signature = computeSignature(partial, this.key);

    const record = {
      ...partial,
      hmac_signature,
      verified: true,
      hmac_signature_valid: true,
    };

    appendFileSync(this.path, `${JSON.stringify(record)}\n`, { encoding: "utf8" });
    return record;
  }

  readAll() {
    if (!existsSync(this.path)) return [];
    const raw = readFileSync(this.path, "utf8");
    return raw
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line));
  }

  verify(record) {
    if (!record || typeof record !== "object") return false;
    const expected = computeSignature(record, this.key);
    return expected === record.hmac_signature;
  }

  // OPA expects data.runtime.ledger.records as a map keyed by action_id.
  // Later entries for the same action_id win (idempotent retries) but we
  // also flip hmac_signature_valid on the in-memory copy so the caller
  // can react to tampering rather than serving silently invalid records.
  asOpaData() {
    const records = {};
    for (const entry of this.readAll()) {
      const valid = this.verify(entry);
      records[entry.action_id] = { ...entry, hmac_signature_valid: valid, verified: valid };
    }
    return { records };
  }
}
