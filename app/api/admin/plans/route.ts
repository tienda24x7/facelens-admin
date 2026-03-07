import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const TABLE = "facelens_plans";

export async function GET() {
  try {
    const db = supabaseAdmin();

    const { data, error } = await db
      .from(TABLE)
      .select("*")
      .order("plan_code", { ascending: true });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: true, data: data || [] },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Error cargando planes" },
      { status: 500 }
    );
  }
}