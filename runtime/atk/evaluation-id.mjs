import { randomBytes } from "node:crypto";

// UUIDv7 per RFC 9562 §5.7. Time-ordered, sortable; built without external deps
// so the runtime keeps a zero-dependency footprint for the evaluation hot path.
//
// Layout (128 bits):
//   - bits 0..47  : unix_ts_ms (big-endian)
//   - bits 48..51 : version (0b0111)
//   - bits 52..63 : rand_a (12 bits)
//   - bits 64..65 : variant (0b10)
//   - bits 66..127: rand_b (62 bits)
//
// Decision recorded in docs/RUNTIME_API_DECISIONS.md D-1.

export function uuidv7(now = Date.now()) {
  const bytes = randomBytes(16);
  const ts = BigInt(now);

  bytes[0] = Number((ts >> 40n) & 0xffn);
  bytes[1] = Number((ts >> 32n) & 0xffn);
  bytes[2] = Number((ts >> 24n) & 0xffn);
  bytes[3] = Number((ts >> 16n) & 0xffn);
  bytes[4] = Number((ts >> 8n) & 0xffn);
  bytes[5] = Number(ts & 0xffn);

  // version 0b0111 in the high nibble of byte 6, preserve random low nibble
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  // variant 0b10 in the high bits of byte 8, preserve random low 6 bits
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const UUIDV7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isUuidv7(value) {
  return typeof value === "string" && UUIDV7_REGEX.test(value);
}
