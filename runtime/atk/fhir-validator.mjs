import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// FHIR validator pluggable adapter (P1.5).
//
// Two modes:
//   - "stub" (default): no real validation, reports performed=false so the
//     response makes it obvious nothing was validated. Production deployments
//     MUST swap this for the HL7 CLI mode.
//   - "hl7-cli": spawns `java -jar validator_cli.jar` with the package
//     `minsalud.fhir.co.rda#<version>` pre-cached, `-tx n/a` to disable the
//     external terminology server. Returns the parsed report.
//
// Selection: createFhirValidator() returns hl7-cli if ARHIAX_FHIR_VALIDATOR_JAR
// is set; otherwise the stub. The server flow always invokes the validator
// for action_category=submit_bundle_to_ihce, and maps fatal/error severities
// to a 422 envelope with primary_rule=FHIR-VAL-01.

export const FHIR_VAL_RULE = "FHIR-VAL-01";

function emptySummary() {
  return { fatal: 0, error: 0, warning: 0, information: 0 };
}

export function summarizeIssues(issues) {
  const summary = emptySummary();
  for (const issue of issues ?? []) {
    const sev = (issue?.severity ?? "information").toLowerCase();
    if (sev in summary) summary[sev] += 1;
  }
  return summary;
}

export function isBlocking(summary) {
  if (!summary) return false;
  return (summary.fatal ?? 0) > 0 || (summary.error ?? 0) > 0;
}

export function createStubValidator() {
  return {
    mode: "stub",
    async validate() {
      return {
        performed: false,
        validator_mode: "stub",
        issues: [],
        issues_summary: null,
        report_uri: null,
        note: "FHIR validator not configured. Set ARHIAX_FHIR_VALIDATOR_JAR to enable structural validation.",
      };
    },
  };
}

// Spawns the HL7 FHIR Validator CLI. Used only when ARHIAX_FHIR_VALIDATOR_JAR
// is configured. Cold start cost is significant (1-3s); see
// docs/FHIR_VALIDATION_NOTES.md §5 for the recommended sidecar mode.
export function createHl7CliValidator({
  jarPath = process.env.ARHIAX_FHIR_VALIDATOR_JAR,
  javaBin = process.env.ARHIAX_FHIR_JAVA_BIN ?? "java",
  packageId = process.env.ARHIAX_FHIR_PACKAGE ?? "minsalud.fhir.co.rda#0.8.1",
  fhirVersion = process.env.ARHIAX_FHIR_VERSION ?? "4.0.1",
  workDir = join(tmpdir(), "nauta-fhir"),
} = {}) {
  if (!jarPath) {
    throw new Error("createHl7CliValidator: jarPath is required (set ARHIAX_FHIR_VALIDATOR_JAR).");
  }
  mkdirSync(workDir, { recursive: true });
  return {
    mode: "hl7-cli",
    jarPath,
    packageId,
    async validate(bundle) {
      const dir = mkdtempSync(join(workDir, "run-"));
      const bundlePath = join(dir, "bundle.json");
      const reportPath = join(dir, "report.json");
      try {
        writeFileSync(bundlePath, JSON.stringify(bundle), "utf8");
        const args = [
          "-jar", jarPath,
          bundlePath,
          "-version", fhirVersion,
          "-ig", packageId,
          "-tx", "n/a",
          "-output", reportPath,
        ];
        execFileSync(javaBin, args, { encoding: "utf8" });
        const report = JSON.parse(readFileSync(reportPath, "utf8"));
        const issues = report?.issue ?? [];
        return {
          performed: true,
          validator_mode: "hl7-cli",
          issues,
          issues_summary: summarizeIssues(issues),
          report_uri: `file://${reportPath}`,
        };
      } finally {
        // Keep the report on disk only if debugging; otherwise clean up.
        if (!process.env.NAUTA_KEEP_FHIR_REPORTS) {
          rmSync(dir, { recursive: true, force: true });
        }
      }
    },
  };
}

export function createFhirValidator(options = {}) {
  if (options.validator) return options.validator;
  if (process.env.ARHIAX_FHIR_VALIDATOR_JAR) {
    return createHl7CliValidator(options);
  }
  return createStubValidator();
}

export function buildRejectionEnvelope({ evaluationId, result, evaluatedAt, policyBundleVersion }) {
  return {
    evaluation_id: evaluationId,
    outcome: "DENY",
    precedence: ["SUSPEND", "DENY", "ESCALATE", "MODIFY", "AUDIT", "PERMIT"],
    reasons: [
      {
        source: "fhir_validator",
        rule: FHIR_VAL_RULE,
        message: `DENY · ${FHIR_VAL_RULE}: FHIR validation reported blocking issues (fatal=${result.issues_summary?.fatal ?? 0}, error=${result.issues_summary?.error ?? 0}).`,
      },
    ],
    also_emitted: {},
    effects: { audit: [] },
    latency_ms: 0,
    evaluated_at: evaluatedAt,
    policy_bundle_version: policyBundleVersion,
    fhir_validation: {
      performed: result.performed,
      report_uri: result.report_uri ?? null,
      issues_summary: result.issues_summary ?? null,
    },
  };
}
