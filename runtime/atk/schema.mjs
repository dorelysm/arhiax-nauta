import { createHash } from "node:crypto";

export const ACTION_CATEGORIES = new Set([
  "produce_composition",
  "data_access",
  "emit_output",
  "emit_divergence_notification",
  "divergence_notification",
  "submit_bundle_to_ihce",
  "enroll_patient",
  "deploy_overlay",
  "modify_consent",
  "transfer_graph",
]);

export const AUTONOMY_LEVELS = new Set(["A0", "A1", "A2", "A3", "A4"]);
export const OUTCOME_SEVERITIES = new Set(["low", "moderate", "high", "critical"]);

const TOP_LEVEL_FIELDS = new Set([
  "action_id",
  "action_category",
  "autonomy_level",
  "target_role",
  "target_composition_profile",
  "target_bundle_profile",
  "timestamp",
  "access_timestamp",
  "access_purpose",
  "data_category",
  "patient_id",
  "patient_id_hash",
  "requester",
  "institution",
  "transport",
  "composition",
  "bundle",
  "output",
  "divergence_severity",
  "consent",
]);

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function requireString(errors, object, field, displayField = field) {
  if (typeof object[field] !== "string" || object[field].length === 0) {
    errors.push({ code: "required_string", field: displayField });
  }
}

function requireObject(errors, object, field) {
  if (!object[field] || typeof object[field] !== "object" || Array.isArray(object[field])) {
    errors.push({ code: "required_object", field });
  }
}

export function validateEvaluateRequest(input, options = {}) {
  const errors = [];

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return [{ code: "invalid_body", field: "$" }];
  }

  for (const field of Object.keys(input)) {
    if (!TOP_LEVEL_FIELDS.has(field)) {
      errors.push({ code: "unknown_field", field });
    }
  }

  for (const field of [
    "action_id",
    "action_category",
    "autonomy_level",
    "target_role",
    "timestamp",
    "patient_id",
    "patient_id_hash",
  ]) {
    requireString(errors, input, field);
  }

  requireObject(errors, input, "requester");
  requireObject(errors, input, "institution");
  requireObject(errors, input, "transport");

  if (typeof input.action_category === "string" && !ACTION_CATEGORIES.has(input.action_category)) {
    errors.push({ code: "invalid_enum", field: "action_category" });
  }

  if (typeof input.autonomy_level === "string" && !AUTONOMY_LEVELS.has(input.autonomy_level)) {
    errors.push({ code: "invalid_enum", field: "autonomy_level" });
  }

  if (input.divergence_severity && !OUTCOME_SEVERITIES.has(input.divergence_severity)) {
    errors.push({ code: "invalid_enum", field: "divergence_severity" });
  }

  if (input.action_category === "data_access") {
    for (const field of ["access_timestamp", "access_purpose", "data_category"]) {
      requireString(errors, input, field);
    }
  }

  if (input.action_category === "submit_bundle_to_ihce") {
    requireObject(errors, input, "bundle");
  }

  if (input.action_category === "produce_composition") {
    requireString(errors, input, "target_composition_profile");
    requireObject(errors, input, "composition");
  }

  if (input.requester && typeof input.requester === "object") {
    for (const field of ["role", "institution_id", "institution_type"]) {
      requireString(errors, input.requester, field, `requester.${field}`);
    }
  }

  if (input.institution && typeof input.institution === "object") {
    for (const field of ["id", "authorization_status", "overlay_status"]) {
      requireString(errors, input.institution, field, `institution.${field}`);
    }
  }

  if (input.transport && typeof input.transport === "object") {
    requireString(errors, input.transport, "tls_version", "transport.tls_version");
  }

  if (options.validatePatientHash !== false && typeof input.patient_id === "string" && typeof input.patient_id_hash === "string") {
    const expected = sha256Hex(input.patient_id);
    if (input.patient_id_hash !== expected) {
      errors.push({ code: "patient_hash_mismatch", field: "patient_id_hash" });
    }
  }

  return errors;
}
