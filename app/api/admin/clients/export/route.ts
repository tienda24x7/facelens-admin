import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const TABLE = "clientes facelens";

function cleanStr(v: any) {
  return String(v ?? "").trim();
}

function escapeCsv(value: any) {
  const s = String(value ?? "");
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: Request) {
  try {
    const db = supabaseAdmin();
    const url = new URL(req.url);

    const status = cleanStr(url.searchParams.get("status") || "all").toLowerCase();
    const plan = cleanStr(url.searchParams.get("plan") || "all");
    const comercial = cleanStr(url.searchParams.get("comercial") || "all");
    const search = cleanStr(url.searchParams.get("search") || "").toLowerCase();

    const { data, error } = await db
      .from(TABLE)
      .select("nombre, slug, plan, comercial, activo")
      .order("nombre", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const filtered = (data || []).filter((row: any) => {
      const rowNombre = cleanStr(row.nombre);
      const rowSlug = cleanStr(row.slug);
      const rowPlan = cleanStr(row.plan);
      const rowComercial = cleanStr(row.comercial);
      const rowActivo = !!row.activo;

      const matchesStatus =
        status === "all" ||
        (status === "active" && rowActivo) ||
        (status === "inactive" && !rowActivo);

      const matchesPlan =
        plan === "all" || rowPlan === plan;

      const matchesComercial =
        comercial === "all" || rowComercial === comercial;

      const matchesSearch =
        !search ||
        rowNombre.toLowerCase().includes(search) ||
        rowSlug.toLowerCase().includes(search);

      return matchesStatus && matchesPlan && matchesComercial && matchesSearch;
    });

    const header = ["cliente", "slug", "comercial", "plan", "estado"];
    const lines = [
      header.join(","),
      ...filtered.map((row: any) =>
        [
          escapeCsv(row.nombre || ""),
          escapeCsv(row.slug || ""),
          escapeCsv(row.comercial || ""),
          escapeCsv(row.plan || ""),
          escapeCsv(row.activo ? "activo" : "inactivo"),
        ].join(",")
      ),
    ];

    const csv = lines.join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="clientes_comerciales.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Error exportando CSV" },
      { status: 500 }
    );
  }
}