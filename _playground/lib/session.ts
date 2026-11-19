const encode = new TextEncoder();
export const COOKIE = "playground-session";
export const lifetime = 60 * 60 * 24 * 7;
async function signingKey(password: string) {
  return crypto.subtle.importKey(
    "raw",
    encode.encode("playground-session-v1/" + password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
export async function issue(password: string) {
  const expiry = String(Math.floor(Date.now() / 1000) + lifetime);
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(password),
    encode.encode(expiry),
  );
  return (
    expiry +
    "." +
    Array.from(new Uint8Array(signature), (v) =>
      v.toString(16).padStart(2, "0"),
    ).join("")
  );
}
export async function valid(token: string, password: string) {
  const match = /^(\d{10})\.([0-9a-f]{64})$/.exec(token);
  if (!password || !match || Number(match[1]) <= Date.now() / 1000)
    return false;
  return crypto.subtle.verify(
    "HMAC",
    await signingKey(password),
    Uint8Array.from(match[2].match(/../g)!, (s) => parseInt(s, 16)),
    encode.encode(match[1]),
  );
}
