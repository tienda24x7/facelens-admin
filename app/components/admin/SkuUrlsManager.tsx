"use client";

import { useEffect, useMemo, useState } from "react";
import { parseBulkInput, normalizeSku } from "@/lib/skuUrlImport";

type Row = {
  sku: string;
  nombre?: string;
  url: string;
};

type ApiResponse = {
  client: { id: number; slug: string; nombre?: string };
  plan: { allowed_total: number | null; filled: number; remaining: number | null };
  rows: Row[];
};

export default function SkuUrlsManager({ clientId }: { clientId: number }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [query, setQuery] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [feedback, setFeedback] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/sku-urls?client_id=${clientId}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [clientId]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.rows;

    return data.rows.filter(
      (r) =>
        r.sku.toLowerCase().includes(q) ||
        (r.nombre || "").toLowerCase().includes(q)
    );
  }, [data, query]);

  function processBulkPaste() {
    if (!data) return;

    const parsed = parseBulkInput(bulkText);
    const rowMap = new Map(data.rows.map((r) => [normalizeSku(r.sku), { ...r }]));

    let valid = 0;
    let invalid = 0;
    let notFound = 0;

    for (const row of parsed.dedupedRows) {
      const existing = rowMap.get(row.sku);
      if (!existing) {
        notFound++;
        continue;
      }
      existing.url = row.url;
      valid++;
    }

    for (const row of parsed.rows) {
      if (row.status === "invalid") invalid++;
    }

    setData({
      ...data,
      rows: Array.from(rowMap.values()),
    });

    setFeedback({
      type: "bulk",
      valid,
      invalid,
      duplicates: parsed.duplicates,
      notFound,
    });
  }

  async function saveCurrentRows() {
    if (!data) return;

    setSaving(true);
    setFeedback(null);

    const rowsToSave = data.rows
      .filter((r) => r.url?.trim())
      .map((r) => ({ sku: r.sku, url: r.url }));

    const res = await fetch("/api/admin/sku-urls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, rows: rowsToSave }),
    });

    const json = await res.json();
    setSaving(false);
    setFeedback({ type: "save", result: json });
    await load();
  }

  async function importBulkMerge() {
    if (!bulkText.trim()) return;
    setImporting(true);
    setFeedback(null);

    const res = await fetch("/api/admin/sku-urls/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        text: bulkText,
      }),
    });

    const json = await res.json();
    setImporting(false);
    setFeedback({ type: "import", result: json });
    await load();
  }

  if (loading) return <div>Cargando...</div>;
  if (!data) return <div>No se pudo cargar la información.</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border p-3">
          <div className="text-sm opacity-70">Permitidas</div>
          <div className="text-2xl font-semibold">
            {data.plan.allowed_total ?? "Ilimitado"}
          </div>
        </div>
        <div className="rounded-xl border p-3">
          <div className="text-sm opacity-70">Cargadas</div>
          <div className="text-2xl font-semibold">{data.plan.filled}</div>
        </div>
        <div className="rounded-xl border p-3">
          <div className="text-sm opacity-70">Disponibles</div>
          <div className="text-2xl font-semibold">
            {data.plan.remaining ?? "∞"}
          </div>
        </div>
      </div>

      <div className="rounded-xl border p-4 space-y-3">
        <input
          className="w-full rounded-lg border px-3 py-2"
          placeholder="Buscar por SKU o nombre"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <textarea
          className="w-full min-h-[140px] rounded-lg border px-3 py-2"
          placeholder={"Pegá SKU,URL o SKU<TAB>URL\nEj:\nRB3025,https://tu-tienda.com/rb3025"}
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
        />

        <div className="flex gap-2">
          <button
            className="rounded-lg border px-4 py-2"
            onClick={processBulkPaste}
            type="button"
          >
            Procesar pegado
          </button>

          <button
            className="rounded-lg border px-4 py-2"
            onClick={importBulkMerge}
            disabled={importing}
            type="button"
          >
            {importing ? "Importando..." : "Importar y mergear"}
          </button>

          <button
            className="rounded-lg border px-4 py-2"
            onClick={saveCurrentRows}
            disabled={saving}
            type="button"
          >
            {saving ? "Guardando..." : "Guardar grilla"}
          </button>
        </div>

        {feedback?.type === "bulk" && (
          <div className="rounded-lg bg-neutral-50 p-3 text-sm">
            Filas válidas aplicadas a la grilla: {feedback.valid} | inválidas: {feedback.invalid} | duplicadas: {feedback.duplicates} | SKUs no encontrados en catálogo: {feedback.notFound}
          </div>
        )}

        {feedback?.type === "import" && feedback?.result && (
          <div className="rounded-lg bg-neutral-50 p-3 text-sm space-y-1">
            <div>Aplicadas: {feedback.result.summary?.applied_count ?? 0}</div>
            <div>Insertadas: {feedback.result.summary?.inserted_count ?? 0}</div>
            <div>Actualizadas: {feedback.result.summary?.updated_count ?? 0}</div>
            <div>Inválidas: {feedback.result.summary?.invalid_count ?? 0}</div>
            <div>Ignoradas por catálogo: {feedback.result.summary?.ignored_not_allowed_count ?? 0}</div>
            <div>Ignoradas por límite: {feedback.result.summary?.ignored_by_limit_count ?? 0}</div>
          </div>
        )}
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-neutral-50 text-left">
              <th className="p-3">SKU</th>
              <th className="p-3">Nombre</th>
              <th className="p-3">URL</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.sku} className="border-b">
                <td className="p-3 font-mono">{row.sku}</td>
                <td className="p-3">{row.nombre || "-"}</td>
                <td className="p-3">
                  <input
                    className="w-full rounded border px-2 py-1"
                    value={row.url || ""}
                    onChange={(e) => {
                      if (!data) return;
                      setData({
                        ...data,
                        rows: data.rows.map((r) =>
                          r.sku === row.sku ? { ...r, url: e.target.value } : r
                        ),
                      });
                    }}
                    placeholder="https://..."
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}