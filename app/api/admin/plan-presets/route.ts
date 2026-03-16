import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function cleanStr(v: any) {
  return String(v ?? "").trim();
}

function normalizeSku(v: any) {
  return cleanStr(v).toUpperCase();
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const plan = cleanStr(url.searchParams.get("plan"));
    const search = cleanStr(url.searchParams.get("search")).toLowerCase();

    if (!plan) {
      return NextResponse.json({ ok: false, error: "Falta plan" }, { status: 400 });
    }

    const { data: presetRows, error: presetErr } = await supabase
      .from("facelens_plan_sku_defaults")
      .select("sku, is_active")
      .eq("plan_code", plan);

    if (presetErr) {
      return NextResponse.json(
        { ok: false, error: `Error leyendo preset: ${presetErr.message}` },
        { status: 500 }
      );
    }

    const presetSkuSet = new Set(
      (presetRows || [])
        .filter((r: any) => r?.is_active)
        .map((r: any) => normalizeSku(r.sku))
        .filter(Boolean)
    );

    const { data: lenses, error: lensesErr } = await supabase
      .from("import_lentes")
      .select("sku, rb, nombre_modelo, categoria, proveedor, grupo, activo");

    if (lensesErr) {
      return NextResponse.json(
        { ok: false, error: `Error leyendo catálogo: ${lensesErr.message}` },
        { status: 500 }
      );
    }

    let rows = (lenses || []).map((r: any) => {
      const sku = normalizeSku(r.sku);
      return {
        sku,
        rb: cleanStr(r.rb),
        nombre_modelo: cleanStr(r.nombre_modelo),
        categoria: cleanStr(r.categoria),
        proveedor: cleanStr(r.proveedor),
        grupo: cleanStr(r.grupo),
        activo_catalogo: !!r.activo,
        selected: presetSkuSet.has(sku),
      };
    });

    if (search) {
      rows = rows.filter((r: any) => {
        return (
          r.sku.toLowerCase().includes(search) ||
          r.rb.toLowerCase().includes(search) ||
          r.nombre_modelo.toLowerCase().includes(search) ||
          r.categoria.toLowerCase().includes(search) ||
          r.proveedor.toLowerCase().includes(search) ||
          r.grupo.toLowerCase().includes(search)
        );
      });
    }

    rows.sort((a: any, b: any) => {
      if (a.selected !== b.selected) return a.selected ? -1 : 1;
      return a.sku.localeCompare(b.sku, "es");
    });

    return NextResponse.json({
      ok: true,
      plan_code: plan,
      summary: {
        total_catalog_rows: rows.length,
        selected_count: rows.filter((r: any) => r.selected).length,
      },
      rows,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Error inesperado en GET plan-presets" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const plan_code = cleanStr(body?.plan_code);
    const rawSkus = Array.isArray(body?.skus) ? body.skus : [];

    if (!plan_code) {
      return NextResponse.json({ ok: false, error: "Falta plan_code" }, { status: 400 });
    }

    const skus = Array.from(
      new Set(rawSkus.map((s: any) => normalizeSku(s)).filter(Boolean))
    );

    const { error: deleteErr } = await supabase
      .from("facelens_plan_sku_defaults")
      .delete()
      .eq("plan_code", plan_code);

    if (deleteErr) {
      return NextResponse.json(
        { ok: false, error: `Error limpiando preset anterior: ${deleteErr.message}` },
        { status: 500 }
      );
    }

    if (skus.length > 0) {
      const payload = skus.map((sku) => ({
        plan_code,
        sku,
        is_active: true,
      }));

      const { error: insertErr } = await supabase
        .from("facelens_plan_sku_defaults")
        .insert(payload);

      if (insertErr) {
        return NextResponse.json(
          { ok: false, error: `Error guardando preset: ${insertErr.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      plan_code,
      saved_count: skus.length,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Error inesperado en POST plan-presets" },
      { status: 500 }
    );
  }
}