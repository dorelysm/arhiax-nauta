#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Extracts components.schemas from runtime/atk/openapi.json into individual
// JSON Schema 2020-12 files under runtime/atk/schemas/. Each emitted file
// rewrites internal "#/components/schemas/Foo" references as
// "Foo.json" so ajv can resolve them across files via addSchema.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "runtime", "atk", "openapi.json");
const OUT_DIR = join(ROOT, "runtime", "atk", "schemas");

function rewriteRefs(node) {
  if (Array.isArray(node)) return node.map(rewriteRefs);
  if (node && typeof node === "object") {
    const out = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === "$ref" && typeof value === "string" && value.startsWith("#/components/schemas/")) {
        out[key] = `${value.slice("#/components/schemas/".length)}.json`;
      } else {
        out[key] = rewriteRefs(value);
      }
    }
    return out;
  }
  return node;
}

const spec = JSON.parse(readFileSync(SOURCE, "utf8"));
const schemas = spec.components?.schemas ?? {};

mkdirSync(OUT_DIR, { recursive: true });

const emitted = [];
for (const [name, schema] of Object.entries(schemas)) {
  const projected = rewriteRefs(schema);
  const wrapped = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `${name}.json`,
    title: name,
    ...projected,
  };
  const path = join(OUT_DIR, `${name}.json`);
  writeFileSync(path, `${JSON.stringify(wrapped, null, 2)}\n`);
  emitted.push(name);
}

writeFileSync(
  join(OUT_DIR, "index.json"),
  `${JSON.stringify({ source: "runtime/atk/openapi.json", schemas: emitted }, null, 2)}\n`,
);

console.log(`Emitted ${emitted.length} schemas to ${OUT_DIR}`);
for (const name of emitted) console.log(`  - ${name}.json`);
