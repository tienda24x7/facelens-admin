import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CLIENTS_TABLE = "clientes facelens";
const IMPORTED_PRODUCTS_TABLE = "clientes_imported_products";

function cleanStr(v: any) {
  return String(v ?? "").trim();
}

function normalizeSku(v: any) {
  return String(v ?? "").trim().toUpperCase();
}

function normalizeCategory(v: any) {
  return String(v ?? "").trim();
}

function buildProductUrl(domain: string, handle: string) {
  const d = cleanStr(domain).replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const h = cleanStr(handle);
  if (!d || !h) return "";
  return `https://${d}/products/${h}`;
}

function pickBestImage(product: any, variant: any) {
  const variantImage =
    cleanStr(variant?.image?.src) ||
    cleanStr(variant?.featured_image?.src);

  if (variantImage) return variantImage;

  const productImage =
    cleanStr(product?.image?.src) ||
    cleanStr(product?.featured_image?.src);

  if (productImage) return productImage;

  const firstImage = Array.isArray(product?.images)
    ? cleanStr(product.images?.[0]?.src)
    : "";

  return firstImage || "";
}

function pickSku(product: any, variant: any) {
  const variantSku = normalizeSku(variant?.sku);
  if (variantSku) return variantSku;

  const variantId = cleanStr(variant?.id);
  const productId = cleanStr(product?.id);

  if (variantId) return normalizeSku(`SHOPIFY-VAR-${variantId}`);
  if (productId) return normalizeSku(`SHOPIFY-PROD-${productId}`);

  return "";
}

function matchesImportFilters(product: any, filtersText: string) {
  const raw = cleanStr(filtersText).toLowerCase();
  if (!raw) return true;

  const filters = raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  if (!filters.length) return true;

  const haystack = [
    cleanStr(product?.title),
    cleanStr(product?.product_type),
    cleanStr(product?.vendor),
    Array.isArray(product?.tags) ? product.tags.join(" ") : cleanStr(product?.tags),
  ]
    .join(" ")
    .toLowerCase();

  return filters.some((f) => haystack.includes(f));
}

async function getAdminAccessTokenWithClientCredentials(params: {
  clientId: string;
  clientSecret: string;
  shopDomain: string;
}) {
  const clientId = cleanStr(params.clientId);
  const clientSecret = cleanStr(params.clientSecret);
  const shopDomain = cleanStr(params.shopDomain)
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");

  if (!clientId) throw new Error("Falta clientId");
  if (!clientSecret) throw new Error("Falta clientSecret");
  if (!shopDomain) throw new Error("Falta shopDomain");

  const tokenUrl = `https://${shopDomain}/admin/oauth/access_token`;

  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    cache: "no-store",
    body: body.toString(),
  });

  const rawText = await response.text();
  let parsed: any = null;

  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    throw new Error(
      parsed?.error_description ||
        parsed?.error ||
        parsed?.errors ||
        rawText ||
        `No se pudo obtener access token (HTTP ${response.status})`
    );
  }

  const accessToken = cleanStr(parsed?.access_token);

  if (!accessToken) {
    throw new Error("Shopify no devolvió access_token.");
  }

  return accessToken;
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing client id" },
        { status: 400 }
      );
    }

    const { data: client, error: clientError } = await supabase
      .from(CLIENTS_TABLE)
      .select(
        [
          "id",
          "nombre",
          "slug",
          "store_platform",
          "store_status",
          "shopify_store_domain",
          "shopify_access_token",
          "shopify_auth_mode",
          "shopify_client_id",
          "shopify_client_secret",
          "store_import_enabled",
          "store_import_filters",
        ].join(",")
      )
      .eq("id", id)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { ok: false, error: clientError?.message || "Cliente no encontrado" },
        { status: 404 }
      );
    }

    const storePlatform = cleanStr(client.store_platform || "none").toLowerCase();
    const authMode = cleanStr(client.shopify_auth_mode || "token").toLowerCase();
    const domain = cleanStr(client.shopify_store_domain);
    const filtersText = cleanStr(client.store_import_filters);

    if (storePlatform !== "shopify") {
      return NextResponse.json(
        { ok: false, error: "El cliente no tiene Shopify configurado como plataforma." },
        { status: 400 }
      );
    }

    if (!domain) {
      return NextResponse.json(
        { ok: false, error: "Falta shopify_store_domain en el cliente." },
        { status: 400 }
      );
    }

    let token = "";

    if (authMode === "app_credentials") {
      const clientId = cleanStr(client.shopify_client_id);
      const clientSecret = cleanStr(client.shopify_client_secret);

      if (!clientId) {
        return NextResponse.json(
          { ok: false, error: "Falta shopify_client_id en el cliente." },
          { status: 400 }
        );
      }

      if (!clientSecret) {
        return NextResponse.json(
          { ok: false, error: "Falta shopify_client_secret en el cliente." },
          { status: 400 }
        );
      }

      token = await getAdminAccessTokenWithClientCredentials({
        clientId,
        clientSecret,
        shopDomain: domain,
      });
    } else {
      token = cleanStr(client.shopify_access_token);

      if (!token) {
        return NextResponse.json(
          { ok: false, error: "Falta shopify_access_token en el cliente." },
          { status: 400 }
        );
      }
    }

    const normalizedDomain = domain
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, "");

    const url = `https://${normalizedDomain}/admin/api/2025-01/products.json?limit=250`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const rawText = await response.text();
    let parsed: any = null;

    try {
      parsed = rawText ? JSON.parse(rawText) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Shopify respondió con error.",
          detail:
            parsed?.errors ||
            parsed?.error ||
            rawText ||
            `HTTP ${response.status}`,
          shopify_status: response.status,
        },
        { status: 400 }
      );
    }

    const products = Array.isArray(parsed?.products) ? parsed.products : [];

    const filteredProducts = products.filter((product: any) =>
      matchesImportFilters(product, filtersText)
    );

    const rowsToUpsert: any[] = [];

    for (const product of filteredProducts) {
      const productTitle = cleanStr(product?.title);
      const productCategory = normalizeCategory(product?.product_type);
      const handle = cleanStr(product?.handle);
      const productUrl = buildProductUrl(normalizedDomain, handle);
      const productId = cleanStr(product?.id);

      const variants = Array.isArray(product?.variants) && product.variants.length
        ? product.variants
        : [null];

      for (const variant of variants) {
        const sku = pickSku(product, variant);
        if (!sku) continue;

        const variantId = cleanStr(variant?.id);
        const imageUrl = pickBestImage(product, variant);

        rowsToUpsert.push({
          cliente_id: client.id,
          sku,
          titulo:
            cleanStr(variant?.title) &&
            cleanStr(variant?.title).toLowerCase() !== "default title"
              ? `${productTitle} - ${cleanStr(variant?.title)}`
              : productTitle || sku,
          categoria: productCategory || "",
          origin: "shopify",
          external_image_url: imageUrl || null,
          external_product_url: productUrl || null,
          external_product_id: productId || null,
          external_variant_id: variantId || null,
          image_source: imageUrl ? "shopify_image" : "none",
          asset_status: imageUrl ? "fallback" : "missing",
          is_active: false,
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }

    if (!rowsToUpsert.length) {
      const { error: updateClientError } = await supabase
        .from(CLIENTS_TABLE)
        .update({
          store_status: "connected",
          last_store_sync_at: new Date().toISOString(),
          last_store_sync_result: "0 productos importados",
        })
        .eq("id", client.id);

      if (updateClientError) {
        console.warn("No se pudo actualizar estado del cliente:", updateClientError.message);
      }

      return NextResponse.json(
        {
          ok: true,
          auth_mode: authMode,
          imported_count: 0,
          products_found: products.length,
          products_filtered: filteredProducts.length,
          message: "Importación ejecutada sin productos para guardar.",
        },
        { status: 200 }
      );
    }

    const { data: upsertedRows, error: upsertError } = await supabase
      .from(IMPORTED_PRODUCTS_TABLE)
      .upsert(rowsToUpsert, { onConflict: "cliente_id,sku" })
      .select("id, sku");

    if (upsertError) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se pudieron guardar los productos importados.",
          detail: upsertError.message,
        },
        { status: 500 }
      );
    }

    const importedCount = Array.isArray(upsertedRows)
      ? upsertedRows.length
      : rowsToUpsert.length;

    const { error: updateClientError } = await supabase
      .from(CLIENTS_TABLE)
      .update({
        store_status: "connected",
        last_store_sync_at: new Date().toISOString(),
        last_store_sync_result: `${importedCount} productos importados`,
      })
      .eq("id", client.id);

    if (updateClientError) {
      console.warn("No se pudo actualizar estado del cliente:", updateClientError.message);
    }

    return NextResponse.json(
      {
        ok: true,
        auth_mode: authMode,
        imported_count: importedCount,
        products_found: products.length,
        products_filtered: filteredProducts.length,
        message: "Importación Shopify OK",
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "Error inesperado importando productos Shopify",
        detail: e?.message || String(e),
      },
      { status: 500 }
    );
  }
}