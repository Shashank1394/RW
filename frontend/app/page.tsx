"use client";

import { useEffect, useState } from "react";
import { getSchema, predict, getMetrics } from "./api";

type FieldMeta =
  | { type: "number"; min?: number; max?: number; placeholder?: string }
  | { type: "select"; options: (string | number)[] }
  | { type: "text"; placeholder?: string };

interface PredictionResult {
  probability: number;
  risk_label: string;
  inputs_used: Record<string, any>;
}

export default function Page() {
  const [schema, setSchema] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const s = await getSchema();
        setSchema(s);
        const m = await getMetrics();
        setMetrics(m);
      } catch (e: any) {
        setError(e.message || "Failed to load schema/metrics");
      }
    })();
  }, []);

  const onChange = (name: string, value: any) => {
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const payload: Record<string, any> = {};
      for (const key of schema?.feature_order || []) {
        payload[key] = form[key] ?? null;
      }
      const res = await predict(payload);
      setResult(res);
    } catch (e: any) {
      setError(e.message || "Prediction failed");
    } finally {
      setLoading(false);
    }
  };

  const renderField = (name: string, meta: FieldMeta) => {
    const label = name.replaceAll("_", " ");
    const value = form[name] ?? "";

    if (meta?.type === "select") {
      return (
        <div key={name} style={{ display: "grid", gap: 6 }}>
          <label style={{ fontWeight: 500 }}>{label}</label>
          <select
            value={value}
            onChange={(e) =>
              onChange(
                name,
                e.target.value === ""
                  ? null
                  : isFinite(Number(e.target.value))
                  ? Number(e.target.value)
                  : e.target.value
              )
            }
            style={{
              padding: 10,
              borderRadius: 8,
              border: "1px solid #ccc",
              background: "#fafafa",
            }}
          >
            <option value="">Select…</option>
            {(meta.options || []).map((opt) => (
              <option key={String(opt)} value={String(opt)}>
                {String(opt)}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (meta?.type === "number") {
      return (
        <div key={name} style={{ display: "grid", gap: 6 }}>
          <label style={{ fontWeight: 500 }}>{label}</label>
          <input
            type="number"
            value={value}
            onChange={(e) =>
              onChange(
                name,
                e.target.value === "" ? null : Number(e.target.value)
              )
            }
            min={(meta as any).min}
            max={(meta as any).max}
            placeholder={(meta as any).placeholder || ""}
            style={{
              padding: 10,
              borderRadius: 8,
              border: "1px solid #ccc",
              background: "#fafafa",
            }}
          />
        </div>
      );
    }

    return (
      <div key={name} style={{ display: "grid", gap: 6 }}>
        <label style={{ fontWeight: 500 }}>{label}</label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(name, e.target.value || null)}
          placeholder={(meta as any).placeholder || ""}
          style={{
            padding: 10,
            borderRadius: 8,
            border: "1px solid #ccc",
            background: "#fafafa",
          }}
        />
      </div>
    );
  };

  // Get risk color for label & progress bar
  const getRiskColor = (risk: string) => {
    if (risk === "High Risk") return "#dc2626"; // red
    if (risk === "Moderate Risk") return "#f59e0b"; // yellow
    return "#16a34a"; // green
  };

  return (
    <main
      style={{
        maxWidth: 960,
        margin: "40px auto",
        padding: "0 16px",
        fontFamily: "Inter, system-ui, Arial",
      }}
    >
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>
        PCOD Probability Estimator
      </h1>
      <p style={{ color: "#555", marginBottom: 16 }}>
        Fill the form to estimate probability (not a diagnosis).
      </p>

      {metrics && (
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          {Object.entries(metrics).map(([k, v]) => (
            <div
              key={k}
              style={{
                border: "1px solid #eee",
                borderRadius: 10,
                padding: "10px 14px",
                textAlign: "center",
                minWidth: 90,
              }}
            >
              <div style={{ fontSize: 12, color: "#666" }}>{k}</div>
              <div style={{ fontWeight: 600 }}>
                {typeof v === "number" ? v.toFixed(3) : String(v)}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div
          style={{
            background: "#fee",
            border: "1px solid #f99",
            padding: 10,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {!schema ? (
        <div>Loading form…</div>
      ) : (
        <form onSubmit={onSubmit}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 16,
            }}
          >
            {(schema.feature_order || []).map((name: string) =>
              renderField(name, schema.field_meta?.[name] || { type: "text" })
            )}
          </div>

          <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              {loading ? "Predicting…" : "Get Probability"}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm({});
                setResult(null);
              }}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid #ccc",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Reset
            </button>
          </div>
        </form>
      )}

      {result && (
        <div
          style={{
            marginTop: 32,
            padding: 20,
            border: "1px solid #eee",
            borderRadius: 12,
            background: "#fafafa",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 12 }}>Result</h2>
          <p style={{ margin: "6px 0", color: "#333" }}>
            Estimated probability:{" "}
            <strong>{(result.probability * 100).toFixed(1)}%</strong>
          </p>

          <p
            style={{
              margin: "6px 0",
              fontWeight: 600,
              color: getRiskColor(result.risk_label),
            }}
          >
            Risk Level: {result.risk_label}
          </p>

          {/* Progress Bar */}
          <div
            style={{
              width: "100%",
              background: "#e5e7eb",
              borderRadius: 6,
              height: 8,
              marginTop: 8,
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${(result.probability * 100).toFixed(1)}%`,
                background: getRiskColor(result.risk_label),
                borderRadius: 6,
                transition: "width 0.4s ease",
              }}
            />
          </div>

          <p style={{ fontSize: 12, color: "#666", marginTop: 12 }}>
            Disclaimer: This is an educational tool, not medical advice.
          </p>
        </div>
      )}
    </main>
  );
}
