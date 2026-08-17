const ENCRYPTION_ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
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

let inMemoryKey: CryptoKey | null = null;

async function getOrCreateKey(): Promise<CryptoKey> {
  if (inMemoryKey) return inMemoryKey;

  const storage = typeof localStorage !== "undefined" ? localStorage : null;
  const storedKeyData = storage
    ? storage.getItem("drawmaid-encryption-key")
    : null;

  if (storedKeyData) {
    try {
      const keyData = JSON.parse(storedKeyData);
      const imported = await crypto.subtle.importKey(
        "jwk",
        keyData,
        { name: ENCRYPTION_ALGORITHM, length: KEY_LENGTH },
        true,
        ["encrypt", "decrypt"],
      );
      inMemoryKey = imported;
      return imported;
    } catch {
      // Fall through to generate new key
    }
  }

  const key = await crypto.subtle.generateKey(
    { name: ENCRYPTION_ALGORITHM, length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"],
  );

  inMemoryKey = key;

  if (storage) {
    try {
      const exportedKey = await crypto.subtle.exportKey("jwk", key);
      storage.setItem("drawmaid-encryption-key", JSON.stringify(exportedKey));
    } catch {
      // Ignore storage errors
    }
  }

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
    ciphertext: arrayBufferToBase64(new Uint8Array(encryptedBuffer)),
    iv: arrayBufferToBase64(iv),
  };
}

export async function decrypt(ciphertext: string, iv: string): Promise<string> {
  const key = await getOrCreateKey();

  const encryptedBytes = base64ToArrayBuffer(ciphertext);
  const ivBytes = base64ToArrayBuffer(iv);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: ENCRYPTION_ALGORITHM, iv: ivBytes as BufferSource },
    key,
    encryptedBytes as BufferSource,
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

export function clearEncryptionKey(): void {
  inMemoryKey = null;
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("drawmaid-encryption-key");
  }
}
