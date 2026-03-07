"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Client = {
  id: string;
  nombre?: string;
  slug?: string;
  plan?: string;
  catalog_scope?: string | null;
  catalog_slug?: string | null;
};

type ExistingRow = {
  sku: string;
  nombre?: string;
  url: string;
};

type ParsedRow = {
  sku: string;
  url: string;
};

type PlanInfo = {
  allowed_total: number | null;
  filled: number;
  remaining: number | null;
};

type ParseStats = {
  totalLines: number;
  validRows: number;
  uniqueRows: number;
  duplicateRows: number;
  invalidRows: number;
};

type LimitPreview = {
  updateCount: number;
  newCount: number;
  wouldFitCount: number;
  wouldExceedCount: number;
  exceedingSkus: string[];
};

function normSku(v: any) {
  return String(v ?? "").trim().toUpperCase();
}

function normUrl(v: any) {
  return String(v ?? "").trim();
}

function isHeaderRow(firstCell: string, secondCell: string) {
  const a = normSku(firstCell);
  const b = normSku(secondCell);

  const firstIsHeader = a === "SKU";
  const secondIsHeader =
    b === "URL" ||
    b === "PRODUCT_URL" ||
    b === "PRODUCTURL" ||
    b === "LINK" ||
    b === "ENLACE";

  return firstIsHeader && secondIsHeader;
}

function splitLine(line: string) {
  return line.split(/\t|,|;/).map((p) => p.trim());
}

function parseBulk(text: string): ParsedRow[] {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const out: ParsedRow[] = [];

  for (const line of lines) {
    const parts = splitLine(line);
    if (parts.length < 2) continue;

    if (isHeaderRow(parts[0], parts[1])) continue;

    const sku = normSku(parts[0]);
    const url = normUrl(parts.slice(1).join(","));

    if (!sku || !url) continue;
    out.push({ sku, url });
  }

  const map = new Map<string, string>();
  for (const r of out) map.set(r.sku, r.url);

  return Array.from(map.entries()).map(([sku, url]) => ({ sku, url }));
}

function getParseStats(text: string): ParseStats {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let totalLines = 0;
  let validRows = 0;
  let invalidRows = 0;
  const seen = new Set<string>();
  let duplicateRows = 0;

  for (const line of lines) {
    const parts = splitLine(line);
    if (parts.length < 2) {
      invalidRows++;
      totalLines++;
      continue;
    }

    if (isHeaderRow(parts[0], parts[1])) {
      continue;
    }

    const sku = normSku(parts[0]);
    const url = normUrl(parts.slice(1).join(","));

    totalLines++;

    if (!sku || !url) {
      invalidRows++;
      continue;
    }

    validRows++;

    if (seen.has(sku)) duplicateRows++;
    seen.add(sku);
  }

  return {
    totalLines,
    validRows,
    uniqueRows: seen.size,
    duplicateRows,
    invalidRows,
  };
}

const styles = {
  page: {
    padding: 24,
    background: "#f7f8fc",
    minHeight: "100vh",
  } as React.CSSProperties,

  pageTitle: {
    marginBottom: 18,
    fontSize: 28,
    fontWeight: 700,
    color: "#1f2937",
  } as React.CSSProperties,

  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 6px 18px rgba(15, 23, 42, 0.05)",
    marginBottom: 14,
  } as React.CSSProperties,

  sectionTitle: {
    margin: "0 0 10px 0",
    fontSize: 15,
    fontWeight: 700,
    color: "#374151",
  } as React.CSSProperties,

  row: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  } as React.CSSProperties,

  input: {
    width: "100%",
    maxWidth: 420,
    padding: 10,
    borderRadius: 12,
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#111827",
    outline: "none",
  } as React.CSSProperties,

  select: {
    padding: 10,
    borderRadius: 12,
    border: "1px solid #d1d5db",
    minWidth: 340,
    background: "#fff",
    color: "#111827",
  } as React.CSSProperties,

  textarea: {
    width: "100%",
    height: 170,
    padding: 12,
    borderRadius: 14,
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#111827",
    resize: "vertical" as const,
  } as React.CSSProperties,

  buttonBase: {
    padding: "9px 14px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 600,
    border: "1px solid transparent",
  } as React.CSSProperties,

  buttonPrimary: {
    padding: "9px 14px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 600,
    border: "1px solid #1d4ed8",
    background: "#2563eb",
    color: "#fff",
  } as React.CSSProperties,

  buttonSuccess: {
    padding: "9px 14px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 600,
    border: "1px solid #059669",
    background: "#10b981",
    color: "#fff",
  } as React.CSSProperties,

  buttonSecondary: {
    padding: "9px 14px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 600,
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#374151",
  } as React.CSSProperties,

  metricCard: {
    padding: 12,
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    background: "#fbfcfe",
    minWidth: 130,
  } as React.CSSProperties,

  metricLabel: {
    color: "#6b7280",
    fontSize: 13,
    marginBottom: 4,
  } as React.CSSProperties,

  metricValue: {
    fontWeight: 700,
    color: "#111827",
  } as React.CSSProperties,

  infoOk: {
    color: "#065f46",
    marginBottom: 10,
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    padding: 12,
    borderRadius: 12,
  } as React.CSSProperties,

  infoError: {
    color: "#991b1b",
    marginBottom: 10,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    padding: 12,
    borderRadius: 12,
  } as React.CSSProperties,

  tableWrap: {
    overflowX: "auto" as const,
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    background: "#fff",
  } as React.CSSProperties,

  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
  } as React.CSSProperties,

  th: {
    textAlign: "left" as const,
    borderBottom: "1px solid #e5e7eb",
    padding: 10,
    background: "#f9fafb",
    color: "#374151",
    fontWeight: 700,
  } as React.CSSProperties,

  td: {
    padding: 10,
    borderBottom: "1px solid #f3f4f6",
    color: "#111827",
  } as React.CSSProperties,

  muted: {
    color: "#6b7280",
  } as React.CSSProperties,
};

export default function SkuUrlsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [existing, setExisting] = useState<ExistingRow[]>([]);
  const [paste, setPaste] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [selectedClient, setSelectedClient] = useState<any>(null);

  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [readingFile, setReadingFile] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const parsed = useMemo(() => parseBulk(paste), [paste]);
  const parseStats = useMemo(() => getParseStats(paste), [paste]);

  const filteredExisting = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return existing;

    return existing.filter((row) => {
      const sku = String(row.sku || "").toLowerCase();
      const nombre = String(row.nombre || "").toLowerCase();
      const url = String(row.url || "").toLowerCase();
      return sku.includes(q) || nombre.includes(q) || url.includes(q);
    });
  }, [existing, search]);

  const limitPreview = useMemo<LimitPreview | null>(() => {
    if (!parsed.length) return null;

    const existingSkuSet = new Set(existing.map((row) => normSku(row.sku)));

    let updateCount = 0;
    const newSkus: string[] = [];

    for (const row of parsed) {
      if (existingSkuSet.has(normSku(row.sku))) {
        updateCount++;
      } else {
        newSkus.push(normSku(row.sku));
      }
    }

    const remaining = planInfo?.remaining;

    if (remaining === null || remaining === undefined) {
      return {
        updateCount,
        newCount: newSkus.length,
        wouldFitCount: newSkus.length,
        wouldExceedCount: 0,
        exceedingSkus: [],
      };
    }

    const wouldFitCount = Math.max(Math.min(newSkus.length, remaining), 0);
    const exceedingSkus = newSkus.slice(wouldFitCount);

    return {
      updateCount,
      newCount: newSkus.length,
      wouldFitCount,
      wouldExceedCount: exceedingSkus.length,
      exceedingSkus,
    };
  }, [parsed, existing, planInfo]);

  async function loadClients() {
    setLoadingClients(true);
    setErr(null);
    setMsg(null);

    try {
      const r = await fetch("/api/admin/clients", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));

      const list: Client[] = j?.data || j?.clients || [];

      if (!r.ok) throw new Error(j?.error || "Error cargando clientes");

      setClients(list);

      if (!clientId && list.length) {
        setClientId(String(list[0].id));
      }
    } catch (e: any) {
      setErr(e?.message || "Error cargando clientes");
    } finally {
      setLoadingClients(false);
    }
  }

  async function loadExisting(id: string) {
    if (!id) {
      setExisting([]);
      setPlanInfo(null);
      setSelectedClient(null);
      return;
    }

    setLoadingExisting(true);
    setErr(null);
    setMsg(null);

    try {
      const r = await fetch(`/api/admin/sku-urls?client_id=${encodeURIComponent(id)}`, {
        cache: "no-store",
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok) throw new Error(j?.error || "Error cargando URLs");

      setExisting(j?.rows || []);
      setPlanInfo(j?.plan || null);
      setSelectedClient(j?.client || null);
    } catch (e: any) {
      setErr(e?.message || "Error cargando URLs");
    } finally {
      setLoadingExisting(false);
    }
  }

  async function saveGrid() {
    setSaving(true);
    setErr(null);
    setMsg(null);

    try {
      if (!clientId) throw new Error("Elegí un cliente primero.");
      if (parsed.length === 0) {
        throw new Error("No detecté líneas válidas. Formato: SKU,URL o SKU<TAB>URL.");
      }

      const r = await fetch("/api/admin/sku-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, rows: parsed }),
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok) throw new Error(j?.error || "Error guardando");

      setMsg(
        `Guardar grilla OK • Aplicadas: ${j?.summary?.applied_count ?? 0} • Insertadas: ${j?.summary?.inserted_count ?? 0} • Actualizadas: ${j?.summary?.updated_count ?? 0} • Ignoradas por límite: ${j?.summary?.ignored_by_limit_count ?? 0}`
      );

      setPaste("");
      setSelectedFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadExisting(clientId);
    } catch (e: any) {
      setErr(e?.message || "Error guardando");
    } finally {
      setSaving(false);
    }
  }

  async function importMerge() {
    setImporting(true);
    setErr(null);
    setMsg(null);

    try {
      if (!clientId) throw new Error("Elegí un cliente primero.");
      if (paste.trim().length === 0) {
        throw new Error("Pegá contenido antes de importar.");
      }

      const r = await fetch("/api/admin/sku-urls/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          text: paste,
        }),
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok) throw new Error(j?.error || "Error importando");

      setMsg(
        `Importación OK • Aplicadas: ${j?.summary?.applied_count ?? 0} • Insertadas: ${j?.summary?.inserted_count ?? 0} • Actualizadas: ${j?.summary?.updated_count ?? 0} • Inválidas: ${j?.summary?.invalid_count ?? 0} • Fuera de catálogo: ${j?.summary?.ignored_not_allowed_count ?? 0} • Ignoradas por límite: ${j?.summary?.ignored_by_limit_count ?? 0}`
      );

      setPaste("");
      setSelectedFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadExisting(clientId);
    } catch (e: any) {
      setErr(e?.message || "Error importando");
    } finally {
      setImporting(false);
    }
  }

  async function handleCsvFile(file: File) {
    setErr(null);
    setMsg(null);
    setReadingFile(true);

    try {
      const text = await file.text();

      if (!text || !text.trim()) {
        throw new Error("El archivo CSV está vacío.");
      }

      setPaste(text);
      setSelectedFileName(file.name);
      setMsg(`CSV cargado: ${file.name}`);
    } catch (e: any) {
      setErr(e?.message || "No se pudo leer el archivo CSV");
    } finally {
      setReadingFile(false);
    }
  }

  useEffect(() => {
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadExisting(clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  return (
    <div style={styles.page}>
      <h1 style={styles.pageTitle}>URLs por SKU</h1>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Cliente y acciones generales</div>
        <div style={styles.row}>
          <button onClick={loadClients} disabled={loadingClients} style={styles.buttonSecondary}>
            {loadingClients ? "Cargando..." : "Recargar clientes"}
          </button>

          <select value={clientId} onChange={(e) => setClientId(e.target.value)} style={styles.select}>
            <option value="">— Elegí cliente —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre || c.slug || c.id} • {c.plan || "PLAN?"}
              </option>
            ))}
          </select>

          <button
            onClick={() => loadExisting(clientId)}
            disabled={!clientId || loadingExisting}
            style={styles.buttonSecondary}
          >
            {loadingExisting ? "Cargando..." : "Recargar URLs"}
          </button>

          <button
            onClick={() => {
              if (!clientId) return;
              window.location.href = `/api/admin/sku-urls/template?client_id=${encodeURIComponent(clientId)}`;
            }}
            disabled={!clientId}
            style={styles.buttonSecondary}
          >
            Exportar plantilla CSV
          </button>

          <button
            onClick={() => {
              if (!clientId) return;
              window.location.href = `/api/admin/sku-urls/export?client_id=${encodeURIComponent(clientId)}`;
            }}
            disabled={!clientId}
            style={styles.buttonSecondary}
          >
            Exportar CSV con URLs existentes
          </button>
        </div>
      </div>

      {selectedClient && (
        <div style={styles.card}>
          <div style={styles.sectionTitle}>Resumen del cliente</div>
          <div style={styles.row}>
            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>Cliente</div>
              <div style={styles.metricValue}>{selectedClient.nombre || selectedClient.slug || selectedClient.id}</div>
            </div>

            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>Plan</div>
              <div style={styles.metricValue}>{selectedClient.plan || "—"}</div>
            </div>

            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>URLs permitidas</div>
              <div style={styles.metricValue}>{planInfo?.allowed_total ?? "Ilimitado"}</div>
            </div>

            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>Cargadas</div>
              <div style={styles.metricValue}>{planInfo?.filled ?? 0}</div>
            </div>

            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>Disponibles</div>
              <div style={styles.metricValue}>{planInfo?.remaining ?? "∞"}</div>
            </div>
          </div>
        </div>
      )}

      {err && <div style={styles.infoError}>Error: {err}</div>}
      {msg && <div style={styles.infoOk}>{msg}</div>}

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Carga masiva / CSV</div>

        <div style={{ ...styles.muted, marginBottom: 8 }}>
          Pegado masivo o CSV (SKU,URL o SKU&lt;TAB&gt;URL). Detectadas: <b>{parsed.length}</b>
        </div>

        <div style={{ ...styles.row, marginBottom: 12 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleCsvFile(file);
            }}
            style={{ maxWidth: 320 }}
          />

          <button
            type="button"
            onClick={() => {
              setPaste("");
              setSelectedFileName("");
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            style={styles.buttonSecondary}
          >
            Limpiar carga
          </button>

          <div style={styles.muted}>
            {readingFile
              ? "Leyendo CSV..."
              : selectedFileName
              ? `Archivo: ${selectedFileName}`
              : "Sin archivo cargado"}
          </div>
        </div>

        {(paste.trim() || selectedFileName) && (
          <div style={{ ...styles.row, marginBottom: 12 }}>
            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>Líneas detectadas</div>
              <div style={styles.metricValue}>{parseStats.totalLines}</div>
            </div>

            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>Filas válidas</div>
              <div style={styles.metricValue}>{parseStats.validRows}</div>
            </div>

            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>SKUs únicos</div>
              <div style={styles.metricValue}>{parseStats.uniqueRows}</div>
            </div>

            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>Duplicadas</div>
              <div style={styles.metricValue}>{parseStats.duplicateRows}</div>
            </div>

            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>Inválidas</div>
              <div style={styles.metricValue}>{parseStats.invalidRows}</div>
            </div>
          </div>
        )}

        {limitPreview && (
          <div
            style={{
              marginBottom: 12,
              padding: 12,
              borderRadius: 14,
              border: `1px solid ${limitPreview.wouldExceedCount > 0 ? "#fecaca" : "#bbf7d0"}`,
              background: limitPreview.wouldExceedCount > 0 ? "#fff1f2" : "#f0fdf4",
            }}
          >
            <div style={{ marginBottom: 8, fontWeight: 700, color: "#374151" }}>
              Vista previa contra el límite del plan
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <div>Updates: <b>{limitPreview.updateCount}</b></div>
              <div>Nuevos: <b>{limitPreview.newCount}</b></div>
              <div>Entrarían: <b>{limitPreview.wouldFitCount}</b></div>
              <div>Exceden: <b>{limitPreview.wouldExceedCount}</b></div>
            </div>

            {limitPreview.wouldExceedCount > 0 ? (
              <>
                <div style={{ color: "#991b1b", marginBottom: 6 }}>
                  Atención: hay SKUs nuevos que exceden el cupo disponible. El backend los va a ignorar.
                </div>
                <div style={{ color: "#991b1b", fontSize: 13 }}>
                  SKUs excedentes: {limitPreview.exceedingSkus.join(", ")}
                </div>
              </>
            ) : (
              <div style={{ color: "#166534" }}>
                No se detectan excedentes por límite antes de enviar.
              </div>
            )}
          </div>
        )}

        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder={`100101,https://www.tienda24x7.net/productos/...\n100103\thttps://www.tienda24x7.net/productos/...`}
          style={styles.textarea}
        />

        <div style={{ ...styles.row, marginTop: 12 }}>
          <button onClick={saveGrid} disabled={!clientId || saving} style={styles.buttonPrimary}>
            {saving ? "Guardando..." : "Guardar grilla"}
          </button>

          <button onClick={importMerge} disabled={!clientId || importing} style={styles.buttonSuccess}>
            {importing ? "Importando..." : "Importar y mergear"}
          </button>

          <div style={styles.muted}>
            Filas catálogo: <b>{existing.length}</b>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Catálogo y búsqueda</div>

        <div style={{ marginBottom: 10 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por SKU, nombre o URL"
            style={styles.input}
          />
        </div>

        <div style={{ ...styles.muted, marginBottom: 8 }}>
          Mostrando <b>{filteredExisting.length}</b> de <b>{existing.length}</b> filas
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {["sku", "nombre", "url"].map((h) => (
                  <th key={h} style={styles.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredExisting.map((r, idx) => (
                <tr key={`${r.sku}-${idx}`}>
                  <td style={{ ...styles.td, fontFamily: "monospace" }}>{r.sku}</td>
                  <td style={styles.td}>{r.nombre || ""}</td>
                  <td style={styles.td}>
                    {r.url ? (
                      <a href={r.url} target="_blank" rel="noreferrer">
                        {r.url}
                      </a>
                    ) : (
                      ""
                    )}
                  </td>
                </tr>
              ))}
              {filteredExisting.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ ...styles.td, color: "#6b7280" }}>
                    No hay filas para mostrar con el filtro actual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}