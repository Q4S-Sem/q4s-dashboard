import { createHash, randomBytes } from "node:crypto";

// Eigen API-sleutel per MSP: het platform levert vacatures aan op
// /api/msp/webhook met header `x-api-key`. We bewaren alleen de hash; de sleutel
// zelf zie je één keer bij het aanmaken.

export function hashMspSleutel(sleutel: string): string {
  return createHash("sha256").update(sleutel.trim()).digest("hex");
}

export function nieuweMspSleutel(): { sleutel: string; hash: string } {
  const sleutel = `q4s_msp_${randomBytes(24).toString("base64url")}`;
  return { sleutel, hash: hashMspSleutel(sleutel) };
}
