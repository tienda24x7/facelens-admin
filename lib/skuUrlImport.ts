export type SkuUrlRow = {
  sku: string;
  nombre?: string;
  url: string;
  source?: "existing" | "pasted";
  status?: "ok" | "invalid" | "duplicate" | "blocked";
  reason?: string;
};

export function normalizeSku(value: string) {
  return String(value || "").trim().toUpperCase();
}

export function normalizeUrl(value: string) {
  return String(value || "").trim();
}

export function isValidUrl(value: string) {
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol);
  } catch {
    return false;
  }
}

export function parseBulkInput(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rows: SkuUrlRow[] = [];

  for (const line of lines) {
    const delimiter = line.includes("\t") ? "\t" : ",";
    const parts = line.split(delimiter);

    if (parts.length < 2) {
      rows.push({
        sku: "",
        url: "",
        status: "invalid",
        reason: "Formato inválido. Usar SKU,URL o SKU<TAB>URL",
      });
      continue;
    }

    const sku = normalizeSku(parts[0]);
    const url = normalizeUrl(parts.slice(1).join(delimiter));

    if (!sku || !url || !isValidUrl(url)) {
      rows.push({
        sku,
        url,
        status: "invalid",
        reason: "SKU o URL inválida",
      });
      continue;
    }

    rows.push({
      sku,
      url,
      source: "pasted",
      status: "ok",
    });
  }

  const deduped = new Map<string, SkuUrlRow>();
  let duplicates = 0;

  for (const row of rows) {
    if (!row.sku || row.status === "invalid") continue;
    if (deduped.has(row.sku)) duplicates++;
    deduped.set(row.sku, row);
  }

  return {
    rows,
    dedupedRows: Array.from(deduped.values()),
    duplicates,
  };
}