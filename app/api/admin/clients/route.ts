import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const TABLE = "clientes facelens";
const TOKENS_TABLE = "client_metrics_tokens";

function cleanStr(v: any) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function isValidSlug(slug: string) {
  return /^[a-zA-Z0-9_-]+$/.test(slug);
}

function normalizeBool(v: any, fallback = false) {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "1" || v === 1) return true;
  if (v === "false" || v === "0" || v === 0) return false;
  return fallback;
}

export async function GET() {
  try {
    const db = supabaseAdmin();

    const { data: clients, error: clientsError } = await db
      .from(TABLE)
      .select("*")
      .or("archived.is.null,archived.eq.false")
      .order("nombre", { ascending: true });

    if (clientsError) {
      return NextResponse.json(
        { ok: false, error: clientsError.message },
        { status: 500 }
      );
    }

    const slugs = (clients || [])
      .map((c: any) => cleanStr(c.slug))
      .filter(Boolean);

    let tokenBySlug = new Map<string, string>();

    if (slugs.length > 0) {
      const { data: tokens, error: tokensError } = await db
        .from(TOKENS_TABLE)
        .select("slug, token")
        .in("slug", slugs);

      if (tokensError) {
        return NextResponse.json(
          { ok: false, error: tokensError.message },
          { status: 500 }
        );
      }

      tokenBySlug = new Map(
        (tokens || []).map((t: any) => [
          String(t.slug).trim(),
          String(t.token || "").trim(),
        ])
      );
    }

    const data = (clients || []).map((client: any) => ({
      ...client,
      metrics_token: tokenBySlug.get(String(client.slug || "").trim()) || null,
    }));

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

    const { data: existing, error: e1 } = await db
      .from(TABLE)
      .select("id")
      .eq("slug", slug)
      .or("archived.is.null,archived.eq.false")
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

    const payload: any = {
      nombre,
      slug,
      logo_url: cleanStr(body.logo_url) ?? "",
      color_primario: cleanStr(body.color_primario),
      olor_secundario: cleanStr(body.olor_secundario),
      activo: body.activo ?? true,
      plan: cleanStr(body.plan),
      comercial: cleanStr(body.comercial),
      whatsapp: cleanStr(body.whatsapp),
      catalog_slug: cleanStr(body.catalog_slug),
      catalog_scope: cleanStr(body.catalog_scope),
      default_url: cleanStr(body.default_url),
      locale: cleanStr(body.locale) || "es",
      archived: false,

      store_platform: cleanStr(body.store_platform) || "none",
      store_status: cleanStr(body.store_status) || "not_connected",
      shopify_store_domain: cleanStr(body.shopify_store_domain),
      shopify_access_token: cleanStr(body.shopify_access_token),
      shopify_auth_mode: cleanStr(body.shopify_auth_mode) || "token",
      shopify_client_id: cleanStr(body.shopify_client_id),
      shopify_client_secret: cleanStr(body.shopify_client_secret),
      store_import_enabled: normalizeBool(body.store_import_enabled, false),
      store_import_mode: cleanStr(body.store_import_mode) || "facelens_only",
      store_import_filters: cleanStr(body.store_import_filters),
      last_store_sync_at: cleanStr(body.last_store_sync_at),
      last_store_sync_result: cleanStr(body.last_store_sync_result),
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