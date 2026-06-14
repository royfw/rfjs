import { ImageResponse } from "next/og";

// Brand-colored wordmark icon, generated at build (no static asset, no design tool).
// Dark bedrock background + light signal ink — matches the apps' dark default.
export function renderWordmarkIcon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#11151c",
          color: "#e2e8f1",
          fontFamily: "monospace",
          fontWeight: 700,
          fontSize: Math.round(size * 0.34),
          letterSpacing: "-0.02em",
        }}
      >
        rfjs
      </div>
    ),
    { width: size, height: size },
  );
}
