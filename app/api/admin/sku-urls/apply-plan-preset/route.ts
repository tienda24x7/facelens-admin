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

function normalizeCatalog(value: any) {
  return String(value || "").trim().toUpperCase();
}

async function getPlanMaxSkus(planCode: string | null | undefined) {
  if (!planCode) return null;

  const normalized = cleanStr(planCode).toUpperCase();

  const { data, error } = await supabase
    .from("facelens_plans")
    .select("plan_code, max_skus")
    .eq("plan_code", normalized)
    .maybeSingle();

  if (error) {
    throw new Error(`Error leyendo facelens_plans: ${error.message}`);
  }

  if (!data) return null;

  return data.max_skus === null || data.max_skus === undefined
    ? null
    : Number(data.max_skus);
}

async function getClientOrThrow(client_id: string) {
  const { data, error } = await supabase
    .from("clientes facelens")
    .select("id, slug, nombre, plan, catalog_scope, catalog_slug")
    .eq("id", client_id)
    .single();

  if (error || !data) {
    throw new Error(`Cliente no encontrado: ${error?.message || client_id}`);
  }

  return data;
}

async function getAllowedUniverseForClient(client: any) {
  const scope = normalizeCatalog(client.catalog_scope || "ALL");
  const catalogFilter = scope === "ALL" ? ["NICOLAS", "EZEQUIEL"] : [scope];

  const { data: memberships, error: membershipsErr } = await supabase
    .from("lentes_catalogos")
    .select("lens_id, catalogo")
    .in("catalogo", catalogFilter);

  if (membershipsErr) {
    throw new Error(`Error leyendo lentes_catalogos: ${membershipsErr.message}`);
  }

  const lensIds = Array.from(
    new Set((memberships || []).map((r: any) => String(r.lens_id || "")).filter(Boolean))
  );

  if (!lensIds.length) return [];

  const catalogsByLensId = new Map<string, Set<string>>();
  for (const row of memberships || []) {
    const lensId = String(row.lens_id || "");
    const catalog = normalizeCatalog(row.catalogo);
    if (!lensId || !catalog) continue;
    if (!catalogsByLensId.has(lensId)) catalogsByLensId.set(lensId, new Set<string>());
    catalogsByLensId.get(lensId)!.add(catalog);
  }

  const { data: lensRows, error: lensErr } = await supabase
    .from("lentes")
    .select("id, sku")
    .in("id", lensIds);

  if (lensErr) {
    throw new Error(`Error leyendo lentes: ${lensErr.message}`);
  }

  const skuByLensId = new Map<string, string>();
  const lensIdBySku = new Map<string, string>();

  for (const row of lensRows || []) {
    const lensId = String(row.id || "");
    const sku = normalizeSku(row.sku);
    if (!lensId || !sku) continue;
    skuByLensId.set(lensId, sku);
    lensIdBySku.set(sku, lensId);
  }

  const skus = Array.from(lensIdBySku.keys());
  if (!skus.length) return [];

  const { data: importRows, error: importErr } = await supabase
    .from("import_lentes")
    .select("sku, rb, nombre_modelo, categoria, proveedor, grupo, activo")
    .in("sku", skus);

  if (importErr) {
    throw new Error(`Error leyendo import_lentes: ${importErr.message}`);
  }

  const importBySku = new Map<string, any>();
  for (const row of importRows || []) {
    const sku = normalizeSku(row.sku);
    if (sku) importBySku.set(sku, row);
  }

  const out: Array<{
    lens_id: string;
    sku: string;
    rb: string;
    nombre: string;
    categoria: string;
    proveedor: string;
    grupo: string;
    activo_base: boolean;
    catalogos: string[];
  }> = [];

  for (const lensId of lensIds) {
    const sku = skuByLensId.get(lensId);
    if (!sku) continue;

    const imp = importBySku.get(sku);
    if (!imp) continue;

    out.push({
      lens_id: lensId,
      sku,
      rb: String(imp.rb || "").trim(),
      nombre: String(imp.nombre_modelo || "").trim(),
      categoria: String(imp.categoria || "").trim(),
      proveedor: String(imp.proveedor || "").trim(),
      grupo: String(imp.grupo || "").trim(),
      activo_base: !!imp.activo,
      catalogos: Array.from(catalogsByLensId.get(lensId) || []).sort(),
    });
  }

  out.sort((a, b) => a.sku.localeCompare(b.sku, "es"));
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const client_id = cleanStr(body?.client_id);

    if (!client_id) {
      return NextResponse.json({ ok: false, error: "Falta client_id" }, { status: 400 });
    }

    const client = await getClientOrThrow(client_id);
    const planCode = cleanStr(client.plan);

    if (!planCode) {
      return NextResponse.json(
        { ok: false, error: "El cliente no tiene plan asignado" },
        { status: 400 }
      );
    }

    const maxSkus = await getPlanMaxSkus(planCode);

    const { data: presetRows, error: presetErr } = await supabase
      .from("facelens_plan_sku_defaults")
      .select("sku, is_active")
      .eq("plan_code", planCode)
      .eq("is_active", true);

    if (presetErr) {
      return NextResponse.json(
        { ok: false, error: `Error leyendo preset: ${presetErr.message}` },
        { status: 500 }
      );
    }

    const presetSkusRaw = (presetRows || [])
      .map((r: any) => normalizeSku(r.sku))
      .filter(Boolean);

    if (!presetSkusRaw.length) {
      return NextResponse.json(
        { ok: false, error: `El plan ${planCode} no tiene preset cargado` },
        { status: 400 }
      );
    }

    const universe = await getAllowedUniverseForClient(client);
    const universeBySku = new Map<string, any>();
    for (const row of universe) {
      universeBySku.set(normalizeSku(row.sku), row);
    }

    let applicableSkus = presetSkusRaw.filter((sku) => universeBySku.has(sku));

    if (maxSkus !== null) {
      applicableSkus = applicableSkus.slice(0, maxSkus);
    }

    const applicableSkuSet = new Set(applicableSkus);

    const allUniverseSkus = universe.map((u) => normalizeSku(u.sku)).filter(Boolean);

    const { data: existingRows, error: existingErr } = await supabase
      .from("facelens_sku_urls")
      .select("client_slug, sku, product_url, is_active")
      .eq("client_slug", cleanStr(client.slug));

    if (existingErr) {
      return NextResponse.json(
        { ok: false, error: `Error leyendo selección del cliente: ${existingErr.message}` },
        { status: 500 }
      );
    }

    const existingBySku = new Map<string, any>();
    for (const row of existingRows || []) {
      const sku = normalizeSku(row.sku);
      if (!sku) continue;
      existingBySku.set(sku, row);
    }

    const upsertRows = allUniverseSkus.map((sku) => {
      const existing = existingBySku.get(sku);
      return {
        client_slug: cleanStr(client.slug),
        sku,
        product_url: cleanStr(existing?.product_url),
        is_active: applicableSkuSet.has(sku),
      };
    });

    if (upsertRows.length > 0) {
      const { error: upsertErr } = await supabase
        .from("facelens_sku_urls")
        .upsert(upsertRows, { onConflict: "client_slug,sku" });

      if (upsertErr) {
        return NextResponse.json(
          { ok: false, error: `Error actualizando selección: ${upsertErr.message}` },
          { status: 500 }
        );
      }
    }

    let updatedCount = 0;
    for (const row of upsertRows) {
      const prev = existingBySku.get(row.sku);
      const prevActive = !!prev?.is_active;
      const prevUrl = cleanStr(prev?.product_url);
      if (prevActive !== row.is_active || prevUrl !== row.product_url) {
        updatedCount++;
      }
      if (!prev) {
        updatedCount++;
      }
    }

    return NextResponse.json({
      ok: true,
      summary: {
        plan_code: planCode,
        preset_total: presetSkusRaw.length,
        applicable_total: applicableSkus.length,
        updated_count: updatedCount,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Error inesperado aplicando preset del plan" },
      { status: 500 }
    );
  }
}