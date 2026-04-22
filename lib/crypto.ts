// ─── M1 Asset DNA Watermark — Crypto Utilities ─────────────────────────────
// Simulates Cloud KMS signing for tamper-evident registry entries

/**
 * Generate a SHA-256 hash of the given data
 */
export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * HMAC-SHA256 signing — simulates Cloud KMS asset hash signing
 */
export async function hmacSign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const sigArray = Array.from(new Uint8Array(signature));
  return sigArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify an HMAC-SHA256 signature
 */
export async function hmacVerify(
  data: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const computed = await hmacSign(data, secret);
  return computed === signature;
}

/**
 * Generate a 64-bit watermark token from a UUID
 * Takes first 16 hex chars (64 bits) of UUID for spread-spectrum embedding
 */
export function generateWatermarkToken(uuid: string): string {
  return uuid.replace(/-/g, '').slice(0, 16);
}

/**
 * Convert a hex token to binary string for LSB embedding
 */
export function tokenToBinary(token: string): string {
  return token
    .split('')
    .map(c => parseInt(c, 16).toString(2).padStart(4, '0'))
    .join('');
}

/**
 * Reconstruct hex token from binary string
 */
export function binaryToToken(binary: string): string {
  let token = '';
  for (let i = 0; i < binary.length; i += 4) {
    const nibble = binary.slice(i, i + 4);
    token += parseInt(nibble, 2).toString(16);
  }
  return token;
}
