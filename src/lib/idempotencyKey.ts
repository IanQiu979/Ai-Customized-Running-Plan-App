/**
 * Mints a client-side idempotency key for `POST /api/generate-plan`. `crypto.randomUUID()` is
 * not reliably available in this Hermes/RN runtime, and `expo-crypto` is not an installed
 * dependency (adding one is HIGH-tier per `AGENTS.md`), so this hand-rolls a key from two
 * already-available sources of entropy instead: the current time (base36, so it also sorts and
 * reads compactly) and `Math.random()` (base36, sliced past the leading "0.").
 *
 * The key only needs to be unique per device per generate-plan attempt — it is never checked
 * across devices or persisted beyond one request/replay cycle (`planTypes.ts`'s
 * `GeneratePlanRequest`, "Minted when the configure modal opens; dedupes a retried request") — so
 * `Math.random()` is an acceptable entropy source here, unlike anywhere this project touches auth
 * or secrets.
 */
export function mintIdempotencyKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
