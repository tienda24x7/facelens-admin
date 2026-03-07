import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ImportRow = {
  sku: string;
  url: string;
};

type ResolvedRow = {
  sku: string;
  url: string;
  lente_id: string;
};

function normalizeSku(value: string) {
  return String(value || "").trim().toUpperCase();
}

function normalizeUrl(value: string) {
  return String(value || "").trim();
}

function isValidUrl(value: string) {
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol);
  } catch {
    return false;
  }
}

function parseDelimitedText(input: string): ImportRow[] {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const rows: ImportRow[] = [];

  for (const line of lines) {
    const delimiter = line.includes("\t") ? "\t" : ",";
    const parts = line.split(delimiter);

    if (parts.length < 2) continue;

    const sku = normalizeSku(parts[0]);
    const url = normalizeUrl(parts.slice(1).join(delimiter));

    rows.push({ sku, url });
  }

  return rows;
}

async function getPlanLimit(planCode: string | null | undefined) {
  if (!planCode) return null;

  const normalized = String(planCode).trim().toUpperCase();

  const { data, error } = await supabase
    .from("facelens_plans")
    .select("plan_code, max_urls")
    .eq("plan_code", normalized)
    .maybeSingle();

  if (error) {
    throw new Error(`Error leyendo facelens_plans: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return data.max_urls === null || data.max_urls === undefined
    ? null
    : Number(data.max_urls);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const client_id = String(body?.client_id || "").trim();
    const rawText = String(body?.text || "");
    const rawRows = Array.isArray(body?.rows) ? body.rows : null;

    if (!client_id) {
      return NextResponse.json({ error: "Falta client_id" }, { status: 400 });
    }

    let parsedRows: ImportRow[] = [];

    if (rawRows) {
      parsedRows = rawRows.map((r: any) => ({
        sku: normalizeSku(r?.sku),
        url: normalizeUrl(r?.url),
      }));
    } else {
      parsedRows = parseDelimitedText(rawText);
    }

    if (!parsedRows.length) {
      return NextResponse.json(
        { error: "No se encontraron filas para importar" },
        { status: 400 }
      );
    }

    const { data: client, error: clientErr } = await supabase
      .from("clientes facelens")
      .select("id, slug, default_url, plan")
      .eq("id", client_id)
      .single();

    if (clientErr || !client) {
      return NextResponse.json(
        { error: "Cliente no encontrado", detail: clientErr?.message },
        { status: 404 }
      );
    }

    const allowed_total = await getPlanLimit(client.plan);

    const { data: allowedRows, error: allowedErr } = await supabase
      .from("v_lentes_por_cliente")
      .select("sku, nombre_modelo, client_slug")
      .eq("client_slug", client.slug);

    if (allowedErr) {
      return NextResponse.json(
        { error: "Error leyendo catálogo permitido", detail: allowedErr.message },
        { status: 500 }
      );
    }

    const allowedSkuMap = new Map<string, any>();
    for (const row of allowedRows || []) {
      const sku = normalizeSku(row.sku);
      if (sku) allowedSkuMap.set(sku, row);
    }

    const allowedSkus = Array.from(allowedSkuMap.keys());

    const { data: lensRows, error: lensErr } = await supabase
      .from("lentes")
      .select("id, sku")
      .in("sku", allowedSkus);

    if (lensErr) {
      return NextResponse.json(
        { error: "Error resolviendo lentes por SKU", detail: lensErr.message },
        { status: 500 }
      );
    }

    const lensIdBySku = new Map<string, string>();
    for (const row of lensRows || []) {
      const sku = normalizeSku(row.sku);
      if (sku && row.id) lensIdBySku.set(sku, String(row.id));
    }

    const dedupedMap = new Map<string, ImportRow>();
    const invalid: Array<{ sku: string; url: string; reason: string }> = [];
    let duplicate_count = 0;

    for (const row of parsedRows) {
      const sku = normalizeSku(row.sku);
      const url = normalizeUrl(row.url);

      if (!sku || !url) {
        invalid.push({ sku, url, reason: "missing_fields" });
        continue;
      }

      if (!isValidUrl(url)) {
        invalid.push({ sku, url, reason: "invalid_url" });
        continue;
      }

      if (dedupedMap.has(sku)) duplicate_count++;
      dedupedMap.set(sku, { sku, url });
    }

    const dedupedRows = Array.from(dedupedMap.values());

    const validCatalogRows: ResolvedRow[] = [];
    const ignored_not_allowed: Array<{ sku: string; url: string; reason: string }> = [];

    for (const row of dedupedRows) {
      const allowed = allowedSkuMap.get(row.sku);

      if (!allowed) {
        ignored_not_allowed.push({
          sku: row.sku,
          url: row.url,
          reason: "sku_not_allowed_for_client",
        });
        continue;
      }

      const lente_id = lensIdBySku.get(row.sku);

      if (!lente_id) {
        invalid.push({
          sku: row.sku,
          url: row.url,
          reason: "sku_not_found_in_lentes",
        });
        continue;
      }

      validCatalogRows.push({
        sku: row.sku,
        url: row.url,
        lente_id,
      });
    }

    const { data: existingRows, error: existingErr } = await supabase
      .from("clientes_lentes_urls")
      .select("id, cliente_id, lente_id, product_url")
      .eq("cliente_id", client_id);

    if (existingErr) {
      return NextResponse.json(
        { error: "Error leyendo URLs existentes", detail: existingErr.message },
        { status: 500 }
      );
    }

    const existingByLenteId = new Map<string, any>();
    for (const row of existingRows || []) {
      if (row?.lente_id) {
        existingByLenteId.set(String(row.lente_id), row);
      }
    }

    const currentFilled = (existingRows || []).length;

    const candidatesToUpdate: ResolvedRow[] = [];
    const candidatesToInsert: ResolvedRow[] = [];

    for (const row of validCatalogRows) {
      if (existingByLenteId.has(row.lente_id)) candidatesToUpdate.push(row);
      else candidatesToInsert.push(row);
    }

    let insertSlotsRemaining =
      allowed_total === null ? Infinity : Math.max(allowed_total - currentFilled, 0);

    const insertsAllowed: ResolvedRow[] = [];
    const ignored_by_limit: Array<{ sku: string; url: string; reason: string }> = [];

    for (const row of candidatesToInsert) {
      if (insertSlotsRemaining > 0) {
        insertsAllowed.push(row);
        insertSlotsRemaining--;
      } else {
        ignored_by_limit.push({
          sku: row.sku,
          url: row.url,
          reason: "plan_limit_reached",
        });
      }
    }

    const updated: string[] = [];

    for (const row of candidatesToUpdate) {
      const existing = existingByLenteId.get(row.lente_id);

      if (normalizeUrl(existing.product_url) === row.url) {
        updated.push(row.sku);
        continue;
      }

      const { error: updateErr } = await supabase
        .from("clientes_lentes_urls")
        .update({ product_url: row.url })
        .eq("id", existing.id);

      if (updateErr) {
        invalid.push({
          sku: row.sku,
          url: row.url,
          reason: `update_error:${updateErr.message}`,
        });
      } else {
        updated.push(row.sku);
      }
    }

    const rowsToInsert = insertsAllowed.map((row) => ({
      cliente_id: client_id,
      lente_id: row.lente_id,
      product_url: row.url,
    }));

    let inserted: string[] = [];

    if (rowsToInsert.length > 0) {
      const { data: insertedRows, error: insertErr } = await supabase
        .from("clientes_lentes_urls")
        .insert(rowsToInsert)
        .select("lente_id");

      if (insertErr) {
        return NextResponse.json(
          { error: "Error insertando URLs", detail: insertErr.message },
          { status: 500 }
        );
      }

      const insertedLensIds = new Set(
        (insertedRows || []).map((r: any) => String(r.lente_id))
      );

      inserted = insertsAllowed
        .filter((row) => insertedLensIds.has(String(row.lente_id)))
        .map((row) => row.sku);
    }

    const finalFilled = currentFilled + inserted.length;
    const remaining =
      allowed_total === null ? null : Math.max(allowed_total - finalFilled, 0);

    return NextResponse.json({
      ok: true,
      summary: {
        input_rows: parsedRows.length,
        deduped_rows: dedupedRows.length,
        duplicate_count,
        invalid_count: invalid.length,
        ignored_not_allowed_count: ignored_not_allowed.length,
        ignored_by_limit_count: ignored_by_limit.length,
        updated_count: updated.length,
        inserted_count: inserted.length,
        applied_count: updated.length + inserted.length,
      },
      plan: {
        allowed_total,
        filled_before: currentFilled,
        filled_after: finalFilled,
        remaining,
      },
      details: {
        updated,
        inserted,
        invalid,
        ignored_not_allowed,
        ignored_by_limit,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Error inesperado importando CSV",
        detail: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}