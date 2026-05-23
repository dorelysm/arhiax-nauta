import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FHIR_VAL_RULE,
  buildRejectionEnvelope,
  createFhirValidator,
  createStubValidator,
  isBlocking,
  summarizeIssues,
} from "./fhir-validator.mjs";

describe("FHIR validator", () => {
  it("summarizes mixed severities correctly", () => {
    const summary = summarizeIssues([
      { severity: "error", code: "structure" },
      { severity: "warning", code: "extension" },
      { severity: "INFORMATION", code: "trace" },
      { severity: "fatal", code: "parse" },
    ]);
    assert.equal(summary.fatal, 1);
    assert.equal(summary.error, 1);
    assert.equal(summary.warning, 1);
    assert.equal(summary.information, 1);
  });

  it("treats fatal or error counts as blocking", () => {
    assert.equal(isBlocking({ fatal: 1, error: 0, warning: 0, information: 0 }), true);
    assert.equal(isBlocking({ fatal: 0, error: 1, warning: 0, information: 0 }), true);
    assert.equal(isBlocking({ fatal: 0, error: 0, warning: 9, information: 9 }), false);
    assert.equal(isBlocking(null), false);
  });

  it("stub validator returns performed=false and no issues", async () => {
    const v = createStubValidator();
    const result = await v.validate({ resourceType: "Bundle" });
    assert.equal(result.performed, false);
    assert.equal(result.validator_mode, "stub");
    assert.equal(result.issues_summary, null);
    assert.deepEqual(result.issues, []);
  });

  it("factory falls back to stub when ARHIAX_FHIR_VALIDATOR_JAR is unset", () => {
    const original = process.env.ARHIAX_FHIR_VALIDATOR_JAR;
    delete process.env.ARHIAX_FHIR_VALIDATOR_JAR;
    try {
      const v = createFhirValidator();
      assert.equal(v.mode, "stub");
    } finally {
      if (original) process.env.ARHIAX_FHIR_VALIDATOR_JAR = original;
    }
  });

  it("builds a FHIR-VAL-01 rejection envelope from a blocking result", () => {
    const envelope = buildRejectionEnvelope({
      evaluationId: "019e565a-e043-7768-a066-f8654fb4b761",
      evaluatedAt: "2026-05-23T10:15:00-05:00",
      policyBundleVersion: "0.2.0",
      result: {
        performed: true,
        report_uri: "file:///tmp/report.json",
        issues_summary: { fatal: 0, error: 2, warning: 1, information: 0 },
      },
    });
    assert.equal(envelope.outcome, "DENY");
    assert.equal(envelope.reasons[0].rule, FHIR_VAL_RULE);
    assert.match(envelope.reasons[0].message, /error=2/);
    assert.equal(envelope.fhir_validation.performed, true);
  });
});
