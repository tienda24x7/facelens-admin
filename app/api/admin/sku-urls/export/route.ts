import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const CLIENTS_TABLE = "clientes facelens";
const LENSES_TABLE = "lentes";
const MAP_TABLE = "clientes_lentes_urls";

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

export async function GET(req: Request) {
  try {
    const db = supabaseAdmin();
    const url = new URL(req.url);
    const client_id = cleanStr(url.searchParams.get("client_id"));

    if (!client_id) {
      return NextResponse.json({ ok: false, error: "Falta client_id" }, { status: 400 });
    }

    // 1) cliente (plan + scope)
    const { data: c, error: cErr } = await db
      .from(CLIENTS_TABLE)
      .select("id, plan, catalog_scope")
      .eq("id", client_id)
      .maybeSingle();

    if (cErr || !c) {
      return NextResponse.json({ ok: false, error: cErr?.message || "Cliente no encontrado" }, { status: 400 });
    }

    const limitByPlan = planToLimit(c.plan);
    const scope = cleanStr(c.catalog_scope).toUpperCase();

    // 2) lentes permitidos por scope, limitados por plan
    let q = db.from(LENSES_TABLE).select("id, sku, proveedor").order("sku", { ascending: true });
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

    // 4) CSV con urls existentes (si no hay, vacío)
    const lines: string[] = ["sku,product_url"];
    for (const l of allowedLimited) {
      const sku = cleanStr(l.sku);
      const urlVal = mapByLens.get(String(l.id)) || "";
      // escapado simple por si la url trae comas
      const urlCsv = urlVal.includes(",") ? `"${urlVal.replaceAll('"', '""')}"` : urlVal;
      lines.push(`${sku},${urlCsv}`);
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