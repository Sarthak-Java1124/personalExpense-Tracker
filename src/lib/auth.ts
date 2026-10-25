/**
 * Optional single-user password protection. When APP_PASSWORD is set, a signed
 * session cookie is required for every page and API route. Uses Web Crypto so
 * it runs in middleware (edge) and route handlers alike.
 */

export const SESSION_COOKIE = "et_session";
export const SESSION_DAYS = 30;

export function authEnabled(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

const encoder = new TextEncoder();

async function hmac(message: string): Promise<string> {
  // Keyed on the password itself, so changing APP_PASSWORD signs everyone out.
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`expense-tracker:${process.env.AUTH_SECRET ?? ""}:${process.env.APP_PASSWORD ?? ""}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function checkPassword(candidate: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  // Compare digests rather than raw strings so timing doesn't leak the length.
  return timingSafeEqual(await hmac(`pw:${candidate}`), await hmac(`pw:${expected}`));
}

export async function createSessionToken(): Promise<string> {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  return `${expires}.${await hmac(`session:${expires}`)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [expires, sig] = token.split(".");
  if (!expires || !sig || !(Number(expires) > Date.now())) return false;
  return timingSafeEqual(sig, await hmac(`session:${expires}`));
}
