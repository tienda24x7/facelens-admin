"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(null);
  const router = useRouter();

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);

    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });

    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j?.error || "Login failed");

    router.push("/admin/clients");
  }

  return (
    <div style={{ maxWidth: 420, margin: "80px auto", padding: 20, border: "1px solid #eee", borderRadius: 12 }}>
      <h1 style={{ marginBottom: 10 }}>FaceLens Admin</h1>
      <p style={{ marginTop: 0, color: "#666" }}>Acceso interno</p>

      <form onSubmit={onSubmit}>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ddd" }}
        />
        {err && <div style={{ marginTop: 10, color: "crimson" }}>{err}</div>}
        <button style={{ marginTop: 12, width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ddd" }}>
          Entrar
        </button>
      </form>
    </div>
  );
}