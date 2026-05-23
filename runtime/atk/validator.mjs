import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

// Ajv-based request/response validator. The JSON Schemas live under
// runtime/atk/schemas/ and are emitted from runtime/atk/openapi.json by
// scripts/emit-schemas.mjs (D-5: OpenAPI as source of truth, JSON Schema
// extracted by build).

const SCHEMA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "schemas");
// ajv@8 ships as CommonJS with `module.exports = Ajv` plus `.default`.
// Depending on the Node ESM<->CJS interop path, the default export ends up
// in either `Ajv2020` or `Ajv2020.default`. Resolve both shapes here.
const AjvCtor = typeof Ajv2020 === "function" ? Ajv2020 : Ajv2020.default;

function loadSchemas() {
  const files = readdirSync(SCHEMA_DIR).filter((f) => f.endsWith(".json") && f !== "index.json");
  return files.map((file) => JSON.parse(readFileSync(join(SCHEMA_DIR, file), "utf8")));
}

function buildAjv() {
  const ajv = new AjvCtor({ allErrors: true, strict: false });
  for (const schema of loadSchemas()) {
    ajv.addSchema(schema, schema.$id);
  }
  return ajv;
}

let _ajv;
function getAjv() {
  if (!_ajv) _ajv = buildAjv();
  return _ajv;
}

function compileOnce(schemaId) {
  const ajv = getAjv();
  const existing = ajv.getSchema(schemaId);
  if (existing) return existing;
  throw new Error(`Schema ${schemaId} not found. Did you run "npm run schema:emit"?`);
}

function asErrors(ajvErrors) {
  if (!ajvErrors) return [];
  return ajvErrors.map((err) => ({
    code: err.keyword === "additionalProperties" ? "unknown_field" : err.keyword,
    field: err.instancePath || err.params?.missingProperty || "$",
    message: err.message,
  }));
}

export function validateEvaluateRequest(input) {
  const validate = compileOnce("EvaluateRequest.json");
  const ok = validate(input);
  return ok ? [] : asErrors(validate.errors);
}

export function validateEvaluateResponse(body) {
  const validate = compileOnce("EvaluateResponse.json");
  const ok = validate(body);
  return ok ? [] : asErrors(validate.errors);
}
