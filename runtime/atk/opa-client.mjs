import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { POLICY_DIRS, POLICY_QUERY, extractOpaValue } from "./policy-query.mjs";

// Thin OPA invoker. Spawns `opa eval` once per request, merges base data
// (entity_types.json + thresholds.json) with runtime-provided data, and
// returns the policy result map already projected by POLICY_QUERY.
//
// Production should replace this with a long-lived OPA server (REST API
// over UDS) to amortise startup cost. Documented in
// docs/RUNTIME_API_CONTRACT.md §5; tracked as future optimisation.

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

export function mergeDeep(base, overlay) {
  const out = { ...base };
  for (const [key, value] of Object.entries(overlay || {})) {
    if (isObject(out[key]) && isObject(value)) {
      out[key] = mergeDeep(out[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function loadBaseData(repoRoot) {
  const dataDir = join(repoRoot, "policy-bundle-nauta-colombia", "data");
  const entity = JSON.parse(readFileSync(join(dataDir, "entity_types.json"), "utf8"));
  const thresholds = JSON.parse(readFileSync(join(dataDir, "thresholds.json"), "utf8"));
  return mergeDeep(entity, thresholds);
}

export function evaluateAgainstOpa({ input, data, repoRoot, opaBin = process.env.OPA_BIN || "opa", tmpRoot }) {
  const policyDirs = POLICY_DIRS.map((rel) => resolve(repoRoot, rel));
  const root = tmpRoot ?? join(repoRoot, ".tmp");
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, "nauta-opa-"));
  try {
    const inputPath = join(dir, "input.json");
    const dataPath = join(dir, "data.json");
    writeFileSync(inputPath, JSON.stringify(input));
    writeFileSync(dataPath, JSON.stringify(data));

    // Use paths relative to repoRoot. On Windows OPA's `-d` flag interprets
    // absolute paths that start with a drive letter (e.g. C:/...) as a
    // namespace prefix instead of a plain file location, which makes
    // `data.runtime.ledger.records[...]` invisible and forces fail-closed
    // AUT-03. Running with cwd=repoRoot + relative paths keeps OPA happy
    // on every OS.
    const args = [
      "eval",
      "--format=json",
      "-i", relative(repoRoot, inputPath),
      "-d", relative(repoRoot, dataPath),
      ...policyDirs.flatMap((p) => ["-d", relative(repoRoot, p)]),
      POLICY_QUERY,
    ];
    const raw = execFileSync(opaBin, args, { encoding: "utf8", cwd: repoRoot });
    return extractOpaValue(JSON.parse(raw));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
