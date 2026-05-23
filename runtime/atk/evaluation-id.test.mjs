import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isUuidv7, uuidv7 } from "./evaluation-id.mjs";

describe("uuidv7", () => {
  it("produces a canonical RFC 9562 v7 string", () => {
    const id = uuidv7();
    assert.ok(isUuidv7(id), `expected v7 UUID, got ${id}`);
  });

  it("encodes the provided timestamp in the first 48 bits", () => {
    const ts = 1748019600000; // 2025-05-23T17:00:00Z
    const id = uuidv7(ts);
    const tsHex = ts.toString(16).padStart(12, "0");
    assert.equal(id.replace(/-/g, "").slice(0, 12), tsHex);
  });

  it("sorts lexicographically by creation time", () => {
    const earlier = uuidv7(1_000_000_000_000);
    const later = uuidv7(2_000_000_000_000);
    assert.ok(earlier < later, `${earlier} should sort before ${later}`);
  });

  it("rejects non-v7 ids", () => {
    assert.equal(isUuidv7("not-a-uuid"), false);
    // v4 example
    assert.equal(isUuidv7("00000000-0000-4000-8000-000000000000"), false);
  });
});
