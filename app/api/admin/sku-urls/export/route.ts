import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const CLIENTS_TABLE = "clientes facelens";
const LENSES_TABLE = "lentes";
const MAP_TABLE = "clientes_lentes_urls";

// ✅ Base real del probador
const FACELENS_LIVE_BASE_URL = "https://facelens-live.vercel.app";

function cleanStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function planToLimit(planRaw: any) {
  const p = cleanStr(planRaw).toUpperCase();
  const m = p.match(/(GO|PRIME)\s*0*(\d{1,4})/i);
  if (m && m[2]) {
    const n = Number(m[2]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  if (p === "ALL" || p === "") return 999999;
  return 999999;
}

function csvCell(v: any) {
  const s = cleanStr(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

function buildTryOnUrl(baseUrl: string, clientSlug?: string, sku?: string) {
  const cleanBase = cleanStr(baseUrl).replace(/\/+$/, "");
  const slug = cleanStr(clientSlug);
  const cleanSku = cleanStr(sku).toUpperCase();

  if (!cleanBase || !slug || !cleanSku) return "";
  return `${cleanBase}/?slug=${encodeURIComponent(slug)}&sku=${encodeURIComponent(cleanSku)}`;
}

export async function GET(req: Request) {
  try {
    const db = supabaseAdmin();
    const url = new URL(req.url);
    const client_id = cleanStr(url.searchParams.get("client_id"));

    if (!client_id) {
      return NextResponse.json({ ok: false, error: "Falta client_id" }, { status: 400 });
    }

    // 1) cliente
    const { data: c, error: cErr } = await db
      .from(CLIENTS_TABLE)
      .select("id, slug, plan, catalog_scope")
      .eq("id", client_id)
      .maybeSingle();

    if (cErr || !c) {
      return NextResponse.json({ ok: false, error: cErr?.message || "Cliente no encontrado" }, { status: 400 });
    }

    const limitByPlan = planToLimit(c.plan);
    const scope = cleanStr(c.catalog_scope).toUpperCase();
    const clientSlug = cleanStr(c.slug);

    // 2) lentes permitidos por scope, limitados por plan
    let q = db
      .from(LENSES_TABLE)
      .select("id, sku, rb, proveedor")
      .order("sku", { ascending: true });

    if (scope && scope !== "ALL") q = q.eq("proveedor", scope);

    const { data: lenses, error: lErr } = await q;
    if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 400 });

    const allowedLimited = (lenses || [])
      .filter((x: any) => cleanStr(x.sku) !== "")
      .slice(0, limitByPlan);

    // 3) mapa de URLs existentes del cliente
    const { data: maps, error: mErr } = await db
      .from(MAP_TABLE)
      .select("lente_id, product_url")
      .eq("cliente_id", client_id);

    if (mErr) return NextResponse.json({ ok: false, error: mErr.message }, { status: 400 });

    const mapByLens = new Map<string, string>();
    for (const r of maps || []) {
      mapByLens.set(String(r.lente_id), cleanStr(r.product_url));
    }

    // 4) CSV con RB + URL existente + URL probador
    const lines: string[] = ["sku,rb,product_url,url_probador"];

    for (const l of allowedLimited) {
      const sku = cleanStr(l.sku);
      const rb = cleanStr(l.rb);
      const productUrl = mapByLens.get(String(l.id)) || "";
      const tryOnUrl = buildTryOnUrl(FACELENS_LIVE_BASE_URL, clientSlug, sku);

      lines.push([
        csvCell(sku),
        csvCell(rb),
        csvCell(productUrl),
        csvCell(tryOnUrl),
      ].join(","));
    }

    const csv = lines.join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="sku_urls_existing_${client_id}.csv"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status: 500 });
  }
}