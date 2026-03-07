"use client";

import { useEffect, useMemo, useState } from "react";

type ClientRow = {
  id: string;
  nombre?: string;
  slug?: string;
  logo_url?: string;
  color_primario?: string;
  olor_secundario?: string;
  activo?: boolean;
  plan?: string;
  whatsapp?: string | null;
  catalog_slug?: string | null;
  catalog_scope?: string | null;
  default_url?: string | null;
};

function slugify(v: string) {
  return (v || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
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

  checkboxLabel: {
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
    color: "#374151",
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

  muted: {
    color: "#6b7280",
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
};

export default function ClientsPage() {
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [draft, setDraft] = useState<Record<string, Partial<ClientRow>>>({});
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [logoFileById, setLogoFileById] = useState<Record<string, File | null>>({});

  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<{
    nombre: string;
    slug: string;
    plan: string;
    catalog_scope: string;
    catalog_slug: string;
    whatsapp: string;
    default_url: string;
    activo: boolean;
    logo_url: string;
    sin_logo: boolean;
    color_primario: string;
    olor_secundario: string;
    slugTouched: boolean;
  }>({
    nombre: "",
    slug: "",
    plan: "ALL",
    catalog_scope: "",
    catalog_slug: "catalogo_global",
    whatsapp: "",
    default_url: "",
    activo: true,
    logo_url: "",
    sin_logo: false,
    color_primario: "#111111",
    olor_secundario: "#0F0F0F",
    slugTouched: false,
  });

  const hasDraft = useMemo(() => {
    return Object.keys(draft).some((id) => Object.keys(draft[id] || {}).length > 0);
  }, [draft]);

  async function load() {
    setLoading(true);
    setErr(null);
    setInfo(null);
    try {
      const r = await fetch("/api/admin/clients", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Error cargando clientes");
      setRows(j.data || []);
      setDraft({});
    } catch (e: any) {
      setErr(e?.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  function setField(id: string, key: keyof ClientRow, value: any) {
    setDraft((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [key]: value,
      },
    }));
  }

  function getValue(r: ClientRow, key: keyof ClientRow) {
    const d = draft[r.id];
    if (d && key in d) return (d as any)[key];
    return (r as any)[key];
  }

  async function saveRow(id: string) {
    setSavingId(id);
    setErr(null);
    setInfo(null);
    try {
      const patch = draft[id] || {};
      if (Object.keys(patch).length === 0) return;

      const r = await fetch(`/api/admin/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Error guardando");

      setInfo("✅ Cambios guardados.");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Error");
    } finally {
      setSavingId(null);
    }
  }

  async function uploadLogoForClient(clientId: string) {
    try {
      setUploadingId(clientId);
      setErr(null);
      setInfo(null);

      const file = logoFileById[clientId];
      if (!file) throw new Error("Elegí un archivo primero (PNG/JPG).");

      const fd = new FormData();
      fd.append("file", file);

      const up = await fetch("/api/admin/upload-logo", {
        method: "POST",
        body: fd,
      });

      const uj = await up.json().catch(() => ({}));
      if (!up.ok || !uj?.ok) throw new Error(uj?.error || "Error subiendo logo");

      const url = String(uj.url || "").trim();
      if (!url) throw new Error("No llegó url del upload");

      const r = await fetch(`/api/admin/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo_url: url }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Error guardando logo_url");

      setInfo("✅ Logo subido y guardado.");
      setLogoFileById((prev) => ({ ...prev, [clientId]: null }));
      await load();
    } catch (e: any) {
      setErr(e?.message || "Error");
    } finally {
      setUploadingId(null);
    }
  }

  async function createClient() {
    setCreating(true);
    setErr(null);
    setInfo(null);

    try {
      const nombre = createForm.nombre.trim();
      const slug = createForm.slug.trim();

      if (!nombre || !slug) {
        throw new Error("Falta nombre o slug.");
      }

      const logo_url = createForm.sin_logo ? "" : createForm.logo_url.trim();
      const color_primario = (createForm.color_primario || "").trim();
      const olor_secundario = (createForm.olor_secundario || "").trim();

      if (!color_primario) throw new Error("Falta color_primario.");
      if (!olor_secundario) throw new Error("Falta olor_secundario.");
      if (!createForm.sin_logo && !logo_url) {
        throw new Error("Falta logo_url (o marcá “Sin logo”).");
      }

      const payload = {
        nombre,
        slug,
        plan: createForm.plan.trim() || null,
        catalog_scope: createForm.catalog_scope.trim() || null,
        catalog_slug: createForm.catalog_slug.trim() || null,
        whatsapp: createForm.whatsapp.trim() || null,
        default_url: createForm.default_url.trim() || null,
        activo: !!createForm.activo,
        logo_url,
        color_primario,
        olor_secundario,
      };

      const r = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Error creando cliente");

      setInfo("✅ Cliente creado.");
      setCreateForm((prev) => ({
        ...prev,
        nombre: "",
        slug: "",
        whatsapp: "",
        default_url: "",
        logo_url: "",
        sin_logo: false,
        activo: true,
        slugTouched: false,
      }));

      await load();
    } catch (e: any) {
      setErr(e?.message || "Error");
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={styles.page}>
      <h1 style={styles.pageTitle}>Clientes</h1>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Crear cliente nuevo</div>

        <div style={{ ...styles.row, alignItems: "flex-start" }}>
          <div style={{ ...styles.fieldWrap, minWidth: 260 }}>
            <div style={styles.label}>nombre *</div>
            <input
              value={createForm.nombre}
              onChange={(e) => {
                const nombre = e.target.value;
                setCreateForm((prev) => {
                  const next = { ...prev, nombre };
                  if (!prev.slugTouched) next.slug = slugify(nombre);
                  return next;
                });
              }}
              style={{ ...styles.input, width: 260 }}
              placeholder="Ej: Tienda 24x7"
            />
          </div>

          <div style={{ ...styles.fieldWrap, minWidth: 260 }}>
            <div style={styles.label}>slug *</div>
            <input
              value={createForm.slug}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  slug: e.target.value,
                  slugTouched: true,
                }))
              }
              style={{ ...styles.input, width: 260 }}
              placeholder="ej: tienda24x7_demo"
            />
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Tip: se autogenera desde el nombre, pero podés editarlo.
            </div>
          </div>

          <div style={{ ...styles.fieldWrap, minWidth: 150 }}>
            <div style={styles.label}>plan</div>
            <input
              value={createForm.plan}
              onChange={(e) => setCreateForm((p) => ({ ...p, plan: e.target.value }))}
              style={{ ...styles.input, width: 150 }}
              placeholder="ALL / GO150 / etc"
            />
          </div>

          <div style={{ ...styles.fieldWrap, minWidth: 170 }}>
            <div style={styles.label}>catalog_scope</div>
            <input
              value={createForm.catalog_scope}
              onChange={(e) => setCreateForm((p) => ({ ...p, catalog_scope: e.target.value }))}
              style={{ ...styles.input, width: 170 }}
              placeholder="ALL / NICOLAS / etc"
            />
          </div>

          <div style={{ ...styles.fieldWrap, minWidth: 190 }}>
            <div style={styles.label}>catalog_slug</div>
            <input
              value={createForm.catalog_slug}
              onChange={(e) => setCreateForm((p) => ({ ...p, catalog_slug: e.target.value }))}
              style={{ ...styles.input, width: 190 }}
              placeholder="catalogo_global"
            />
          </div>

          <div style={{ ...styles.fieldWrap, minWidth: 190 }}>
            <div style={styles.label}>whatsapp</div>
            <input
              value={createForm.whatsapp}
              onChange={(e) => setCreateForm((p) => ({ ...p, whatsapp: e.target.value }))}
              style={{ ...styles.input, width: 190 }}
              placeholder="+54911..."
            />
          </div>

          <div style={{ ...styles.fieldWrap, flex: "1 1 360px", minWidth: 260 }}>
            <div style={styles.label}>default_url</div>
            <input
              value={createForm.default_url}
              onChange={(e) => setCreateForm((p) => ({ ...p, default_url: e.target.value }))}
              style={{ ...styles.input, width: "100%" }}
              placeholder="https://..."
            />
          </div>
        </div>

        <div style={{ ...styles.row, marginTop: 14, alignItems: "flex-end" }}>
          <div style={{ ...styles.fieldWrap, flex: "1 1 420px", minWidth: 260 }}>
            <div style={styles.label}>logo_url {createForm.sin_logo ? "" : "*"}</div>
            <input
              value={createForm.logo_url}
              onChange={(e) => setCreateForm((p) => ({ ...p, logo_url: e.target.value }))}
              disabled={createForm.sin_logo}
              style={{
                ...styles.input,
                width: "100%",
                opacity: createForm.sin_logo ? 0.6 : 1,
              }}
              placeholder="https://... (o marcá Sin logo)"
            />
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={createForm.sin_logo}
                onChange={(e) => setCreateForm((p) => ({ ...p, sin_logo: e.target.checked }))}
              />
              Sin logo (guardar vacío)
            </label>
          </div>

          <div style={styles.fieldWrap}>
            <div style={styles.label}>color_primario *</div>
            <div style={styles.row}>
              <input
                type="color"
                value={createForm.color_primario || "#111111"}
                onChange={(e) => setCreateForm((p) => ({ ...p, color_primario: e.target.value }))}
                style={{ width: 46, height: 36, padding: 0, border: "1px solid #ddd", borderRadius: 8 }}
              />
              <input
                value={createForm.color_primario}
                onChange={(e) => setCreateForm((p) => ({ ...p, color_primario: e.target.value }))}
                style={{ ...styles.input, width: 140 }}
                placeholder="#ad85e0"
              />
            </div>
          </div>

          <div style={styles.fieldWrap}>
            <div style={styles.label}>olor_secundario *</div>
            <div style={styles.row}>
              <input
                type="color"
                value={createForm.olor_secundario || "#0F0F0F"}
                onChange={(e) => setCreateForm((p) => ({ ...p, olor_secundario: e.target.value }))}
                style={{ width: 46, height: 36, padding: 0, border: "1px solid #ddd", borderRadius: 8 }}
              />
              <input
                value={createForm.olor_secundario}
                onChange={(e) => setCreateForm((p) => ({ ...p, olor_secundario: e.target.value }))}
                style={{ ...styles.input, width: 140 }}
                placeholder="#0F0F0F"
              />
            </div>
          </div>

          <div style={{ ...styles.row, alignItems: "center" }}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={!!createForm.activo}
                onChange={(e) => setCreateForm((p) => ({ ...p, activo: e.target.checked }))}
              />
              Activo
            </label>

            <button
              onClick={createClient}
              disabled={creating}
              style={{
                ...styles.buttonPrimary,
                opacity: creating ? 0.7 : 1,
                cursor: creating ? "wait" : "pointer",
              }}
            >
              {creating ? "Creando..." : "Crear"}
            </button>
          </div>
        </div>
      </div>

      {err && <div style={styles.infoError}>Error: {err}</div>}
      {info && <div style={styles.infoOk}>{info}</div>}

      <div style={styles.card}>
        <div style={{ ...styles.row, justifyContent: "space-between" }}>
          <div style={styles.sectionTitle}>Listado de clientes</div>

          <div style={styles.row}>
            <button onClick={load} style={styles.buttonSecondary}>
              {loading ? "Cargando..." : "Recargar"}
            </button>

            <div style={styles.muted}>Total: {rows.length}</div>

            {hasDraft && <div style={{ color: "#b45309", fontWeight: 600 }}>Tenés cambios sin guardar.</div>}
          </div>
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {[
                  "id",
                  "nombre",
                  "slug",
                  "plan",
                  "catalog_scope",
                  "catalog_slug",
                  "whatsapp",
                  "default_url",
                  "logo",
                  "activo",
                  "acciones",
                ].map((h) => (
                  <th key={h} style={styles.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ ...styles.td, fontFamily: "monospace", whiteSpace: "nowrap" }}>{r.id}</td>

                  <td style={styles.td}>
                    <input
                      value={getValue(r, "nombre") ?? ""}
                      onChange={(e) => setField(r.id, "nombre", e.target.value)}
                      style={{ ...styles.input, width: 220 }}
                    />
                  </td>

                  <td style={styles.td}>
                    <input
                      value={getValue(r, "slug") ?? ""}
                      onChange={(e) => setField(r.id, "slug", e.target.value)}
                      style={{ ...styles.input, width: 200 }}
                    />
                  </td>

                  <td style={styles.td}>
                    <input
                      value={getValue(r, "plan") ?? ""}
                      onChange={(e) => setField(r.id, "plan", e.target.value)}
                      style={{ ...styles.input, width: 110 }}
                    />
                  </td>

                  <td style={styles.td}>
                    <input
                      value={getValue(r, "catalog_scope") ?? ""}
                      onChange={(e) => setField(r.id, "catalog_scope", e.target.value)}
                      style={{ ...styles.input, width: 140 }}
                    />
                  </td>

                  <td style={styles.td}>
                    <input
                      value={getValue(r, "catalog_slug") ?? ""}
                      onChange={(e) => setField(r.id, "catalog_slug", e.target.value)}
                      style={{ ...styles.input, width: 160 }}
                    />
                  </td>

                  <td style={styles.td}>
                    <input
                      value={getValue(r, "whatsapp") ?? ""}
                      onChange={(e) => setField(r.id, "whatsapp", e.target.value)}
                      style={{ ...styles.input, width: 160 }}
                    />
                  </td>

                  <td style={styles.td}>
                    <input
                      value={getValue(r, "default_url") ?? ""}
                      onChange={(e) => setField(r.id, "default_url", e.target.value)}
                      style={{ ...styles.input, width: 320 }}
                    />
                  </td>

                  <td style={styles.td}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ ...styles.row, alignItems: "center" }}>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => {
                            const f = e.target.files?.[0] || null;
                            setLogoFileById((prev) => ({ ...prev, [r.id]: f }));
                          }}
                          style={{ maxWidth: 180 }}
                        />
                        <button
                          onClick={() => uploadLogoForClient(r.id)}
                          disabled={uploadingId === r.id || !logoFileById[r.id]}
                          style={{
                            ...styles.buttonSecondary,
                            padding: "7px 12px",
                            opacity: uploadingId === r.id ? 0.7 : 1,
                            cursor: uploadingId === r.id ? "wait" : "pointer",
                          }}
                        >
                          {uploadingId === r.id ? "Subiendo..." : "Subir logo"}
                        </button>
                      </div>

                      {r.logo_url ? (
                        <a href={r.logo_url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                          Ver logo
                        </a>
                      ) : (
                        <span style={{ fontSize: 12, color: "#6b7280" }}>Sin logo</span>
                      )}

                      {draft[r.id]?.logo_url ? (
                        <div style={{ fontSize: 12, color: "#6b7280" }}>
                          (pendiente guardar logo_url en draft)
                        </div>
                      ) : null}
                    </div>
                  </td>

                  <td style={styles.td}>
                    <label style={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={!!getValue(r, "activo")}
                        onChange={(e) => setField(r.id, "activo", e.target.checked)}
                      />
                      {getValue(r, "activo") ? "✅" : "❌"}
                    </label>
                  </td>

                  <td style={styles.td}>
                    <button
                      onClick={() => saveRow(r.id)}
                      disabled={savingId === r.id || Object.keys(draft[r.id] || {}).length === 0}
                      style={{
                        ...styles.buttonSuccess,
                        padding: "7px 12px",
                        opacity: savingId === r.id ? 0.7 : 1,
                        cursor: savingId === r.id ? "wait" : "pointer",
                      }}
                    >
                      {savingId === r.id ? "Guardando..." : "Guardar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}