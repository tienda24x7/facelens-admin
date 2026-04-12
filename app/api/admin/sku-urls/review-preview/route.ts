import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const IMPORTED_PRODUCTS_TABLE = "clientes_imported_products";

type ReviewAction = "approve" | "reject" | "needs_asset";

type ClientRow = {
  id: string;
  slug: string | null;
  nombre: string | null;
};

type ImportedProductRow = {
  cliente_id: string;
  sku: string;
  titulo: string | null;
  origin: string | null;
  external_image_url: string | null;
  external_product_url: string | null;
  external_product_id: string | null;
  external_variant_id: string | null;
  facelens_sku: string | null;
  preview_review_status: string | null;
  imported_preview_approved: boolean | null;
  approved_image_url: string | null;
  live_visual_mode: string | null;
  live_enabled: boolean | null;
};

function normalizeSku(value: any) {
  return String(value || "").trim().toUpperCase();
}

function cleanStr(value: any) {
  return String(value ?? "").trim();
}

function normalizeAction(value: any): ReviewAction | null {
  const v = cleanStr(value).toLowerCase();
  if (v === "approve" || v === "reject" || v === "needs_asset") return v;
  return null;
}

async function getClientOrThrow(client_id: string): Promise<ClientRow> {
  const { data, error } = await supabase
    .from("clientes facelens")
    .select("id, slug, nombre")
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

async function getImportedProductOrThrow(
  clientId: string,
  sku: string
): Promise<ImportedProductRow> {
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
        "facelens_sku",
        "preview_review_status",
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
    throw new Error(`Error leyendo producto importado: ${error.message}`);
  }

  if (!data) {
    throw new Error(`No se encontró producto importado para SKU ${sku}`);
  }

  if (typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Respuesta inválida del producto importado");
  }

  return data as unknown as ImportedProductRow;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const client_id = cleanStr(body?.client_id);
    const sku = normalizeSku(body?.sku);
    const action = normalizeAction(body?.action);

    if (!client_id) {
      return NextResponse.json({ error: "Falta client_id" }, { status: 400 });
    }

    if (!sku) {
      return NextResponse.json({ error: "Falta sku" }, { status: 400 });
    }

    if (!action) {
      return NextResponse.json(
        { error: "Acción inválida. Usar approve, reject o needs_asset." },
        { status: 400 }
      );
    }

    const client = await getClientOrThrow(client_id);
    const imported = await getImportedProductOrThrow(client.id, sku);

    const externalImageUrl = cleanStr(imported.external_image_url);

    if (action === "approve" && !externalImageUrl) {
      return NextResponse.json(
        {
          error:
            "No se puede aprobar fallback porque el producto no tiene external_image_url.",
        },
        { status: 400 }
      );
    }

    let patch: Record<string, any> = {};

    if (action === "approve") {
      patch = {
        preview_review_status: "approved",
        imported_preview_approved: true,
        approved_image_url: externalImageUrl,
        live_visual_mode: "imported_preview",
        live_enabled: true,
      };
    }

    if (action === "reject") {
      patch = {
        preview_review_status: "rejected",
        imported_preview_approved: false,
        approved_image_url: null,
        live_visual_mode: "disabled",
        live_enabled: false,
      };
    }

    if (action === "needs_asset") {
      patch = {
        preview_review_status: "rejected",
        imported_preview_approved: false,
        approved_image_url: null,
        live_visual_mode: "disabled",
        live_enabled: false,
      };
    }

    const { data: updated, error: updateErr } = await supabase
      .from(IMPORTED_PRODUCTS_TABLE)
      .update(patch)
      .eq("cliente_id", client.id)
      .eq("sku", sku)
      .select(
        [
          "cliente_id",
          "sku",
          "titulo",
          "facelens_sku",
          "preview_review_status",
          "imported_preview_approved",
          "approved_image_url",
          "live_visual_mode",
          "live_enabled",
          "external_image_url",
        ].join(",")
      )
      .single();

    if (updateErr) {
      return NextResponse.json(
        {
          error: "Error actualizando revisión de imagen importada",
          detail: updateErr.message,
        },
        { status: 500 }
      );
    }

    const action_label =
      action === "approve"
        ? "fallback_approved"
        : action === "reject"
        ? "fallback_rejected"
        : "requires_asset";

    return NextResponse.json({
      ok: true,
      summary: {
        client_id: client.id,
        client_slug: client.slug,
        sku,
        action,
        action_label,
      },
      row: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Error inesperado en POST review-preview",
        detail: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}