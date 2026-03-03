// Testing phase policy: keep it intentionally simple.
export const PASSWORD_REGEX = /^.{4,}$/;

export const isStrongPassword = (value: string): boolean => PASSWORD_REGEX.test(value);

const PBKDF2_ITERATIONS = 120_000;
const PBKDF2_BITS = 256;
const SALT_BYTES = 16;

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const fromHexToArrayBuffer = (hex: string): ArrayBuffer => {
  const clean = hex.trim();
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return buffer;
};

const randomSaltHex = (): string => {
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  return Array.from(salt)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const pbkdf2Hash = async (password: string, saltHex: string, iterations = PBKDF2_ITERATIONS): Promise<string> => {
  const subtle = crypto.subtle;
  const key = await subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: fromHexToArrayBuffer(saltHex),
      iterations
    },
    key,
    PBKDF2_BITS
  );
  return toHex(bits);
};

export const hashPassword = async (password: string): Promise<string> => {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const saltHex = randomSaltHex();
    const hashHex = await pbkdf2Hash(password, saltHex);
    return `pbkdf2$${PBKDF2_ITERATIONS}$${saltHex}$${hashHex}`;
  }
  return `fallback:${password}`;
};

export const verifyPassword = async (password: string, storedHash: string): Promise<boolean> => {
  if (storedHash.startsWith("fallback:")) return storedHash === `fallback:${password}`;
  if (storedHash.startsWith("pbkdf2$")) {
    if (!(typeof crypto !== "undefined" && crypto.subtle)) return false;
    const [, iterationsRaw, saltHex, hashHex] = storedHash.split("$");
    const iterations = Number.parseInt(iterationsRaw ?? "", 10);
    if (!iterations || !saltHex || !hashHex) return false;
    const current = await pbkdf2Hash(password, saltHex, iterations);
    return current === hashHex;
  }
  // Legacy unsalted hash support (migration path).
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const bytes = new TextEncoder().encode(password);
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return toHex(hash) === storedHash;
  }
  return false;
};
