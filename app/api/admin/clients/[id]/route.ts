import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const TABLE = "clientes facelens";

// Campos permitidos (whitelist) para que no se guarde cualquier cosa
const ALLOWED = new Set([
  "nombre",
  "slug",
  "logo_url",
  "color_primario",
  "olor_secundario", // está así en tu DB/json
  "activo",
  "plan",
  "whatsapp",
  "catalog_slug",
  "catalog_scope",
  "default_url",
]);

function pickAllowed(obj: any) {
  const out: Record<string, any> = {};
  if (!obj || typeof obj !== "object") return out;
  for (const k of Object.keys(obj)) {
    if (ALLOWED.has(k)) out[k] = obj[k];
  }
  return out;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> } // 👈 Next 16
) {
  try {
    const { id } = await ctx.params; // 👈 FIX
    const patchRaw = await req.json().catch(() => ({}));
    const patch = pickAllowed(patchRaw);

    if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    if (!Object.keys(patch).length) {
      return NextResponse.json({ ok: false, error: "Empty patch" }, { status: 400 });
    }

    const db = supabaseAdmin();

    const { data, error } = await db
      .from(TABLE)
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status: 500 });
  }
}