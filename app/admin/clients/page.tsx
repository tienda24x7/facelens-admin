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
  archived?: boolean;
  plan?: string;
  comercial?: string | null;
  whatsapp?: string | null;
  catalog_slug?: string | null;
  catalog_scope?: string | null;
  default_url?: string | null;
  metrics_token?: string | null;
  locale?: string | null;

  store_platform?: string | null;
  store_status?: string | null;
  shopify_store_domain?: string | null;
  shopify_access_token?: string | null;
  shopify_auth_mode?: string | null;
  shopify_client_id?: string | null;
  shopify_client_secret?: string | null;
  store_import_enabled?: boolean | null;
  store_import_mode?: string | null;
  store_import_filters?: string | null;
  last_store_sync_at?: string | null;
  last_store_sync_result?: string | null;
};

type PlanRow = {
  plan_code?: string;
  max_urls?: number | null;
  created_at?: string;
};

type StatusFilter = "all" | "active" | "inactive";

const FACELENS_LIVE_BASE_URL = "https://facelens-live.vercel.app";
const FACELENS_PANEL_BASE_URL = "https://facelens-panel.vercel.app";
const CATALOG_SCOPE_OPTIONS = ["ALL", "NICOLAS", "EZEQUIEL"];
const LOCALE_OPTIONS = ["es", "en", "pt-BR"];
const STORE_PLATFORM_OPTIONS = ["none", "shopify", "tiendanube", "custom"];
const STORE_STATUS_OPTIONS = ["not_connected", "connected", "error"];
const STORE_IMPORT_MODE_OPTIONS = ["facelens_only", "shopify_fallback"];
const SHOPIFY_AUTH_MODE_OPTIONS = ["token", "app_credentials"];

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

function cleanStr(v: any) {
  return String(v ?? "").trim();
}

function normalizeHexColor(value: any, fallback = "#111111") {
  const s = String(value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s : fallback;
}

function buildAppUrl(slug?: string) {
  const s = cleanStr(slug);
  if (!s) return "";
  return `${FACELENS_LIVE_BASE_URL}/?slug=${encodeURIComponent(s)}`;
}

function isPrimePlan(plan?: string | null) {
  return cleanStr(plan).toUpperCase().includes("PRIME");
}

function buildDashboardUrl(
  slug?: string,
  plan?: string | null,
  metricsToken?: string | null
) {
  if (!isPrimePlan(plan)) return "";
  const s = cleanStr(slug);
  const t = cleanStr(metricsToken);
  if (!s || !t) return "";
  return `${FACELENS_PANEL_BASE_URL}/?slug=${encodeURIComponent(s)}&t=${encodeURIComponent(t)}&days=30`;
}

function platformLabel(value?: string | null) {
  const v = cleanStr(value);
  if (v === "shopify") return "Shopify";
  if (v === "tiendanube") return "Tiendanube";
  if (v === "custom") return "Web propia";
  return "Sin tienda";
}

function storeStatusLabel(value?: string | null) {
  const v = cleanStr(value);
  if (v === "connected") return "Conectada";
  if (v === "error") return "Error";
  return "No conectada";
}

function importModeLabel(value?: string | null) {
  const v = cleanStr(value);
  if (v === "shopify_fallback") return "Usar imagen importada como fallback";
  return "Solo assets FaceLens";
}

function shopifyAuthModeLabel(value?: string | null) {
  const v = cleanStr(value);
  if (v === "app_credentials") return "App nueva (client id / secret)";
  return "Token directo";
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

  buttonDanger: {
    padding: "7px 12px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 600,
    border: "1px solid #dc2626",
    background: "#ef4444",
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

  linkBox: {
    display: "inline-block",
    maxWidth: 260,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: 12,
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

  detailCard: {
    padding: 14,
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#fafafa",
  } as React.CSSProperties,

  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(280px, 1fr))",
    gap: 14,
  } as React.CSSProperties,

  sectionBox: {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 12,
    background: "#fff",
  } as React.CSSProperties,

  sectionBoxTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#374151",
    marginBottom: 10,
  } as React.CSSProperties,
};

export default function ClientsPage() {
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [draft, setDraft] = useState<Record<string, Partial<ClientRow>>>({});
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [testingStoreId, setTestingStoreId] = useState<string | null>(null);
  const [importingStoreId, setImportingStoreId] = useState<string | null>(null);

  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [logoFileById, setLogoFileById] = useState<Record<string, File | null>>({});

  const [copiedKey, setCopiedKey] = useState<string>("");

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [comercialFilter, setComercialFilter] = useState("all");

  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<{
    nombre: string;
    slug: string;
    plan: string;
    comercial: string;
    catalog_scope: string;
    catalog_slug: string;
    whatsapp: string;
    default_url: string;
    activo: boolean;
    logo_url: string;
    sin_logo: boolean;
    color_primario: string;
    olor_secundario: string;
    locale: string;
    slugTouched: boolean;

    store_platform: string;
    store_status: string;
    shopify_store_domain: string;
    shopify_access_token: string;
    shopify_auth_mode: string;
    shopify_client_id: string;
    shopify_client_secret: string;
    store_import_enabled: boolean;
    store_import_mode: string;
    store_import_filters: string;
    last_store_sync_at: string;
    last_store_sync_result: string;
  }>({
    nombre: "",
    slug: "",
    plan: "",
    comercial: "",
    catalog_scope: "ALL",
    catalog_slug: "catalogo_global",
    whatsapp: "",
    default_url: "",
    activo: true,
    logo_url: "",
    sin_logo: false,
    color_primario: "#111111",
    olor_secundario: "#0F0F0F",
    locale: "es",
    slugTouched: false,

    store_platform: "none",
    store_status: "not_connected",
    shopify_store_domain: "",
    shopify_access_token: "",
    shopify_auth_mode: "token",
    shopify_client_id: "",
    shopify_client_secret: "",
    store_import_enabled: false,
    store_import_mode: "facelens_only",
    store_import_filters: "lentes, sunglasses, eyewear",
    last_store_sync_at: "",
    last_store_sync_result: "",
  });

  const planOptions = useMemo(() => {
    return (plans || []).map((p) => cleanStr(p.plan_code)).filter(Boolean);
  }, [plans]);

  const comercialOptions = useMemo(() => {
    const values = new Set<string>();

    rows.forEach((r) => {
      const current = cleanStr(getValue(r, "comercial"));
      if (current) values.add(current);
    });

    return Array.from(values).sort((a, b) => a.localeCompare(b, "es"));
  }, [rows, draft]);

  const hasDraft = useMemo(() => {
    return Object.keys(draft).some((id) => Object.keys(draft[id] || {}).length > 0);
  }, [draft]);

  const filteredRows = useMemo(() => {
    const search = cleanStr(searchTerm).toLowerCase();

    return rows.filter((r) => {
      const currentNombre = cleanStr(getValue(r, "nombre")).toLowerCase();
      const currentSlug = cleanStr(getValue(r, "slug")).toLowerCase();
      const currentPlan = cleanStr(getValue(r, "plan"));
      const currentComercial = cleanStr(getValue(r, "comercial"));
      const currentActivo = !!getValue(r, "activo");

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && currentActivo) ||
        (statusFilter === "inactive" && !currentActivo);

      const matchesPlan =
        planFilter === "all" || cleanStr(currentPlan) === cleanStr(planFilter);

      const matchesComercial =
        comercialFilter === "all" || cleanStr(currentComercial) === cleanStr(comercialFilter);

      const matchesSearch =
        !search ||
        currentNombre.includes(search) ||
        currentSlug.includes(search);

      return matchesStatus && matchesPlan && matchesComercial && matchesSearch;
    });
  }, [rows, draft, statusFilter, planFilter, comercialFilter, searchTerm]);

  async function copyText(value: string, key: string, okMsg: string) {
    try {
      if (!value) throw new Error("No hay link para copiar.");
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setInfo(okMsg);
      setTimeout(() => setCopiedKey(""), 1800);
    } catch (e: any) {
      setErr(e?.message || "No se pudo copiar");
    }
  }

  async function showPendingStoreAction(actionLabel: string) {
    setErr(null);
    setInfo(`ℹ️ ${actionLabel} quedará habilitado cuando armemos el backend de integración.`);
  }

  async function testShopifyConnection(row: ClientRow) {
  try {
    setTestingStoreId(row.id);
    setErr(null);
    setInfo(null);

    const response = await fetch(`/api/admin/clients/${row.id}/shopify-test`, {
      method: "POST",
    });

    const json = await response.json().catch(() => ({}));

    if (!response.ok || !json?.ok) {
      throw new Error(
        json?.detail ||
          json?.error ||
          "No se pudo probar la conexión Shopify."
      );
    }

    const productsFound = Number(json?.sample?.products_found || 0);
    const domain = cleanStr(json?.shop?.domain);
    const firstTitles = Array.isArray(json?.sample?.first_products)
      ? json.sample.first_products
          .map((p: any) => cleanStr(p?.title))
          .filter(Boolean)
          .slice(0, 3)
      : [];

    const preview =
      firstTitles.length > 0 ? ` • Ejemplos: ${firstTitles.join(" | ")}` : "";

    setInfo(
      `✅ Conexión Shopify OK para ${cleanStr(row.nombre || row.slug || row.id)} • Dominio: ${domain || "—"} • Productos muestra: ${productsFound}${preview}`
    );
  } catch (e: any) {
    setErr(e?.message || "No se pudo probar la conexión Shopify.");
  } finally {
    setTestingStoreId(null);
  }
}

  async function importShopifyProducts(row: ClientRow) {
    try {
      const storePlatform = cleanStr(row.store_platform).toLowerCase();
      if (storePlatform !== "shopify") {
        throw new Error("El cliente no tiene Shopify configurado como plataforma.");
      }

      setImportingStoreId(row.id);
      setErr(null);
      setInfo(null);

      const response = await fetch(`/api/admin/clients/${row.id}/shopify-import`, {
        method: "POST",
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json?.ok) {
        throw new Error(
          json?.error ||
            json?.detail ||
            "No se pudo importar productos desde Shopify."
        );
      }

      const importedCount = Number(json?.imported_count || 0);
      const productsFound = Number(json?.products_found || 0);
      const productsFiltered = Number(json?.products_filtered || 0);

      setInfo(
        `✅ Importación Shopify OK para ${cleanStr(row.nombre || row.slug || row.id)} • Productos leídos: ${productsFound} • Filtrados: ${productsFiltered} • Guardados: ${importedCount}`
      );

      await load();
    } catch (e: any) {
      setErr(e?.message || "No se pudo importar productos desde Shopify.");
    } finally {
      setImportingStoreId(null);
    }
  }

  function downloadCsv() {
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        plan: planFilter,
        comercial: comercialFilter,
        search: searchTerm,
      });

      const url = `/api/admin/clients/export?${params.toString()}`;
      window.open(url, "_blank");
    } catch (e: any) {
      setErr(e?.message || "No se pudo exportar el CSV");
    }
  }

  async function loadPlans() {
    try {
      const r = await fetch("/api/admin/plans", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Error cargando planes");
      setPlans(j.data || []);
    } catch (e: any) {
      setErr(e?.message || "Error cargando planes");
    }
  }

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

  async function archiveClient(row: ClientRow) {
    const nombre = cleanStr(row.nombre || row.slug || row.id);
    const slug = cleanStr(row.slug);

    try {
      setArchivingId(row.id);
      setErr(null);
      setInfo(null);

      if (!slug) {
        throw new Error("No se puede archivar un cliente sin slug.");
      }

      const confirmed = window.confirm(
        `Vas a archivar a "${nombre}".\n\nEsta acción lo quitará del listado operativo y lo dejará inactivo.\n\n¿Querés continuar?`
      );

      if (!confirmed) return;

      const typed = window.prompt(
        `Segunda validación:\n\nEscribí exactamente el slug del cliente para confirmar el archivado.\n\nSlug esperado: ${slug}`
      );

      if (typed === null) return;

      if (cleanStr(typed) !== slug) {
        throw new Error("La confirmación no coincide con el slug del cliente.");
      }

      const r = await fetch(`/api/admin/clients/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          archived: true,
          activo: false,
        }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "No se pudo archivar el cliente.");

      setInfo(`✅ Cliente archivado: ${nombre}`);
      await load();
    } catch (e: any) {
      setErr(e?.message || "No se pudo archivar el cliente.");
    } finally {
      setArchivingId(null);
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
        comercial: createForm.comercial.trim() || null,
        catalog_scope: createForm.catalog_scope.trim() || null,
        catalog_slug: createForm.catalog_slug.trim() || null,
        whatsapp: createForm.whatsapp.trim() || null,
        default_url: createForm.default_url.trim() || null,
        activo: !!createForm.activo,
        logo_url,
        color_primario,
        olor_secundario,
        locale: createForm.locale.trim() || "es",

        store_platform: createForm.store_platform.trim() || "none",
        store_status: createForm.store_status.trim() || "not_connected",
        shopify_store_domain: createForm.shopify_store_domain.trim() || null,
        shopify_access_token: createForm.shopify_access_token.trim() || null,
        shopify_auth_mode: createForm.shopify_auth_mode.trim() || "token",
        shopify_client_id: createForm.shopify_client_id.trim() || null,
        shopify_client_secret: createForm.shopify_client_secret.trim() || null,
        store_import_enabled: !!createForm.store_import_enabled,
        store_import_mode: createForm.store_import_mode.trim() || "facelens_only",
        store_import_filters: createForm.store_import_filters.trim() || null,
        last_store_sync_at: createForm.last_store_sync_at.trim() || null,
        last_store_sync_result: createForm.last_store_sync_result.trim() || null,
      };

      const r = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Error creando cliente");

      setInfo("✅ Cliente creado.");
      setCreateForm({
        nombre: "",
        slug: "",
        plan: planOptions[0] || "",
        comercial: "",
        catalog_scope: "ALL",
        catalog_slug: "catalogo_global",
        whatsapp: "",
        default_url: "",
        activo: true,
        logo_url: "",
        sin_logo: false,
        color_primario: "#111111",
        olor_secundario: "#0F0F0F",
        locale: "es",
        slugTouched: false,

        store_platform: "none",
        store_status: "not_connected",
        shopify_store_domain: "",
        shopify_access_token: "",
        shopify_auth_mode: "token",
        shopify_client_id: "",
        shopify_client_secret: "",
        store_import_enabled: false,
        store_import_mode: "facelens_only",
        store_import_filters: "lentes, sunglasses, eyewear",
        last_store_sync_at: "",
        last_store_sync_result: "",
      });

      await load();
    } catch (e: any) {
      setErr(e?.message || "Error");
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    load();
    loadPlans();
  }, []);

  useEffect(() => {
    if (!createForm.plan && planOptions.length > 0) {
      setCreateForm((prev) => ({ ...prev, plan: planOptions[0] }));
    }
  }, [planOptions, createForm.plan]);

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

          <div style={{ ...styles.fieldWrap, minWidth: 170 }}>
            <div style={styles.label}>plan</div>
            <select
              value={createForm.plan}
              onChange={(e) => setCreateForm((p) => ({ ...p, plan: e.target.value }))}
              style={{ ...styles.select, width: 170 }}
            >
              {planOptions.length === 0 ? (
                <option value="">Sin planes</option>
              ) : (
                planOptions.map((plan) => (
                  <option key={plan} value={plan}>
                    {plan}
                  </option>
                ))
              )}
            </select>
          </div>

          <div style={{ ...styles.fieldWrap, minWidth: 170 }}>
            <div style={styles.label}>idioma</div>
            <select
              value={createForm.locale}
              onChange={(e) => setCreateForm((p) => ({ ...p, locale: e.target.value }))}
              style={{ ...styles.select, width: 170 }}
            >
              {LOCALE_OPTIONS.map((locale) => (
                <option key={locale} value={locale}>
                  {locale}
                </option>
              ))}
            </select>
          </div>

          <div style={{ ...styles.fieldWrap, minWidth: 220 }}>
            <div style={styles.label}>comercial</div>
            <input
              value={createForm.comercial}
              onChange={(e) => setCreateForm((p) => ({ ...p, comercial: e.target.value }))}
              style={{ ...styles.input, width: 220 }}
              placeholder="Ej: Juan Pérez"
            />
          </div>

          <div style={{ ...styles.fieldWrap, minWidth: 170 }}>
            <div style={styles.label}>catalog_scope</div>
            <select
              value={createForm.catalog_scope}
              onChange={(e) => setCreateForm((p) => ({ ...p, catalog_scope: e.target.value }))}
              style={{ ...styles.select, width: 170 }}
            >
              {CATALOG_SCOPE_OPTIONS.map((scope) => (
                <option key={scope} value={scope}>
                  {scope}
                </option>
              ))}
            </select>
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

        <div style={{ ...styles.sectionBox, marginTop: 14 }}>
          <div style={styles.sectionBoxTitle}>Tienda conectada</div>

          <div style={{ ...styles.row, alignItems: "flex-start" }}>
            <div style={{ ...styles.fieldWrap, minWidth: 170 }}>
              <div style={styles.label}>Plataforma</div>
              <select
                value={createForm.store_platform}
                onChange={(e) => setCreateForm((p) => ({ ...p, store_platform: e.target.value }))}
                style={{ ...styles.select, width: 170 }}
              >
                {STORE_PLATFORM_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {platformLabel(option)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ ...styles.fieldWrap, minWidth: 170 }}>
              <div style={styles.label}>Estado conexión</div>
              <select
                value={createForm.store_status}
                onChange={(e) => setCreateForm((p) => ({ ...p, store_status: e.target.value }))}
                style={{ ...styles.select, width: 170 }}
              >
                {STORE_STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {storeStatusLabel(option)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ ...styles.fieldWrap, minWidth: 190 }}>
              <div style={styles.label}>Modo auth Shopify</div>
              <select
                value={createForm.shopify_auth_mode}
                onChange={(e) => setCreateForm((p) => ({ ...p, shopify_auth_mode: e.target.value }))}
                style={{ ...styles.select, width: 190 }}
              >
                {SHOPIFY_AUTH_MODE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {shopifyAuthModeLabel(option)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ ...styles.fieldWrap, minWidth: 260, flex: "1 1 260px" }}>
              <div style={styles.label}>Dominio Shopify</div>
              <input
                value={createForm.shopify_store_domain}
                onChange={(e) => setCreateForm((p) => ({ ...p, shopify_store_domain: e.target.value }))}
                style={{ ...styles.input, width: "100%" }}
                placeholder="mitienda.myshopify.com"
              />
            </div>

            {createForm.shopify_auth_mode === "token" ? (
              <div style={{ ...styles.fieldWrap, minWidth: 260, flex: "1 1 260px" }}>
                <div style={styles.label}>Access token Shopify</div>
                <input
                  type="password"
                  value={createForm.shopify_access_token}
                  onChange={(e) => setCreateForm((p) => ({ ...p, shopify_access_token: e.target.value }))}
                  style={{ ...styles.input, width: "100%" }}
                  placeholder="shpat_..."
                />
              </div>
            ) : (
              <>
                <div style={{ ...styles.fieldWrap, minWidth: 240, flex: "1 1 240px" }}>
                  <div style={styles.label}>Shopify client id</div>
                  <input
                    value={createForm.shopify_client_id}
                    onChange={(e) => setCreateForm((p) => ({ ...p, shopify_client_id: e.target.value }))}
                    style={{ ...styles.input, width: "100%" }}
                    placeholder="client id"
                  />
                </div>

                <div style={{ ...styles.fieldWrap, minWidth: 240, flex: "1 1 240px" }}>
                  <div style={styles.label}>Shopify client secret</div>
                  <input
                    type="password"
                    value={createForm.shopify_client_secret}
                    onChange={(e) => setCreateForm((p) => ({ ...p, shopify_client_secret: e.target.value }))}
                    style={{ ...styles.input, width: "100%" }}
                    placeholder="client secret"
                  />
                </div>
              </>
            )}

            <div style={{ ...styles.fieldWrap, minWidth: 220 }}>
              <div style={styles.label}>Modo visual</div>
              <select
                value={createForm.store_import_mode}
                onChange={(e) => setCreateForm((p) => ({ ...p, store_import_mode: e.target.value }))}
                style={{ ...styles.select, width: 220 }}
              >
                {STORE_IMPORT_MODE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {importModeLabel(option)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ ...styles.fieldWrap, minWidth: 220, flex: "1 1 280px" }}>
              <div style={styles.label}>Filtros importación</div>
              <input
                value={createForm.store_import_filters}
                onChange={(e) => setCreateForm((p) => ({ ...p, store_import_filters: e.target.value }))}
                style={{ ...styles.input, width: "100%" }}
                placeholder="lentes, sunglasses, eyewear"
              />
            </div>

            <div style={{ ...styles.fieldWrap, minWidth: 180 }}>
              <div style={styles.label}>Importación habilitada</div>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={!!createForm.store_import_enabled}
                  onChange={(e) => setCreateForm((p) => ({ ...p, store_import_enabled: e.target.checked }))}
                />
                {createForm.store_import_enabled ? "Sí" : "No"}
              </label>
            </div>
          </div>

          <div style={{ ...styles.row, marginTop: 12 }}>
            <button
              onClick={() => showPendingStoreAction("Probar conexión")}
              disabled
              style={{ ...styles.buttonSecondary, opacity: 0.6, cursor: "not-allowed" }}
            >
              Probar conexión
            </button>

            <button
              onClick={() => showPendingStoreAction("Importar productos")}
              disabled
              style={{ ...styles.buttonSecondary, opacity: 0.6, cursor: "not-allowed" }}
            >
              Importar productos
            </button>

            <button
              onClick={() => showPendingStoreAction("Actualizar catálogo")}
              disabled
              style={{ ...styles.buttonSecondary, opacity: 0.6, cursor: "not-allowed" }}
            >
              Actualizar catálogo
            </button>

            <button
              onClick={() => showPendingStoreAction("Desconectar tienda")}
              disabled
              style={{ ...styles.buttonSecondary, opacity: 0.6, cursor: "not-allowed" }}
            >
              Desconectar
            </button>

            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Estos botones se activan cuando armemos el backend de integración.
            </div>
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

            <button onClick={downloadCsv} style={styles.buttonSecondary}>
              Exportar CSV
            </button>

            <div style={styles.muted}>Total: {rows.length}</div>
            <div style={styles.muted}>Visibles: {filteredRows.length}</div>

            {hasDraft && <div style={{ color: "#b45309", fontWeight: 600 }}>Tenés cambios sin guardar.</div>}
          </div>
        </div>

        <div
          style={{
            ...styles.row,
            marginBottom: 14,
            padding: 12,
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            background: "#f9fafb",
            alignItems: "flex-end",
          }}
        >
          <div style={{ ...styles.fieldWrap, minWidth: 200 }}>
            <div style={styles.label}>Estado</div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              style={{ ...styles.select, width: 200 }}
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>

          <div style={{ ...styles.fieldWrap, minWidth: 220 }}>
            <div style={styles.label}>Plan</div>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              style={{ ...styles.select, width: 220 }}
            >
              <option value="all">Todos los planes</option>
              {planOptions.map((plan) => (
                <option key={plan} value={plan}>
                  {plan}
                </option>
              ))}
            </select>
          </div>

          <div style={{ ...styles.fieldWrap, minWidth: 220 }}>
            <div style={styles.label}>Comercial</div>
            <select
              value={comercialFilter}
              onChange={(e) => setComercialFilter(e.target.value)}
              style={{ ...styles.select, width: 220 }}
            >
              <option value="all">Todos los comerciales</option>
              {comercialOptions.map((comercial) => (
                <option key={comercial} value={comercial}>
                  {comercial}
                </option>
              ))}
            </select>
          </div>

          <div style={{ ...styles.fieldWrap, minWidth: 260, flex: "1 1 280px" }}>
            <div style={styles.label}>Buscar por nombre o slug</div>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ ...styles.input, width: "100%" }}
              placeholder="Ej: tienda24x7 o via_rapida_store"
            />
          </div>

          <button
            onClick={() => {
              setStatusFilter("all");
              setPlanFilter("all");
              setComercialFilter("all");
              setSearchTerm("");
            }}
            style={styles.buttonSecondary}
          >
            Limpiar filtros
          </button>
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {[
                  "cliente",
                  "slug",
                  "plan",
                  "comercial",
                  "estado",
                  "links",
                  "acciones",
                ].map((h) => (
                  <th key={h} style={styles.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((r) => {
                const appUrl = buildAppUrl(String(getValue(r, "slug") ?? ""));
                const dashboardUrl = buildDashboardUrl(
                  String(getValue(r, "slug") ?? ""),
                  String(getValue(r, "plan") ?? ""),
                  String(getValue(r, "metrics_token") ?? "")
                );

                const hasChangesRow = Object.keys(draft[r.id] || {}).length > 0;
                const isBusy =
                  savingId === r.id ||
                  archivingId === r.id ||
                  testingStoreId === r.id ||
                  importingStoreId === r.id;
                const isExpanded = expandedId === r.id;

                const currentPrimary = normalizeHexColor(getValue(r, "color_primario"), "#111111");
                const currentSecondary = normalizeHexColor(getValue(r, "olor_secundario"), "#0F0F0F");
                const currentStorePlatform = cleanStr(getValue(r, "store_platform")).toLowerCase();

                return (
                  <>
                    <tr key={r.id}>
                      <td style={styles.td}>
                        <div style={{ fontWeight: 700 }}>{getValue(r, "nombre") || "—"}</div>
                        <div style={{ ...styles.muted, fontSize: 12, marginTop: 4, fontFamily: "monospace" }}>
                          {r.id}
                        </div>
                      </td>

                      <td style={styles.td}>
                        <div style={{ fontFamily: "monospace" }}>{getValue(r, "slug") || "—"}</div>
                      </td>

                      <td style={styles.td}>
                        <span style={styles.badge}>{String(getValue(r, "plan") || "—")}</span>
                      </td>

                      <td style={styles.td}>
                        {getValue(r, "comercial") || <span style={styles.muted}>Sin asignar</span>}
                      </td>

                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.badge,
                            background: getValue(r, "activo") ? "#ecfdf5" : "#fef2f2",
                            borderColor: getValue(r, "activo") ? "#a7f3d0" : "#fecaca",
                            color: getValue(r, "activo") ? "#065f46" : "#991b1b",
                          }}
                        >
                          {getValue(r, "activo") ? "Activo" : "Inactivo"}
                        </span>
                        {hasChangesRow ? (
                          <div style={{ color: "#b45309", fontSize: 12, marginTop: 6 }}>Cambios sin guardar</div>
                        ) : null}
                      </td>

                      <td style={styles.td}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {appUrl ? (
                            <a href={appUrl} target="_blank" rel="noreferrer" style={styles.linkBox} title={appUrl}>
                              App cliente
                            </a>
                          ) : (
                            <span style={styles.muted}>Sin link app</span>
                          )}

                          {dashboardUrl ? (
                            <a
                              href={dashboardUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={styles.linkBox}
                              title={dashboardUrl}
                            >
                              Dashboard
                            </a>
                          ) : isPrimePlan(String(getValue(r, "plan") ?? "")) ? (
                            <span style={styles.muted}>Falta token métricas</span>
                          ) : (
                            <span style={styles.muted}>Solo PRIME</span>
                          )}
                        </div>
                      </td>

                      <td style={styles.td}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : r.id)}
                            style={styles.buttonSecondary}
                          >
                            {isExpanded ? "Ocultar" : "Ver / Editar"}
                          </button>

                          <button
                            onClick={() => saveRow(r.id)}
                            disabled={isBusy || !hasChangesRow}
                            style={{
                              ...styles.buttonSuccess,
                              opacity: isBusy || !hasChangesRow ? 0.7 : 1,
                              cursor: isBusy ? "wait" : "pointer",
                            }}
                          >
                            {savingId === r.id ? "Guardando..." : "Guardar"}
                          </button>

                          <button
                            onClick={() => archiveClient(r)}
                            disabled={isBusy}
                            style={{
                              ...styles.buttonDanger,
                              opacity: isBusy ? 0.7 : 1,
                              cursor: isBusy ? "wait" : "pointer",
                            }}
                          >
                            {archivingId === r.id ? "Archivando..." : "Archivar"}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isExpanded ? (
                      <tr key={`${r.id}-detail`}>
                        <td colSpan={7} style={styles.td}>
                          <div style={styles.detailCard}>
                            <div style={styles.detailGrid}>
                              <div style={styles.sectionBox}>
                                <div style={styles.sectionBoxTitle}>Datos básicos</div>

                                <div style={{ ...styles.row, alignItems: "flex-start" }}>
                                  <div style={{ ...styles.fieldWrap, minWidth: 220, flex: "1 1 220px" }}>
                                    <div style={styles.label}>Nombre</div>
                                    <input
                                      value={getValue(r, "nombre") ?? ""}
                                      onChange={(e) => setField(r.id, "nombre", e.target.value)}
                                      style={{ ...styles.input, width: "100%" }}
                                    />
                                  </div>

                                  <div style={{ ...styles.fieldWrap, minWidth: 220, flex: "1 1 220px" }}>
                                    <div style={styles.label}>Slug</div>
                                    <input
                                      value={getValue(r, "slug") ?? ""}
                                      onChange={(e) => setField(r.id, "slug", e.target.value)}
                                      style={{ ...styles.input, width: "100%" }}
                                    />
                                  </div>

                                  <div style={{ ...styles.fieldWrap, minWidth: 170 }}>
                                    <div style={styles.label}>Plan</div>
                                    <select
                                      value={String(getValue(r, "plan") ?? "")}
                                      onChange={(e) => setField(r.id, "plan", e.target.value)}
                                      style={{ ...styles.select, width: 170 }}
                                    >
                                      {planOptions.length === 0 ? (
                                        <option value="">Sin planes</option>
                                      ) : (
                                        planOptions.map((plan) => (
                                          <option key={plan} value={plan}>
                                            {plan}
                                          </option>
                                        ))
                                      )}
                                    </select>
                                  </div>

                                  <div style={{ ...styles.fieldWrap, minWidth: 170 }}>
                                    <div style={styles.label}>Idioma</div>
                                    <select
                                      value={String(getValue(r, "locale") ?? "es")}
                                      onChange={(e) => setField(r.id, "locale", e.target.value)}
                                      style={{ ...styles.select, width: 170 }}
                                    >
                                      {LOCALE_OPTIONS.map((locale) => (
                                        <option key={locale} value={locale}>
                                          {locale}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div style={{ ...styles.fieldWrap, minWidth: 220, flex: "1 1 220px" }}>
                                    <div style={styles.label}>Comercial</div>
                                    <input
                                      value={getValue(r, "comercial") ?? ""}
                                      onChange={(e) => setField(r.id, "comercial", e.target.value)}
                                      style={{ ...styles.input, width: "100%" }}
                                      placeholder="Sin asignar"
                                    />
                                  </div>

                                  <div style={{ ...styles.fieldWrap, minWidth: 160 }}>
                                    <div style={styles.label}>Activo</div>
                                    <label style={styles.checkboxLabel}>
                                      <input
                                        type="checkbox"
                                        checked={!!getValue(r, "activo")}
                                        onChange={(e) => setField(r.id, "activo", e.target.checked)}
                                      />
                                      {getValue(r, "activo") ? "Sí" : "No"}
                                    </label>
                                  </div>
                                </div>
                              </div>

                              <div style={styles.sectionBox}>
                                <div style={styles.sectionBoxTitle}>Catálogo y contacto</div>

                                <div style={{ ...styles.row, alignItems: "flex-start" }}>
                                  <div style={{ ...styles.fieldWrap, minWidth: 160 }}>
                                    <div style={styles.label}>catalog_scope</div>
                                    <select
                                      value={String(getValue(r, "catalog_scope") ?? "ALL")}
                                      onChange={(e) => setField(r.id, "catalog_scope", e.target.value)}
                                      style={{ ...styles.select, width: 160 }}
                                    >
                                      {CATALOG_SCOPE_OPTIONS.map((scope) => (
                                        <option key={scope} value={scope}>
                                          {scope}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div style={{ ...styles.fieldWrap, minWidth: 220, flex: "1 1 220px" }}>
                                    <div style={styles.label}>catalog_slug</div>
                                    <input
                                      value={getValue(r, "catalog_slug") ?? ""}
                                      onChange={(e) => setField(r.id, "catalog_slug", e.target.value)}
                                      style={{ ...styles.input, width: "100%" }}
                                    />
                                  </div>

                                  <div style={{ ...styles.fieldWrap, minWidth: 220, flex: "1 1 220px" }}>
                                    <div style={styles.label}>whatsapp</div>
                                    <input
                                      value={getValue(r, "whatsapp") ?? ""}
                                      onChange={(e) => setField(r.id, "whatsapp", e.target.value)}
                                      style={{ ...styles.input, width: "100%" }}
                                    />
                                  </div>

                                  <div style={{ ...styles.fieldWrap, minWidth: 280, flex: "1 1 280px" }}>
                                    <div style={styles.label}>default_url</div>
                                    <input
                                      value={getValue(r, "default_url") ?? ""}
                                      onChange={(e) => setField(r.id, "default_url", e.target.value)}
                                      style={{ ...styles.input, width: "100%" }}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div style={styles.sectionBox}>
                                <div style={styles.sectionBoxTitle}>Branding</div>

                                <div style={{ ...styles.row, alignItems: "flex-start" }}>
                                  <div style={{ ...styles.fieldWrap }}>
                                    <div style={styles.label}>Color primario</div>
                                    <div style={{ ...styles.row, gap: 8 }}>
                                      <input
                                        type="color"
                                        value={currentPrimary}
                                        onChange={(e) => setField(r.id, "color_primario", e.target.value)}
                                        style={{
                                          width: 42,
                                          height: 34,
                                          padding: 0,
                                          border: "1px solid #ddd",
                                          borderRadius: 8,
                                        }}
                                      />
                                      <input
                                        value={String(getValue(r, "color_primario") ?? currentPrimary)}
                                        onChange={(e) => setField(r.id, "color_primario", e.target.value)}
                                        style={{ ...styles.input, width: 130 }}
                                        placeholder="#111111"
                                      />
                                    </div>
                                  </div>

                                  <div style={{ ...styles.fieldWrap }}>
                                    <div style={styles.label}>Color secundario</div>
                                    <div style={{ ...styles.row, gap: 8 }}>
                                      <input
                                        type="color"
                                        value={currentSecondary}
                                        onChange={(e) => setField(r.id, "olor_secundario", e.target.value)}
                                        style={{
                                          width: 42,
                                          height: 34,
                                          padding: 0,
                                          border: "1px solid #ddd",
                                          borderRadius: 8,
                                        }}
                                      />
                                      <input
                                        value={String(getValue(r, "olor_secundario") ?? currentSecondary)}
                                        onChange={(e) => setField(r.id, "olor_secundario", e.target.value)}
                                        style={{ ...styles.input, width: 130 }}
                                        placeholder="#0F0F0F"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div style={styles.sectionBox}>
                                <div style={styles.sectionBoxTitle}>Tienda conectada</div>

                                <div style={{ ...styles.row, alignItems: "flex-start" }}>
                                  <div style={{ ...styles.fieldWrap, minWidth: 170 }}>
                                    <div style={styles.label}>Plataforma</div>
                                    <select
                                      value={String(getValue(r, "store_platform") ?? "none")}
                                      onChange={(e) => setField(r.id, "store_platform", e.target.value)}
                                      style={{ ...styles.select, width: 170 }}
                                    >
                                      {STORE_PLATFORM_OPTIONS.map((option) => (
                                        <option key={option} value={option}>
                                          {platformLabel(option)}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div style={{ ...styles.fieldWrap, minWidth: 170 }}>
                                    <div style={styles.label}>Estado conexión</div>
                                    <select
                                      value={String(getValue(r, "store_status") ?? "not_connected")}
                                      onChange={(e) => setField(r.id, "store_status", e.target.value)}
                                      style={{ ...styles.select, width: 170 }}
                                    >
                                      {STORE_STATUS_OPTIONS.map((option) => (
                                        <option key={option} value={option}>
                                          {storeStatusLabel(option)}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div style={{ ...styles.fieldWrap, minWidth: 190 }}>
                                    <div style={styles.label}>Modo auth Shopify</div>
                                    <select
                                      value={String(getValue(r, "shopify_auth_mode") ?? "token")}
                                      onChange={(e) => setField(r.id, "shopify_auth_mode", e.target.value)}
                                      style={{ ...styles.select, width: 190 }}
                                    >
                                      {SHOPIFY_AUTH_MODE_OPTIONS.map((option) => (
                                        <option key={option} value={option}>
                                          {shopifyAuthModeLabel(option)}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div style={{ ...styles.fieldWrap, minWidth: 260, flex: "1 1 260px" }}>
                                    <div style={styles.label}>Dominio Shopify</div>
                                    <input
                                      value={String(getValue(r, "shopify_store_domain") ?? "")}
                                      onChange={(e) => setField(r.id, "shopify_store_domain", e.target.value)}
                                      style={{ ...styles.input, width: "100%" }}
                                      placeholder="mitienda.myshopify.com"
                                    />
                                  </div>

                                  {String(getValue(r, "shopify_auth_mode") ?? "token") === "token" ? (
                                    <div style={{ ...styles.fieldWrap, minWidth: 260, flex: "1 1 260px" }}>
                                      <div style={styles.label}>Access token Shopify</div>
                                      <input
                                        type="password"
                                        value={String(getValue(r, "shopify_access_token") ?? "")}
                                        onChange={(e) => setField(r.id, "shopify_access_token", e.target.value)}
                                        style={{ ...styles.input, width: "100%" }}
                                        placeholder="shpat_..."
                                      />
                                    </div>
                                  ) : (
                                    <>
                                      <div style={{ ...styles.fieldWrap, minWidth: 240, flex: "1 1 240px" }}>
                                        <div style={styles.label}>Shopify client id</div>
                                        <input
                                          value={String(getValue(r, "shopify_client_id") ?? "")}
                                          onChange={(e) => setField(r.id, "shopify_client_id", e.target.value)}
                                          style={{ ...styles.input, width: "100%" }}
                                          placeholder="client id"
                                        />
                                      </div>

                                      <div style={{ ...styles.fieldWrap, minWidth: 240, flex: "1 1 240px" }}>
                                        <div style={styles.label}>Shopify client secret</div>
                                        <input
                                          type="password"
                                          value={String(getValue(r, "shopify_client_secret") ?? "")}
                                          onChange={(e) => setField(r.id, "shopify_client_secret", e.target.value)}
                                          style={{ ...styles.input, width: "100%" }}
                                          placeholder="client secret"
                                        />
                                      </div>
                                    </>
                                  )}

                                  <div style={{ ...styles.fieldWrap, minWidth: 220 }}>
                                    <div style={styles.label}>Modo visual</div>
                                    <select
                                      value={String(getValue(r, "store_import_mode") ?? "facelens_only")}
                                      onChange={(e) => setField(r.id, "store_import_mode", e.target.value)}
                                      style={{ ...styles.select, width: 220 }}
                                    >
                                      {STORE_IMPORT_MODE_OPTIONS.map((option) => (
                                        <option key={option} value={option}>
                                          {importModeLabel(option)}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div style={{ ...styles.fieldWrap, minWidth: 260, flex: "1 1 260px" }}>
                                    <div style={styles.label}>Filtros importación</div>
                                    <input
                                      value={String(getValue(r, "store_import_filters") ?? "")}
                                      onChange={(e) => setField(r.id, "store_import_filters", e.target.value)}
                                      style={{ ...styles.input, width: "100%" }}
                                      placeholder="lentes, sunglasses, eyewear"
                                    />
                                  </div>

                                  <div style={{ ...styles.fieldWrap, minWidth: 180 }}>
                                    <div style={styles.label}>Importación habilitada</div>
                                    <label style={styles.checkboxLabel}>
                                      <input
                                        type="checkbox"
                                        checked={!!getValue(r, "store_import_enabled")}
                                        onChange={(e) => setField(r.id, "store_import_enabled", e.target.checked)}
                                      />
                                      {!!getValue(r, "store_import_enabled") ? "Sí" : "No"}
                                    </label>
                                  </div>

                                  <div style={{ ...styles.fieldWrap, minWidth: 220 }}>
                                    <div style={styles.label}>Última importación</div>
                                    <input
                                      value={String(getValue(r, "last_store_sync_at") ?? "")}
                                      onChange={(e) => setField(r.id, "last_store_sync_at", e.target.value)}
                                      style={{ ...styles.input, width: 220 }}
                                      placeholder="Solo lectura por ahora"
                                    />
                                  </div>

                                  <div style={{ ...styles.fieldWrap, minWidth: 280, flex: "1 1 280px" }}>
                                    <div style={styles.label}>Resultado última importación</div>
                                    <input
                                      value={String(getValue(r, "last_store_sync_result") ?? "")}
                                      onChange={(e) => setField(r.id, "last_store_sync_result", e.target.value)}
                                      style={{ ...styles.input, width: "100%" }}
                                      placeholder="OK / Error / 42 productos importados"
                                    />
                                  </div>
                                </div>

                                <div style={{ ...styles.row, marginTop: 12 }}>
                                  <button
                                    onClick={() => testShopifyConnection({
                                      ...r,
                                      ...(draft[r.id] || {}),
                                    })}
                                    disabled={
                                      testingStoreId === r.id ||
                                      currentStorePlatform !== "shopify"
                                    }
                                    style={{
                                      ...styles.buttonSecondary,
                                      opacity:
                                        testingStoreId === r.id || currentStorePlatform !== "shopify"
                                          ? 0.6
                                          : 1,
                                      cursor:
                                        testingStoreId === r.id
                                          ? "wait"
                                          : currentStorePlatform !== "shopify"
                                          ? "not-allowed"
                                          : "pointer",
                                    }}
                                  >
                                    {testingStoreId === r.id ? "Probando..." : "Probar conexión"}
                                  </button>

                                  <button
                                    onClick={() =>
                                      importShopifyProducts({
                                        ...r,
                                        ...(draft[r.id] || {}),
                                      })
                                    }
                                    disabled={
                                      importingStoreId === r.id ||
                                      currentStorePlatform !== "shopify"
                                    }
                                    style={{
                                      ...styles.buttonSecondary,
                                      opacity:
                                        importingStoreId === r.id || currentStorePlatform !== "shopify"
                                          ? 0.6
                                          : 1,
                                      cursor:
                                        importingStoreId === r.id
                                          ? "wait"
                                          : currentStorePlatform !== "shopify"
                                          ? "not-allowed"
                                          : "pointer",
                                    }}
                                  >
                                    {importingStoreId === r.id ? "Importando..." : "Importar productos"}
                                  </button>

                                  <button
                                    onClick={() => showPendingStoreAction(`Actualizar catálogo de ${cleanStr(getValue(r, "nombre") || getValue(r, "slug") || r.id)}`)}
                                    disabled
                                    style={{ ...styles.buttonSecondary, opacity: 0.6, cursor: "not-allowed" }}
                                  >
                                    Actualizar catálogo
                                  </button>

                                  <button
                                    onClick={() => showPendingStoreAction(`Desconectar tienda de ${cleanStr(getValue(r, "nombre") || getValue(r, "slug") || r.id)}`)}
                                    disabled
                                    style={{ ...styles.buttonSecondary, opacity: 0.6, cursor: "not-allowed" }}
                                  >
                                    Desconectar
                                  </button>
                                </div>
                              </div>

                              <div style={styles.sectionBox}>
                                <div style={styles.sectionBoxTitle}>Logo y links</div>

                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                  <div style={{ ...styles.row, alignItems: "center" }}>
                                    <input
                                      type="file"
                                      accept="image/png,image/jpeg,image/webp"
                                      onChange={(e) => {
                                        const f = e.target.files?.[0] || null;
                                        setLogoFileById((prev) => ({ ...prev, [r.id]: f }));
                                      }}
                                      style={{ maxWidth: 220 }}
                                    />
                                    <button
                                      onClick={() => uploadLogoForClient(r.id)}
                                      disabled={uploadingId === r.id || !logoFileById[r.id]}
                                      style={{
                                        ...styles.buttonSecondary,
                                        opacity: uploadingId === r.id ? 0.7 : 1,
                                        cursor: uploadingId === r.id ? "wait" : "pointer",
                                      }}
                                    >
                                      {uploadingId === r.id ? "Subiendo..." : "Subir logo"}
                                    </button>
                                  </div>

                                  <div style={{ ...styles.row, alignItems: "center" }}>
                                    {r.logo_url ? (
                                      <a href={r.logo_url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                                        Ver logo actual
                                      </a>
                                    ) : (
                                      <span style={{ fontSize: 12, color: "#6b7280" }}>Sin logo</span>
                                    )}

                                    {appUrl ? (
                                      <button
                                        onClick={() =>
                                          copyText(
                                            appUrl,
                                            `app-${r.id}`,
                                            `✅ Link app copiado para ${r.nombre || r.slug || r.id}`
                                          )
                                        }
                                        style={{ ...styles.buttonSecondary, padding: "7px 12px" }}
                                      >
                                        {copiedKey === `app-${r.id}` ? "App copiada" : "Copiar app"}
                                      </button>
                                    ) : null}

                                    {dashboardUrl ? (
                                      <button
                                        onClick={() =>
                                          copyText(
                                            dashboardUrl,
                                            `dash-${r.id}`,
                                            `✅ Link métricas copiado para ${r.nombre || r.slug || r.id}`
                                          )
                                        }
                                        style={{ ...styles.buttonSecondary, padding: "7px 12px" }}
                                      >
                                        {copiedKey === `dash-${r.id}` ? "Dashboard copiado" : "Copiar dashboard"}
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div style={{ ...styles.row, marginTop: 14, justifyContent: "flex-end" }}>
                              <button
                                onClick={() => saveRow(r.id)}
                                disabled={isBusy || !hasChangesRow}
                                style={{
                                  ...styles.buttonSuccess,
                                  opacity: isBusy || !hasChangesRow ? 0.7 : 1,
                                  cursor: isBusy ? "wait" : "pointer",
                                }}
                              >
                                {savingId === r.id ? "Guardando..." : "Guardar cambios"}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </>
                );
              })}

              {filteredRows.length === 0 && (
                <tr>
                  <td style={{ ...styles.td, textAlign: "center", color: "#6b7280", padding: 24 }} colSpan={7}>
                    No hay clientes que coincidan con los filtros aplicados.
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