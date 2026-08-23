import { ImageResponse } from "next/og";

/**
 * The link-preview card (WhatsApp, Instagram, Twitter, etc.).
 *
 * Rendered on demand rather than shipped as a static image so it stays in the
 * brand's own colours and tracks the wordmark without a design tool round-trip.
 * Deliberately no custom font file: ImageResponse's built-in sans is enough for
 * a title card, and a missing font URL is a classic way to break this route.
 */
export const alt = "Malesan — AI Creative Companion";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "96px",
          backgroundColor: "#0b0a09",
          backgroundImage:
            "radial-gradient(900px 520px at 12% -5%, rgba(255,138,61,0.30), transparent 60%), radial-gradient(760px 520px at 105% 108%, rgba(223,94,30,0.24), transparent 55%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 104,
            fontWeight: 800,
            letterSpacing: "-0.03em",
          }}
        >
          <span style={{ color: "#f5f0ea" }}>malesa</span>
          <span style={{ color: "#ff8a3d" }}>n</span>
        </div>
        <div
          style={{
            marginTop: 30,
            fontSize: 58,
            fontWeight: 700,
            color: "#f5f0ea",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          AI Creative Companion
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 32,
            color: "#99928a",
            maxWidth: 920,
            lineHeight: 1.35,
          }}
        >
          Bikin konten tanpa ribet. Ide, script, dan workflow kreator dalam satu AI companion.
        </div>
      </div>
    ),
    { ...size },
  );
}
