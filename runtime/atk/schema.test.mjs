import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { validateEvaluateRequest } from "./schema.mjs";

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function baseRequest() {
  const patientId = "pt-co-cc-1010101010";
  return {
    action_id: "act-test-001",
    action_category: "data_access",
    autonomy_level: "A3",
    target_role: "clinical-navigator",
    timestamp: "2026-05-23T10:15:00-05:00",
    access_timestamp: "2026-05-23T10:15:00-05:00",
    access_purpose: "longitudinal_coordination",
    data_category: "mental_health",
    patient_id: patientId,
    patient_id_hash: sha256Hex(patientId),
    requester: {
      role: "clinical-navigator",
      institution_id: "ips_cgn_baq",
      institution_type: "ips_hospital",
    },
    institution: {
      id: "ips_cgn_baq",
      authorization_status: "active",
      overlay_status: "calibrated",
      a4_enabled: false,
      a4_signed_by_dpo: false,
    },
    transport: {
      tls_version: "1.3",
      cipher_suite: "TLS_AES_256_GCM_SHA384",
    },
  };
}

describe("validateEvaluateRequest", () => {
  it("accepts a canonical data_access request", () => {
    assert.deepEqual(validateEvaluateRequest(baseRequest()), []);
  });

  it("rejects unknown top-level fields", () => {
    const errors = validateEvaluateRequest({ ...baseRequest(), surprise: true });

    assert.equal(errors[0].code, "unknown_field");
    assert.equal(errors[0].field, "surprise");
  });

  it("rejects invalid action_category", () => {
    const errors = validateEvaluateRequest({ ...baseRequest(), action_category: "typo" });

    assert(errors.some((error) => error.code === "invalid_enum" && error.field === "action_category"));
  });

  it("rejects patient hash mismatch by default", () => {
    const errors = validateEvaluateRequest({ ...baseRequest(), patient_id_hash: "0".repeat(64) });

    assert(errors.some((error) => error.code === "patient_hash_mismatch"));
  });

  it("can skip patient hash validation for legacy fixtures", () => {
    const errors = validateEvaluateRequest(
      { ...baseRequest(), patient_id_hash: "0".repeat(64) },
      { validatePatientHash: false },
    );

    assert.deepEqual(errors, []);
  });
});
