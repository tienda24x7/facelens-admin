import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const TABLE = "clientes facelens";

function cleanStr(v: any) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function isValidSlug(slug: string) {
  // simple: letras/números/_/-
  return /^[a-zA-Z0-9_-]+$/.test(slug);
}

export async function GET() {
  try {
    const db = supabaseAdmin();

    const { data, error } = await db
      .from(TABLE)
      .select("*")
      .order("nombre", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const db = supabaseAdmin();
    const body = await req.json().catch(() => ({}));

    const nombre = cleanStr(body.nombre);
    const slug = cleanStr(body.slug);

    // ✅ Validaciones mínimas
    if (!nombre || !slug) {
      return NextResponse.json(
        { ok: false, error: "Falta nombre o slug" },
        { status: 400 }
      );
    }

    if (!isValidSlug(slug)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Slug inválido. Usá solo letras, números, guion (-) o guion bajo (_), sin espacios.",
        },
        { status: 400 }
      );
    }

    // ✅ Chequeo slug duplicado
    const { data: existing, error: e1 } = await db
      .from(TABLE)
      .select("id")
      .eq("slug", slug)
      .limit(1);

    if (e1) {
      return NextResponse.json({ ok: false, error: e1.message }, { status: 500 });
    }

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Ese slug ya existe. Elegí otro." },
        { status: 409 }
      );
    }

    // ✅ Campos permitidos (whitelist) + limpieza
    // IMPORTANTE: logo_url NO puede ser null (tu tabla tiene NOT NULL)
    const payload: any = {
      nombre,
      slug,
      logo_url: cleanStr(body.logo_url) ?? "", // ✅ evita null (manda "" si falta)
      color_primario: cleanStr(body.color_primario),
      olor_secundario: cleanStr(body.olor_secundario), // viene así en tu schema/json
      activo: body.activo ?? true,
      plan: cleanStr(body.plan),
      whatsapp: cleanStr(body.whatsapp),
      catalog_slug: cleanStr(body.catalog_slug),
      catalog_scope: cleanStr(body.catalog_scope),
      default_url: cleanStr(body.default_url),
    };

    const { data, error } = await db
      .from(TABLE)
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Error" },
      { status: 500 }
    );
  }
}