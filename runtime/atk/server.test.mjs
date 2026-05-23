import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { Ledger } from "./ledger.mjs";
import { loadBaseData, mergeDeep } from "./opa-client.mjs";
import { startEvaluateServer } from "./server.mjs";
import { isUuidv7 } from "./evaluation-id.mjs";
import { AuditStream } from "./audit-stream.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FIXTURE_DIR = join(REPO_ROOT, "fixtures", "evaluate");

function loadFixture(name) {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), "utf8"));
}

function fixtureToServerConfig(fixture, repoRoot) {
  const overrides = fixture.data_overrides ?? {};
  const baseData = mergeDeep(loadBaseData(repoRoot), overrides.thresholds ? { thresholds: overrides.thresholds } : {});
  return {
    baseData,
    repoRoot,
    consentProvider: () => overrides.consent ?? { policies: {}, revocations: {}, exclusions: {} },
    feedbackProvider: () => overrides.runtime?.feedback ?? {},
    authorizedRoles: overrides.runtime?.authorized_roles ?? ["clinical-navigator", "patient"],
  };
}

async function post(port, path, body, headers = {}) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

describe("evaluate server", () => {
  let tmpDir;
  let ledger;
  let auditStream;
  let handle;

  function startWith(extraOptions = {}) {
    return startEvaluateServer(0, {
      repoRoot: REPO_ROOT,
      ledger,
      auditStream,
      ...extraOptions,
    });
  }

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "nauta-server-"));
    ledger = new Ledger({ path: join(tmpDir, "ledger.jsonl"), key: "test-server-key" });
    const sinkPath = join(tmpDir, "sink.jsonl");
    const transport = {
      records: [],
      async send(record) {
        this.records.push(record);
      },
    };
    auditStream = new AuditStream({ walDir: join(tmpDir, "audit-wal"), transport, retryMs: 1 });
    auditStream.__transport = transport;
  });

  afterEach(async () => {
    if (handle?.server) {
      handle.server.close();
      handle = null;
    }
    if (auditStream) {
      await auditStream.stop();
    }
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns 200 on /healthz", async () => {
    handle = await startWith();
    const res = await fetch(`http://127.0.0.1:${handle.port}/healthz`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "ok");
  });

  it("returns 404 for unknown routes", async () => {
    handle = await startWith();
    const res = await fetch(`http://127.0.0.1:${handle.port}/nope`);
    assert.equal(res.status, 404);
  });

  it("returns 400 when X-ARHIAX-Idempotency-Key is missing", async () => {
    handle = await startWith();
    const fixture = loadFixture("valid-rda-submission.json");
    const res = await post(handle.port, "/v1/evaluate", fixture.input);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "missing_idempotency_key");
  });

  it("returns 400 on malformed JSON", async () => {
    handle = await startWith();
    const res = await post(handle.port, "/v1/evaluate", "{not-json", {
      "X-ARHIAX-Idempotency-Key": "test-key-1",
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "invalid_json");
  });

  it("returns 422 on schema violation", async () => {
    handle = await startWith();
    const res = await post(handle.port, "/v1/evaluate", { not_a_field: true }, {
      "X-ARHIAX-Idempotency-Key": "test-key-bad",
    });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, "validation_failed");
    assert.ok(Array.isArray(res.body.error.details));
  });

  it("returns 403 when X-ARHIAX-Institution-Id mismatches requester.institution_id", async () => {
    const fixture = loadFixture("valid-rda-submission.json");
    handle = await startWith(fixtureToServerConfig(fixture, REPO_ROOT));
    const res = await post(handle.port, "/v1/evaluate", fixture.input, {
      "X-ARHIAX-Idempotency-Key": "test-key-mismatch",
      "X-ARHIAX-Institution-Id": "ips_wrong",
    });
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, "institution_mismatch");
  });

  it("evaluates valid-rda-submission as PERMIT with UUIDv7 evaluation_id", async () => {
    const fixture = loadFixture("valid-rda-submission.json");
    handle = await startWith(fixtureToServerConfig(fixture, REPO_ROOT));
    const res = await post(handle.port, "/v1/evaluate", fixture.input, {
      "X-ARHIAX-Idempotency-Key": "test-key-permit",
      "X-ARHIAX-Institution-Id": fixture.input.requester.institution_id,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.outcome, "PERMIT");
    assert.ok(isUuidv7(res.body.evaluation_id));
    assert.ok(res.body.effects.audit.length > 0, "SAMD-06 audit should be emitted");
    assert.equal(res.body.policy_bundle_version, "0.2.0");

    // D-4: audit stream drained to the transport after responding.
    await auditStream.flush();
    assert.ok(
      auditStream.__transport.records.length >= 1,
      "expected at least one audit record forwarded to the transport",
    );
    assert.equal(auditStream.__transport.records[0].evaluation_id, res.body.evaluation_id);
  });

  it("evaluates samd-violation as DENY", async () => {
    const fixture = loadFixture("samd-violation.json");
    handle = await startWith(fixtureToServerConfig(fixture, REPO_ROOT));
    const res = await post(handle.port, "/v1/evaluate", fixture.input, {
      "X-ARHIAX-Idempotency-Key": "test-key-deny",
      "X-ARHIAX-Institution-Id": fixture.input.requester.institution_id,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.outcome, "DENY");
    assert.ok(res.body.reasons.length > 0);
  });

  it("evaluates uncalibrated-critical-divergence as SUSPEND", async () => {
    const fixture = loadFixture("uncalibrated-critical-divergence.json");
    handle = await startWith(fixtureToServerConfig(fixture, REPO_ROOT));
    const res = await post(handle.port, "/v1/evaluate", fixture.input, {
      "X-ARHIAX-Idempotency-Key": "test-key-suspend",
      "X-ARHIAX-Institution-Id": fixture.input.requester.institution_id,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.outcome, "SUSPEND");
  });

  it("returns cached response for repeated idempotency-key + same body", async () => {
    const fixture = loadFixture("valid-rda-submission.json");
    handle = await startWith(fixtureToServerConfig(fixture, REPO_ROOT));
    const key = "test-key-idem";
    const first = await post(handle.port, "/v1/evaluate", fixture.input, {
      "X-ARHIAX-Idempotency-Key": key,
      "X-ARHIAX-Institution-Id": fixture.input.requester.institution_id,
    });
    const second = await post(handle.port, "/v1/evaluate", fixture.input, {
      "X-ARHIAX-Idempotency-Key": key,
      "X-ARHIAX-Institution-Id": fixture.input.requester.institution_id,
    });
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(first.body.evaluation_id, second.body.evaluation_id);
    // Only one ledger record despite two HTTP requests.
    assert.equal(ledger.readAll().length, 1);
  });

  it("runs FHIR validator and short-circuits with 422 + FHIR-VAL-01 when blocking issues are reported", async () => {
    const fixture = loadFixture("r1888-missing-provenance-denied.json");
    const fhirValidator = {
      mode: "mock",
      async validate() {
        return {
          performed: true,
          validator_mode: "mock",
          issues: [
            { severity: "error", code: "structure", details: "missing required field" },
          ],
          issues_summary: { fatal: 0, error: 1, warning: 0, information: 0 },
          report_uri: "memory://mock",
        };
      },
    };
    handle = await startWith({ ...fixtureToServerConfig(fixture, REPO_ROOT), fhirValidator });
    const res = await post(handle.port, "/v1/evaluate", fixture.input, {
      "X-ARHIAX-Idempotency-Key": "test-key-fhir-reject",
      "X-ARHIAX-Institution-Id": fixture.input.requester.institution_id,
    });
    assert.equal(res.status, 422);
    assert.equal(res.body.outcome, "DENY");
    assert.equal(res.body.reasons[0].rule, "FHIR-VAL-01");
    assert.equal(res.body.fhir_validation.performed, true);
    assert.equal(res.body.fhir_validation.issues_summary.error, 1);
  });

  it("passes through FHIR validation when no blocking issues and continues to OPA", async () => {
    const fixture = loadFixture("r1888-missing-provenance-denied.json");
    const fhirValidator = {
      mode: "mock-clean",
      async validate() {
        return {
          performed: true,
          validator_mode: "mock-clean",
          issues: [],
          issues_summary: { fatal: 0, error: 0, warning: 1, information: 0 },
          report_uri: "memory://mock-clean",
        };
      },
    };
    handle = await startWith({ ...fixtureToServerConfig(fixture, REPO_ROOT), fhirValidator });
    const res = await post(handle.port, "/v1/evaluate", fixture.input, {
      "X-ARHIAX-Idempotency-Key": "test-key-fhir-clean",
      "X-ARHIAX-Institution-Id": fixture.input.requester.institution_id,
    });
    assert.equal(res.status, 200);
    // OPA-level rule should still fire because Provenance is missing.
    assert.equal(res.body.outcome, "DENY");
    assert.equal(res.body.fhir_validation.performed, true);
    assert.equal(res.body.fhir_validation.issues_summary.error, 0);
    assert.equal(res.body.fhir_validation.issues_summary.warning, 1);
  });

  it("leaves fhir_validation.performed=false for non-submission action categories", async () => {
    const fixture = loadFixture("valid-rda-submission.json");
    handle = await startWith(fixtureToServerConfig(fixture, REPO_ROOT));
    const res = await post(handle.port, "/v1/evaluate", fixture.input, {
      "X-ARHIAX-Idempotency-Key": "test-key-no-fhir",
      "X-ARHIAX-Institution-Id": fixture.input.requester.institution_id,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.fhir_validation.performed, false);
  });

  it("returns 409 when idempotency-key is reused with a different body", async () => {
    const fixture = loadFixture("valid-rda-submission.json");
    handle = await startWith(fixtureToServerConfig(fixture, REPO_ROOT));
    const key = "test-key-conflict";
    await post(handle.port, "/v1/evaluate", fixture.input, {
      "X-ARHIAX-Idempotency-Key": key,
      "X-ARHIAX-Institution-Id": fixture.input.requester.institution_id,
    });
    const conflicting = { ...fixture.input, action_id: "act-different" };
    const res = await post(handle.port, "/v1/evaluate", conflicting, {
      "X-ARHIAX-Idempotency-Key": key,
      "X-ARHIAX-Institution-Id": fixture.input.requester.institution_id,
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, "idempotency_conflict");
  });
});
