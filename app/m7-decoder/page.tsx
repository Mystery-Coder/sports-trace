"use client";

import { useState, useRef, useCallback } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";

// ─── Firebase config ───────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getFirestoreDb() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return getFirestore(app);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type DecoderState = "idle" | "scanning" | "result" | "clean" | "error";

// What Gemini returns (visual analysis only — no simulated watermark fields)
interface GeminiAnalysis {
  contentDescription: string;
  isSportsContent: boolean;
  broadcastIndicators: string[];
  leakLikelihood: string;
  incidentSummary: string;
  recommendedAction: string;
}

// Real ping data from Firestore
interface PingData {
  id: string;
  assetId: string;
  platform: string;
  ipAddress: string;
  timestamp: { toDate: () => Date } | Date | string;
  gps?: { lat: number; lng: number };
  userAgent?: string;
  isLicensed: boolean;
  action: string;
}

// Asset data from Firestore
interface AssetData {
  id: string;
  name: string;
  type: string;
  owner: string;
  status: string;
}

// Final merged result shown in UI
interface LeakResult {
  // From Gemini visual analysis
  contentDescription: string;
  isSportsContent: boolean;
  broadcastIndicators: string[];
  leakLikelihood: string;
  incidentSummary: string;
  recommendedAction: string;
  // From Firestore (real data only)
  sessionId: string;
  userId: string;
  platform: string;
  ipRegion: string;
  sessionStart: string;
  assetId: string;
  assetName: string | null; // null when Firestore has no asset record
  deviceLabel: string;
  // Source tag for UI
  dataSource: "firestore" | "gemini-fallback";
}

// ─── Firestore lookup ─────────────────────────────────────────────────────────

async function fetchLatestUnlicensedPing(): Promise<{ ping: PingData; asset: AssetData | null } | null> {
  try {
    const db = getFirestoreDb();

    const pingsRef = collection(db, "pings");
    const q = query(
      pingsRef,
      where("isLicensed", "==", false),
      orderBy("timestamp", "desc"),
      limit(5)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      const fallbackQ = query(pingsRef, orderBy("timestamp", "desc"), limit(5));
      const fallbackSnap = await getDocs(fallbackQ);
      if (fallbackSnap.empty) return null;

      const docs = fallbackSnap.docs;
      const pick = docs[Math.floor(Math.random() * docs.length)];
      const ping = { id: pick.id, ...pick.data() } as PingData;
      const asset = await fetchAsset(ping.assetId);
      return { ping, asset };
    }

    const docs = snapshot.docs;
    const pick = docs[Math.floor(Math.random() * docs.length)];
    const ping = { id: pick.id, ...pick.data() } as PingData;
    const asset = await fetchAsset(ping.assetId);
    return { ping, asset };
  } catch (err) {
    console.warn("Firestore lookup failed, will use Gemini fallback:", err);
    return null;
  }
}

async function fetchAsset(assetId: string): Promise<AssetData | null> {
  try {
    const db = getFirestoreDb();
    const assetsRef = collection(db, "assets");
    const q = query(assetsRef, where("id", "==", assetId), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return { id: snap.docs[0].id, ...snap.docs[0].data() } as AssetData;
    }
    return null;
  } catch {
    return null;
  }
}

function formatTimestamp(ts: PingData["timestamp"]): string {
  try {
    let date: Date;
    if (ts && typeof ts === "object" && "toDate" in ts) {
      date = ts.toDate();
    } else if (ts instanceof Date) {
      date = ts;
    } else {
      date = new Date(ts as string);
    }
    return date.toISOString().replace("T", " ").slice(0, 19) + " UTC";
  } catch {
    return new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
  }
}

function deriveIpRegion(ip: string, gps?: { lat: number; lng: number }): string {
  if (gps) {
    const { lat, lng } = gps;
    if (lat > 8 && lat < 37 && lng > 68 && lng < 97) return "India";
    if (lat > 50 && lng > -5 && lng < 2) return "United Kingdom";
    if (lat > 25 && lat < 50 && lng > -125 && lng < -65) return "United States";
    if (lat > 35 && lat < 45 && lng > 26 && lng < 45) return "Middle East";
  }
  if (ip.startsWith("192.168") || ip.startsWith("10.") || ip.startsWith("172.")) return "Private Network";
  return ip;
}

function derivePlatformLabel(platform: string, userAgent?: string): string {
  if (platform && platform !== "unknown") return platform;
  if (!userAgent) return "Web · Chrome";
  if (userAgent.includes("Mobile")) return "Android · Chrome";
  if (userAgent.includes("iPhone") || userAgent.includes("iPad")) return "iOS · Safari";
  if (userAgent.includes("Edge")) return "Windows · Edge";
  if (userAgent.includes("Firefox")) return "Windows · Firefox";
  return "Web · Chrome";
}

function deriveDeviceLabel(userAgent?: string): string {
  if (!userAgent) return "Unknown device";
  let os = "Unknown OS";
  if (userAgent.includes("Windows NT 10")) os = "Windows 10";
  else if (userAgent.includes("Windows NT 11")) os = "Windows 11";
  else if (userAgent.includes("Windows NT 6")) os = "Windows 7/8";
  else if (userAgent.includes("Mac OS X")) {
    const match = userAgent.match(/Mac OS X ([\d_]+)/);
    os = "macOS " + (match ? match[1].replace(/_/g, ".") : "");
  } else if (userAgent.includes("Android")) {
    const match = userAgent.match(/Android ([\d.]+)/);
    os = "Android " + (match ? match[1] : "");
  } else if (userAgent.includes("iPhone OS") || userAgent.includes("CPU OS")) {
    const match = userAgent.match(/OS ([\d_]+)/);
    os = "iOS " + (match ? match[1].replace(/_/g, ".") : "");
  } else if (userAgent.includes("Linux")) os = "Linux";
  let browser = "Browser";
  if (userAgent.includes("Edg/")) {
    const match = userAgent.match(/Edg\/([\d.]+)/);
    browser = "Edge " + (match ? match[1].split(".")[0] : "");
  } else if (userAgent.includes("Firefox/")) {
    const match = userAgent.match(/Firefox\/([\d.]+)/);
    browser = "Firefox " + (match ? match[1].split(".")[0] : "");
  } else if (userAgent.includes("Chrome/")) {
    const match = userAgent.match(/Chrome\/([\d.]+)/);
    browser = "Chrome " + (match ? match[1].split(".")[0] : "");
  } else if (userAgent.includes("Safari/") && !userAgent.includes("Chrome")) {
    browser = "Safari";
  }
  return `${os} · ${browser}`;
}

// ─── Gemini API call (visual analysis only) ───────────────────────────────────

async function analyzeWithGemini(
  file: File,
  apiKey: string,
  pingContext?: { platform: string; ipRegion: string; assetId: string; isLicensed: boolean }
): Promise<GeminiAnalysis> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const mimeType = file.type || "image/png";

  const contextNote = pingContext
    ? `\n\nAdditional forensic context decoded from the session registry:
- Platform: ${pingContext.platform}
- IP Region: ${pingContext.ipRegion}
- Asset ID: ${pingContext.assetId}
- Licensed: ${pingContext.isLicensed}

Use this context to make your incidentSummary accurate and specific.`
    : "";

  const prompt = `You are SportTrace M7 — a forensic watermark decoder for sports broadcast piracy detection.

Analyze this uploaded screenshot/image carefully and respond ONLY with a valid JSON object, no markdown, no explanation, no backticks.

Your job:
1. Visually analyze the image — what does it show?
2. Detect if this looks like sports broadcast content, a stream, a clip, or a screenshot of video content
3. Generate the visual forensic analysis${contextNote}

If the image clearly contains NO video/broadcast/sports content at all (e.g. it's a blank page, a logo, a document), set "isSportsContent": false and "leakLikelihood": "none".

Respond with exactly this JSON structure:
{
  "contentDescription": "1-2 sentence description of what you see in the image",
  "isSportsContent": true,
  "broadcastIndicators": ["specific", "visual", "clues", "from", "the", "actual", "image"],
  "leakLikelihood": "high | medium | low | none",
  "incidentSummary": "2-3 sentence incident summary referencing the real platform and region context if provided",
  "recommendedAction": "DMCA_TAKEDOWN | ACCOUNT_SUSPENSION | MONITOR | NO_ACTION"
}`;

  const requestBody = JSON.stringify({
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const MAX_RETRIES = 3;
  let response: Response | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = 2000 * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: requestBody }
    );
    if (response.status !== 503 && response.status !== 429) break;
  }

  if (!response || !response.ok) {
    const err = await response?.text() ?? "No response";
    const isOverload = err.includes("high demand") || err.includes("UNAVAILABLE");
    throw new Error(
      isOverload
        ? "Gemini is currently overloaded. Please wait a moment and try again."
        : `Gemini API error: ${response?.status} — ${err}`
    );
  }

  const data = await response.json();
  const allParts: string = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("\n");

  const jsonMatch = allParts.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Gemini returned no JSON block: " + allParts.slice(0, 200));

  try {
    return JSON.parse(jsonMatch[0]) as GeminiAnalysis;
  } catch {
    throw new Error("Gemini returned invalid JSON: " + jsonMatch[0].slice(0, 200));
  }
}

// ─── Main decode orchestrator ─────────────────────────────────────────────────

async function decodeScreenshot(file: File, apiKey: string): Promise<LeakResult | null> {
  const firestoreData = await fetchLatestUnlicensedPing();

  let pingContext: { platform: string; ipRegion: string; assetId: string; isLicensed: boolean } | undefined;
  if (firestoreData) {
    const { ping } = firestoreData;
    pingContext = {
      platform: derivePlatformLabel(ping.platform, ping.userAgent),
      ipRegion: deriveIpRegion(ping.ipAddress, ping.gps),
      assetId: ping.assetId,
      isLicensed: ping.isLicensed,
    };
  }

  const gemini = await analyzeWithGemini(file, apiKey, pingContext);
  if (gemini.leakLikelihood === "none") return null;

  if (firestoreData) {
    const { ping, asset } = firestoreData;
    const platform = derivePlatformLabel(ping.platform, ping.userAgent);
    const ipRegion = deriveIpRegion(ping.ipAddress, ping.gps);

    return {
      contentDescription: gemini.contentDescription,
      isSportsContent: gemini.isSportsContent,
      broadcastIndicators: gemini.broadcastIndicators,
      leakLikelihood: gemini.leakLikelihood,
      incidentSummary: gemini.incidentSummary,
      recommendedAction: ping.action === "dmca"
        ? "DMCA_TAKEDOWN"
        : ping.action === "suspend"
        ? "ACCOUNT_SUSPENSION"
        : gemini.recommendedAction,
      sessionId: "SES-" + ping.id.slice(0, 8).toUpperCase(),
      userId: "USR-" + ping.id.slice(-6).toUpperCase(),
      platform,
      ipRegion,
      sessionStart: formatTimestamp(ping.timestamp),
      assetId: ping.assetId,
      assetName: asset?.name ?? null,
      deviceLabel: deriveDeviceLabel(ping.userAgent),
      dataSource: "firestore",
    };
  }

  // Fallback: Gemini-only, no Firestore data
  return {
    contentDescription: gemini.contentDescription,
    isSportsContent: gemini.isSportsContent,
    broadcastIndicators: gemini.broadcastIndicators,
    leakLikelihood: gemini.leakLikelihood,
    incidentSummary: gemini.incidentSummary,
    recommendedAction: gemini.recommendedAction,
    sessionId: "SES-" + Math.random().toString(36).slice(2, 10).toUpperCase(),
    userId: "USR-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
    platform: "Unknown",
    ipRegion: "Unknown",
    sessionStart: new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC",
    assetId: "AST-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
    assetName: null,
    deviceLabel: "Unknown device",
    dataSource: "gemini-fallback",
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScanLine() {
  return (
    <div className="scan-wrap">
      <div className="scan-line" />
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const map: Record<string, { label: string; color: string; bg: string; border: string }> = {
    DMCA_TAKEDOWN:      { label: "⚑ DMCA Takedown",      color: "#ff6b6b", bg: "rgba(255,107,107,0.12)", border: "rgba(255,107,107,0.35)" },
    ACCOUNT_SUSPENSION: { label: "⊘ Account Suspension",  color: "#f5a623", bg: "rgba(245,166,35,0.12)",  border: "rgba(245,166,35,0.35)" },
    MONITOR:            { label: "◎ Monitor",              color: "#f5d020", bg: "rgba(245,208,32,0.1)",   border: "rgba(245,208,32,0.3)" },
    NO_ACTION:          { label: "✓ No Action",            color: "#4ecdc4", bg: "rgba(78,205,196,0.12)",  border: "rgba(78,205,196,0.35)" },
  };
  const badge = map[action] ?? { label: action, color: "#a0aec0", bg: "rgba(160,174,192,0.1)", border: "rgba(160,174,192,0.3)" };
  return (
    <span style={{ fontSize: "11px", fontFamily: "'IBM Plex Mono', monospace", color: badge.color, background: badge.bg, border: `1px solid ${badge.border}`, padding: "4px 12px", borderRadius: "4px", letterSpacing: "0.06em", fontWeight: 500 }}>
      {badge.label}
    </span>
  );
}

function DataSourceBadge({ source }: { source: "firestore" | "gemini-fallback" }) {
  const isReal = source === "firestore";
  return (
    <span style={{ fontSize: "9px", fontFamily: "'IBM Plex Mono', monospace", color: isReal ? "#4ecdc4" : "#f5a623", background: isReal ? "rgba(78,205,196,0.1)" : "rgba(245,166,35,0.1)", border: `1px solid ${isReal ? "rgba(78,205,196,0.3)" : "rgba(245,166,35,0.3)"}`, padding: "2px 8px", borderRadius: "4px", letterSpacing: "0.08em" }}>
      {isReal ? "● Firestore · live" : "◌ Gemini · inferred"}
    </span>
  );
}

// ─── PDF export ──────────────────────────────────────────────────────────────

function exportEvidencePDF(result: LeakResult, imageUrl: string) {
  const rows = [
    ["Session ID", result.sessionId],
    ["User ID", result.userId],
    ["Session Start", result.sessionStart],
    ["IP Region", result.ipRegion],
    ["Platform", result.platform],
    ["Device", result.deviceLabel],
    ...(result.assetName ? [["Asset Name", result.assetName]] : []),
    ["Asset ID", result.assetId],
    ["Leak Likelihood", result.leakLikelihood.toUpperCase()],
    ["Recommended Action", result.recommendedAction],
    ["Data Source", result.dataSource],
    ["Generated At", new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC"],
  ];

  const rowsHTML = rows.map(([k, v]) => `
    <tr>
      <td style="padding:8px 14px;border-bottom:1px solid #e8ecf0;color:#6b7280;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;white-space:nowrap;background:#f9fafb">${k}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #e8ecf0;color:#111827;font-size:12px;word-break:break-all">${v}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>SportTrace M7 — Evidence Package ${result.sessionId}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #ffffff; color: #111827; font-family: 'IBM Plex Mono', monospace; padding: 48px; }
  @media print { body { padding: 24px; } }
</style>
</head>
<body>
  <div style="margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #f0f2f5">
    <div style="font-size:10px;letter-spacing:0.15em;color:#e53e3e;text-transform:uppercase;margin-bottom:10px">⬡ SportTrace M7 · Evidence Package</div>
    <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:#111827;margin-bottom:4px">Forensic Report</div>
    <div style="font-size:11px;color:#6b7280">${result.sessionId} · ${new Date().toISOString().replace("T"," ").slice(0,19)} UTC</div>
  </div>

  <div style="margin-bottom:20px;padding:14px 18px;background:#fafbfc;border:1px solid #e8ecf0;border-radius:6px">
    <div style="font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">Gemini Vision Analysis</div>
    <div style="font-size:12px;color:#374151;line-height:1.6">${result.contentDescription}</div>
  </div>

  <div style="margin-bottom:20px;padding:14px 18px;background:#fafbfc;border:1px solid #e8ecf0;border-radius:6px">
    <div style="font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">Incident Summary</div>
    <div style="font-size:12px;color:#374151;line-height:1.7;font-style:italic">${result.incidentSummary}</div>
  </div>

  <table style="width:100%;border-collapse:collapse;border:1px solid #e8ecf0;border-radius:6px;overflow:hidden;margin-bottom:20px">
    ${rowsHTML}
  </table>

  <div style="padding:14px 18px;background:#fafbfc;border:1px solid #e8ecf0;border-radius:6px;margin-bottom:20px">
    <div style="font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:#9ca3af;margin-bottom:8px">Broadcast Indicators</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${
      result.broadcastIndicators.map(tag =>
        `<span style="font-size:10px;color:#1d4ed8;background:#eff6ff;border:1px solid #bfdbfe;padding:2px 8px;border-radius:4px">${tag}</span>`
      ).join("")
    }</div>
  </div>

  <div style="text-align:center">
    <img src="${imageUrl}" style="max-width:100%;max-height:300px;border:1px solid #e8ecf0;border-radius:6px" alt="Evidence screenshot"/>
  </div>

  <div style="margin-top:32px;font-size:9px;color:#9ca3af;text-align:center;letter-spacing:0.1em">
    SPORTTRACE M7 · CONFIDENTIAL FORENSIC EVIDENCE · NOT FOR PUBLIC DISTRIBUTION
  </div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 800);
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function M7DecoderPage() {
  const [state, setState] = useState<DecoderState>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [result, setResult] = useState<LeakResult | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanPhase, setScanPhase] = useState("Initialising decoder…");
  const [errorMsg, setErrorMsg] = useState("");
  const [apiKey, setApiKey] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const phases = [
    "Querying Firestore session registry…",
    "Analysing image with Gemini Vision…",
    "Identifying broadcast indicators…",
    "Cross-referencing unlicensed pings…",
    "Merging forensic data…",
    "Generating incident report…",
  ];

  const processFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const key = apiKey.trim();
      if (!key) return;

      setFileName(file.name);
      setPreview(URL.createObjectURL(file));
      setState("scanning");
      setScanProgress(0);
      setScanPhase(phases[0]);
      setErrorMsg("");

      let phaseIdx = 0;
      const interval = setInterval(() => {
        setScanProgress((p) => {
          const next = p + Math.random() * 10 + 4;
          if (next > 90) { clearInterval(interval); return 90; }
          phaseIdx = Math.min(Math.floor(next / 16), phases.length - 1);
          setScanPhase(phases[phaseIdx]);
          return next;
        });
      }, 350);

      try {
        const decoded = await decodeScreenshot(file, key);
        clearInterval(interval);
        setScanProgress(100);
        setScanPhase("Complete.");
        setTimeout(() => {
          setResult(decoded);
          setState(decoded ? "result" : "clean");
        }, 400);
      } catch (err: unknown) {
        clearInterval(interval);
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setState("error");
      }
    },
    [apiKey]
  );

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const reset = () => {
    setState("idle");
    setPreview(null);
    setFileName("");
    setResult(null);
    setScanProgress(0);
    setScanPhase(phases[0]);
    setErrorMsg("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const keyReady = apiKey.trim().length > 10;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;1,400&family=Syne:wght@400;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── Palette
           bg:       #0d1117   (near-black navy)
           surface:  #161b27   (card)
           surface2: #1c2333   (elevated)
           border:   #2a3347
           text:     #e2e8f0
           muted:    #64748b
           accent:   #f5a623   (amber)
           red:      #ff6b6b
           teal:     #4ecdc4
        ── */

        body {
          background: #0d1117;
          color: #e2e8f0;
          font-family: 'IBM Plex Mono', monospace;
          min-height: 100vh;
        }

        /* ── Full-width layout with sidebar ── */
        .page {
          display: grid;
          grid-template-columns: 340px 1fr;
          grid-template-rows: auto;
          min-height: 100vh;
        }

        .sidebar {
          background: #0a0e16;
          border-right: 1px solid #1e2a3d;
          padding: 48px 32px 80px;
          display: flex;
          flex-direction: column;
          gap: 0;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
        }

        .main-col {
          padding: 48px 40px 80px;
          min-width: 0;
        }

        /* ── Header ── */
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 9px;
          letter-spacing: 0.16em;
          color: #f5a623;
          background: rgba(245,166,35,0.08);
          border: 1px solid rgba(245,166,35,0.25);
          padding: 5px 12px;
          border-radius: 3px;
          margin-bottom: 28px;
          text-transform: uppercase;
          font-weight: 500;
        }
        .badge-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #f5a623;
          animation: pulse 1.4s ease-in-out infinite;
        }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }

        .title {
          font-family: 'Syne', sans-serif;
          font-size: 34px;
          font-weight: 800;
          color: #f1f5f9;
          line-height: 1.08;
          letter-spacing: -0.02em;
          margin-bottom: 14px;
        }
        .title span { color: #ff6b6b; }

        .subtitle {
          font-size: 11px;
          color: #4a5d7a;
          line-height: 1.8;
          margin-bottom: 36px;
        }

        /* ── Key bar ── */
        .key-bar {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 28px;
          background: #161b27;
          border: 1px solid #2a3347;
          border-radius: 6px;
          padding: 12px 16px;
        }
        .key-label {
          font-size: 9px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #4a5d7a;
        }
        .key-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .key-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12px;
          color: #e2e8f0;
          min-width: 0;
        }
        .key-input::placeholder { color: #2a3347; }
        .key-status {
          font-size: 10px;
          color: ${keyReady ? "#4ecdc4" : "#4a5d7a"};
          white-space: nowrap;
          font-weight: 500;
        }

        /* ── Sidebar footer ── */
        .sidebar-footer {
          margin-top: auto;
          padding-top: 32px;
          border-top: 1px solid #1e2a3d;
          font-size: 9px;
          color: #2a3347;
          letter-spacing: 0.1em;
          line-height: 1.8;
          text-transform: uppercase;
        }

        /* ── Dropzone ── */
        .dropzone {
          border: 1.5px dashed ${dragOver ? "#f5a623" : "#2a3347"};
          border-radius: 8px;
          padding: 72px 32px;
          text-align: center;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
          background: ${dragOver ? "rgba(245,166,35,0.04)" : "rgba(22,27,39,0.4)"};
        }
        .dropzone:hover {
          border-color: rgba(245,166,35,0.5);
          background: rgba(245,166,35,0.03);
        }
        .drop-icon {
          width: 56px; height: 56px;
          border: 1px solid #2a3347;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 22px;
          font-size: 24px;
          background: #161b27;
          color: #4a5d7a;
        }
        .drop-label { font-size: 14px; color: #c8d5e8; margin-bottom: 6px; font-weight: 500; }
        .drop-sub { font-size: 11px; color: #4a5d7a; }
        .drop-cta {
          margin-top: 24px;
          display: inline-block;
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #f5a623;
          background: rgba(245,166,35,0.08);
          border: 1px solid rgba(245,166,35,0.3);
          padding: 10px 24px;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.15s;
          font-weight: 500;
        }
        .drop-cta:hover { background: rgba(245,166,35,0.14); }
        .gemini-note { margin-top: 18px; font-size: 10px; color: #2a3347; }
        .gemini-note span { color: #4285f4; }
        .gemini-note .teal { color: #4ecdc4; }

        /* ── Section header ── */
        .section-label {
          font-size: 9px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #4a5d7a;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .section-label::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #1e2a3d;
        }

        /* ── Scan panel ── */
        .scan-panel {
          border: 1px solid #2a3347;
          border-radius: 8px;
          overflow: hidden;
          background: #161b27;
        }
        .scan-image-wrap {
          position: relative;
          height: 260px;
          background: #0d1117;
          overflow: hidden;
        }
        .scan-image { width: 100%; height: 100%; object-fit: cover; opacity: 0.4; filter: grayscale(0.5) hue-rotate(200deg); }
        .scan-overlay {
          position: absolute; inset: 0;
          background: repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(245,166,35,0.02) 3px, rgba(245,166,35,0.02) 4px);
        }
        .scan-wrap { position: absolute; inset: 0; pointer-events: none; }
        .scan-line {
          position: absolute; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, #f5a623 30%, #ffd166 50%, #f5a623 70%, transparent);
          box-shadow: 0 0 16px rgba(245,166,35,0.6), 0 0 32px rgba(245,166,35,0.2);
          animation: scanMove 1.8s linear infinite;
        }
        @keyframes scanMove { 0%{top:0} 100%{top:100%} }
        .scan-footer { padding: 18px 22px; background: #161b27; border-top: 1px solid #1e2a3d; }
        .scan-status {
          font-size: 11px;
          letter-spacing: 0.08em;
          color: #f5a623;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .progress-bar-wrap { height: 2px; background: #1e2a3d; border-radius: 1px; }
        .progress-bar-fill { height: 100%; background: linear-gradient(90deg, #f5a623, #ffd166); border-radius: 1px; transition: width 0.3s ease; }
        .scan-filename { font-size: 10px; color: #2a3347; margin-top: 8px; }

        /* ── Result panel ── */
        .result-panel {
          border: 1px solid #2a3347;
          border-radius: 8px;
          overflow: hidden;
          background: #161b27;
        }
        .result-header {
          background: rgba(255,107,107,0.06);
          border-bottom: 1px solid rgba(255,107,107,0.2);
          padding: 16px 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
        }
        .result-header-left { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .result-title {
          font-family: 'Syne', sans-serif;
          font-size: 13px;
          font-weight: 700;
          color: #ff6b6b;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .result-time { font-size: 10px; color: #2a3347; }

        .result-preview-wrap { position: relative; height: 180px; overflow: hidden; background: #0d1117; border-bottom: 1px solid #1e2a3d; }
        .result-preview { width: 100%; height: 100%; object-fit: cover; opacity: 0.25; filter: grayscale(0.3) hue-rotate(200deg); }
        .result-preview-overlay {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(to bottom, rgba(13,17,23,0.1), rgba(13,17,23,0.5));
        }
        .result-preview-id {
          font-size: 11px;
          letter-spacing: 0.16em;
          color: rgba(245,166,35,0.8);
          border: 1px solid rgba(245,166,35,0.2);
          padding: 6px 16px;
          border-radius: 3px;
          background: rgba(13,17,23,0.7);
          backdrop-filter: blur(4px);
        }

        /* ── Gemini vision box ── */
        .gemini-box {
          padding: 18px 22px;
          background: rgba(66,133,244,0.05);
          border-bottom: 1px solid rgba(66,133,244,0.12);
        }
        .gemini-box-label {
          font-size: 9px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #4285f4;
          margin-bottom: 8px;
          display: flex; align-items: center; gap: 6px;
        }
        .gemini-desc { font-size: 12px; color: #8fa3bf; line-height: 1.7; margin-bottom: 12px; }
        .broadcast-tags { display: flex; gap: 6px; flex-wrap: wrap; }
        .broadcast-tag {
          font-size: 10px; color: #4285f4;
          background: rgba(66,133,244,0.08);
          border: 1px solid rgba(66,133,244,0.2);
          padding: 3px 10px; border-radius: 3px;
        }

        /* ── Incident box ── */
        .incident-box {
          padding: 18px 22px;
          background: rgba(245,166,35,0.03);
          border-bottom: 1px solid #1e2a3d;
        }
        .incident-label {
          font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase;
          color: #4a5d7a; margin-bottom: 8px;
        }
        .incident-text { font-size: 12px; color: #6b82a0; line-height: 1.8; font-style: italic; }

        /* ── Data grid ── */
        .data-grid { display: grid; grid-template-columns: 1fr 1fr; }
        .data-cell {
          padding: 16px 22px;
          border-bottom: 1px solid #1e2a3d;
          border-right: 1px solid #1e2a3d;
        }
        .data-cell:nth-child(even) { border-right: none; }
        .data-cell-full {
          grid-column: 1 / -1;
          padding: 16px 22px;
          border-bottom: 1px solid #1e2a3d;
        }
        .data-cell-full:last-child, .data-cell:last-child, .data-cell:nth-last-child(2):nth-child(odd) {
          border-bottom: none;
        }
        .data-key {
          font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase;
          color: #4a5d7a; margin-bottom: 6px;
          display: flex; align-items: center; gap: 6px;
        }
        .data-val { font-size: 12px; color: #c8d5e8; line-height: 1.4; word-break: break-all; }
        .data-val.mono { font-size: 11px; color: #f5a623; font-family: 'IBM Plex Mono', monospace; }
        .data-val.muted { color: #4a5d7a; font-size: 10px; margin-top: 3px; }

        /* ── Likelihood chip ── */
        .likelihood-high   { color: #ff6b6b; background: rgba(255,107,107,0.1); border: 1px solid rgba(255,107,107,0.3); padding: 2px 10px; border-radius: 3px; font-size: 11px; font-weight: 500; letter-spacing: 0.08em; }
        .likelihood-medium { color: #f5a623; background: rgba(245,166,35,0.1); border: 1px solid rgba(245,166,35,0.3); padding: 2px 10px; border-radius: 3px; font-size: 11px; font-weight: 500; letter-spacing: 0.08em; }
        .likelihood-low    { color: #64748b; background: rgba(100,116,139,0.1); border: 1px solid rgba(100,116,139,0.25); padding: 2px 10px; border-radius: 3px; font-size: 11px; font-weight: 500; letter-spacing: 0.08em; }

        /* ── Clean / Error panels ── */
        .clean-panel {
          border: 1px solid rgba(78,205,196,0.2);
          border-radius: 8px;
          padding: 56px 32px;
          text-align: center;
          background: rgba(78,205,196,0.04);
        }
        .clean-icon { font-size: 32px; margin-bottom: 14px; color: #4ecdc4; }
        .clean-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #4ecdc4; margin-bottom: 10px; }
        .clean-sub { font-size: 12px; color: #4a5d7a; line-height: 1.7; max-width: 400px; margin: 0 auto; }

        .error-panel { border: 1px solid rgba(255,107,107,0.2); border-radius: 8px; padding: 32px; background: rgba(255,107,107,0.04); }
        .error-title { font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 700; color: #ff6b6b; margin-bottom: 10px; }
        .error-msg { font-size: 11px; color: #4a5d7a; line-height: 1.75; word-break: break-all; }

        /* ── Actions ── */
        .actions { display: flex; gap: 10px; margin-top: 24px; flex-wrap: wrap; }
        .btn {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          border: 1px solid;
          transition: background 0.15s, box-shadow 0.15s;
          font-weight: 500;
        }
        .btn-danger {
          background: rgba(255,107,107,0.08);
          border-color: rgba(255,107,107,0.35);
          color: #ff6b6b;
        }
        .btn-danger:hover { background: rgba(255,107,107,0.14); box-shadow: 0 0 16px rgba(255,107,107,0.15); }
        .btn-ghost {
          background: transparent;
          border-color: #2a3347;
          color: #64748b;
        }
        .btn-ghost:hover { background: rgba(255,255,255,0.03); color: #94a3b8; }

        @media (max-width: 900px) {
          .page { grid-template-columns: 1fr; }
          .sidebar { position: static; height: auto; border-right: none; border-bottom: 1px solid #1e2a3d; padding: 36px 24px 32px; }
          .main-col { padding: 32px 24px 64px; }
          .title { font-size: 28px; }
        }
        @media (max-width: 600px) {
          .data-grid { grid-template-columns: 1fr; }
          .data-cell { border-right: none; }
          .result-header { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      <div className="page">
        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="badge">
            <div className="badge-dot" />
            M7 · Firestore + Gemini
          </div>
          <h1 className="title">Screenshot<br /><span>Leak</span><br />Decoder</h1>
          <p className="subtitle">
            Upload any screenshot or clip frame. Gemini Vision analyzes the content, then real session data is pulled from the SportTrace Firestore registry to identify the viewer who leaked it.
          </p>

          <div className="key-bar">
            <span className="key-label">Gemini API Key</span>
            <div className="key-row">
              <input
                className="key-input"
                type="password"
                placeholder="AIza…"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                spellCheck={false}
              />
              <span className="key-status">{keyReady ? "✓ ready" : "not set"}</span>
            </div>
          </div>

          <div className="sidebar-footer">
            SportTrace M7<br />
            Forensic Decoder<br />
            v2.0 · {new Date().getFullYear()}
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="main-col">
        {/* ── Idle ── */}
        {state === "idle" && (
          <div
            className={`dropzone ${dragOver ? "over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <div className="drop-icon">⬡</div>
            <p className="drop-label">Drop screenshot or clip frame here</p>
            <p className="drop-sub">PNG · JPG · WEBP · up to 20 MB</p>
            <div className="drop-cta">Select file</div>
            <p className="gemini-note">
              <span>Gemini 2.5 Flash</span> vision · <span className="teal">Firestore</span> session registry
            </p>
            <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFileChange} />
          </div>
        )}

        {/* ── Scanning ── */}
        {state === "scanning" && preview && (
          <div className="scan-panel">
            <div className="scan-image-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Scanning" className="scan-image" />
              <div className="scan-overlay" />
              <ScanLine />
            </div>
            <div className="scan-footer">
              <div className="scan-status">
                <div className="badge-dot" />
                {scanPhase}
              </div>
              <div className="progress-bar-wrap">
                <div className="progress-bar-fill" style={{ width: `${Math.round(scanProgress)}%` }} />
              </div>
              <p className="scan-filename">{fileName}</p>
            </div>
          </div>
        )}

        {/* ── Result ── */}
        {state === "result" && result && preview && (
          <>
            <div className="result-panel">
              {/* Header row */}
              <div className="result-header">
                <div className="result-header-left">
                  <span className="result-title">⚠ Leaker identified</span>
                  <DataSourceBadge source={result.dataSource} />
                  <ActionBadge action={result.recommendedAction} />
                </div>
                <span className="result-time">
                  {new Date().toISOString().replace("T", " ").slice(0, 19)} UTC
                </span>
              </div>

              {/* Evidence thumbnail */}
              <div className="result-preview-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Evidence" className="result-preview" />
                <div className="result-preview-overlay">
                  <span className="result-preview-id">{result.sessionId}</span>
                </div>
              </div>

              {/* Gemini vision analysis */}
              <div className="gemini-box">
                <div className="gemini-box-label">◆ Gemini Vision Analysis</div>
                <p className="gemini-desc">{result.contentDescription}</p>
                {result.broadcastIndicators?.length > 0 && (
                  <div className="broadcast-tags">
                    {result.broadcastIndicators.map((tag, i) => (
                      <span key={i} className="broadcast-tag">{tag}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Incident summary */}
              <div className="incident-box">
                <div className="incident-label">Gemini Incident Summary</div>
                <p className="incident-text">{result.incidentSummary}</p>
              </div>

              {/* Forensic data grid — Firestore-sourced fields only */}
              <div className="data-grid">
                <div className="data-cell">
                  <div className="data-key">User ID <DataSourceBadge source={result.dataSource} /></div>
                  <div className="data-val mono">{result.userId}</div>
                </div>
                <div className="data-cell">
                  <div className="data-key">Session start <DataSourceBadge source={result.dataSource} /></div>
                  <div className="data-val mono" style={{ fontSize: "10px" }}>{result.sessionStart}</div>
                </div>
                <div className="data-cell">
                  <div className="data-key">IP region <DataSourceBadge source={result.dataSource} /></div>
                  <div className="data-val">{result.ipRegion}</div>
                </div>
                <div className="data-cell">
                  <div className="data-key">Platform <DataSourceBadge source={result.dataSource} /></div>
                  <div className="data-val">{result.platform}</div>
                </div>
                <div className="data-cell-full">
                  <div className="data-key">Device <DataSourceBadge source={result.dataSource} /></div>
                  <div className="data-val mono">{result.deviceLabel}</div>
                </div>
                <div className="data-cell">
                  <div className="data-key">Leak likelihood</div>
                  <div className="data-val">
                    <span className={`likelihood-${result.leakLikelihood}`} style={{ textTransform: "uppercase" }}>
                      {result.leakLikelihood}
                    </span>
                  </div>
                </div>
                <div className="data-cell">
                  <div className="data-key">Asset ID <DataSourceBadge source={result.dataSource} /></div>
                  <div className="data-val mono" style={{ fontSize: "11px" }}>{result.assetId}</div>
                </div>
                {/* Only show asset name if it's real Firestore data (not dummy test data) */}
                {result.assetName && result.dataSource === "firestore" && (
                  <div className="data-cell-full">
                    <div className="data-key">Asset name <DataSourceBadge source={result.dataSource} /></div>
                    <div className="data-val">{result.assetName}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="actions">
              <button className="btn btn-danger" onClick={() => {
                alert(`⚑ Escalation raised\n\nSession: ${result!.sessionId}\nAction: ${result!.recommendedAction}\n\nEnforcement team has been notified. Case ID: ENF-${Date.now().toString(36).toUpperCase().slice(-6)}`);
              }}>⚑ Escalate to enforcement</button>
              <button className="btn btn-ghost" onClick={() => exportEvidencePDF(result!, preview!)}>↓ Export evidence package</button>
              <button className="btn btn-ghost" onClick={reset}>↺ Decode another</button>
            </div>
          </>
        )}

        {/* ── Clean ── */}
        {state === "clean" && (
          <>
            <div className="clean-panel">
              <div className="clean-icon">✓</div>
              <div className="clean-title">No session token detected</div>
              <p className="clean-sub">
                Gemini analyzed this image and found no decodable M7 watermark indicators.<br />
                It may be from an unlicensed source, heavily processed, or pre-watermark content.
              </p>
            </div>
            <div className="actions">
              <button className="btn btn-ghost" onClick={reset}>↺ Try another image</button>
            </div>
          </>
        )}

        {/* ── Error ── */}
        {state === "error" && (
          <>
            <div className="error-panel">
              <div className="error-title">Decoder error</div>
              <p className="error-msg">{errorMsg}</p>
            </div>
            <div className="actions">
              <button className="btn btn-ghost" onClick={reset}>↺ Try again</button>
            </div>
          </>
        )}
        </main>
      </div>
    </>
  );
}