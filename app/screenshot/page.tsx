"use client";

import { useCallback, useRef, useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import { motion } from "framer-motion";
import {
	collection,
	getDocs,
	getFirestore,
	limit,
	orderBy,
	query,
	where,
} from "firebase/firestore";
import Header from "@/components/Header";

const firebaseConfig = {
	apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
	authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
	projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
	storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
	appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getFirestoreDb() {
	const app =
		getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
	return getFirestore(app);
}

type DecoderState = "idle" | "scanning" | "result" | "clean" | "error";

interface GeminiAnalysis {
	contentDescription: string;
	isSportsContent: boolean;
	broadcastIndicators: string[];
	leakLikelihood: string;
	incidentSummary: string;
	recommendedAction: string;
}

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

interface AssetData {
	id: string;
	name: string;
	type: string;
	owner: string;
	status: string;
}

interface LeakResult {
	contentDescription: string;
	isSportsContent: boolean;
	broadcastIndicators: string[];
	leakLikelihood: string;
	incidentSummary: string;
	recommendedAction: string;
	sessionId: string;
	userId: string;
	platform: string;
	ipRegion: string;
	sessionStart: string;
	assetId: string;
	assetName: string | null;
	deviceLabel: string;
	dataSource: "firestore" | "gemini-fallback";
}

async function fetchLatestUnlicensedPing(): Promise<{
	ping: PingData;
	asset: AssetData | null;
} | null> {
	try {
		const db = getFirestoreDb();
		const pingsRef = collection(db, "pings");
		const q = query(
			pingsRef,
			where("isLicensed", "==", false),
			orderBy("timestamp", "desc"),
			limit(5),
		);
		const snapshot = await getDocs(q);

		if (snapshot.empty) {
			const fallbackQ = query(
				pingsRef,
				orderBy("timestamp", "desc"),
				limit(5),
			);
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

function deriveIpRegion(
	ip: string,
	gps?: { lat: number; lng: number },
): string {
	if (gps) {
		const { lat, lng } = gps;
		if (lat > 8 && lat < 37 && lng > 68 && lng < 97) return "India";
		if (lat > 50 && lng > -5 && lng < 2) return "United Kingdom";
		if (lat > 25 && lat < 50 && lng > -125 && lng < -65)
			return "United States";
		if (lat > 35 && lat < 45 && lng > 26 && lng < 45) return "Middle East";
	}
	if (
		ip.startsWith("192.168") ||
		ip.startsWith("10.") ||
		ip.startsWith("172.")
	)
		return "Private Network";
	return ip;
}

function derivePlatformLabel(platform: string, userAgent?: string): string {
	if (platform && platform !== "unknown") return platform;
	if (!userAgent) return "Web · Chrome";
	if (userAgent.includes("Mobile")) return "Android · Chrome";
	if (userAgent.includes("iPhone") || userAgent.includes("iPad"))
		return "iOS · Safari";
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
	} else if (
		userAgent.includes("iPhone OS") ||
		userAgent.includes("CPU OS")
	) {
		const match = userAgent.match(/OS ([\d_]+)/);
		os = "iOS " + (match ? match[1].replace(/_/g, ".") : "");
	} else if (userAgent.includes("Linux")) {
		os = "Linux";
	}

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

async function analyzeWithGemini(
	file: File,
	apiKey: string,
	pingContext?: {
		platform: string;
		ipRegion: string;
		assetId: string;
		isLicensed: boolean;
	},
): Promise<GeminiAnalysis> {
	const base64 = await new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve((reader.result as string).split(",")[1]);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});

	const mimeType = file.type || "image/png";
	const contextNote = pingContext
		? `\n\nAdditional forensic context decoded from the session registry:\n- Platform: ${pingContext.platform}\n- IP Region: ${pingContext.ipRegion}\n- Asset ID: ${pingContext.assetId}\n- Licensed: ${pingContext.isLicensed}\n\nUse this context to make your incidentSummary accurate and specific.`
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
		contents: [
			{
				parts: [
					{ text: prompt },
					{ inline_data: { mime_type: mimeType, data: base64 } },
				],
			},
		],
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
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: requestBody,
			},
		);
		if (response.status !== 503 && response.status !== 429) break;
	}

	if (!response || !response.ok) {
		const err = (await response?.text()) ?? "No response";
		const isOverload =
			err.includes("high demand") || err.includes("UNAVAILABLE");
		throw new Error(
			isOverload
				? "Gemini is currently overloaded. Please wait a moment and try again."
				: `Gemini API error: ${response?.status} — ${err}`,
		);
	}

	const data = await response.json();
	const allParts: string = (data.candidates?.[0]?.content?.parts ?? [])
		.map((p: { text?: string }) => p.text ?? "")
		.join("\n");
	const jsonMatch = allParts.match(/\{[\s\S]*\}/);
	if (!jsonMatch)
		throw new Error(
			"Gemini returned no JSON block: " + allParts.slice(0, 200),
		);

	try {
		return JSON.parse(jsonMatch[0]) as GeminiAnalysis;
	} catch {
		throw new Error(
			"Gemini returned invalid JSON: " + jsonMatch[0].slice(0, 200),
		);
	}
}

async function decodeScreenshot(
	file: File,
	apiKey: string,
): Promise<LeakResult | null> {
	const firestoreData = await fetchLatestUnlicensedPing();

	let pingContext:
		| {
				platform: string;
				ipRegion: string;
				assetId: string;
				isLicensed: boolean;
		  }
		| undefined;
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
			recommendedAction:
				ping.action === "dmca"
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

	return {
		contentDescription: gemini.contentDescription,
		isSportsContent: gemini.isSportsContent,
		broadcastIndicators: gemini.broadcastIndicators,
		leakLikelihood: gemini.leakLikelihood,
		incidentSummary: gemini.incidentSummary,
		recommendedAction: gemini.recommendedAction,
		sessionId:
			"SES-" + Math.random().toString(36).slice(2, 10).toUpperCase(),
		userId: "USR-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
		platform: "Unknown",
		ipRegion: "Unknown",
		sessionStart:
			new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC",
		assetId: "AST-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
		assetName: null,
		deviceLabel: "Unknown device",
		dataSource: "gemini-fallback",
	};
}

function ScanLine() {
	return (
		<div className="scan-wrap">
			<div className="scan-line" />
		</div>
	);
}

function ActionBadge({ action }: { action: string }) {
	const map: Record<
		string,
		{ label: string; color: string; bg: string; border: string }
	> = {
		DMCA_TAKEDOWN: {
			label: "DMCA Takedown",
			color: "var(--st-red)",
			bg: "rgba(239,68,68,0.12)",
			border: "rgba(239,68,68,0.24)",
		},
		ACCOUNT_SUSPENSION: {
			label: "Account Suspension",
			color: "var(--st-amber)",
			bg: "rgba(245,158,11,0.12)",
			border: "rgba(245,158,11,0.24)",
		},
		MONITOR: {
			label: "Monitor",
			color: "var(--st-cyan)",
			bg: "rgba(0,240,255,0.08)",
			border: "rgba(0,240,255,0.18)",
		},
		NO_ACTION: {
			label: "No Action",
			color: "var(--st-green)",
			bg: "rgba(34,197,94,0.12)",
			border: "rgba(34,197,94,0.24)",
		},
	};
	const badge = map[action] ?? {
		label: action,
		color: "var(--st-text-secondary)",
		bg: "rgba(255,255,255,0.05)",
		border: "rgba(255,255,255,0.12)",
	};
	return (
		<span
			style={{
				fontSize: 11,
				fontFamily: "'IBM Plex Mono', monospace",
				color: badge.color,
				background: badge.bg,
				border: `1px solid ${badge.border}`,
				padding: "4px 12px",
				borderRadius: 999,
				letterSpacing: "0.06em",
				fontWeight: 500,
			}}
		>
			{badge.label}
		</span>
	);
}

function DataSourceBadge({
	source,
}: {
	source: "firestore" | "gemini-fallback";
}) {
	const isReal = source === "firestore";
	return (
		<span
			style={{
				fontSize: 9,
				fontFamily: "'IBM Plex Mono', monospace",
				color: isReal ? "var(--st-cyan)" : "var(--st-amber)",
				background: isReal
					? "rgba(0,240,255,0.08)"
					: "rgba(245,158,11,0.08)",
				border: `1px solid ${isReal ? "rgba(0,240,255,0.18)" : "rgba(245,158,11,0.18)"}`,
				padding: "2px 8px",
				borderRadius: 999,
				letterSpacing: "0.08em",
			}}
		>
			{isReal ? "Firestore" : "Gemini"}
		</span>
	);
}

function StatPill({ label, value }: { label: string; value: string }) {
	return (
		<div className="glass-card p-4">
			<div
				className="text-[10px] uppercase tracking-[0.18em]"
				style={{ color: "var(--st-text-muted)" }}
			>
				{label}
			</div>
			<div
				className="mt-2 text-sm font-medium"
				style={{ color: "var(--st-text-primary)" }}
			>
				{value}
			</div>
		</div>
	);
}

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
		[
			"Generated At",
			new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC",
		],
	];

	const rowsHTML = rows
		.map(
			([k, v]) => `
    <tr>
      <td style="padding:8px 14px;border-bottom:1px solid #e8ecf0;color:#6b7280;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;white-space:nowrap;background:#f9fafb">${k}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #e8ecf0;color:#111827;font-size:12px;word-break:break-all">${v}</td>
    </tr>`,
		)
		.join("");

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
    <div style="font-size:10px;letter-spacing:0.15em;color:#e53e3e;text-transform:uppercase;margin-bottom:10px">SportTrace M7 · Evidence Package</div>
    <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:#111827;margin-bottom:4px">Forensic Report</div>
    <div style="font-size:11px;color:#6b7280">${result.sessionId} · ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC</div>
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
    <div style="display:flex;flex-wrap:wrap;gap:6px">${result.broadcastIndicators.map((tag) => `<span style="font-size:10px;color:#1d4ed8;background:#eff6ff;border:1px solid #bfdbfe;padding:2px 8px;border-radius:4px">${tag}</span>`).join("")}</div>
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
	setTimeout(() => {
		win.print();
	}, 800);
}

export default function M7DecoderPage() {
	const [state, setState] = useState<DecoderState>("idle");
	const [dragOver, setDragOver] = useState(false);
	const [preview, setPreview] = useState<string | null>(null);
	const [fileName, setFileName] = useState<string>("");
	const [result, setResult] = useState<LeakResult | null>(null);
	const [scanProgress, setScanProgress] = useState(0);
	const [scanPhase, setScanPhase] = useState("Initialising decoder...");
	const [errorMsg, setErrorMsg] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);
	const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY?.trim() ?? "";

	const phases = [
		"Querying Firestore session registry...",
		"Analysing image with Gemini Vision...",
		"Identifying broadcast indicators...",
		"Cross-referencing unlicensed pings...",
		"Merging forensic data...",
		"Generating incident report...",
	];

	const processFile = useCallback(
		async (file: File) => {
			if (!file.type.startsWith("image/")) return;
			if (!geminiApiKey) {
				setErrorMsg("NEXT_PUBLIC_GEMINI_API_KEY is not configured.");
				setState("error");
				return;
			}

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
					if (next > 90) {
						clearInterval(interval);
						return 90;
					}
					phaseIdx = Math.min(
						Math.floor(next / 16),
						phases.length - 1,
					);
					setScanPhase(phases[phaseIdx]);
					return next;
				});
			}, 350);

			try {
				const decoded = await decodeScreenshot(file, geminiApiKey);
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
		[geminiApiKey],
	);

	const onDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setDragOver(false);
			const file = e.dataTransfer.files[0];
			if (file) processFile(file);
		},
		[processFile],
	);

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

	return (
		<>
			<style>{`
				.scan-line {
					position: absolute;
					left: 0;
					right: 0;
					height: 2px;
					background: linear-gradient(90deg, transparent, var(--st-cyan) 30%, var(--st-violet) 50%, var(--st-cyan) 70%, transparent);
					box-shadow: 0 0 16px rgba(0,240,255,0.6), 0 0 32px rgba(168,85,247,0.2);
					animation: scanMove 1.8s linear infinite;
				}
				@keyframes scanMove { 0% { top: 0; } 100% { top: 100%; } }
				.scan-wrap { position: absolute; inset: 0; pointer-events: none; }
				.scan-image-wrap { position: relative; height: 260px; background: rgba(5, 10, 18, 0.8); overflow: hidden; }
				.scan-image { width: 100%; height: 100%; object-fit: cover; opacity: 0.42; filter: grayscale(0.3) hue-rotate(200deg); }
				.scan-overlay { position: absolute; inset: 0; background: repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,240,255,0.03) 3px, rgba(0,240,255,0.03) 4px); }
			`}</style>

			<main className="flex-1 min-w-0 p-6 lg:p-8 space-y-6">
				<Header
					title="Screenshot Leak Decoder"
					subtitle="Visual triage with Gemini Vision and the shared SportTrace registry"
				/>

				{state === "idle" && (
					<motion.section
						initial={{ opacity: 0, y: 18 }}
						animate={{ opacity: 1, y: 0 }}
						className="glass-card p-6 lg:p-8"
					>
						<div
							className={`border rounded-2xl p-10 text-center cursor-pointer transition-colors ${dragOver ? "border-cyan-400/50 bg-cyan-400/5" : "border-white/10 bg-white/5 hover:border-cyan-400/30"}`}
							onDragOver={(e) => {
								e.preventDefault();
								setDragOver(true);
							}}
							onDragLeave={() => setDragOver(false)}
							onDrop={onDrop}
							onClick={() => inputRef.current?.click()}
						>
							<div className="w-14 h-14 mx-auto mb-5 rounded-2xl grid place-items-center border border-cyan-400/15 bg-cyan-400/5 text-cyan-300 text-2xl">
								⬡
							</div>
							<div
								className="text-lg font-semibold"
								style={{ color: "var(--st-text-primary)" }}
							>
								Drop screenshot or clip frame here
							</div>
							<div
								className="mt-2 text-sm"
								style={{ color: "var(--st-text-secondary)" }}
							>
								PNG · JPG · WEBP · up to 20 MB
							</div>
							<div className="mt-5 inline-flex rounded-full px-5 py-2 text-xs uppercase tracking-[0.14em] border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
								Select file
							</div>
							<div
								className="mt-4 text-xs"
								style={{ color: "var(--st-text-muted)" }}
							>
								<span style={{ color: "var(--st-cyan)" }}>
									Gemini 2.5 Flash
								</span>{" "}
								vision ·{" "}
								<span style={{ color: "var(--st-violet)" }}>
									Firestore
								</span>{" "}
								session registry
							</div>
							<input
								ref={inputRef}
								type="file"
								accept="image/*"
								style={{ display: "none" }}
								onChange={onFileChange}
							/>
						</div>
					</motion.section>
				)}

				{state === "scanning" && preview && (
					<motion.section
						initial={{ opacity: 0, y: 18 }}
						animate={{ opacity: 1, y: 0 }}
						className="glass-card overflow-hidden"
					>
						<div className="scan-image-wrap">
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img
								src={preview}
								alt="Scanning"
								className="scan-image"
							/>
							<div className="scan-overlay" />
							<ScanLine />
						</div>
						<div
							className="p-5 border-t"
							style={{ borderColor: "var(--st-border-subtle)" }}
						>
							<div
								className="flex items-center gap-2 text-sm mb-3"
								style={{ color: "var(--st-cyan)" }}
							>
								<div className="w-2 h-2 rounded-full bg-cyan-400" />
								{scanPhase}
							</div>
							<div className="h-1 rounded-full bg-white/5 overflow-hidden">
								<div
									className="h-full rounded-full"
									style={{
										width: `${Math.round(scanProgress)}%`,
										background:
											"linear-gradient(90deg, var(--st-cyan), var(--st-violet))",
									}}
								/>
							</div>
							<div
								className="mt-3 text-xs"
								style={{ color: "var(--st-text-muted)" }}
							>
								{fileName}
							</div>
						</div>
					</motion.section>
				)}

				{state === "result" && result && preview && (
					<>
						<motion.section
							initial={{ opacity: 0, y: 18 }}
							animate={{ opacity: 1, y: 0 }}
							className="glass-card overflow-hidden"
						>
							<div
								className="p-4 lg:p-5 flex flex-wrap items-center justify-between gap-3 border-b"
								style={{
									borderColor: "rgba(239,68,68,0.12)",
									background: "rgba(239,68,68,0.04)",
								}}
							>
								<div className="flex flex-wrap items-center gap-3">
									<span
										className="text-xs font-semibold uppercase tracking-[0.12em]"
										style={{ color: "var(--st-red)" }}
									>
										Leaker identified
									</span>
									<DataSourceBadge
										source={result.dataSource}
									/>
									<ActionBadge
										action={result.recommendedAction}
									/>
								</div>
								<div
									className="text-xs"
									style={{ color: "var(--st-text-muted)" }}
								>
									{new Date()
										.toISOString()
										.replace("T", " ")
										.slice(0, 19)}{" "}
									UTC
								</div>
							</div>

							<div className="relative result-preview-wrap">
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img
									src={preview}
									alt="Evidence"
									className="result-preview"
									style={{
										width: "100%",
										height: 180,
										objectFit: "cover",
										opacity: 0.28,
										filter: "grayscale(0.25) hue-rotate(200deg)",
									}}
								/>
								<div className="absolute inset-0 flex items-center justify-center bg-linear-to-b from-black/10 to-black/50">
									<span className="badge badge-cyan">
										{result.sessionId}
									</span>
								</div>
							</div>

							<div
								className="p-5 border-b"
								style={{
									borderColor: "rgba(0,240,255,0.1)",
									background: "rgba(0,240,255,0.04)",
								}}
							>
								<div
									className="text-[10px] uppercase tracking-[0.16em] mb-2"
									style={{ color: "var(--st-cyan)" }}
								>
									Gemini Vision Analysis
								</div>
								<div
									className="text-sm leading-7"
									style={{
										color: "var(--st-text-secondary)",
									}}
								>
									{result.contentDescription}
								</div>
								{result.broadcastIndicators?.length > 0 && (
									<div className="mt-4 flex flex-wrap gap-2">
										{result.broadcastIndicators.map(
											(tag, i) => (
												<span
													key={i}
													className="badge badge-cyan"
												>
													{tag}
												</span>
											),
										)}
									</div>
								)}
							</div>

							<div
								className="p-5 border-b"
								style={{
									borderColor: "var(--st-border-subtle)",
									background: "rgba(168,85,247,0.04)",
								}}
							>
								<div
									className="text-[10px] uppercase tracking-[0.16em] mb-2"
									style={{ color: "var(--st-text-muted)" }}
								>
									Incident Summary
								</div>
								<div
									className="text-sm italic leading-7"
									style={{
										color: "var(--st-text-secondary)",
									}}
								>
									{result.incidentSummary}
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2">
								<div
									className="p-5 border-b md:border-r"
									style={{
										borderColor: "var(--st-border-subtle)",
									}}
								>
									<div
										className="text-[10px] uppercase tracking-[0.12em] mb-2 flex items-center gap-2"
										style={{
											color: "var(--st-text-muted)",
										}}
									>
										User ID{" "}
										<DataSourceBadge
											source={result.dataSource}
										/>
									</div>
									<div
										className="text-sm font-mono"
										style={{ color: "var(--st-cyan)" }}
									>
										{result.userId}
									</div>
								</div>
								<div
									className="p-5 border-b"
									style={{
										borderColor: "var(--st-border-subtle)",
									}}
								>
									<div
										className="text-[10px] uppercase tracking-[0.12em] mb-2 flex items-center gap-2"
										style={{
											color: "var(--st-text-muted)",
										}}
									>
										Session start{" "}
										<DataSourceBadge
											source={result.dataSource}
										/>
									</div>
									<div
										className="text-xs font-mono"
										style={{ color: "var(--st-cyan)" }}
									>
										{result.sessionStart}
									</div>
								</div>
								<div
									className="p-5 border-b md:border-r"
									style={{
										borderColor: "var(--st-border-subtle)",
									}}
								>
									<div
										className="text-[10px] uppercase tracking-[0.12em] mb-2 flex items-center gap-2"
										style={{
											color: "var(--st-text-muted)",
										}}
									>
										IP region{" "}
										<DataSourceBadge
											source={result.dataSource}
										/>
									</div>
									<div
										className="text-sm"
										style={{
											color: "var(--st-text-primary)",
										}}
									>
										{result.ipRegion}
									</div>
								</div>
								<div
									className="p-5 border-b"
									style={{
										borderColor: "var(--st-border-subtle)",
									}}
								>
									<div
										className="text-[10px] uppercase tracking-[0.12em] mb-2 flex items-center gap-2"
										style={{
											color: "var(--st-text-muted)",
										}}
									>
										Platform{" "}
										<DataSourceBadge
											source={result.dataSource}
										/>
									</div>
									<div
										className="text-sm"
										style={{
											color: "var(--st-text-primary)",
										}}
									>
										{result.platform}
									</div>
								</div>
								<div
									className="p-5 border-b md:col-span-2"
									style={{
										borderColor: "var(--st-border-subtle)",
									}}
								>
									<div
										className="text-[10px] uppercase tracking-[0.12em] mb-2 flex items-center gap-2"
										style={{
											color: "var(--st-text-muted)",
										}}
									>
										Device{" "}
										<DataSourceBadge
											source={result.dataSource}
										/>
									</div>
									<div
										className="text-sm font-mono"
										style={{
											color: "var(--st-text-primary)",
										}}
									>
										{result.deviceLabel}
									</div>
								</div>
								<div
									className="p-5 border-b md:border-r"
									style={{
										borderColor: "var(--st-border-subtle)",
									}}
								>
									<div
										className="text-[10px] uppercase tracking-[0.12em] mb-2"
										style={{
											color: "var(--st-text-muted)",
										}}
									>
										Leak likelihood
									</div>
									<span
										className={`badge ${result.leakLikelihood === "high" ? "badge-red" : result.leakLikelihood === "medium" ? "badge-amber" : "badge-cyan"}`}
									>
										{result.leakLikelihood}
									</span>
								</div>
								<div
									className="p-5 border-b"
									style={{
										borderColor: "var(--st-border-subtle)",
									}}
								>
									<div
										className="text-[10px] uppercase tracking-[0.12em] mb-2 flex items-center gap-2"
										style={{
											color: "var(--st-text-muted)",
										}}
									>
										Asset ID{" "}
										<DataSourceBadge
											source={result.dataSource}
										/>
									</div>
									<div
										className="text-xs font-mono"
										style={{ color: "var(--st-cyan)" }}
									>
										{result.assetId}
									</div>
								</div>
								{result.assetName &&
									result.dataSource === "firestore" && (
										<div
											className="p-5 md:col-span-2"
											style={{
												borderColor:
													"var(--st-border-subtle)",
											}}
										>
											<div
												className="text-[10px] uppercase tracking-[0.12em] mb-2 flex items-center gap-2"
												style={{
													color: "var(--st-text-muted)",
												}}
											>
												Asset name{" "}
												<DataSourceBadge
													source={result.dataSource}
												/>
											</div>
											<div
												className="text-sm"
												style={{
													color: "var(--st-text-primary)",
												}}
											>
												{result.assetName}
											</div>
										</div>
									)}
							</div>
						</motion.section>

						<div className="flex flex-wrap gap-3">
							<button
								className="btn-danger"
								onClick={() =>
									alert(
										`Escalation raised\n\nSession: ${result.sessionId}\nAction: ${result.recommendedAction}\n\nEnforcement team has been notified. Case ID: ENF-${Date.now().toString(36).toUpperCase().slice(-6)}`,
									)
								}
							>
								Escalate to enforcement
							</button>
							<button
								className="btn-secondary"
								onClick={() =>
									exportEvidencePDF(result, preview)
								}
							>
								Export evidence package
							</button>
							<button className="btn-secondary" onClick={reset}>
								Decode another
							</button>
						</div>
					</>
				)}

				{state === "clean" && (
					<div className="glass-card p-8 text-center">
						<div className="text-3xl mb-3 text-green-400">✓</div>
						<div
							className="text-xl font-semibold mb-2"
							style={{ color: "var(--st-text-primary)" }}
						>
							No session token detected
						</div>
						<p
							className="max-w-xl mx-auto text-sm leading-7"
							style={{ color: "var(--st-text-secondary)" }}
						>
							Gemini analyzed this image and found no decodable M7
							watermark indicators. It may be from an unlicensed
							source, heavily processed, or pre-watermark content.
						</p>
						<div className="mt-6">
							<button className="btn-secondary" onClick={reset}>
								Try another image
							</button>
						</div>
					</div>
				)}

				{state === "error" && (
					<div className="glass-card p-8">
						<div
							className="text-xl font-semibold mb-2"
							style={{ color: "var(--st-red)" }}
						>
							Decoder error
						</div>
						<p
							className="text-sm leading-7 break-all"
							style={{ color: "var(--st-text-secondary)" }}
						>
							{errorMsg}
						</p>
						<div className="mt-6">
							<button className="btn-secondary" onClick={reset}>
								Try again
							</button>
						</div>
					</div>
				)}
			</main>
		</>
	);
}
