const ENCRYPTION_ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getOrCreateKey(): Promise<CryptoKey> {
  const storedKeyData = localStorage.getItem("drawmaid-encryption-key");

  if (storedKeyData) {
    const keyData = JSON.parse(storedKeyData);
    return crypto.subtle.importKey(
      "jwk",
      keyData,
      { name: ENCRYPTION_ALGORITHM, length: KEY_LENGTH },
      true,
      ["encrypt", "decrypt"],
    );
  }

  const key = await crypto.subtle.generateKey(
    { name: ENCRYPTION_ALGORITHM, length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"],
  );

  const exportedKey = await crypto.subtle.exportKey("jwk", key);
  localStorage.setItem("drawmaid-encryption-key", JSON.stringify(exportedKey));

  return key;
}

export async function encrypt(
  plaintext: string,
): Promise<{ ciphertext: string; iv: string }> {
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const encoder = new TextEncoder();
  const encodedData = encoder.encode(plaintext);

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: ENCRYPTION_ALGORITHM, iv },
    key,
    encodedData,
  );

  return {
    ciphertext: arrayBufferToBase64(encryptedBuffer),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
  };
}

export async function decrypt(ciphertext: string, iv: string): Promise<string> {
  const key = await getOrCreateKey();

  const encryptedBuffer = base64ToArrayBuffer(ciphertext).buffer as ArrayBuffer;
  const ivBuffer = base64ToArrayBuffer(iv).buffer as ArrayBuffer;

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: ENCRYPTION_ALGORITHM, iv: new Uint8Array(ivBuffer) },
    key,
    encryptedBuffer,
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

export function clearEncryptionKey(): void {
  localStorage.removeItem("drawmaid-encryption-key");
}
