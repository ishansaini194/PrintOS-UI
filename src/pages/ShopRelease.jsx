import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { releaseJob } from "../api";

/**
 * PrintOS — Shop release page (desktop, at the counter).
 * URL: printos.app/shop/:shopId/release
 *
 * The Release button is wired to local state only. Replace the body of
 * `handleRelease` with your POST /release { shop_id, code } call and map the
 * response to setResult('ok' | 'notfound' | 'offline'). All three result
 * banners are already built below.
 */

const GLOBAL_CSS = `
@keyframes po_spin{to{transform:rotate(360deg)}}
@keyframes po_fadeup{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
`;

const ACCENT = "#c25c34";
const FONT = "'Hanken Grotesk', system-ui, sans-serif";
const MONO = "'Space Mono', monospace";

const bannerBase = {
  width: 520,
  maxWidth: "100%",
  marginTop: 30,
  borderRadius: 14,
  padding: "22px 24px",
  textAlign: "center",
  animation: "po_fadeup .3s ease",
};

export default function ShopRelease({ shopId: shopIdProp, shopName = "Sharma Xerox" }) {
  const params = useParams();
  const shopId = shopIdProp ?? params.shopId ?? "A12";

  const [input, setInput] = useState(""); // up to 6 digits
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // null | 'ok' | 'notfound' | 'offline'
  const [resultCode, setResultCode] = useState("");

  const spaced = (c) => (c ? c.slice(0, 3) + " " + c.slice(3) : "");

  const onChange = (e) => {
    setInput((e.target.value || "").replace(/\D/g, "").slice(0, 6));
    setResult(null);
  };

  const handleRelease = async () => {
    const code = input.replace(/\D/g, "");
    if (code.length < 6 || loading) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await releaseJob({ shopId, code }); // returns raw response
      if (res.ok) {
        setResult("ok");
        setResultCode(code);
        setInput("");
      } else if (res.status === 404) {
        setResult("notfound");
      } else if (res.status === 503) {
        setResult("offline");
      } else {
        setResult("notfound"); // any other error → safe generic
      }
    } catch {
      setResult("offline"); // network failure → treat as offline/retry
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") handleRelease();
  };

  const resetShop = () => {
    setInput("");
    setResult(null);
  };

  const disabled = loading || input.length < 6;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f6f3ec",
        fontFamily: FONT,
        color: "#2a2724",
        WebkitFontSmoothing: "antialiased",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "48px 24px",
      }}
    >
      <style>{GLOBAL_CSS}</style>

      <div style={{ width: "100%", maxWidth: 940, display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 40px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 22, letterSpacing: "-.01em" }}>
          <span style={{ width: 22, height: 22, background: ACCENT, borderRadius: 6, display: "inline-block" }} />
          PrintOS
          <span style={{ fontWeight: 500, fontSize: 16, color: "#8a8378" }}>· {shopName}</span>
        </div>

        <div style={{ fontWeight: 700, fontSize: 17, margin: "34px 0 4px" }}>Enter the customer's collection code</div>
        <div style={{ fontSize: 14, color: "#8a8378", marginBottom: 26 }}>Ask them to read out the 6-digit code, or scan their screen.</div>

        <input
          value={input}
          onChange={onChange}
          onKeyDown={onKeyDown}
          inputMode="numeric"
          placeholder="000000"
          maxLength={6}
          style={{
            width: 420,
            maxWidth: "100%",
            textAlign: "center",
            font: `700 58px ${MONO}`,
            letterSpacing: ".22em",
            padding: "20px 14px",
            border: "2px solid #2a2724",
            borderRadius: 16,
            background: "#fff",
            color: "#2a2724",
            outline: "none",
            caretColor: ACCENT,
            fontFamily: MONO,
          }}
        />

        <button
          onClick={handleRelease}
          disabled={disabled}
          style={{
            marginTop: 24,
            width: 420,
            maxWidth: "100%",
            padding: 20,
            border: "none",
            borderRadius: 14,
            fontWeight: 800,
            fontSize: 19,
            fontFamily: "inherit",
            color: "#fff",
            background: disabled ? "#d3a48f" : ACCENT,
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          {loading ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 20, height: 20, border: "3px solid rgba(255,255,255,.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "po_spin .7s linear infinite" }} />
              Releasing…
            </span>
          ) : (
            <span>Release &amp; Print</span>
          )}
        </button>

        {/* ---------- RESULT: success ---------- */}
        {result === "ok" && (
          <div style={{ ...bannerBase, border: "2px solid #3f7d54", background: "#ecf4ee" }}>
            <div style={{ fontSize: 26, marginBottom: 6 }}>🖨️</div>
            <div style={{ fontWeight: 800, fontSize: 19, color: "#2c5c3d" }}>Printing job {spaced(resultCode)}</div>
            <div style={{ fontSize: 15, color: "#3d5b47", marginTop: 4 }}>Please collect it from the printer.</div>
            <button onClick={resetShop} style={{ marginTop: 16, background: "none", border: "none", color: "#2c5c3d", fontWeight: 700, fontSize: 14, cursor: "pointer", textDecoration: "underline" }}>Enter another code</button>
          </div>
        )}

        {/* ---------- RESULT: not found ---------- */}
        {result === "notfound" && (
          <div style={{ ...bannerBase, border: "2px solid #b24f28", background: "#f8ece7" }}>
            <div style={{ fontSize: 26, marginBottom: 6 }}>🔍</div>
            <div style={{ fontWeight: 800, fontSize: 19, color: "#9a3f1c" }}>No job found for that code</div>
            <div style={{ fontSize: 15, color: "#8a5238", marginTop: 4 }}>Check the code with the customer and try again.</div>
            <button onClick={resetShop} style={{ marginTop: 16, background: "none", border: "none", color: "#9a3f1c", fontWeight: 700, fontSize: 14, cursor: "pointer", textDecoration: "underline" }}>Clear &amp; retry</button>
          </div>
        )}

        {/* ---------- RESULT: offline ---------- */}
        {result === "offline" && (
          <div style={{ ...bannerBase, border: "2px solid #a8842f", background: "#f7f0dd" }}>
            <div style={{ fontSize: 26, marginBottom: 6 }}>📡</div>
            <div style={{ fontWeight: 800, fontSize: 19, color: "#7d631f" }}>Shop is offline right now</div>
            <div style={{ fontSize: 15, color: "#7d631f", marginTop: 4 }}>The job is safe — please try again in a moment.</div>
            <button onClick={handleRelease} style={{ marginTop: 16, background: "none", border: "none", color: "#7d631f", fontWeight: 700, fontSize: 14, cursor: "pointer", textDecoration: "underline" }}>Try again</button>
          </div>
        )}
      </div>
    </div>
  );
}
