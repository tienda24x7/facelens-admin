import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "facelens-assets";
const FOLDER = "logos";

export async function POST(req: Request) {
  try {
    const db = supabaseAdmin();
    const form = await req.formData();

    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ ok: false, error: "Falta file" }, { status: 400 });

    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const safeName = `${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;
    const path = `${FOLDER}/${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const { error: upErr } = await db.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type || "image/png",
      upsert: false,
    });
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 });

    const { data } = db.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ ok: true, url: data.publicUrl, path }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status: 500 });
  }
}