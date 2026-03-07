import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({ password: "" }));

  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: "ADMIN_PASSWORD missing" }, { status: 500 });
  }

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("facelens_admin", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
  });
  return res;
}