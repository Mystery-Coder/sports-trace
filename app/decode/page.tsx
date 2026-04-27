'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { ScanSearch, MapPin, Clock, Monitor, CheckCircle, AlertTriangle, XCircle, Radio, Globe } from 'lucide-react';
import Header from '@/components/Header';
import FileUpload from '@/components/FileUpload';
import { useSportTraceStore } from '@/lib/store';
import { decodeImageWatermark, loadImageToData } from '@/lib/watermark';
import type { DetectionPing, EnforcementAction } from '@/lib/types';

type Stage = 'upload' | 'scanning' | 'result';

export default function DecodePage() {
  const [stage, setStage] = useState<Stage>('upload');
  const [scanProgress, setScanProgress] = useState(0);
  const [decodeResult, setDecodeResult] = useState<{ token: string | null; confidence: number; assetMatch: boolean; assetName?: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { assets, addPing, addEnforcement } = useSportTraceStore();
  const [territoryCheck, setTerritoryCheck] = useState<{
  result: 'granted' | 'blocked';
  country?: string;
  matchName?: string;
  } | null>(null);

  const handleFileSelected = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload a watermarked image to decode.');
      return;
    }

    setStage('scanning');
    setScanProgress(0);

    // Animate scanning progress
    const progressInterval = setInterval(() => {
      setScanProgress((p) => Math.min(p + 2, 90));
    }, 50);

    try {
      const { imageData, width, height } = await loadImageToData(file);

      // Draw to canvas
      if (canvasRef.current) {
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        const ctx = canvasRef.current.getContext('2d')!;
        ctx.putImageData(imageData, 0, 0);
      }

      // Decode watermark
      const result = decodeImageWatermark(imageData);

      clearInterval(progressInterval);
      setScanProgress(100);

      // Check if token matches any registered asset
      const matchedAsset = result.token ? assets.find((a) => a.watermarkToken === result.token) : null;

      setDecodeResult({
        token: result.token,
        confidence: result.confidence,
        assetMatch: !!matchedAsset,
        assetName: matchedAsset?.name,
      });

      // If token found, fire a detection ping
      if (result.token) {
      // Step 1: Get real GPS from browser
      const gps = await new Promise<{ lat: number; lng: number }>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve({ lat: 12.97 + Math.random() * 2, lng: 77.59 + Math.random() * 2 }) // fallback
        );
      });

      // Step 2: Check territory license via M5
      let isLicensed = false;
      let territoryResult: { result: 'granted' | 'blocked'; country?: string; matchName?: string } | null = null;

      try {
        // Use the first active license for demo — in production would match by asset
        const licensesRes = await fetch('/api/territory/license');
        const licensesData = await licensesRes.json();
        const activeLicense = licensesData.licenses?.[0];

        if (activeLicense) {
          const checkRes = await fetch('/api/territory/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              matchId: activeLicense.matchId,
              lat: gps.lat,
              lng: gps.lng,
            }),
          });
          const checkData = await checkRes.json();
          territoryResult = checkData;
          isLicensed = checkData.result === 'granted';
        } else {
          // No license set up — default to licensed
          isLicensed = true;
        }
      } catch (err) {
        console.error('Territory check failed:', err);
        isLicensed = true; // Fail open for demo
      }

      // Step 3: Build ping with real GPS + real license status
      const ping: DetectionPing = {
        id: uuidv4(),
        assetId: matchedAsset?.id || 'unknown',
        watermarkToken: result.token,
        timestamp: Date.now(),
        gps,
        platform: ['Chrome Browser', 'Firefox', 'Safari', 'Mobile App'][Math.floor(Math.random() * 4)],
        userAgent: navigator.userAgent,
        ipAddress: '192.168.' + Math.floor(Math.random() * 255) + '.' + Math.floor(Math.random() * 255),
        action: isLicensed ? 'log' : Math.random() > 0.5 ? 'offer' : 'dmca',
        isLicensed,
      };

      await addPing(ping);

      // Step 4: If unlicensed, create enforcement action
      if (!isLicensed) {
        const enforcement: EnforcementAction = {
          id: uuidv4(),
          assetId: matchedAsset?.id || 'unknown',
          pingId: ping.id,
          type: ping.action === 'dmca' ? 'dmca' : 'micro-license',
          status: 'pending',
          severity: ping.action === 'dmca' ? 'high' : 'medium',
          evidence: { timestamp: ping.timestamp, gps: ping.gps, platform: ping.platform },
          createdAt: Date.now(),
        };
        await addEnforcement(enforcement);
      }

      // Step 5: Show territory result in UI
      setTerritoryCheck(territoryResult);
    }

      setTimeout(() => setStage('result'), 500);
    } catch {
      clearInterval(progressInterval);
      setStage('upload');
      alert('Failed to decode image.');
    }
  };

  const reset = () => { setStage('upload'); setDecodeResult(null); setScanProgress(0); };

  return (
    <div className="flex min-h-screen">
      
      <main className="flex-1 flex flex-col">
        <Header title="Decode & Ping" subtitle="Scan media for hidden watermark DNA → fire detection ping" />
        <div className="flex-1 p-8 space-y-6 relative z-10">

          {stage === 'upload' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--st-text-primary)' }}>Decode Watermark</h2>
                <p className="text-sm" style={{ color: 'var(--st-text-secondary)' }}>Upload a watermarked image to extract the hidden DNA token and fire a detection ping</p>
              </div>
              <FileUpload onFileSelected={handleFileSelected} accept="image/*" />
            </motion.div>
          )}

          {stage === 'scanning' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-lg mx-auto text-center space-y-6 py-8">
              {/* Scanner visualization */}
              <div className="relative mx-auto overflow-hidden rounded-xl" style={{ maxWidth: 400, maxHeight: 300 }}>
                <canvas ref={canvasRef} className="w-full rounded-xl" style={{ maxHeight: 300 }} />
                {scanProgress < 100 && <div className="scanner-overlay" />}
                <div className="absolute inset-0 border-2 rounded-xl" style={{ borderColor: scanProgress < 100 ? 'var(--st-cyan)' : 'var(--st-green)', transition: 'border-color 0.3s' }} />
              </div>
              <div>
                <p className="text-sm font-medium mb-2" style={{ color: 'var(--st-text-primary)' }}>
                  {scanProgress < 100 ? 'Scanning for watermark DNA...' : 'Token extracted!'}
                </p>
                <div className="progress-bar w-full max-w-xs mx-auto">
                  <div className="progress-fill" style={{ width: `${scanProgress}%` }} />
                </div>
              </div>
            </motion.div>
          )}

          {stage === 'result' && decodeResult && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-6">
              {/* Result header */}
              <div className="glass-card p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{
                  background: decodeResult.token ? 'rgba(0, 240, 255, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${decodeResult.token ? 'rgba(0, 240, 255, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                }}>
                  {decodeResult.token ? <ScanSearch size={24} style={{ color: 'var(--st-cyan)' }} /> : <XCircle size={24} style={{ color: 'var(--st-red)' }} />}
                </div>
                <div>
                  <h3 className="text-base font-bold" style={{ color: decodeResult.token ? 'var(--st-cyan)' : 'var(--st-red)' }}>
                    {decodeResult.token ? 'Watermark DNA Detected!' : 'No Watermark Found'}
                  </h3>
                  <p className="text-xs mt-1" style={{ color: 'var(--st-text-secondary)' }}>
                    Confidence: {(decodeResult.confidence * 100).toFixed(1)}%
                  </p>
                </div>
              </div>

              {decodeResult.token && (
                <>
                  {/* Token details */}
                  <div className="glass-card p-6 space-y-3">
                    <h4 className="text-sm font-semibold" style={{ color: 'var(--st-text-primary)' }}>Decoded Token</h4>
                    {[
                      ['Token', decodeResult.token],
                      ['Confidence', `${(decodeResult.confidence * 100).toFixed(1)}%`],
                      ['Registry Match', decodeResult.assetMatch ? 'YES ✓' : 'NO — Unregistered'],
                      ...(decodeResult.assetName ? [['Asset Name', decodeResult.assetName]] : []),
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--st-border-subtle)' }}>
                        <span className="text-xs" style={{ color: 'var(--st-text-secondary)' }}>{label}</span>
                        <span className="text-xs font-mono" style={{ color: 'var(--st-cyan)' }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Ping fired */}
                  <div className="glass-card p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Radio size={16} style={{ color: 'var(--st-violet)' }} />
                      <h4 className="text-sm font-semibold" style={{ color: 'var(--st-text-primary)' }}>Detection Ping Fired</h4>
                      <span className="badge badge-violet">Sent to Firestore</span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--st-text-secondary)' }}>
                      A detection ping with GPS coordinates, platform context, and timestamp has been recorded. Check the Dashboard or Enforcement Queue for actions.
                    </p>
                  </div>

                  {/* Territory Check Result */}
                  {territoryCheck && (
                    <div className={`glass-card p-6 border ${
                      territoryCheck.result === 'granted'
                        ? 'border-green-500/30 bg-green-500/5'
                        : 'border-red-500/30 bg-red-500/5'
                    }`}>
                      <div className="flex items-center gap-2 mb-3">
                        <Globe size={16} style={{ color: territoryCheck.result === 'granted' ? '#22c55e' : '#ef4444' }} />
                        <h4 className="text-sm font-semibold" style={{ color: 'var(--st-text-primary)' }}>
                          M5 Territory Check
                        </h4>
                        <span className={`badge ${territoryCheck.result === 'granted' ? 'badge-green' : 'badge-red'}`}>
                          {territoryCheck.result === 'granted' ? 'Licensed Territory' : '451 Blocked'}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--st-text-secondary)' }}>
                        {territoryCheck.result === 'granted'
                          ? `Viewer in ${territoryCheck.country} — licensed to watch ${territoryCheck.matchName}`
                          : `Viewer in ${territoryCheck.country} — not licensed for ${territoryCheck.matchName}. Enforcement triggered.`
                        }
                      </p>
                    </div>
                  )}
                </>
              )}

              <div className="flex justify-center">
                <button onClick={reset} className="btn-secondary">Decode Another Image</button>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
