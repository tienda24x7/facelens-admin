import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CLIENTS_TABLE = "clientes facelens";
const IMPORTED_PRODUCTS_TABLE = "clientes_imported_products";

type ImportedRow = {
  cliente_id: string;
  sku: string | null;
  titulo: string | null;
  facelens_sku: string | null;
  external_product_id: string | null;
  external_variant_id: string | null;
  preview_review_status: string | null;
  preview_resolution: string | null;
  imported_preview_approved: boolean | null;
  approved_image_url: string | null;
  live_visual_mode: string | null;
  live_enabled: boolean | null;
};

function cleanStr(v: unknown) {
  return String(v ?? "").trim();
}

function normalizeSku(v: unknown) {
  return String(v ?? "").trim().toUpperCase();
}

function withCors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Accept");
  return res;
}

function jsonWithCors(body: any, status = 200) {
  return withCors(NextResponse.json(body, { status }));
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const slug = cleanStr(url.searchParams.get("slug"));
    const external_variant_id = cleanStr(url.searchParams.get("external_variant_id"));
    const external_product_id = cleanStr(url.searchParams.get("external_product_id"));
    const sku = normalizeSku(url.searchParams.get("sku"));

    if (!slug) {
      return jsonWithCors(
        {
          ok: false,
          enabled: false,
          reason: "missing_slug",
        },
        400
      );
    }

    const { data: client, error: clientError } = await supabase
      .from(CLIENTS_TABLE)
      .select("id, slug, nombre, activo")
      .eq("slug", slug)
      .maybeSingle();

    if (clientError) {
      return jsonWithCors(
        {
          ok: false,
          enabled: false,
          reason: "client_lookup_error",
          detail: clientError.message,
        },
        500
      );
    }

    if (!client) {
      return jsonWithCors(
        {
          ok: false,
          enabled: false,
          reason: "client_not_found",
        },
        404
      );
    }

    const { data: importedRows, error: importedError } = await supabase
      .from(IMPORTED_PRODUCTS_TABLE)
      .select(
        [
          "cliente_id",
          "sku",
          "titulo",
          "facelens_sku",
          "external_product_id",
          "external_variant_id",
          "preview_review_status",
          "preview_resolution",
          "imported_preview_approved",
          "approved_image_url",
          "live_visual_mode",
          "live_enabled",
        ].join(",")
      )
      .eq("cliente_id", client.id);

    if (importedError) {
      return jsonWithCors(
        {
          ok: false,
          enabled: false,
          reason: "imported_rows_error",
          detail: importedError.message,
        },
        500
      );
    }

    const rows: ImportedRow[] = Array.isArray(importedRows) ? (importedRows as ImportedRow[]) : [];

    const approvedRows = rows.filter((row) => {
      return (
        cleanStr(row.preview_review_status).toLowerCase() === "approved" &&
        cleanStr(row.preview_resolution).toLowerCase() === "approved" &&
        row.imported_preview_approved === true &&
        cleanStr(row.live_visual_mode).toLowerCase() === "imported_preview" &&
        row.live_enabled === true &&
        cleanStr(row.approved_image_url) !== ""
      );
    });

    let matched: ImportedRow | null = null;
    let matchedBy = "";
    let reason = "no_match_for_client";

    if (!matched && external_variant_id) {
      matched =
        approvedRows.find(
          (row) => cleanStr(row.external_variant_id) === external_variant_id
        ) || null;

      if (matched) {
        matchedBy = "external_variant_id";
        reason = "imported_match_with_approved_fallback";
      }
    }

    if (!matched && external_product_id) {
      matched =
        approvedRows.find(
          (row) => cleanStr(row.external_product_id) === external_product_id
        ) || null;

      if (matched) {
        matchedBy = "external_product_id";
        reason = "imported_match_with_approved_fallback";
      }
    }

    if (!matched && sku) {
      matched =
        approvedRows.find((row) => normalizeSku(row.sku) === sku) || null;

      if (matched) {
        matchedBy = "sku";
        reason = "imported_match_with_approved_fallback";
      }
    }

    if (!matched) {
      return jsonWithCors({
        ok: true,
        enabled: false,
        matched_by: null,
        client: {
          id: client.id,
          slug: client.slug,
          nombre: client.nombre,
        },
        product: null,
        live_url: null,
        approved_image_url: null,
        reason,
      });
    }

    const facelensSku = normalizeSku(matched.facelens_sku) || normalizeSku(matched.sku);

    return jsonWithCors({
      ok: true,
      enabled: true,
      mode: "imported_preview",
      matched_by: matchedBy,
      client: {
        id: client.id,
        slug: client.slug,
        nombre: client.nombre,
      },
      product: {
        source: "imported",
        sku: normalizeSku(matched.sku),
        facelens_sku: facelensSku,
        external_product_id: cleanStr(matched.external_product_id),
        external_variant_id: cleanStr(matched.external_variant_id),
        title: cleanStr(matched.titulo),
      },
      live_url: `https://facelens-live.vercel.app/?slug=${encodeURIComponent(
        client.slug
      )}&sku=${encodeURIComponent(facelensSku)}`,
      approved_image_url: cleanStr(matched.approved_image_url),
      reason,
    });
  } catch (error: any) {
    return jsonWithCors(
      {
        ok: false,
        enabled: false,
        reason: "unexpected_error",
        detail: error?.message || String(error),
      },
      500
    );
  }
}