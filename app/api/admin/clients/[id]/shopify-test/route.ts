import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TABLE = "clientes facelens";

function cleanStr(v: any) {
  return String(v ?? "").trim();
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
      .from(TABLE)
      .select(
        "id, nombre, slug, store_platform, shopify_store_domain, shopify_access_token, shopify_auth_mode, shopify_client_id, shopify_client_secret"
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

    const normalizedDomain = domain
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, "");

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
        shopDomain: normalizedDomain,
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

    const url = `https://${normalizedDomain}/admin/api/2025-01/products.json?limit=3`;

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
          auth_mode: authMode,
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

    return NextResponse.json(
      {
        ok: true,
        auth_mode: authMode,
        message: "Conexión Shopify OK",
        shop: {
          domain: normalizedDomain,
        },
        sample: {
          products_found: products.length,
          first_products: products.map((p: any) => ({
            id: p?.id ?? null,
            title: cleanStr(p?.title),
            handle: cleanStr(p?.handle),
            status: cleanStr(p?.status),
          })),
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "Error inesperado testeando Shopify",
        detail: e?.message || String(e),
      },
      { status: 500 }
    );
  }
}