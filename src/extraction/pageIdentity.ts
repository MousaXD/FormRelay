const FNV64_OFFSET = 0xcbf29ce484222325n;
const FNV64_PRIME = 0x100000001b3n;

function canonicalPrivateUrl(doc: Document): string | null {
  try {
    const url = new URL(doc.location.href);
    url.username = '';
    url.password = '';
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Returns a compact local route identity that includes query and fragment state
 * without exporting those URL components verbatim.
 *
 * This is a collision-resistant-enough routing guard for accidental cross-record
 * fills, not a cryptographic authentication primitive.
 */
export function pageIdentity(doc: Document = document): string | null {
  const canonical = canonicalPrivateUrl(doc);
  if (!canonical) return null;

  let hash = FNV64_OFFSET;
  for (const byte of new TextEncoder().encode(canonical)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * FNV64_PRIME);
  }

  return `frp_${hash.toString(16).padStart(16, '0')}`;
}
