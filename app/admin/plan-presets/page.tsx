"use client";

import { useEffect, useMemo, useState } from "react";

type PlanRow = {
  plan_code?: string;
  max_urls?: number | null;
  created_at?: string;
};

type PresetRow = {
  sku: string;
  rb: string;
  nombre_modelo: string;
  categoria: string;
  proveedor: string;
  grupo: string;
  activo_catalogo: boolean;
  selected: boolean;
};

function cleanStr(v: any) {
  return String(v ?? "").trim();
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
    margin: "0 0 12px 0",
    fontSize: 15,
    fontWeight: 700,
    color: "#374151",
  } as React.CSSProperties,

  row: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  } as React.CSSProperties,

  fieldWrap: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  } as React.CSSProperties,

  label: {
    fontSize: 12,
    color: "#6b7280",
  } as React.CSSProperties,

  input: {
    padding: 9,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#111827",
  } as React.CSSProperties,

  select: {
    padding: 9,
    borderRadius: 10,
    border: "1px solid #d1d5db",
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

  buttonSecondary: {
    padding: "9px 14px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 600,
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#374151",
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

  muted: {
    color: "#6b7280",
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

  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#374151",
  } as React.CSSProperties,
};

export default function PlanPresetsPage() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [planCode, setPlanCode] = useState("");
  const [rows, setRows] = useState<PresetRow[]>([]);
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>({});
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterSelected, setFilterSelected] = useState<"all" | "selected" | "unselected">("all");
  const [filterCategoria, setFilterCategoria] = useState("all");
  const [filterProveedor, setFilterProveedor] = useState("all");

  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      const v = cleanStr(r.categoria);
      if (v) set.add(v);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [rows]);

  const providers = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      const v = cleanStr(r.proveedor);
      if (v) set.add(v);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [rows]);

  const selectedCount = useMemo(() => {
    return Object.values(selectedMap).filter(Boolean).length;
  }, [selectedMap]);

  const filteredRows = useMemo(() => {
    const q = cleanStr(search).toLowerCase();

    return rows.filter((r) => {
      const selected = !!selectedMap[r.sku];

      const matchesSearch =
        !q ||
        cleanStr(r.sku).toLowerCase().includes(q) ||
        cleanStr(r.rb).toLowerCase().includes(q) ||
        cleanStr(r.nombre_modelo).toLowerCase().includes(q) ||
        cleanStr(r.categoria).toLowerCase().includes(q) ||
        cleanStr(r.proveedor).toLowerCase().includes(q);

      const matchesSelected =
        filterSelected === "all" ||
        (filterSelected === "selected" && selected) ||
        (filterSelected === "unselected" && !selected);

      const matchesCategoria =
        filterCategoria === "all" || cleanStr(r.categoria) === cleanStr(filterCategoria);

      const matchesProveedor =
        filterProveedor === "all" || cleanStr(r.proveedor) === cleanStr(filterProveedor);

      return matchesSearch && matchesSelected && matchesCategoria && matchesProveedor;
    });
  }, [rows, selectedMap, search, filterSelected, filterCategoria, filterProveedor]);

  async function loadPlans() {
    setLoadingPlans(true);
    setErr(null);

    try {
      const r = await fetch("/api/admin/plans", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));

      if (!r.ok || !j?.ok) throw new Error(j?.error || "Error cargando planes");

      const list = j.data || [];
      setPlans(list);

      if (!planCode && list.length > 0) {
        setPlanCode(cleanStr(list[0].plan_code));
      }
    } catch (e: any) {
      setErr(e?.message || "Error cargando planes");
    } finally {
      setLoadingPlans(false);
    }
  }

  async function loadPreset(plan: string) {
    if (!plan) {
      setRows([]);
      setSelectedMap({});
      return;
    }

    setLoadingRows(true);
    setErr(null);
    setInfo(null);

    try {
      const r = await fetch(`/api/admin/plan-presets?plan=${encodeURIComponent(plan)}`, {
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));

      if (!r.ok || !j?.ok) throw new Error(j?.error || "Error cargando preset");

      const list: PresetRow[] = j.rows || [];
      setRows(list);

      const nextMap: Record<string, boolean> = {};
      list.forEach((row) => {
        nextMap[row.sku] = !!row.selected;
      });
      setSelectedMap(nextMap);
    } catch (e: any) {
      setErr(e?.message || "Error cargando preset");
    } finally {
      setLoadingRows(false);
    }
  }

  async function savePreset() {
    setSaving(true);
    setErr(null);
    setInfo(null);

    try {
      if (!planCode) throw new Error("Elegí un plan.");

      const skus = Object.entries(selectedMap)
        .filter(([, selected]) => !!selected)
        .map(([sku]) => sku);

      const r = await fetch("/api/admin/plan-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_code: planCode,
          skus,
        }),
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok || !j?.ok) throw new Error(j?.error || "Error guardando preset");

      setInfo(`✅ Preset guardado para ${planCode}. SKUs seleccionados: ${j.saved_count ?? skus.length}`);
      await loadPreset(planCode);
    } catch (e: any) {
      setErr(e?.message || "Error guardando preset");
    } finally {
      setSaving(false);
    }
  }

  function setSkuSelected(sku: string, checked: boolean) {
    setSelectedMap((prev) => ({
      ...prev,
      [sku]: checked,
    }));
  }

  function selectAllFiltered() {
    setSelectedMap((prev) => {
      const next = { ...prev };
      filteredRows.forEach((r) => {
        next[r.sku] = true;
      });
      return next;
    });
  }

  function clearAllFiltered() {
    setSelectedMap((prev) => {
      const next = { ...prev };
      filteredRows.forEach((r) => {
        next[r.sku] = false;
      });
      return next;
    });
  }

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    if (planCode) {
      loadPreset(planCode);
    }
  }, [planCode]);

  return (
    <div style={styles.page}>
      <h1 style={styles.pageTitle}>Presets por plan</h1>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Plan y acciones generales</div>

        <div style={styles.row}>
          <button onClick={loadPlans} disabled={loadingPlans} style={styles.buttonSecondary}>
            {loadingPlans ? "Cargando..." : "Recargar planes"}
          </button>

          <select
            value={planCode}
            onChange={(e) => setPlanCode(e.target.value)}
            style={{ ...styles.select, minWidth: 220 }}
          >
            <option value="">— Elegí plan —</option>
            {plans.map((p) => {
              const code = cleanStr(p.plan_code);
              return (
                <option key={code} value={code}>
                  {code}
                </option>
              );
            })}
          </select>

          <button
            onClick={() => loadPreset(planCode)}
            disabled={!planCode || loadingRows}
            style={styles.buttonSecondary}
          >
            {loadingRows ? "Cargando..." : "Recargar preset"}
          </button>

          <button
            onClick={selectAllFiltered}
            disabled={!rows.length}
            style={styles.buttonSecondary}
          >
            Seleccionar filtrados
          </button>

          <button
            onClick={clearAllFiltered}
            disabled={!rows.length}
            style={styles.buttonSecondary}
          >
            Quitar filtrados
          </button>

          <button
            onClick={savePreset}
            disabled={!planCode || saving}
            style={styles.buttonSuccess}
          >
            {saving ? "Guardando..." : "Guardar preset"}
          </button>
        </div>
      </div>

      {err && <div style={styles.infoError}>Error: {err}</div>}
      {info && <div style={styles.infoOk}>{info}</div>}

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Resumen</div>

        <div style={styles.row}>
          <div style={styles.metricCard}>
            <div style={styles.metricLabel}>Plan</div>
            <div style={styles.metricValue}>{planCode || "—"}</div>
          </div>

          <div style={styles.metricCard}>
            <div style={styles.metricLabel}>Catálogo total</div>
            <div style={styles.metricValue}>{rows.length}</div>
          </div>

          <div style={styles.metricCard}>
            <div style={styles.metricLabel}>Seleccionados</div>
            <div style={styles.metricValue}>{selectedCount}</div>
          </div>

          <div style={styles.metricCard}>
            <div style={styles.metricLabel}>Mostrando</div>
            <div style={styles.metricValue}>{filteredRows.length}</div>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Filtros</div>

        <div style={styles.row}>
          <div style={{ ...styles.fieldWrap, minWidth: 280, flex: "1 1 320px" }}>
            <div style={styles.label}>Buscar</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...styles.input, width: "100%" }}
              placeholder="Buscar por SKU, RB, modelo, categoría o proveedor"
            />
          </div>

          <div style={{ ...styles.fieldWrap, minWidth: 180 }}>
            <div style={styles.label}>Estado selección</div>
            <select
              value={filterSelected}
              onChange={(e) => setFilterSelected(e.target.value as any)}
              style={{ ...styles.select, width: 180 }}
            >
              <option value="all">Todos</option>
              <option value="selected">Seleccionados</option>
              <option value="unselected">No seleccionados</option>
            </select>
          </div>

          <div style={{ ...styles.fieldWrap, minWidth: 200 }}>
            <div style={styles.label}>Categoría</div>
            <select
              value={filterCategoria}
              onChange={(e) => setFilterCategoria(e.target.value)}
              style={{ ...styles.select, width: 200 }}
            >
              <option value="all">Todas</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div style={{ ...styles.fieldWrap, minWidth: 200 }}>
            <div style={styles.label}>Proveedor</div>
            <select
              value={filterProveedor}
              onChange={(e) => setFilterProveedor(e.target.value)}
              style={{ ...styles.select, width: 200 }}
            >
              <option value="all">Todos</option>
              {providers.map((prov) => (
                <option key={prov} value={prov}>
                  {prov}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              setSearch("");
              setFilterSelected("all");
              setFilterCategoria("all");
              setFilterProveedor("all");
            }}
            style={styles.buttonSecondary}
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Selección base del plan</div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {["seleccionar", "sku", "rb", "modelo", "categoría", "proveedor", "grupo", "catálogo"].map((h) => (
                  <th key={h} style={styles.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((row) => {
                const selected = !!selectedMap[row.sku];

                return (
                  <tr key={row.sku}>
                    <td style={styles.td}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => setSkuSelected(row.sku, e.target.checked)}
                      />
                    </td>
                    <td style={{ ...styles.td, fontFamily: "monospace" }}>{row.sku}</td>
                    <td style={{ ...styles.td, fontFamily: "monospace" }}>{row.rb || ""}</td>
                    <td style={styles.td}>{row.nombre_modelo || ""}</td>
                    <td style={styles.td}>{row.categoria || ""}</td>
                    <td style={styles.td}>{row.proveedor || ""}</td>
                    <td style={styles.td}>{row.grupo || ""}</td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.badge,
                          background: row.activo_catalogo ? "#ecfdf5" : "#fef2f2",
                          borderColor: row.activo_catalogo ? "#a7f3d0" : "#fecaca",
                          color: row.activo_catalogo ? "#065f46" : "#991b1b",
                        }}
                      >
                        {row.activo_catalogo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ ...styles.td, textAlign: "center", color: "#6b7280", padding: 24 }}>
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