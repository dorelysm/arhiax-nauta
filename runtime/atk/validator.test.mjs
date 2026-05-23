import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { validateEvaluateRequest, validateEvaluateResponse } from "./validator.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FIXTURE_DIR = join(REPO_ROOT, "fixtures", "evaluate");

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function withRealHash(input) {
  if (typeof input.patient_id !== "string") return input;
  return { ...input, patient_id_hash: sha256Hex(input.patient_id) };
}

describe("validateEvaluateRequest (ajv)", () => {
  it("rejects unknown top-level fields", () => {
    const errors = validateEvaluateRequest({ totally_made_up: 1 });
    assert.ok(errors.length > 0);
    assert.ok(errors.some((e) => e.code === "unknown_field"));
  });

  it("rejects an invalid action_category", () => {
    const errors = validateEvaluateRequest({
      action_id: "a",
      action_category: "fly_to_moon",
      autonomy_level: "A3",
      target_role: "x",
      timestamp: "2026-05-23T10:00:00Z",
      patient_id: "p",
      patient_id_hash: sha256Hex("p"),
      requester: { role: "r", institution_id: "i", institution_type: "t" },
      institution: { id: "i", authorization_status: "active", overlay_status: "calibrated" },
      transport: { tls_version: "1.3" },
    });
    assert.ok(errors.some((e) => e.code === "enum"));
  });

  it("enforces data_access conditional fields", () => {
    const errors = validateEvaluateRequest({
      action_id: "a",
      action_category: "data_access",
      autonomy_level: "A3",
      target_role: "x",
      timestamp: "2026-05-23T10:00:00Z",
      patient_id: "p",
      patient_id_hash: sha256Hex("p"),
      requester: { role: "r", institution_id: "i", institution_type: "t" },
      institution: { id: "i", authorization_status: "active", overlay_status: "calibrated" },
      transport: { tls_version: "1.3" },
    });
    const missing = errors.map((e) => e.field);
    assert.ok(missing.includes("access_timestamp"));
    assert.ok(missing.includes("access_purpose"));
    assert.ok(missing.includes("data_category"));
  });

  it("accepts every shipped fixture (after recomputing patient_id_hash)", () => {
    const files = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith(".json") && f !== "README.md");
    for (const file of files) {
      if (file === "README.md") continue;
      const fixture = JSON.parse(readFileSync(join(FIXTURE_DIR, file), "utf8"));
      const input = withRealHash(fixture.input);
      const errors = validateEvaluateRequest(input);
      assert.deepEqual(errors, [], `${file} should pass schema: ${JSON.stringify(errors)}`);
    }
  });
});

describe("validateEvaluateResponse (ajv)", () => {
  it("accepts a well-formed envelope", () => {
    const errors = validateEvaluateResponse({
      evaluation_id: "019e565a-e043-7768-a066-f8654fb4b761",
      outcome: "PERMIT",
      precedence: ["SUSPEND", "DENY", "ESCALATE", "MODIFY", "AUDIT", "PERMIT"],
      reasons: [{ source: "allow", message: "ok" }],
      also_emitted: {},
      effects: { audit: [] },
      latency_ms: 12,
      evaluated_at: "2026-05-23T10:15:00.087-05:00",
      policy_bundle_version: "0.2.0",
      fhir_validation: { performed: false, report_uri: null, issues_summary: null },
    });
    assert.deepEqual(errors, []);
  });

  it("rejects a non-UUIDv7 evaluation_id", () => {
    const errors = validateEvaluateResponse({
      evaluation_id: "00000000-0000-4000-8000-000000000000",
      outcome: "PERMIT",
      precedence: ["PERMIT"],
      reasons: [],
      also_emitted: {},
      effects: { audit: [] },
      latency_ms: 1,
      evaluated_at: "now",
      policy_bundle_version: "0.2.0",
    });
    assert.ok(errors.some((e) => e.code === "pattern"));
  });
});
