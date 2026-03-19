/**
 * Web Push implementation for Deno/Edge Functions
 * Uses Web Crypto API (no Node.js dependencies)
 * Implements RFC 8291 (Message Encryption) + RFC 8292 (VAPID)
 */

/* ─── Base64url helpers ─── */
function arrayBufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToArrayBuffer(b64url: string): ArrayBuffer {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function concatBuffers(...buffers: ArrayBuffer[]): ArrayBuffer {
  const totalLength = buffers.reduce((sum, b) => sum + b.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buf of buffers) {
    result.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }
  return result.buffer;
}

function encodeText(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function numberToBuffer(num: number, size: number): ArrayBuffer {
  const buf = new ArrayBuffer(size);
  const view = new DataView(buf);
  if (size === 2) view.setUint16(0, num, false);
  else if (size === 4) view.setUint32(0, num, false);
  return buf;
}

/* ─── VAPID Key Generation ─── */
export interface VAPIDKeys {
  publicKey: string;   // base64url-encoded raw public key (65 bytes uncompressed)
  privateKeyJwk: JsonWebKey; // JWK format for import
}

export async function generateVAPIDKeys(): Promise<VAPIDKeys> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );

  const rawPublic = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const jwkPrivate = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

  return {
    publicKey: arrayBufferToBase64url(rawPublic),
    privateKeyJwk: jwkPrivate,
  };
}

/* ─── VAPID JWT Signing ─── */
async function createVAPIDJwt(
  audience: string,
  subject: string,
  privateKeyJwk: JsonWebKey
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60, // 12 hours
    sub: subject,
  };

  const headerB64 = arrayBufferToBase64url(encodeText(JSON.stringify(header)).buffer);
  const payloadB64 = arrayBufferToBase64url(encodeText(JSON.stringify(payload)).buffer);
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import the private key for signing
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateKeyJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  // Sign
  const signatureBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    privateKey,
    encodeText(unsignedToken)
  );

  // Convert DER signature to raw r||s format (64 bytes)
  const rawSignature = derToRaw(new Uint8Array(signatureBuffer));
  const signatureB64 = arrayBufferToBase64url(rawSignature.buffer);

  return `${unsignedToken}.${signatureB64}`;
}

/** Convert DER-encoded ECDSA signature to raw (r||s) 64-byte format */
function derToRaw(der: Uint8Array): Uint8Array {
  // Some implementations return raw already (64 bytes)
  if (der.length === 64) return der;

  // DER format: 0x30 <len> 0x02 <r_len> <r> 0x02 <s_len> <s>
  const raw = new Uint8Array(64);

  let offset = 2; // skip 0x30 and total length
  // Read r
  offset++; // skip 0x02
  const rLen = der[offset++];
  const rStart = offset;
  offset += rLen;

  // Read s
  offset++; // skip 0x02
  const sLen = der[offset++];
  const sStart = offset;

  // Copy r (right-aligned in 32 bytes)
  const r = der.slice(rStart, rStart + rLen);
  const rPad = 32 - rLen;
  if (rPad >= 0) {
    raw.set(r, rPad);
  } else {
    // r has leading zero padding, skip it
    raw.set(r.slice(-32), 0);
  }

  // Copy s (right-aligned in 32 bytes)
  const s = der.slice(sStart, sStart + sLen);
  const sPad = 32 - sLen;
  if (sPad >= 0) {
    raw.set(s, 32 + sPad);
  } else {
    raw.set(s.slice(-32), 32);
  }

  return raw;
}

/* ─── HKDF (RFC 5869) ─── */
async function hkdf(
  salt: ArrayBuffer,
  ikm: ArrayBuffer,
  info: ArrayBuffer,
  length: number
): Promise<ArrayBuffer> {
  // Extract
  const key = await crypto.subtle.importKey(
    "raw",
    salt.byteLength > 0 ? salt : new Uint8Array(32),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const prk = await crypto.subtle.sign("HMAC", key, ikm);

  // Expand
  const infoArray = new Uint8Array(info);
  const prkKey = await crypto.subtle.importKey(
    "raw",
    prk,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const input = new Uint8Array(infoArray.length + 1);
  input.set(infoArray);
  input[infoArray.length] = 1;

  const result = await crypto.subtle.sign("HMAC", prkKey, input);
  return result.slice(0, length);
}

/* ─── Content Encryption (RFC 8291 - aes128gcm) ─── */
interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string; // base64url
    auth: string;   // base64url
  };
}

async function encryptPayload(
  subscription: PushSubscriptionData,
  payload: string
): Promise<{ encrypted: ArrayBuffer; salt: Uint8Array; serverPublicKey: ArrayBuffer }> {
  const plaintext = encodeText(payload);

  // Generate salt (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Generate ephemeral ECDH key pair
  const serverKeys = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const serverPublicKey = await crypto.subtle.exportKey("raw", serverKeys.publicKey);

  // Import subscriber's public key
  const clientPublicKeyBuffer = base64urlToArrayBuffer(subscription.keys.p256dh);
  const clientPublicKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKeyBuffer,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // ECDH shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientPublicKey },
    serverKeys.privateKey,
    256
  );

  // Auth secret
  const authSecret = base64urlToArrayBuffer(subscription.keys.auth);

  // Build info strings for HKDF
  // IKM = HKDF(auth, shared_secret, "WebPush: info" || 0x00 || client_pub || server_pub, 32)
  const keyInfoHeader = encodeText("WebPush: info\0");
  const keyInfo = concatBuffers(
    keyInfoHeader.buffer,
    clientPublicKeyBuffer,
    serverPublicKey
  );

  const ikm = await hkdf(authSecret, sharedSecret, keyInfo, 32);

  // Content encryption key: HKDF(salt, ikm, "Content-Encoding: aes128gcm" || 0x00, 16)
  const cekInfo = encodeText("Content-Encoding: aes128gcm\0");
  const contentEncryptionKey = await hkdf(salt.buffer, ikm, cekInfo.buffer, 16);

  // Nonce: HKDF(salt, ikm, "Content-Encoding: nonce" || 0x00, 12)
  const nonceInfo = encodeText("Content-Encoding: nonce\0");
  const nonce = await hkdf(salt.buffer, ikm, nonceInfo.buffer, 12);

  // Pad the plaintext: data || 0x02 (delimiter)
  const paddedPlaintext = new Uint8Array(plaintext.length + 1);
  paddedPlaintext.set(plaintext);
  paddedPlaintext[plaintext.length] = 2; // padding delimiter

  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey(
    "raw",
    contentEncryptionKey,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, tagLength: 128 },
    aesKey,
    paddedPlaintext
  );

  // Build aes128gcm header: salt(16) || rs(4) || idlen(1) || keyid(65) || ciphertext
  const rs = 4096; // record size
  const header = concatBuffers(
    salt.buffer,
    numberToBuffer(rs, 4),
    new Uint8Array([65]).buffer, // keyid length (65 bytes for uncompressed P-256)
    serverPublicKey,
    ciphertext
  );

  return { encrypted: header, salt, serverPublicKey };
}

/* ─── Send Push Notification ─── */
export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  url?: string;
}

export interface SendResult {
  endpoint: string;
  success: boolean;
  status?: number;
  error?: string;
}

export async function sendPushNotification(
  subscription: PushSubscriptionData,
  payload: PushPayload,
  vapidKeys: VAPIDKeys,
  vapidSubject: string
): Promise<SendResult> {
  try {
    const payloadStr = JSON.stringify(payload);
    const { encrypted } = await encryptPayload(subscription, payloadStr);

    // Build VAPID auth
    const audience = new URL(subscription.endpoint).origin;
    const jwt = await createVAPIDJwt(audience, vapidSubject, vapidKeys.privateKeyJwk);

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "Content-Length": String(encrypted.byteLength),
        TTL: "86400",
        Urgency: "high",
        Authorization: `vapid t=${jwt}, k=${vapidKeys.publicKey}`,
      },
      body: encrypted,
    });

    if (response.status === 201 || response.status === 200) {
      return { endpoint: subscription.endpoint, success: true, status: response.status };
    }

    const errorBody = await response.text().catch(() => "");
    return {
      endpoint: subscription.endpoint,
      success: false,
      status: response.status,
      error: `Push service returned ${response.status}: ${errorBody}`,
    };
  } catch (err) {
    return {
      endpoint: subscription.endpoint,
      success: false,
      error: `Exception sending push: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
