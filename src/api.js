const BASE = import.meta.env.VITE_API_BASE_URL;

// 1. Upload a document + options → returns { job_id, amount_paise, claim_code }
export async function uploadJob({ file, shopId, type, copies }) {
  const form = new FormData();
  form.append("file", file);
  form.append("shop_id", shopId);
  form.append("type", type);       // "mono" | "color"
  form.append("copies", copies);
  const res = await fetch(`${BASE}/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
  return res.json();
}

// 2. Confirm payment (STUB backend) → marks paid, job held at shop
export async function confirmPayment(jobId) {
  const res = await fetch(`${BASE}/pay/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId }),
  });
  if (!res.ok) throw new Error(`pay/confirm failed: ${res.status}`);
  return res.json();
}

// 3. Release a held job by claim code → shop prints
export async function releaseJob({ shopId, code }) {
  const res = await fetch(`${BASE}/release`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shop_id: shopId, code }),
  });
  return res; // caller inspects res.ok / res.status (404 wrong code, 503 offline)
}
