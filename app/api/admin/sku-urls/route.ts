import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const IMPORTED_PRODUCTS_TABLE = "clientes_imported_products";

type SaveRow = {
  sku: string;
  url?: string;
  is_active?: boolean;
};

type PlanLimits = {
  max_skus: number | null;
  max_urls: number | null;
};

type ClientRow = {
  id: string;
  slug: string | null;
  nombre: string | null;
  plan: string | null;
  catalog_scope: string | null;
  catalog_slug: string | null;
};

type ImportedProductRow = {
  cliente_id: string;
  sku: string;
  titulo: string | null;
  categoria: string | null;
  origin: string | null;
  external_image_url: string | null;
  external_product_url: string | null;
  external_product_id: string | null;
  external_variant_id: string | null;
  image_source: string | null;
  asset_status: string | null;
  last_sync_at: string | null;
  facelens_sku: string | null;
  preview_review_status: string | null;
  preview_resolution: string | null;
  imported_preview_approved: boolean | null;
  approved_image_url: string | null;
  live_visual_mode: string | null;
  live_enabled: boolean | null;
};

type AllowedUniverseRow = {
  lens_id: string;
  sku: string;
  rb: string;
  nombre: string;
  categoria: string;
  proveedor: string;
  grupo: string;
  activo_base: boolean;
  catalogos: string[];
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

function cleanStr(value: any) {
  return String(value ?? "").trim();
}

function normalizeReviewStatus(value: any) {
  const v = cleanStr(value).toLowerCase();
  if (v === "approved" || v === "rejected") return v;
  return "pending";
}

function normalizePreviewResolution(value: any) {
  const v = cleanStr(value).toLowerCase();
  if (v === "approved" || v === "rejected" || v === "needs_asset") return v;
  return "pending";
}

function normalizeLiveVisualMode(value: any) {
  const v = cleanStr(value).toLowerCase();
  if (v === "native_asset" || v === "imported_preview") return v;
  return "disabled";
}

function normalizeBool(value: any) {
  return value === true;
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

function hasImportedOrigin(row: any) {
  const origin = cleanStr(row?.origin).toLowerCase();
  return origin !== "" && origin !== "manual";
}

function hasImportedImage(row: any) {
  return !!cleanStr(row?.external_image_url);
}

function hasNativeAssetsByImportedRow(row: any) {
  const assetStatus = cleanStr(row?.asset_status).toLowerCase();
  const imageSource = cleanStr(row?.image_source).toLowerCase();
  const liveVisualMode = normalizeLiveVisualMode(row?.live_visual_mode);

  if (assetStatus === "ready") return true;
  if (imageSource === "facelens_assets") return true;
  if (liveVisualMode === "native_asset") return true;

  return false;
}

function compareSkuLike(a: string, b: string) {
  const an = Number(a);
  const bn = Number(b);

  const aIsNum = Number.isFinite(an) && String(an) === a;
  const bIsNum = Number.isFinite(bn) && String(bn) === b;

  if (aIsNum && bIsNum) return an - bn;
  return a.localeCompare(b, "es");
}

function sortRowsForUi(rows: any[]) {
  return [...rows].sort((a, b) => {
    const aImported = hasImportedOrigin(a) ? 1 : 0;
    const bImported = hasImportedOrigin(b) ? 1 : 0;
    if (aImported !== bImported) return bImported - aImported;

    const aHasUrl = normalizeUrl(a?.url) ? 1 : 0;
    const bHasUrl = normalizeUrl(b?.url) ? 1 : 0;
    if (aHasUrl !== bHasUrl) return bHasUrl - aHasUrl;

    const aHasImg = hasImportedImage(a) ? 1 : 0;
    const bHasImg = hasImportedImage(b) ? 1 : 0;
    if (aHasImg !== bHasImg) return bHasImg - aHasImg;

    return compareSkuLike(String(a?.sku || ""), String(b?.sku || ""));
  });
}

function buildVisualMeta(params: {
  imported?: ImportedProductRow | null;
  importedOnly: boolean;
  hasNativeBase: boolean;
}) {
  const { imported, importedOnly, hasNativeBase } = params;

  const importedOrigin = hasImportedOrigin(imported);
  const hasImportedImg = !!cleanStr(imported?.external_image_url);
  const approvedImageUrl = cleanStr(imported?.approved_image_url) || null;
  const importedPreviewApproved = normalizeBool(imported?.imported_preview_approved);
  const previewReviewStatus = normalizeReviewStatus(imported?.preview_review_status);
  const previewResolution = normalizePreviewResolution(imported?.preview_resolution);
  const liveVisualMode = normalizeLiveVisualMode(imported?.live_visual_mode);
  const liveEnabled = normalizeBool(imported?.live_enabled);
  const importedProductUrl = cleanStr(imported?.external_product_url) || null;
  const nativeAssetsFromImported = hasNativeAssetsByImportedRow(imported);

  const hasNativeAssets = importedOnly
    ? nativeAssetsFromImported
    : hasNativeBase && (nativeAssetsFromImported || !hasImportedImg);

  const approvedFallbackReady =
    liveEnabled &&
    importedPreviewApproved &&
    previewReviewStatus === "approved" &&
    previewResolution === "approved" &&
    liveVisualMode === "imported_preview" &&
    !!approvedImageUrl;

  let sourceType: "native" | "imported" | "merged" = "native";
  if (importedOnly) {
    sourceType = "imported";
  } else if (importedOrigin) {
    sourceType = "merged";
  }

  let imageUrlFinal: string | null = null;
  if (hasNativeAssets) {
    imageUrlFinal = approvedFallbackReady ? approvedImageUrl : null;
  } else if (approvedFallbackReady) {
    imageUrlFinal = approvedImageUrl;
  } else if (hasImportedImg) {
    imageUrlFinal = cleanStr(imported?.external_image_url);
  }

  let canRenderInLive = false;

  if (hasNativeAssets) {
    canRenderInLive = liveEnabled || !importedOrigin;
  } else if (approvedFallbackReady) {
    canRenderInLive = true;
  } else {
    canRenderInLive = false;
  }

  let visualStatus:
    | "ready_native"
    | "ready_merged"
    | "fallback_imported_image"
    | "imported_only"
    | "missing_assets"
    | "inactive_warning";

  if (importedOnly) {
    if (approvedFallbackReady) {
      visualStatus = "fallback_imported_image";
    } else if (previewResolution === "needs_asset") {
      visualStatus = "missing_assets";
    } else if (hasNativeAssets && canRenderInLive) {
      visualStatus = "imported_only";
    } else if (hasImportedImg && !canRenderInLive) {
      visualStatus = "inactive_warning";
    } else {
      visualStatus = "missing_assets";
    }
  } else if (sourceType === "native") {
    visualStatus = "ready_native";
  } else if (hasNativeAssets && canRenderInLive) {
    visualStatus = "ready_merged";
  } else if (approvedFallbackReady) {
    visualStatus = "fallback_imported_image";
  } else if (previewResolution === "needs_asset") {
    visualStatus = "missing_assets";
  } else if (hasImportedImg && !canRenderInLive) {
    visualStatus = "inactive_warning";
  } else {
    visualStatus = "missing_assets";
  }

  return {
    source_type: sourceType,
    is_imported_only: importedOnly,
    has_native_assets: hasNativeAssets,
    has_imported_image: hasImportedImg,
    image_url_final: imageUrlFinal,
    can_render_in_live: canRenderInLive,
    visual_status: visualStatus,
    imported_origin: importedOrigin ? cleanStr(imported?.origin) || null : null,
    imported_product_url: importedProductUrl,
    approved_fallback_ready: approvedFallbackReady,
    preview_resolution: previewResolution,
  };
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

async function getClientOrThrow(client_id: string): Promise<ClientRow> {
  const { data, error } = await supabase
    .from("clientes facelens")
    .select("id, slug, nombre, plan, catalog_scope, catalog_slug")
    .eq("id", client_id)
    .single();

  if (error || !data) {
    throw new Error(`Cliente no encontrado: ${error?.message || client_id}`);
  }

  if (typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Respuesta inválida del cliente");
  }

  return data as unknown as ClientRow;
}

async function getAllowedUniverseForClient(client: ClientRow): Promise<AllowedUniverseRow[]> {
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

  const out: AllowedUniverseRow[] = [];

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

async function getImportedProductsForClient(
  clientId: string
): Promise<ImportedProductRow[]> {
  try {
    const { data, error } = await supabase
      .from(IMPORTED_PRODUCTS_TABLE)
      .select(
        [
          "cliente_id",
          "sku",
          "titulo",
          "categoria",
          "origin",
          "external_image_url",
          "external_product_url",
          "external_product_id",
          "external_variant_id",
          "image_source",
          "asset_status",
          "last_sync_at",
          "facelens_sku",
          "preview_review_status",
          "preview_resolution",
          "imported_preview_approved",
          "approved_image_url",
          "live_visual_mode",
          "live_enabled",
        ].join(",")
      )
      .eq("cliente_id", clientId);

    if (error) {
      console.warn("No se pudieron leer productos importados:", error.message);
      return [];
    }

    if (!Array.isArray(data)) {
      return [];
    }

    return data as unknown as ImportedProductRow[];
  } catch (e) {
    console.warn("Error leyendo productos importados:", e);
    return [];
  }
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
    const importedProducts = await getImportedProductsForClient(client.id);

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

    const activeBySku = new Map<string, { is_active: boolean; product_url: string }>();

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

    const importedBySku = new Map<string, ImportedProductRow>();
    for (const item of importedProducts) {
      const sku = normalizeSku(item.sku);
      if (!sku) continue;
      importedBySku.set(sku, item);
    }

    const baseRows = universe.map((row) => {
      const active = activeBySku.get(row.sku);
      const imported = importedBySku.get(row.sku);
      const url =
        active?.product_url ||
        urlByLensId.get(row.lens_id) ||
        normalizeUrl(imported?.external_product_url) ||
        "";

      const resolvedLiveSku = normalizeSku(imported?.facelens_sku) || row.sku;

      const visualMeta = buildVisualMeta({
        imported,
        importedOnly: false,
        hasNativeBase: true,
      });

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
        )}&sku=${encodeURIComponent(resolvedLiveSku)}`,

        facelens_sku: resolvedLiveSku,
        preview_review_status: normalizeReviewStatus(imported?.preview_review_status),
        imported_preview_approved: normalizeBool(imported?.imported_preview_approved),
        approved_image_url: cleanStr(imported?.approved_image_url) || null,
        live_visual_mode: normalizeLiveVisualMode(imported?.live_visual_mode),
        live_enabled: normalizeBool(imported?.live_enabled),

        origin: cleanStr(imported?.origin) || "manual",
        asset_status:
          cleanStr(imported?.asset_status) ||
          (visualMeta.has_imported_image ? "fallback" : "ready"),
        image_source:
          cleanStr(imported?.image_source) ||
          (visualMeta.has_imported_image ? "shopify_image" : "facelens_assets"),
        external_image_url: cleanStr(imported?.external_image_url) || null,
        external_product_url: cleanStr(imported?.external_product_url) || null,
        external_product_id: cleanStr(imported?.external_product_id) || null,
        external_variant_id: cleanStr(imported?.external_variant_id) || null,
        last_sync_at: cleanStr(imported?.last_sync_at) || null,

        ...visualMeta,
      };
    });

    const knownSkus = new Set(baseRows.map((r) => normalizeSku(r.sku)));

    const importedOnlyRows = importedProducts
      .filter((item) => {
        const sku = normalizeSku(item.sku);
        return sku && !knownSkus.has(sku);
      })
      .map((item) => {
        const sku = normalizeSku(item.sku);
        const active = activeBySku.get(sku);
        const url = active?.product_url || normalizeUrl(item.external_product_url) || "";
        const resolvedLiveSku = normalizeSku(item.facelens_sku) || sku;

        const visualMeta = buildVisualMeta({
          imported: item,
          importedOnly: true,
          hasNativeBase: false,
        });

        return {
          sku,
          rb: "",
          nombre: cleanStr(item.titulo) || sku,
          categoria: cleanStr(item.categoria) || "",
          proveedor: "",
          grupo: "",
          catalogos: [],
          lens_id: "",
          is_active: !!active?.is_active,
          url,
          try_on_url: `https://facelens-live.vercel.app/?slug=${encodeURIComponent(
            String(client.slug || "")
          )}&sku=${encodeURIComponent(resolvedLiveSku)}`,

          facelens_sku: resolvedLiveSku,
          preview_review_status: normalizeReviewStatus(item.preview_review_status),
          imported_preview_approved: normalizeBool(item.imported_preview_approved),
          approved_image_url: cleanStr(item.approved_image_url) || null,
          live_visual_mode: normalizeLiveVisualMode(item.live_visual_mode),
          live_enabled: normalizeBool(item.live_enabled),

          origin: cleanStr(item.origin) || "shopify",
          asset_status:
            cleanStr(item.asset_status) ||
            (visualMeta.has_imported_image ? "fallback" : "missing"),
          image_source:
            cleanStr(item.image_source) ||
            (visualMeta.has_imported_image ? "shopify_image" : "none"),
          external_image_url: cleanStr(item.external_image_url) || null,
          external_product_url: cleanStr(item.external_product_url) || null,
          external_product_id: cleanStr(item.external_product_id) || null,
          external_variant_id: cleanStr(item.external_variant_id) || null,
          last_sync_at: cleanStr(item.last_sync_at) || null,

          ...visualMeta,
        };
      });

    const rows = sortRowsForUi([...baseRows, ...importedOnlyRows]);

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

    const universeBySku = new Map<string, AllowedUniverseRow>();
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

    const importedProducts = await getImportedProductsForClient(client.id);
    const importedSkuSet = new Set(
      importedProducts.map((item) => normalizeSku(item.sku)).filter(Boolean)
    );

    const notAllowed: Array<{ sku: string; reason: string }> = [];
    const allowedRows: SaveRow[] = [];

    for (const row of rows) {
      if (!universeBySku.has(row.sku) && !importedSkuSet.has(row.sku)) {
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
      .filter((r) => universeBySku.has(r.sku))
      .map((r) => {
        const universeRow = universeBySku.get(r.sku)!;
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