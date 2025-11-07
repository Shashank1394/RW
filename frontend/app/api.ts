// frontend/app/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export async function getSchema() {
  const res = await fetch(`${API_BASE}/schema`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch schema");
  return res.json();
}

export async function getMetrics() {
  const res = await fetch(`${API_BASE}/metrics`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch metrics");
  return res.json();
}

export async function predict(payload: Record<string, any>) {
  const res = await fetch(`${API_BASE}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });
  if (!res.ok) throw new Error("Prediction failed");
  return res.json();
}
