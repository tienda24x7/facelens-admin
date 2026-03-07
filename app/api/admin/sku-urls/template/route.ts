import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const CLIENTS_TABLE = "clientes facelens";
const LENSES_TABLE = "lentes";

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

export async function GET(req: Request) {
  try {
    const db = supabaseAdmin();
    const url = new URL(req.url);
    const client_id = cleanStr(url.searchParams.get("client_id"));

    if (!client_id) {
      return NextResponse.json({ ok: false, error: "Falta client_id" }, { status: 400 });
    }

    // Cliente
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

    // Lentes permitidos por scope
    let q = db
      .from(LENSES_TABLE)
      .select("sku, rb, proveedor")
      .order("sku", { ascending: true });

    if (scope && scope !== "ALL") q = q.eq("proveedor", scope);

    const { data: lenses, error: lErr } = await q;
    if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 400 });

    const allowed = (lenses || [])
      .filter((x: any) => cleanStr(x.sku) !== "")
      .slice(0, limitByPlan);

    // CSV plantilla (sku,rb,product_url)
    const lines = ["sku,rb,product_url"];

    for (const lens of allowed) {
      lines.push([
        csvCell(lens.sku),
        csvCell(lens.rb),
        ""
      ].join(","));
    }

    const csv = lines.join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="sku_urls_${client_id}.csv"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status: 500 });
  }
}