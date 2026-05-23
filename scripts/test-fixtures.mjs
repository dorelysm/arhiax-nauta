import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const policyRoot = join(root, "policy-bundle-nauta-colombia");
const fixtureRoot = join(root, "fixtures", "evaluate");

function findOpa() {
  const candidates = [
    process.env.OPA_BIN,
    "opa",
    process.platform === "win32" ? join(process.env.TEMP || ".", "opa_windows_amd64.exe") : null,
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ["version"], { stdio: "ignore" });
      return candidate;
    } catch {
      // Keep looking.
    }
  }

  throw new Error("OPA not found. Run scripts/validate.ps1 first locally or set OPA_BIN.");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function mergeDeep(base, overlay) {
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

function hasValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return Boolean(value);
}

const opa = findOpa();
const baseData = mergeDeep(
  readJson(join(policyRoot, "data", "entity_types.json")),
  readJson(join(policyRoot, "data", "thresholds.json")),
);

const policyDirs = [
  join(policyRoot, "base"),
  join(policyRoot, "res-1888-2025"),
  join(policyRoot, "habeas-data"),
  join(policyRoot, "decreto-4725-2005"),
  join(policyRoot, "clinical-graus-2016"),
];

const query = `{
  "autonomy_allow": data.arhiax.nauta.base.autonomy.allow,
  "autonomy_deny": data.arhiax.nauta.base.autonomy.deny,
  "autonomy_suspend": data.arhiax.nauta.base.autonomy.suspend,
  "hic_escalate": data.arhiax.nauta.base.hic.escalate,
  "res_deny": data.arhiax.nauta.co.res_1888_2025.deny,
  "habeas_allow": data.arhiax.nauta.co.habeas_data.allow,
  "habeas_deny": data.arhiax.nauta.co.habeas_data.deny,
  "habeas_suspend": data.arhiax.nauta.co.habeas_data.suspend,
  "samd_allow": data.arhiax.nauta.co.decreto_4725_2005.allow,
  "samd_deny": data.arhiax.nauta.co.decreto_4725_2005.deny,
  "samd_escalate": data.arhiax.nauta.co.decreto_4725_2005.escalate
}`;

function evaluateFixture(fixturePath) {
  const fixture = readJson(fixturePath);
  
  if (fixture.input && typeof fixture.input.patient_id === "string" && fixture.input.patient_id_hash) {
    const expectedHash = createHash("sha256").update(fixture.input.patient_id).digest("hex");
    if (fixture.input.patient_id_hash !== expectedHash) {
      console.warn(`[WARN] ${relative(fixtureRoot, fixturePath)}: patient_id_hash is not the actual SHA-256 of patient_id. Esto es tolerado en fixtures golden, pero debe corregirse si es nuevo.`);
    }
  }

  const tmpRoot = join(root, ".tmp");
  mkdirSync(tmpRoot, { recursive: true });
  const dir = mkdtempSync(join(tmpRoot, "nauta-fixture-"));
  try {
    const inputPath = join(dir, "input.json");
    const dataPath = join(dir, "data.json");
    const data = mergeDeep(baseData, fixture.data_overrides || {});

    writeFileSync(inputPath, JSON.stringify(fixture.input, null, 2));
    writeFileSync(dataPath, JSON.stringify(data, null, 2));

    const args = [
      "eval",
      "--format=json",
      "-i",
      relative(root, inputPath),
      "-d",
      relative(root, dataPath),
      ...policyDirs.flatMap((path) => ["-d", path]),
      query,
    ];
    const raw = execFileSync(opa, args, { encoding: "utf8" });
    const parsed = JSON.parse(raw);
    const value = parsed.result?.[0]?.expressions?.[0]?.value || {};
    return { fixture, value };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function assertExpected(file, fixture, value) {
  const rule = fixture.expected_outcome?.primary_rule || "";
  const expected = fixture.expected_outcome?.outcome;

  const checks = {
    "AUT-02": hasValue(value.autonomy_deny),
    "AUT-03": hasValue(value.autonomy_deny),
    "AUT-04": hasValue(value.autonomy_suspend),
    "AUT-05": hasValue(value.autonomy_suspend),
    "AUT-06": hasValue(value.autonomy_deny),
    "AUT-07": hasValue(value.autonomy_deny),
    "HIC-1": hasValue(value.hic_escalate),
    "HIC-3": hasValue(value.hic_escalate),
    "HD-02": hasValue(value.habeas_deny),
    "HD-03": hasValue(value.habeas_deny),
    "HD-04": hasValue(value.habeas_suspend),
    "R1888-01": hasValue(value.res_deny),
    "R1888-02": hasValue(value.res_deny),
    "R1888-03": hasValue(value.res_deny),
    "R1888-04": hasValue(value.res_deny),
    "R1888-05": hasValue(value.res_deny),
    "R1888-06": hasValue(value.res_deny),
    "SAMD-01": hasValue(value.samd_deny),
    "SAMD-02": hasValue(value.samd_deny),
    "SAMD-03": hasValue(value.samd_escalate),
    "SAMD-04": hasValue(value.samd_deny),
    "SAMD-05": hasValue(value.samd_deny),
  };

  let ok = false;
  if (expected === "PERMIT") {
    ok =
      value.autonomy_allow === true &&
      value.samd_allow === true &&
      (fixture.input.data_category ? value.habeas_allow === true : true) &&
      !hasValue(value.autonomy_deny) &&
      !hasValue(value.samd_deny) &&
      !hasValue(value.habeas_deny) &&
      !hasValue(value.habeas_suspend);
  } else {
    ok = Object.entries(checks).some(([prefix, passed]) => rule.includes(prefix) && passed);
  }

  if (!ok) {
    throw new Error(
      `${file} expected ${expected} via ${rule}, got ${JSON.stringify(value, null, 2)}`,
    );
  }
}

const files = process.argv.slice(2);
const fixtureFiles = files.length
  ? files.map((file) => resolve(file))
  : readdirSync(fixtureRoot)
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map((file) => join(fixtureRoot, file));

for (const file of fixtureFiles) {
  const { fixture, value } = evaluateFixture(file);
  assertExpected(file, fixture, value);
  console.log(`PASS ${file} -> ${fixture.expected_outcome.outcome} (${fixture.expected_outcome.primary_rule})`);
}
