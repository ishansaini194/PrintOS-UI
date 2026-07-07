import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { uploadJob, orderPayment, verifyPayment } from "../api";

/**
 * PrintOS — Customer app (mobile-first).
 * Reached by scanning the shop's QR code: printos.app/s/:shopId
 *
 * API touch-points:
 *   1. POST /upload      -> returns { job_id, amount_paise, claim_code }
 *   2. POST /pay/order   -> { razorpay_order_id, amount_paise, key_id },
 *      then Razorpay checkout opens; on success POST /pay/verify with the
 *      returned payment id + signature — the cloud verifies before marking paid.
 * Amounts from the API are in paise; divide by 100 for rupees.
 */

// loadRazorpayScript injects Razorpay's checkout script once and resolves when
// window.Razorpay is available.
let razorpayScriptPromise = null;
function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve();
  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = resolve;
      s.onerror = () => {
        razorpayScriptPromise = null; // allow a retry after a network blip
        reject(new Error("could not load Razorpay checkout"));
      };
      document.body.appendChild(s);
    });
  }
  return razorpayScriptPromise;
}

// keyframes / font note — move these into your global CSS if you prefer.
const GLOBAL_CSS = `
@keyframes po_spin{to{transform:rotate(360deg)}}
@keyframes po_pop{0%{transform:scale(.7);opacity:0}60%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
@keyframes po_fadeup{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
`;

const ACCENT = "#c25c34";
const IDLE = "#ddd7cb";
const FONT = "'Hanken Grotesk', system-ui, sans-serif";
const MONO = "'Space Mono', monospace";

// segmented-control button style (colour toggle)
const segStyle = (active) => ({
  flex: 1,
  padding: "14px 6px",
  border: "none",
  cursor: "pointer",
  textAlign: "center",
  fontWeight: 700,
  fontFamily: "inherit",
  transition: "background .12s",
  background: active ? "#2a2724" : "#fff",
  color: active ? "#fbf9f4" : "#2a2724",
});

const smallSegStyle = (active, rightBorder) => ({
  flex: 1,
  padding: "12px 6px",
  border: "none",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
  fontFamily: "inherit",
  background: active ? "#2a2724" : "#fff",
  color: active ? "#fbf9f4" : "#2a2724",
  borderRight: rightBorder ? "2px solid #2a2724" : undefined,
});

export default function CustomerApp({
  shopId: shopIdProp,
  shopName = "Sharma Xerox & Stationery",
  monoPaise = 3000,
  colorPaise = 6000,
  showDuplex = true,
}) {
  const params = useParams();
  const shopId = shopIdProp ?? params.shopId ?? "A12";

  const [step, setStep] = useState("upload"); // upload | options | price | success
  const [file, setFile] = useState(null);
  const [type, setType] = useState("mono"); // mono | color
  const [copies, setCopies] = useState(1);
  const [duplex, setDuplex] = useState(false);
  const [paper, setPaper] = useState("A4"); // A4 | Letter
  const [amount, setAmount] = useState(0); // paise
  const [code, setCode] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [payError, setPayError] = useState(null);

  const order = { upload: 0, options: 1, price: 2, success: 3 }[step] ?? 0;
  const amountRupees = Math.round(amount / 100);
  const typeLabel = type === "mono" ? "Black & White" : "Colour";
  const codeSpaced = code ? code.slice(0, 3) + " " + code.slice(3) : "";

  const pickFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) setFile(f);
    // TODO(api): POST /upload here (multipart: file, shop_id, {type, copies})
    // and store { job_id, amount_paise, claim_code } instead of computing locally.
  };

  const goPrice = async () => {
    if (loading) return;
    setLoading(true);
    // /upload does the real work: computes amount + claim_code, creates the job.
    try {
      const { job_id, amount_paise, claim_code } = await uploadJob({ file, shopId, type, copies });
      setJobId(job_id);
      setAmount(amount_paise); // server amount, not local math
      setCode(claim_code); // real claim code
      setStep("price");
    } catch {
      alert("Upload failed. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const pay = async () => {
    if (loading) return;
    setLoading(true);
    setPayError(null);
    try {
      // 1. Cloud creates the Razorpay order for this job.
      const { razorpay_order_id, amount_paise, key_id } = await orderPayment(jobId);
      // 2. Open Razorpay checkout (UPI/card) in its own popup.
      await loadRazorpayScript();
      const rzp = new window.Razorpay({
        key: key_id || import.meta.env.VITE_RAZORPAY_KEY_ID,
        order_id: razorpay_order_id,
        amount: amount_paise,
        name: shopName,
        description: `Print job — ${copies}× ${typeLabel}`,
        handler: async (resp) => {
          // 3. The cloud verifies the signature; only then is the job paid.
          try {
            await verifyPayment({
              jobId,
              razorpayPaymentId: resp.razorpay_payment_id,
              razorpayOrderId: resp.razorpay_order_id,
              razorpaySignature: resp.razorpay_signature,
            });
            setStep("success"); // success screen already shows `code`
          } catch {
            setPayError("We could not confirm your payment. Please try again.");
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setPayError("Payment not completed. Tap Pay to try again.");
            setLoading(false);
          },
        },
      });
      rzp.open();
      // Keep `loading` on while checkout is open — the handler or dismiss
      // callback above releases it.
    } catch {
      setPayError("Could not start the payment. Check your connection and try again.");
      setLoading(false);
    }
  };

  const reset = () => {
    setStep("upload");
    setFile(null);
    setType("mono");
    setCopies(1);
    setDuplex(false);
    setAmount(0);
    setCode(null);
    setJobId(null);
    setPayError(null);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        margin: "0 auto",
        maxWidth: 480,
        background: "#f6f3ec",
        display: "flex",
        flexDirection: "column",
        fontFamily: FONT,
        color: "#2a2724",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <style>{GLOBAL_CSS}</style>

      {/* header */}
      <div style={{ padding: "22px 22px 14px", borderBottom: "1px solid #e4dfd4", background: "#fbf9f4" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 17, letterSpacing: "-.01em" }}>
            <span style={{ width: 18, height: 18, background: ACCENT, borderRadius: 5, display: "inline-block" }} />
            PrintOS
          </div>
          <div style={{ font: `600 11px ${MONO}`, color: "#8a8378", background: "#efeae0", padding: "5px 9px", borderRadius: 7 }}>
            shop #{shopId}
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: "#8a8378", marginTop: 5 }}>{shopName}</div>
        {/* progress */}
        <div style={{ display: "flex", gap: 6, marginTop: 16 }}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: order >= i ? ACCENT : IDLE }} />
          ))}
        </div>
      </div>

      <div style={{ flex: 1, padding: "24px 22px", display: "flex", flexDirection: "column" }}>
        {/* ---------- UPLOAD ---------- */}
        {step === "upload" && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, animation: "po_fadeup .25s ease" }}>
            <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: "-.02em", marginBottom: 4 }}>Print a document</div>
            <div style={{ fontSize: 14, color: "#7c766b", lineHeight: 1.5, marginBottom: 22 }}>
              Upload your file, choose the options, pay — then collect it here at the counter.
            </div>

            {file ? (
              <div style={{ border: "2px solid #2a2724", borderRadius: 14, background: "#fff", padding: 16, display: "flex", alignItems: "center", gap: 13 }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: "#efeae0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flex: "none" }}>📄</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</div>
                  <div style={{ fontSize: 12, color: "#8a8378" }}>Ready to print</div>
                </div>
                <label style={{ flex: "none", fontSize: 12.5, fontWeight: 600, color: "#b24f28", cursor: "pointer" }}>
                  Change
                  <input type="file" onChange={pickFile} style={{ display: "none" }} accept=".pdf,.doc,.docx,image/*" />
                </label>
              </div>
            ) : (
              <label style={{ border: "2px dashed #b3ab9d", borderRadius: 16, background: "#fbf9f4", padding: "38px 18px", textAlign: "center", cursor: "pointer", display: "block" }}>
                <div style={{ fontSize: 34, marginBottom: 10 }}>⬆️</div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>Tap to choose a file</div>
                <div style={{ fontSize: 12.5, color: "#8a8378" }}>PDF, Word, or a photo</div>
                <input type="file" onChange={pickFile} style={{ display: "none" }} accept=".pdf,.doc,.docx,image/*" />
              </label>
            )}

            <div style={{ flex: 1 }} />
            <button
              onClick={() => file && setStep("options")}
              disabled={!file}
              style={{
                width: "100%",
                padding: 16,
                border: "none",
                borderRadius: 13,
                fontWeight: 800,
                fontSize: 16,
                fontFamily: "inherit",
                transition: "all .15s",
                background: file ? ACCENT : "#e0dbd0",
                color: file ? "#fff" : "#aca596",
                cursor: file ? "pointer" : "not-allowed",
              }}
            >
              Continue
            </button>
          </div>
        )}

        {/* ---------- OPTIONS ---------- */}
        {step === "options" && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, animation: "po_fadeup .25s ease" }}>
            <button onClick={() => setStep("upload")} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#8a8378", font: `600 13px ${FONT}`, cursor: "pointer", padding: 0, marginBottom: 14 }}>← Back</button>

            <div style={{ display: "flex", alignItems: "center", gap: 11, border: "1px solid #e4dfd4", borderRadius: 12, background: "#fff", padding: "11px 13px", marginBottom: 24 }}>
              <span style={{ fontSize: 18 }}>📄</span>
              <span style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file?.name}</span>
            </div>

            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 9 }}>Colour</div>
            <div style={{ display: "flex", border: "2px solid #2a2724", borderRadius: 12, overflow: "hidden", marginBottom: 22 }}>
              <button onClick={() => setType("mono")} style={segStyle(type === "mono")}>
                <span style={{ display: "block", fontSize: 15 }}>Black &amp; White</span>
                <span style={{ display: "block", font: `400 11px ${MONO}`, opacity: 0.7, marginTop: 2 }}>₹{Math.round(monoPaise / 100)} / copy</span>
              </button>
              <button onClick={() => setType("color")} style={segStyle(type === "color")}>
                <span style={{ display: "block", fontSize: 15 }}>Colour</span>
                <span style={{ display: "block", font: `400 11px ${MONO}`, opacity: 0.7, marginTop: 2 }}>₹{Math.round(colorPaise / 100)} / copy</span>
              </button>
            </div>

            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 9 }}>Copies</div>
            <div style={{ display: "flex", alignItems: "center", border: "2px solid #2a2724", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
              <button onClick={() => setCopies((c) => Math.max(1, c - 1))} style={{ width: 56, height: 54, border: "none", borderRight: "2px solid #2a2724", background: "#f6f3ec", fontSize: 26, fontWeight: 700, cursor: "pointer", color: "#2a2724" }}>−</button>
              <div style={{ flex: 1, textAlign: "center", font: `700 24px ${MONO}` }}>{copies}</div>
              <button onClick={() => setCopies((c) => c + 1)} style={{ width: 56, height: 54, border: "none", borderLeft: "2px solid #2a2724", background: "#f6f3ec", fontSize: 24, fontWeight: 700, cursor: "pointer", color: "#2a2724" }}>+</button>
            </div>

            {showDuplex && (
              <div style={{ marginTop: 22 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "2px solid #2a2724", borderRadius: 12, background: "#fff", padding: "14px 16px", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Print both sides</div>
                    <div style={{ fontSize: 12, color: "#8a8378" }}>Duplex</div>
                  </div>
                  <button onClick={() => setDuplex((d) => !d)} style={{ width: 46, height: 26, borderRadius: 999, border: "none", cursor: "pointer", position: "relative", transition: "background .15s", flex: "none", background: duplex ? ACCENT : "#d3cdbf" }}>
                    <span style={{ position: "absolute", top: 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .15s", left: duplex ? 23 : 3 }} />
                  </button>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 9 }}>Paper size</div>
                <div style={{ display: "flex", border: "2px solid #2a2724", borderRadius: 12, overflow: "hidden" }}>
                  <button onClick={() => setPaper("A4")} style={smallSegStyle(paper === "A4", true)}>A4</button>
                  <button onClick={() => setPaper("Letter")} style={smallSegStyle(paper === "Letter", false)}>Letter</button>
                </div>
              </div>
            )}

            <div style={{ flex: 1, minHeight: 22 }} />
            <button onClick={goPrice} style={{ width: "100%", padding: 16, border: "none", borderRadius: 13, background: ACCENT, color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>See price →</button>
          </div>
        )}

        {/* ---------- PRICE / PAY ---------- */}
        {step === "price" && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, animation: "po_fadeup .25s ease" }}>
            <button onClick={() => setStep("options")} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#8a8378", font: `600 13px ${FONT}`, cursor: "pointer", padding: 0, marginBottom: 14 }}>← Back</button>
            <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: "-.02em", marginBottom: 20 }}>Review &amp; pay</div>

            <div style={{ border: "1px solid #e4dfd4", borderRadius: 14, background: "#fff", overflow: "hidden", marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "13px 16px", borderBottom: "1px solid #efeae0", fontSize: 14 }}>
                <span style={{ color: "#8a8378" }}>File</span>
                <span style={{ fontWeight: 600, maxWidth: 190, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file?.name}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "13px 16px", borderBottom: "1px solid #efeae0", fontSize: 14 }}>
                <span style={{ color: "#8a8378" }}>Colour</span>
                <span style={{ fontWeight: 600 }}>{typeLabel}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "13px 16px", fontSize: 14 }}>
                <span style={{ color: "#8a8378" }}>Copies</span>
                <span style={{ fontWeight: 600 }}>{copies}</span>
              </div>
            </div>

            <div style={{ textAlign: "center", padding: "14px 0 4px" }}>
              <div style={{ fontSize: 13, color: "#8a8378", letterSpacing: ".04em", textTransform: "uppercase", fontWeight: 600 }}>Amount to pay</div>
              <div style={{ font: `700 52px ${MONO}`, lineHeight: 1, marginTop: 8 }}>₹{amountRupees}</div>
            </div>

            <div style={{ flex: 1, minHeight: 22 }} />
            <button
              onClick={pay}
              disabled={loading}
              style={{
                width: "100%",
                padding: 17,
                border: "none",
                borderRadius: 13,
                fontWeight: 800,
                fontSize: 17,
                fontFamily: "inherit",
                color: "#fff",
                background: loading ? "#b0724f" : ACCENT,
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 17, height: 17, border: "2.5px solid rgba(255,255,255,.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "po_spin .7s linear infinite" }} />
                  Processing…
                </span>
              ) : (
                <span>Pay ₹{amountRupees}</span>
              )}
            </button>
            {payError && (
              <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "#b3402e", marginTop: 12 }}>{payError}</div>
            )}
            <div style={{ textAlign: "center", fontSize: 12, color: "#8a8378", marginTop: 12 }}>💳 Pay once — collect your print at the counter</div>
          </div>
        )}

        {/* ---------- SUCCESS ---------- */}
        {step === "success" && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, textAlign: "center", animation: "po_fadeup .3s ease" }}>
            <div style={{ width: 62, height: 62, borderRadius: "50%", background: "#3f7d54", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "8px auto 16px", animation: "po_pop .45s ease" }}>✓</div>
            <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: "-.02em" }}>Payment received</div>
            <div style={{ fontSize: 14, color: "#7c766b", marginTop: 6 }}>Your print is waiting at the shop.</div>

            <div style={{ margin: "26px 0 8px", textAlign: "left" }}>
              <div style={{ fontSize: 12, color: "#8a8378", textAlign: "center", letterSpacing: ".05em", textTransform: "uppercase", fontWeight: 600, marginBottom: 10 }}>Your collection code</div>
              <div style={{ border: "2px dashed #c25c34", borderRadius: 16, background: "#fdf4ef", padding: "22px 12px", textAlign: "center" }}>
                <div style={{ font: `700 46px ${MONO}`, letterSpacing: ".12em", color: "#2a2724" }}>{codeSpaced}</div>
              </div>
            </div>
            <div style={{ fontSize: 14, color: "#4a453e", lineHeight: 1.55, margin: "6px 8px 0" }}>
              <b>Show or type this code</b> at the shop counter to collect your print.
            </div>

            <div style={{ flex: 1, minHeight: 26 }} />
            <button onClick={reset} style={{ width: "100%", padding: 15, border: "2px solid #2a2724", borderRadius: 13, background: "#fff", color: "#2a2724", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Print another document</button>
          </div>
        )}
      </div>
    </div>
  );
}
