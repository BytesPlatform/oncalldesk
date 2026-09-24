import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AI receptionist for HVAC demo: the call, the dispatch board and the revenue it recovers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The social preview card, drawn on the demo's own palette. */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "linear-gradient(135deg, #0a0e17 0%, #111725 60%, #171f31 100%)",
          color: "#eef2f8",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: "linear-gradient(135deg, #ff8f66, #ff6a3d 55%, #ff4d6d)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              fontWeight: 800,
              color: "#fff",
            }}
          >
            N
          </div>
          <div style={{ fontSize: 28, color: "#aab5c9" }}>Northline Heating and Cooling · AI service line</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>AI Receptionist for HVAC</div>
          <div style={{ fontSize: 34, color: "#ff8f66" }}>24/7 emergency dispatch. Triage, book, text the tech.</div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 24, color: "#aab5c9" }}>
          <span style={{ padding: "10px 22px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.18)" }}>Live call</span>
          <span style={{ padding: "10px 22px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.18)" }}>Dispatch board</span>
          <span style={{ padding: "10px 22px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.18)" }}>Recovered revenue</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
