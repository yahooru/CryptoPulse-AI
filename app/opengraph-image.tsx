import { ImageResponse } from "next/og"

import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site"

export const runtime = "edge"
export const alt = `${SITE_NAME} social preview`
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = "image/png"

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
          padding: 72,
          color: "#fff7ed",
          background:
            "radial-gradient(circle at 30% 30%, #7c2d12 0, #111827 34%, #050505 78%)",
          fontFamily: "Arial",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 88,
              height: 88,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 18,
              background: "linear-gradient(135deg, #f97316, #fed7aa)",
              color: "#111827",
              fontSize: 52,
              fontWeight: 900,
            }}
          >
            C
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ color: "#fed7aa", fontSize: 24, fontWeight: 700 }}>
              Portfolio Risk Lab
            </div>
            <div style={{ color: "#ffffff", fontSize: 38, fontWeight: 800 }}>{SITE_NAME}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ maxWidth: 940, fontSize: 72, lineHeight: 0.96, fontWeight: 900 }}>
            AI Portfolio Doctor for Crypto Allocations
          </div>
          <div style={{ maxWidth: 900, color: "#d1d5db", fontSize: 30, lineHeight: 1.35 }}>
            {SITE_DESCRIPTION}
          </div>
        </div>

        <div style={{ display: "flex", gap: 18, color: "#fed7aa", fontSize: 24, fontWeight: 700 }}>
          <span>CMC data</span>
          <span>/</span>
          <span>BNB Chain wallet reads</span>
          <span>/</span>
          <span>Replay-ready JSON</span>
        </div>
      </div>
    ),
    size,
  )
}
