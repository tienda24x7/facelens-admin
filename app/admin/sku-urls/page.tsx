"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type Client = {
  id: string;
  nombre?: string;
  slug?: string;
  plan?: string;
  catalog_scope?: string | null;
  catalog_slug?: string | null;
};

type PlanInfo = {
  max_skus: number | null;
  max_urls: number | null;
  active_count: number;
  active_remaining: number | null;
  url_count: number;
  url_remaining: number | null;
};

type SkuRow = {
  sku: string;
  rb: string;
  nombre: string;
  categoria: string;
  proveedor: string;
  grupo: string;
  catalogos: string[];
  lens_id: string;
  is_active: boolean;
  url: string;
  try_on_url: string;
};

type DraftRow = {
  is_active?: boolean;
  url?: string;
};

function normSku(v: any) {
  return String(v ?? "").trim().toUpperCase();
}

function normUrl(v: any) {
  return String(v ?? "").trim();
}

function isPrimePlan(plan?: string | null) {
  return String(plan || "").trim().toUpperCase().includes("PRIME");
}

function safeFilePart(v: any) {
  return String(v ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
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

  inputSmall: {
    width: "100%",
    minWidth: 220,
    padding: 9,
    borderRadius: 10,
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
    minWidth: 150,
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
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,

  td: {
    padding: 10,
    borderBottom: "1px solid #f3f4f6",
    color: "#111827",
    verticalAlign: "top" as const,
  } as React.CSSProperties,

  muted: {
    color: "#6b7280",
  } as React.CSSProperties,

  urlBox: {
    display: "inline-block",
    maxWidth: 320,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: 12,
    color: "#374151",
  } as React.CSSProperties,

  chip: {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: 999,
    background: "#eef2ff",
    color: "#3730a3",
    fontSize: 12,
    fontWeight: 600,
    marginRight: 6,
    marginBottom: 6,
  } as React.CSSProperties,

  badgeWarn: {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: 999,
    background: "#fff7ed",
    color: "#9a3412",
    fontSize: 12,
    fontWeight: 700,
  } as React.CSSProperties,
};

export default function SkuUrlsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<string>("");

  const [rows, setRows] = useState<SkuRow[]>([]);
  const [draft, setDraft] = useState<Record<string, DraftRow>>({});

  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applyingPreset, setApplyingPreset] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterCatalog, setFilterCatalog] = useState("all");

  const [copiedKey, setCopiedKey] = useState("");

  function getValue(row: SkuRow, key: keyof SkuRow | "url" | "is_active") {
    const d = draft[row.sku];
    if (d && key in d) return (d as any)[key];
    return (row as any)[key];
  }

  function setField(sku: string, key: keyof DraftRow, value: any) {
    setDraft((prev) => ({
      ...prev,
      [sku]: {
        ...(prev[sku] || {}),
        [key]: value,
      },
    }));
  }

  async function copyText(value: string, key: string, okMsg: string) {
    try {
      if (!value) throw new Error("No hay valor para copiar.");
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setMsg(okMsg);
      setTimeout(() => setCopiedKey(""), 1800);
    } catch (e: any) {
      setErr(e?.message || "No se pudo copiar");
    }
  }

  async function loadClients() {
    setLoadingClients(true);
    setErr(null);
    setMsg(null);

    try {
      const r = await fetch("/api/admin/clients", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));

      if (!r.ok) throw new Error(j?.error || "Error cargando clientes");

      const list: Client[] = j?.data || [];
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

  async function loadRows(id: string) {
    if (!id) {
      setRows([]);
      setPlanInfo(null);
      setSelectedClient(null);
      setDraft({});
      return;
    }

    setLoadingRows(true);
    setErr(null);
    setMsg(null);

    try {
      const r = await fetch(`/api/admin/sku-urls?client_id=${encodeURIComponent(id)}`, {
        cache: "no-store",
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Error cargando SKUs");

      setRows(j?.rows || []);
      setPlanInfo(j?.plan || null);
      setSelectedClient(j?.client || null);
      setDraft({});
    } catch (e: any) {
      setErr(e?.message || "Error cargando SKUs");
    } finally {
      setLoadingRows(false);
    }
  }

  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      const c = String(r.categoria || "").trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [rows]);

  const catalogs = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      (r.catalogos || []).forEach((c) => {
        const v = String(c || "").trim();
        if (v) set.add(v);
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      const isActive = !!getValue(row, "is_active");
      const url = String(getValue(row, "url") || "").toLowerCase();
      const sku = String(row.sku || "").toLowerCase();
      const rb = String(row.rb || "").toLowerCase();
      const nombre = String(row.nombre || "").toLowerCase();
      const categoria = String(row.categoria || "").toLowerCase();
      const cats = (row.catalogos || []).join(" ").toLowerCase();

      const matchesSearch =
        !q ||
        sku.includes(q) ||
        rb.includes(q) ||
        nombre.includes(q) ||
        categoria.includes(q) ||
        cats.includes(q) ||
        url.includes(q);

      const matchesActive =
        filterActive === "all" ||
        (filterActive === "active" && isActive) ||
        (filterActive === "inactive" && !isActive);

      const matchesCategory =
        filterCategory === "all" || String(row.categoria || "") === filterCategory;

      const matchesCatalog =
        filterCatalog === "all" || (row.catalogos || []).includes(filterCatalog);

      return matchesSearch && matchesActive && matchesCategory && matchesCatalog;
    });
  }, [rows, draft, search, filterActive, filterCategory, filterCatalog]);

  const rowsWithDraft = useMemo(() => {
    return rows.map((row) => ({
      ...row,
      is_active: !!getValue(row, "is_active"),
      url: normUrl(getValue(row, "url")),
    }));
  }, [rows, draft]);

  const activeCountDraft = useMemo(() => {
    return rowsWithDraft.filter((r) => r.is_active).length;
  }, [rowsWithDraft]);

  const urlCountDraft = useMemo(() => {
    return rowsWithDraft.filter((r) => normUrl(r.url)).length;
  }, [rowsWithDraft]);

  const hasChanges = useMemo(() => {
    return Object.keys(draft).some((sku) => Object.keys(draft[sku] || {}).length > 0);
  }, [draft]);

  async function saveAll() {
    setSaving(true);
    setErr(null);
    setMsg(null);

    try {
      if (!clientId) throw new Error("Elegí un cliente primero.");

      const payloadRows = rows.map((row) => ({
        sku: row.sku,
        is_active: !!getValue(row, "is_active"),
        url: normUrl(getValue(row, "url")),
      }));

      const r = await fetch("/api/admin/sku-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          rows: payloadRows,
        }),
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok) throw new Error(j?.error || "Error guardando");

      setMsg(
        `Guardado OK • Filas: ${j?.summary?.saved_count ?? 0} • Activos: ${j?.summary?.active_count ?? 0} • URLs: ${j?.summary?.url_count ?? 0}`
      );

      await loadRows(clientId);
    } catch (e: any) {
      setErr(e?.message || "Error guardando");
    } finally {
      setSaving(false);
    }
  }

  async function applyPlanPreset() {
    setApplyingPreset(true);
    setErr(null);
    setMsg(null);

    try {
      if (!clientId) throw new Error("Elegí un cliente primero.");
      if (!selectedClient?.plan) throw new Error("El cliente no tiene plan asignado.");

      const confirmed = window.confirm(
        `Vas a aplicar el preset del plan ${selectedClient.plan} a este cliente.\n\nEsto reemplaza la selección activa actual de SKUs del cliente por la selección base del plan.\n\nLas URLs de producto no se modifican.\n\n¿Querés continuar?`
      );

      if (!confirmed) return;

      const r = await fetch("/api/admin/sku-urls/apply-plan-preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || "Error aplicando preset del plan");
      }

      setMsg(
        `Preset aplicado OK • Plan: ${j?.summary?.plan_code ?? selectedClient.plan} • Preset total: ${
          j?.summary?.preset_total ?? 0
        } • Aplicables: ${j?.summary?.applicable_total ?? 0} • Filas actualizadas: ${
          j?.summary?.updated_count ?? 0
        }`
      );

      await loadRows(clientId);
    } catch (e: any) {
      setErr(e?.message || "Error aplicando preset del plan");
    } finally {
      setApplyingPreset(false);
    }
  }

  function selectAllAllowed() {
    if (!rows.length) return;

    const maxSkus = planInfo?.max_skus ?? null;
    const currentRows = [...rows];
    const nextDraft: Record<string, DraftRow> = {};

    let remaining: number = maxSkus === null ? Infinity : maxSkus;

    for (const row of currentRows) {
      if (remaining > 0) {
        nextDraft[row.sku] = {
          ...(draft[row.sku] || {}),
          is_active: true,
        };
        remaining--;
      } else {
        nextDraft[row.sku] = {
          ...(draft[row.sku] || {}),
          is_active: false,
        };
      }
    }

    setDraft((prev) => ({ ...prev, ...nextDraft }));
  }

  function clearAllActive() {
    const nextDraft: Record<string, DraftRow> = {};
    rows.forEach((row) => {
      nextDraft[row.sku] = {
        ...(draft[row.sku] || {}),
        is_active: false,
      };
    });
    setDraft((prev) => ({ ...prev, ...nextDraft }));
  }

  function exportExcel(mode: "active" | "all" = "all") {
    setErr(null);
    setMsg(null);

    try {
      if (!clientId) throw new Error("Elegí un cliente primero.");
      if (!rows.length) throw new Error("No hay filas para exportar.");

      const sourceRows =
        mode === "active"
          ? rows.filter((row) => !!getValue(row, "is_active"))
          : rows;

      if (!sourceRows.length) {
        throw new Error(
          mode === "active"
            ? "No hay SKUs activos para exportar."
            : "No hay filas para exportar."
        );
      }

      const exportRows = sourceRows.map((row) => {
        const currentUrl = normUrl(getValue(row, "url"));
        const tryOnUrl = normUrl(row.try_on_url || "");

        return {
          sku: normSku(row.sku),
          rb: String(row.rb || "").trim(),
          mmodelo: String(row.nombre || "").trim(),
          url_producto: currentUrl,
          url_probador: tryOnUrl,
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(workbook, worksheet, "sku_urls");

      const slugPart = safeFilePart(
        selectedClient?.slug || selectedClient?.nombre || clientId || "cliente"
      );

      const suffix = mode === "active" ? "activos" : "todos";
      const fileName = `facelens_urls_${slugPart}_${suffix}.xlsx`;

      setExportingExcel(true);
      XLSX.writeFile(workbook, fileName);

      setMsg(
        `Excel exportado OK • Tipo: ${
          mode === "active" ? "activos" : "todos"
        } • Filas: ${exportRows.length} • Archivo: ${fileName}`
      );
    } catch (e: any) {
      setErr(e?.message || "No se pudo exportar el Excel");
    } finally {
      setExportingExcel(false);
    }
  }

  useEffect(() => {
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadRows(clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  return (
    <div style={styles.page}>
      <h1 style={styles.pageTitle}>SKUs y URLs por cliente</h1>

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
            onClick={() => loadRows(clientId)}
            disabled={!clientId || loadingRows}
            style={styles.buttonSecondary}
          >
            {loadingRows ? "Cargando..." : "Recargar SKUs"}
          </button>

          <button
            onClick={applyPlanPreset}
            disabled={!clientId || !rows.length || applyingPreset}
            style={styles.buttonSecondary}
          >
            {applyingPreset ? "Aplicando preset..." : "Aplicar preset del plan"}
          </button>

          <button
            onClick={selectAllAllowed}
            disabled={!clientId || !rows.length}
            style={styles.buttonSecondary}
          >
            Seleccionar todos
          </button>

          <button
            onClick={clearAllActive}
            disabled={!clientId || !rows.length}
            style={styles.buttonSecondary}
          >
            Quitar todos
          </button>

          <button
            onClick={() => exportExcel("active")}
            disabled={!clientId || !rows.length || exportingExcel}
            style={styles.buttonSuccess}
          >
            {exportingExcel ? "Exportando..." : "Exportar Excel (activos)"}
          </button>

          <button
            onClick={() => exportExcel("all")}
            disabled={!clientId || !rows.length || exportingExcel}
            style={styles.buttonSecondary}
          >
            {exportingExcel ? "Exportando..." : "Exportar Excel (todos)"}
          </button>

          <button
            onClick={saveAll}
            disabled={!clientId || !rows.length || saving || !hasChanges}
            style={styles.buttonPrimary}
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>

      {selectedClient && (
        <div style={styles.card}>
          <div style={styles.sectionTitle}>Resumen del cliente</div>

          <div style={styles.row}>
            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>Cliente</div>
              <div style={styles.metricValue}>
                {selectedClient.nombre || selectedClient.slug || selectedClient.id}
              </div>
            </div>

            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>Slug</div>
              <div style={styles.metricValue}>{selectedClient.slug || "—"}</div>
            </div>

            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>Plan</div>
              <div style={styles.metricValue}>{selectedClient.plan || "—"}</div>
            </div>

            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>Catálogo permitido</div>
              <div style={styles.metricValue}>{selectedClient.catalog_scope || "—"}</div>
            </div>

            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>SKUs activos</div>
              <div style={styles.metricValue}>
                {activeCountDraft} / {planInfo?.max_skus ?? "∞"}
              </div>
            </div>

            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>URLs producto</div>
              <div style={styles.metricValue}>
                {urlCountDraft} / {planInfo?.max_urls ?? "∞"}
              </div>
            </div>
          </div>

          <div style={{ ...styles.row, marginTop: 12 }}>
            {planInfo?.max_skus !== null && activeCountDraft > (planInfo?.max_skus || 0) ? (
              <span style={styles.badgeWarn}>
                Exceso de SKUs activos: {activeCountDraft - (planInfo?.max_skus || 0)}
              </span>
            ) : null}

            {planInfo?.max_urls !== null && urlCountDraft > (planInfo?.max_urls || 0) ? (
              <span style={styles.badgeWarn}>
                Exceso de URLs: {urlCountDraft - (planInfo?.max_urls || 0)}
              </span>
            ) : null}

            {isPrimePlan(selectedClient.plan) ? (
              <span style={styles.chip}>PRIME: deep links FaceLens habilitados</span>
            ) : (
              <span style={styles.chip}>GO: deep links visibles solo como referencia</span>
            )}
          </div>
        </div>
      )}

      {err && <div style={styles.infoError}>Error: {err}</div>}
      {msg && <div style={styles.infoOk}>{msg}</div>}

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Filtros y búsqueda</div>

        <div style={styles.row}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por SKU 100..., RB, modelo, categoría o URL"
            style={styles.input}
          />

          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value as "all" | "active" | "inactive")}
            style={{ ...styles.select, minWidth: 170 }}
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{ ...styles.select, minWidth: 220 }}
          >
            <option value="all">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={filterCatalog}
            onChange={(e) => setFilterCatalog(e.target.value)}
            style={{ ...styles.select, minWidth: 220 }}
          >
            <option value="all">Todos los catálogos</option>
            {catalogs.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              setSearch("");
              setFilterActive("all");
              setFilterCategory("all");
              setFilterCatalog("all");
            }}
            style={styles.buttonSecondary}
          >
            Limpiar filtros
          </button>
        </div>

        <div style={{ ...styles.muted, marginTop: 10 }}>
          Mostrando <b>{filteredRows.length}</b> de <b>{rows.length}</b> SKUs permitidos
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Catálogo operativo del cliente</div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {[
                  "activo",
                  "sku",
                  "rb",
                  "modelo",
                  "categoría",
                  "catálogos",
                  "url_producto",
                  "url_probador",
                  "acciones",
                ].map((h) => (
                  <th key={h} style={styles.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((row) => {
                const currentActive = !!getValue(row, "is_active");
                const currentUrl = normUrl(getValue(row, "url"));
                const tryOnUrl = row.try_on_url || "";
                const deepLinkAllowed = isPrimePlan(selectedClient?.plan);

                return (
                  <tr key={row.sku}>
                    <td style={styles.td}>
                      <label style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={currentActive}
                          onChange={(e) => setField(row.sku, "is_active", e.target.checked)}
                        />
                        {currentActive ? "Sí" : "No"}
                      </label>
                    </td>

                    <td style={{ ...styles.td, fontFamily: "monospace" }}>{row.sku}</td>

                    <td style={{ ...styles.td, fontFamily: "monospace" }}>{row.rb || ""}</td>

                    <td style={styles.td}>{row.nombre || ""}</td>

                    <td style={styles.td}>{row.categoria || ""}</td>

                    <td style={styles.td}>
                      {(row.catalogos || []).length ? (
                        row.catalogos.map((c) => (
                          <span key={`${row.sku}-${c}`} style={styles.chip}>
                            {c}
                          </span>
                        ))
                      ) : (
                        <span style={styles.muted}>—</span>
                      )}
                    </td>

                    <td style={styles.td}>
                      <input
                        value={currentUrl}
                        onChange={(e) => setField(row.sku, "url", e.target.value)}
                        placeholder="https://..."
                        style={styles.inputSmall}
                      />
                    </td>

                    <td style={styles.td}>
                      {tryOnUrl ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <a
                            href={tryOnUrl}
                            target="_blank"
                            rel="noreferrer"
                            title={tryOnUrl}
                            style={{
                              ...styles.urlBox,
                              opacity: deepLinkAllowed ? 1 : 0.65,
                            }}
                          >
                            {tryOnUrl}
                          </a>
                          {!deepLinkAllowed && (
                            <span style={styles.muted}>Disponible comercialmente en PRIME</span>
                          )}
                        </div>
                      ) : (
                        <span style={styles.muted}>Sin URL</span>
                      )}
                    </td>

                    <td style={styles.td}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          onClick={() =>
                            copyText(
                              currentUrl,
                              `product-${row.sku}`,
                              `URL de producto copiada para SKU ${row.sku}`
                            )
                          }
                          disabled={!currentUrl}
                          style={styles.buttonSecondary}
                        >
                          {copiedKey === `product-${row.sku}` ? "Copiada" : "Copiar URL producto"}
                        </button>

                        <button
                          onClick={() =>
                            copyText(
                              tryOnUrl,
                              `tryon-${row.sku}`,
                              `URL FaceLens copiada para SKU ${row.sku}`
                            )
                          }
                          disabled={!tryOnUrl}
                          style={styles.buttonSecondary}
                        >
                          {copiedKey === `tryon-${row.sku}` ? "Copiada" : "Copiar URL FaceLens"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ ...styles.td, color: "#6b7280" }}>
                    No hay SKUs para mostrar con el filtro actual.
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