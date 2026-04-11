import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const IMPORTED_PRODUCTS_TABLE = "clientes_imported_products";

type ResolveMode = "native_asset" | "imported_preview" | "disabled";

function cleanStr(value: any) {
  return String(value ?? "").trim();
}

function normalizeSku(value: any) {
  return cleanStr(value).toUpperCase();
}

function normalizeCatalog(value: any) {
  return cleanStr(value).toUpperCase();
}

function normalizeReviewStatus(value: any): "pending" | "approved" | "rejected" {
  const v = cleanStr(value).toLowerCase();
  if (v === "approved" || v === "rejected") return v;
  return "pending";
}

function normalizePreviewResolution(
  value: any
): "pending" | "approved" | "rejected" | "needs_asset" {
  const v = cleanStr(value).toLowerCase();
  if (v === "approved" || v === "rejected" || v === "needs_asset") return v;
  return "pending";
}

function normalizeLiveVisualMode(value: any): ResolveMode {
  const v = cleanStr(value).toLowerCase();
  if (v === "native_asset" || v === "imported_preview") return v;
  return "disabled";
}

function normalizeBool(value: any) {
  return value === true;
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

async function getClientBySlugOrThrow(slug: string) {
  const { data, error } = await supabase
    .from("clientes facelens")
    .select("id, slug, nombre, plan, catalog_scope, catalog_slug, activo")
    .eq("slug", slug)
    .single();

  if (error || !data) {
    throw new Error(`Cliente no encontrado para slug ${slug}`);
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
    const lensId = cleanStr(row.lens_id);
    const catalog = normalizeCatalog(row.catalogo);
    if (!lensId || !catalog) continue;

    if (!catalogsByLensId.has(lensId)) {
      catalogsByLensId.set(lensId, new Set<string>());
    }
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
  for (const row of lensRows || []) {
    const lensId = cleanStr(row.id);
    const sku = normalizeSku(row.sku);
    if (!lensId || !sku) continue;
    skuByLensId.set(lensId, sku);
  }

  const skus = Array.from(skuByLensId.values());
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
      rb: cleanStr(imp.rb),
      nombre: cleanStr(imp.nombre_modelo),
      categoria: cleanStr(imp.categoria),
      proveedor: cleanStr(imp.proveedor),
      grupo: cleanStr(imp.grupo),
      activo_base: !!imp.activo,
      catalogos: Array.from(catalogsByLensId.get(lensId) || []).sort(),
    });
  }

  return out;
}

async function findImportedByVariantId(clientId: string, externalVariantId: string) {
  if (!externalVariantId) return null;

  const { data, error } = await supabase
    .from(IMPORTED_PRODUCTS_TABLE)
    .select(
      [
        "cliente_id",
        "sku",
        "titulo",
        "origin",
        "external_image_url",
        "external_product_url",
        "external_product_id",
        "external_variant_id",
        "image_source",
        "asset_status",
        "facelens_sku",
        "preview_review_status",
        "preview_resolution",
        "imported_preview_approved",
        "approved_image_url",
        "live_visual_mode",
        "live_enabled",
      ].join(",")
    )
    .eq("cliente_id", clientId)
    .eq("external_variant_id", externalVariantId)
    .maybeSingle();

  if (error) {
    throw new Error(`Error leyendo producto importado por variant_id: ${error.message}`);
  }

  return data || null;
}

async function findImportedBySku(clientId: string, sku: string) {
  if (!sku) return null;

  const { data, error } = await supabase
    .from(IMPORTED_PRODUCTS_TABLE)
    .select(
      [
        "cliente_id",
        "sku",
        "titulo",
        "origin",
        "external_image_url",
        "external_product_url",
        "external_product_id",
        "external_variant_id",
        "image_source",
        "asset_status",
        "facelens_sku",
        "preview_review_status",
        "preview_resolution",
        "imported_preview_approved",
        "approved_image_url",
        "live_visual_mode",
        "live_enabled",
      ].join(",")
    )
    .eq("cliente_id", clientId)
    .eq("sku", sku)
    .maybeSingle();

  if (error) {
    throw new Error(`Error leyendo producto importado por sku: ${error.message}`);
  }

  return data || null;
}

async function findImportedByProductId(clientId: string, externalProductId: string) {
  if (!externalProductId) return null;

  const { data, error } = await supabase
    .from(IMPORTED_PRODUCTS_TABLE)
    .select(
      [
        "cliente_id",
        "sku",
        "titulo",
        "origin",
        "external_image_url",
        "external_product_url",
        "external_product_id",
        "external_variant_id",
        "image_source",
        "asset_status",
        "facelens_sku",
        "preview_review_status",
        "preview_resolution",
        "imported_preview_approved",
        "approved_image_url",
        "live_visual_mode",
        "live_enabled",
      ].join(",")
    )
    .eq("cliente_id", clientId)
    .eq("external_product_id", externalProductId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Error leyendo producto importado por product_id: ${error.message}`);
  }

  return data || null;
}

function buildLiveUrl(slug: string, sku: string) {
  return `https://facelens-live.vercel.app/?slug=${encodeURIComponent(slug)}&sku=${encodeURIComponent(
    sku
  )}`;
}

function resolveImportedMode(imported: any): {
  enabled: boolean;
  mode: ResolveMode;
  facelens_sku: string;
  approved_image_url: string | null;
  reason: string;
} {
  const facelensSku = normalizeSku(imported?.facelens_sku) || normalizeSku(imported?.sku);
  const reviewStatus = normalizeReviewStatus(imported?.preview_review_status);
  const previewResolution = normalizePreviewResolution(imported?.preview_resolution);
  const importedPreviewApproved = normalizeBool(imported?.imported_preview_approved);
  const liveVisualMode = normalizeLiveVisualMode(imported?.live_visual_mode);
  const liveEnabled = normalizeBool(imported?.live_enabled);
  const approvedImageUrl = cleanStr(imported?.approved_image_url) || null;
  const hasNativeAssets = hasNativeAssetsByImportedRow(imported);

  if (
    liveEnabled &&
    hasNativeAssets &&
    facelensSku &&
    (liveVisualMode === "native_asset" || liveVisualMode === "disabled")
  ) {
    return {
      enabled: true,
      mode: "native_asset",
      facelens_sku: facelensSku,
      approved_image_url: approvedImageUrl,
      reason: "imported_match_with_native_asset",
    };
  }

  if (
    liveEnabled &&
    facelensSku &&
    reviewStatus === "approved" &&
    previewResolution === "approved" &&
    importedPreviewApproved &&
    liveVisualMode === "imported_preview" &&
    approvedImageUrl
  ) {
    return {
      enabled: true,
      mode: "imported_preview",
      facelens_sku: facelensSku,
      approved_image_url: approvedImageUrl,
      reason: "imported_match_with_approved_fallback",
    };
  }

  if (previewResolution === "needs_asset") {
    return {
      enabled: false,
      mode: "disabled",
      facelens_sku: facelensSku,
      approved_image_url: approvedImageUrl,
      reason: "imported_match_requires_asset",
    };
  }

  if (previewResolution === "rejected") {
    return {
      enabled: false,
      mode: "disabled",
      facelens_sku: facelensSku,
      approved_image_url: approvedImageUrl,
      reason: "imported_match_rejected",
    };
  }

  return {
    enabled: false,
    mode: "disabled",
    facelens_sku: facelensSku,
    approved_image_url: approvedImageUrl,
    reason: "imported_match_not_enabled",
  };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const slug = cleanStr(url.searchParams.get("slug"));
    const externalVariantId = cleanStr(url.searchParams.get("external_variant_id"));
    const externalProductId = cleanStr(url.searchParams.get("external_product_id"));
    const sku = normalizeSku(url.searchParams.get("sku"));

    if (!slug) {
      return NextResponse.json({ error: "Falta slug" }, { status: 400 });
    }

    if (!externalVariantId && !externalProductId && !sku) {
      return NextResponse.json(
        { error: "Debés enviar external_variant_id, external_product_id o sku" },
        { status: 400 }
      );
    }

    const client = await getClientBySlugOrThrow(slug);
    const universe = await getAllowedUniverseForClient(client);
    const universeBySku = new Map<string, any>();

    for (const row of universe) {
      universeBySku.set(normalizeSku(row.sku), row);
    }

    let imported: any = null;
    let matchedBy: "external_variant_id" | "sku" | "external_product_id" | null = null;

    if (externalVariantId) {
      imported = await findImportedByVariantId(client.id, externalVariantId);
      if (imported) matchedBy = "external_variant_id";
    }

    if (!imported && sku) {
      imported = await findImportedBySku(client.id, sku);
      if (imported) matchedBy = "sku";
    }

    if (!imported && externalProductId) {
      imported = await findImportedByProductId(client.id, externalProductId);
      if (imported) matchedBy = "external_product_id";
    }

    if (imported) {
      const importedResolution = resolveImportedMode(imported);
      const resolvedSku = importedResolution.facelens_sku || sku;

      if (importedResolution.enabled && universeBySku.has(resolvedSku)) {
        return NextResponse.json({
          ok: true,
          enabled: true,
          mode: importedResolution.mode,
          matched_by: matchedBy,
          client: {
            id: client.id,
            slug: client.slug,
            nombre: client.nombre,
          },
          product: {
            source: "imported",
            sku: normalizeSku(imported?.sku),
            facelens_sku: resolvedSku,
            external_product_id: cleanStr(imported?.external_product_id) || null,
            external_variant_id: cleanStr(imported?.external_variant_id) || null,
            title: cleanStr(imported?.titulo) || null,
          },
          live_url: buildLiveUrl(client.slug, resolvedSku),
          approved_image_url: importedResolution.approved_image_url,
          reason: importedResolution.reason,
        });
      }

      return NextResponse.json({
        ok: true,
        enabled: false,
        mode: "disabled",
        matched_by: matchedBy,
        client: {
          id: client.id,
          slug: client.slug,
          nombre: client.nombre,
        },
        product: {
          source: "imported",
          sku: normalizeSku(imported?.sku),
          facelens_sku: importedResolution.facelens_sku || null,
          external_product_id: cleanStr(imported?.external_product_id) || null,
          external_variant_id: cleanStr(imported?.external_variant_id) || null,
          title: cleanStr(imported?.titulo) || null,
        },
        live_url: null,
        approved_image_url: importedResolution.approved_image_url,
        reason: importedResolution.reason,
      });
    }

    if (sku && universeBySku.has(sku)) {
      return NextResponse.json({
        ok: true,
        enabled: true,
        mode: "native_asset",
        matched_by: "sku",
        client: {
          id: client.id,
          slug: client.slug,
          nombre: client.nombre,
        },
        product: {
          source: "native",
          sku,
          facelens_sku: sku,
          external_product_id: externalProductId || null,
          external_variant_id: externalVariantId || null,
          title: null,
        },
        live_url: buildLiveUrl(client.slug, sku),
        approved_image_url: null,
        reason: "native_match_by_sku",
      });
    }

    return NextResponse.json({
      ok: true,
      enabled: false,
      mode: "disabled",
      matched_by: null,
      client: {
        id: client.id,
        slug: client.slug,
        nombre: client.nombre,
      },
      product: {
        source: "none",
        sku: sku || null,
        facelens_sku: null,
        external_product_id: externalProductId || null,
        external_variant_id: externalVariantId || null,
        title: null,
      },
      live_url: null,
      approved_image_url: null,
      reason: "no_match_for_client",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Error inesperado en GET shopify product-resolver",
        detail: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}