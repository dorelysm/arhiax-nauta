import { createServer as createHttpServer } from "node:http";
import { performance } from "node:perf_hooks";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { validateEvaluateRequest } from "./validator.mjs";
import { Ledger, hashPayload } from "./ledger.mjs";
import { evaluatePolicyResult, mapEvaluationError } from "./evaluate.mjs";
import { uuidv7 } from "./evaluation-id.mjs";
import { evaluateAgainstOpa, loadBaseData, mergeDeep } from "./opa-client.mjs";
import { AuditStream } from "./audit-stream.mjs";

// HTTP surface for POST /evaluate. Implements the contract in
// docs/RUNTIME_API_CONTRACT.md and the decisions in
// docs/RUNTIME_API_DECISIONS.md (D-3 idempotency required, D-4 ledger
// synchronous before OPA).

const DEFAULT_REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const POLICY_BUNDLE_VERSION = "0.2.0";

function jsonResponse(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function errorBody(code, extra = {}) {
  return { error: { code, ...extra } };
}

function readBody(req, { maxBytes = 1_000_000 } = {}) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy();
        reject(new Error("payload_too_large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolveBody(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function hashBody(raw) {
  return createHash("sha256").update(raw).digest("hex");
}

const STUB_AUTHORIZED_ROLES = [
  "clinical-navigator",
  "patient",
  "patient_authorized_representative",
  "case-manager",
];

function stubConsentProvider() {
  return { policies: {}, revocations: {}, exclusions: {} };
}

function stubFeedbackProvider() {
  return {};
}

export function createEvaluateServer(options = {}) {
  const repoRoot = options.repoRoot ?? DEFAULT_REPO_ROOT;
  const ledger = options.ledger ?? new Ledger();
  const baseData = options.baseData ?? loadBaseData(repoRoot);
  const consentProvider = options.consentProvider ?? stubConsentProvider;
  const feedbackProvider = options.feedbackProvider ?? stubFeedbackProvider;
  const authorizedRoles = options.authorizedRoles ?? STUB_AUTHORIZED_ROLES;
  const opaBin = options.opaBin ?? process.env.OPA_BIN ?? "opa";
  const idempotency = options.idempotencyCache ?? new Map();
  const auditStream = options.auditStream ?? new AuditStream();

  async function handleEvaluate(req, res) {
    const startedAt = performance.now();
    const evaluationId = uuidv7();
    let rawBody;
    try {
      rawBody = await readBody(req);
    } catch (err) {
      jsonResponse(res, 413, errorBody("payload_too_large", { evaluation_id: evaluationId }));
      return;
    }

    // D-3: idempotency key mandatory
    const idemKey = req.headers["x-arhiax-idempotency-key"];
    if (!idemKey || typeof idemKey !== "string") {
      jsonResponse(res, 400, errorBody("missing_idempotency_key", { evaluation_id: evaluationId }));
      return;
    }

    const bodyHash = hashBody(rawBody);
    const cached = idempotency.get(idemKey);
    if (cached) {
      if (cached.bodyHash !== bodyHash) {
        jsonResponse(res, 409, errorBody("idempotency_conflict", { evaluation_id: evaluationId }));
        return;
      }
      jsonResponse(res, cached.status, cached.body);
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      jsonResponse(res, 400, errorBody("invalid_json", { evaluation_id: evaluationId }));
      return;
    }

    const headerInstitution = req.headers["x-arhiax-institution-id"];
    if (
      typeof headerInstitution === "string" &&
      parsed?.requester?.institution_id &&
      parsed.requester.institution_id !== headerInstitution
    ) {
      jsonResponse(res, 403, errorBody("institution_mismatch", { evaluation_id: evaluationId }));
      return;
    }

    // Recompute patient_id_hash (RUNTIME_API_CONTRACT.md §2.2): el campo
    // entrante es solo para depuración; el runtime lo recomputa y reemplaza.
    if (typeof parsed?.patient_id === "string") {
      parsed.patient_id_hash = createHash("sha256").update(parsed.patient_id).digest("hex");
    }

    const validationErrors = validateEvaluateRequest(parsed);
    if (validationErrors.length > 0) {
      jsonResponse(res, 422, {
        error: {
          code: "validation_failed",
          evaluation_id: evaluationId,
          details: validationErrors,
        },
      });
      return;
    }

    // Step 3 of the flow (RUNTIME_API_CONTRACT.md §1): attest BEFORE OPA.
    const actorId =
      parsed.requester?.actor_id ??
      parsed.requester?.institution_id ??
      "nauta-agent-unknown";
    try {
      ledger.recordAction({
        action_id: parsed.action_id,
        actor_id: actorId,
        action_type: parsed.action_category,
        payload: parsed,
        timestamp: parsed.timestamp,
      });
    } catch (err) {
      const response = mapEvaluationError(err, evaluationId);
      idempotency.set(idemKey, { bodyHash, status: 500, body: response });
      jsonResponse(res, 500, response);
      return;
    }

    const runtimeData = {
      runtime: {
        authorized_roles: authorizedRoles,
        ledger: ledger.asOpaData(),
        feedback: feedbackProvider(parsed) ?? {},
      },
      consent: consentProvider(parsed) ?? { policies: {}, revocations: {}, exclusions: {} },
    };

    let policyResult;
    try {
      policyResult = evaluateAgainstOpa({
        input: parsed,
        data: mergeDeep(baseData, runtimeData),
        repoRoot,
        opaBin,
      });
    } catch (err) {
      const response = mapEvaluationError(err, evaluationId);
      idempotency.set(idemKey, { bodyHash, status: 503, body: response });
      jsonResponse(res, 503, response);
      return;
    }

    const finishedAt = performance.now();
    const envelope = evaluatePolicyResult(policyResult, {
      evaluationId,
      startedAt,
      finishedAt,
    });
    const responseBody = {
      ...envelope,
      evaluated_at: new Date().toISOString(),
      policy_bundle_version: POLICY_BUNDLE_VERSION,
      fhir_validation: { performed: false, report_uri: null, issues_summary: null },
    };

    // D-4: persist audit records to WAL BEFORE responding. If the WAL is
    // unwritable we treat it as a dependency failure (503) so the caller
    // can retry — this preserves observability invariants even when the
    // ledger HMAC already succeeded.
    try {
      auditStream.recordEnvelope(responseBody);
    } catch (err) {
      const failResponse = mapEvaluationError(err, evaluationId);
      idempotency.set(idemKey, { bodyHash, status: 503, body: failResponse });
      jsonResponse(res, 503, failResponse);
      return;
    }

    idempotency.set(idemKey, { bodyHash, status: 200, body: responseBody });
    jsonResponse(res, 200, responseBody);
  }

  const server = createHttpServer((req, res) => {
    if (req.method === "POST" && req.url === "/v1/evaluate") {
      handleEvaluate(req, res).catch((err) => {
        const response = mapEvaluationError(err);
        jsonResponse(res, 500, response);
      });
      return;
    }
    if (req.method === "GET" && req.url === "/healthz") {
      jsonResponse(res, 200, { status: "ok", policy_bundle_version: POLICY_BUNDLE_VERSION });
      return;
    }
    jsonResponse(res, 404, errorBody("not_found"));
  });

  return { server, ledger, idempotency, auditStream };
}

export function startEvaluateServer(port = 0, options = {}) {
  const { server, ledger, idempotency, auditStream } = createEvaluateServer(options);
  return new Promise((resolveStart) => {
    server.listen(port, () => {
      const address = server.address();
      resolveStart({ server, ledger, idempotency, auditStream, port: address.port });
    });
  });
}
