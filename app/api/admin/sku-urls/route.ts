import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type SaveRow = {
  sku: string;
  url?: string;
  is_active?: boolean;
};

type PlanLimits = {
  max_skus: number | null;
  max_urls: number | null;
};

function normalizeSku(value: any) {
  return String(value || "").trim().toUpperCase();
}

function normalizeUrl(value: any) {
  return String(value || "").trim();
}

function normalizeCatalog(value: any) {
  return String(value || "").trim().toUpperCase();
}

function isValidUrl(value: string) {
  if (!value) return true;
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol);
  } catch {
    return false;
  }
}

async function getPlanLimits(planCode: string | null | undefined): Promise<PlanLimits> {
  if (!planCode) {
    return { max_skus: null, max_urls: null };
  }

  const normalized = String(planCode).trim().toUpperCase();

  const { data, error } = await supabase
    .from("facelens_plans")
    .select("plan_code, max_skus, max_urls")
    .eq("plan_code", normalized)
    .maybeSingle();

  if (error) {
    throw new Error(`Error leyendo facelens_plans: ${error.message}`);
  }

  if (!data) {
    return { max_skus: null, max_urls: null };
  }

  return {
    max_skus:
      data.max_skus === null || data.max_skus === undefined
        ? null
        : Number(data.max_skus),
    max_urls:
      data.max_urls === null || data.max_urls === undefined
        ? null
        : Number(data.max_urls),
  };
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

  const catalogFilter =
    scope === "ALL" ? ["NICOLAS", "EZEQUIEL"] : [scope];

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

export async function GET(req: NextRequest) {
  try {
    const client_id = String(new URL(req.url).searchParams.get("client_id") || "").trim();

    if (!client_id) {
      return NextResponse.json({ error: "Falta client_id" }, { status: 400 });
    }

    const client = await getClientOrThrow(client_id);
    const plan = await getPlanLimits(client.plan);
    const universe = await getAllowedUniverseForClient(client);

    const { data: activeRows, error: activeErr } = await supabase
      .from("facelens_sku_urls")
      .select("sku, product_url, is_active")
      .eq("client_slug", client.slug);

    if (activeErr) {
      return NextResponse.json(
        { error: "Error leyendo facelens_sku_urls", detail: activeErr.message },
        { status: 500 }
      );
    }

    const activeBySku = new Map<
      string,
      { is_active: boolean; product_url: string }
    >();

    for (const row of activeRows || []) {
      const sku = normalizeSku(row.sku);
      if (!sku) continue;
      activeBySku.set(sku, {
        is_active: !!row.is_active,
        product_url: normalizeUrl(row.product_url),
      });
    }

    const { data: urlRows, error: urlErr } = await supabase
      .from("clientes_lentes_urls")
      .select("cliente_id, lente_id, product_url")
      .eq("cliente_id", client.id);

    if (urlErr) {
      return NextResponse.json(
        { error: "Error leyendo clientes_lentes_urls", detail: urlErr.message },
        { status: 500 }
      );
    }

    const urlByLensId = new Map<string, string>();
    for (const row of urlRows || []) {
      const lensId = String(row.lente_id || "");
      if (!lensId) continue;
      urlByLensId.set(lensId, normalizeUrl(row.product_url));
    }

    const rows = universe.map((row) => {
      const active = activeBySku.get(row.sku);
      const url =
        active?.product_url ||
        urlByLensId.get(row.lens_id) ||
        "";

      return {
        sku: row.sku,
        rb: row.rb,
        nombre: row.nombre,
        categoria: row.categoria,
        proveedor: row.proveedor,
        grupo: row.grupo,
        catalogos: row.catalogos,
        lens_id: row.lens_id,
        is_active: !!active?.is_active,
        url,
        try_on_url: `https://facelens-live.vercel.app/?slug=${encodeURIComponent(
          String(client.slug || "")
        )}&sku=${encodeURIComponent(row.sku)}`,
      };
    });

    const activeCount = rows.filter((r) => r.is_active).length;
    const urlCount = rows.filter((r) => normalizeUrl(r.url)).length;

    return NextResponse.json({
      ok: true,
      client: {
        id: client.id,
        slug: client.slug,
        nombre: client.nombre,
        plan: client.plan,
        catalog_scope: client.catalog_scope,
        catalog_slug: client.catalog_slug,
      },
      plan: {
        max_skus: plan.max_skus,
        max_urls: plan.max_urls,
        active_count: activeCount,
        active_remaining:
          plan.max_skus === null ? null : Math.max(plan.max_skus - activeCount, 0),
        url_count: urlCount,
        url_remaining:
          plan.max_urls === null ? null : Math.max(plan.max_urls - urlCount, 0),
      },
      rows,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Error inesperado en GET sku-urls",
        detail: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const client_id = String(body?.client_id || "").trim();
    const rawRows = Array.isArray(body?.rows) ? body.rows : [];

    if (!client_id) {
      return NextResponse.json({ error: "Falta client_id" }, { status: 400 });
    }

    if (!rawRows.length) {
      return NextResponse.json(
        { error: "No se recibieron filas para guardar" },
        { status: 400 }
      );
    }

    const client = await getClientOrThrow(client_id);
    const plan = await getPlanLimits(client.plan);
    const universe = await getAllowedUniverseForClient(client);

    const universeBySku = new Map<string, any>();
    for (const row of universe) {
      universeBySku.set(normalizeSku(row.sku), row);
    }

    const inputRows: SaveRow[] = rawRows.map((r: any) => ({
      sku: normalizeSku(r?.sku),
      url: normalizeUrl(r?.url),
      is_active: !!r?.is_active,
    }));

    const deduped = new Map<string, SaveRow>();
    const invalid: Array<{ sku: string; url: string; reason: string }> = [];
    let duplicate_count = 0;

    for (const row of inputRows) {
      if (!row.sku) {
        invalid.push({
          sku: "",
          url: normalizeUrl(row.url),
          reason: "missing_sku",
        });
        continue;
      }

      if (row.url && !isValidUrl(row.url)) {
        invalid.push({
          sku: row.sku,
          url: row.url,
          reason: "invalid_url",
        });
        continue;
      }

      if (deduped.has(row.sku)) duplicate_count++;
      deduped.set(row.sku, row);
    }

    const rows = Array.from(deduped.values());

    const notAllowed: Array<{ sku: string; reason: string }> = [];
    const allowedRows: SaveRow[] = [];

    for (const row of rows) {
      if (!universeBySku.has(row.sku)) {
        notAllowed.push({
          sku: row.sku,
          reason: "sku_not_allowed_for_client",
        });
        continue;
      }
      allowedRows.push(row);
    }

    const activeRequestedCount = allowedRows.filter((r) => r.is_active).length;
    const urlRequestedCount = allowedRows.filter((r) => normalizeUrl(r.url)).length;

    if (plan.max_skus !== null && activeRequestedCount > plan.max_skus) {
      return NextResponse.json(
        {
          error: `El plan permite máximo ${plan.max_skus} SKUs activos y estás intentando guardar ${activeRequestedCount}.`,
        },
        { status: 400 }
      );
    }

    if (plan.max_urls !== null && urlRequestedCount > plan.max_urls) {
      return NextResponse.json(
        {
          error: `El plan permite máximo ${plan.max_urls} URLs de producto y estás intentando guardar ${urlRequestedCount}.`,
        },
        { status: 400 }
      );
    }

    const upsertRows = allowedRows.map((row) => ({
      client_slug: String(client.slug || "").trim(),
      sku: row.sku,
      product_url: normalizeUrl(row.url),
      is_active: !!row.is_active,
    }));

    if (upsertRows.length > 0) {
      const { error: upsertErr } = await supabase
        .from("facelens_sku_urls")
        .upsert(upsertRows, { onConflict: "client_slug,sku" });

      if (upsertErr) {
        return NextResponse.json(
          { error: "Error guardando facelens_sku_urls", detail: upsertErr.message },
          { status: 500 }
        );
      }
    }

    const toDeleteUrls = allowedRows
      .filter((r) => !normalizeUrl(r.url))
      .map((r) => universeBySku.get(r.sku)?.lens_id)
      .filter(Boolean);

    if (toDeleteUrls.length > 0) {
      const { error: deleteErr } = await supabase
        .from("clientes_lentes_urls")
        .delete()
        .eq("cliente_id", client.id)
        .in("lente_id", toDeleteUrls);

      if (deleteErr) {
        return NextResponse.json(
          { error: "Error borrando URLs vacías", detail: deleteErr.message },
          { status: 500 }
        );
      }
    }

    const urlUpserts = allowedRows
      .filter((r) => normalizeUrl(r.url))
      .map((r) => {
        const universeRow = universeBySku.get(r.sku);
        return {
          cliente_id: client.id,
          lente_id: universeRow.lens_id,
          product_url: normalizeUrl(r.url),
        };
      });

    if (urlUpserts.length > 0) {
      const { error: urlUpsertErr } = await supabase
        .from("clientes_lentes_urls")
        .upsert(urlUpserts, { onConflict: "cliente_id,lente_id" });

      if (urlUpsertErr) {
        return NextResponse.json(
          { error: "Error guardando clientes_lentes_urls", detail: urlUpsertErr.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      summary: {
        input_rows: inputRows.length,
        deduped_rows: rows.length,
        duplicate_count,
        invalid_count: invalid.length,
        not_allowed_count: notAllowed.length,
        saved_count: allowedRows.length,
        active_count: activeRequestedCount,
        url_count: urlRequestedCount,
      },
      details: {
        invalid,
        not_allowed: notAllowed,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Error inesperado en POST sku-urls",
        detail: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}