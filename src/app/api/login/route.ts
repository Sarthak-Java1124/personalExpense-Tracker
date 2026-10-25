import { NextResponse } from "next/server";
import { authEnabled, checkPassword, createSessionToken, SESSION_COOKIE, SESSION_DAYS } from "@/lib/auth";

export async function POST(request: Request) {
  if (!authEnabled()) return NextResponse.json({ ok: true });
  const body = await request.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";
  if (!(await checkPassword(password))) {
    // Slow down guessing a little.
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !request.url.startsWith("http://localhost"),
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return res;
}
