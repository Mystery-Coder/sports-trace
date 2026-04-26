'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Upload, Check, Loader2, Download, Eye } from 'lucide-react';

import Header from '@/components/Header';
import FileUpload from '@/components/FileUpload';
import WatermarkVisualizer from '@/components/WatermarkVisualizer';
import { useSportTraceStore } from '@/lib/store';
import { embedImageWatermark, loadImageToData, imageDataToBlob, loadVideoElement, extractVideoFrames, embedVideoWatermark } from '@/lib/watermark';
import { generateWatermarkToken, sha256, hmacSign } from '@/lib/crypto';
import type { Asset } from '@/lib/types';

type Stage = 'upload' | 'processing' | 'complete';

export default function EmbedPage() {
  const [stage, setStage] = useState<Stage>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [result, setResult] = useState<{ asset: Asset; watermarkedUrl: string; originalUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const watermarkedCanvasRef = useRef<HTMLCanvasElement>(null);
  const { addAsset } = useSportTraceStore();

  const handleFileSelected = (f: File) => {
    setFile(f);
    setError(null);
    setResult(null);
  };

  const handleEmbed = async () => {
    if (!file) return;
    setStage('processing');
    setError(null);

    try {
      const assetId = uuidv4();
      const token = generateWatermarkToken(assetId);
      const isVideo = file.type.startsWith('video/');
      const startTime = performance.now();

      if (isVideo) {
        setProgress(10); setProgressLabel('Loading video...');
        const video = await loadVideoElement(file);

        setProgress(30); setProgressLabel('Extracting frames...');
        const frames = await extractVideoFrames(video, 10);

        setProgress(60); setProgressLabel('Embedding watermark DNA...');
        const wmResult = embedVideoWatermark(frames, token);

        if (!wmResult.success) throw new Error('Video watermark failed');

        setProgress(80); setProgressLabel('Generating preview...');
        // Show first watermarked frame as preview
        const previewBlob = await imageDataToBlob(frames[0]);
        const previewUrl = URL.createObjectURL(previewBlob);

        // Draw canvases
        drawFrameToCanvas(frames[0], watermarkedCanvasRef.current);

        setProgress(90); setProgressLabel('Registering in Firestore...');
        const hash = await sha256(assetId + token + Date.now());
        const sig = await hmacSign(hash, 'sporttrace-hackathon-secret-key-2026');

        const embedTime = performance.now() - startTime;
        const asset: Asset = {
          id: assetId, name: file.name, owner: 'demo-user', type: 'video',
          watermarkToken: token, hash, hmacSignature: sig,
          originalUrl: '', watermarkedUrl: previewUrl, fileSize: file.size,
          createdAt: Date.now(), pingCount: 0, status: 'active',
        };

        await addAsset(asset);
        setProgress(100); setProgressLabel(`Done in ${embedTime.toFixed(0)}ms`);
        setResult({ asset, watermarkedUrl: previewUrl, originalUrl: URL.createObjectURL(file) });
      } else {
        // Image watermarking
        setProgress(15); setProgressLabel('Loading image...');
        const { imageData, width, height } = await loadImageToData(file);

        // Draw original
        drawImageDataToCanvas(imageData, originalCanvasRef.current, width, height);

        setProgress(40); setProgressLabel('Embedding watermark DNA...');
        const clonedData = new ImageData(new Uint8ClampedArray(imageData.data), width, height);
        const wmResult = embedImageWatermark(clonedData, token);

        if (!wmResult.success) throw new Error('Image too small for watermark');

        setProgress(70); setProgressLabel('Generating watermarked output...');
        drawImageDataToCanvas(clonedData, watermarkedCanvasRef.current, width, height);
        const blob = await imageDataToBlob(clonedData);
        const watermarkedUrl = URL.createObjectURL(blob);

        setProgress(85); setProgressLabel('Signing hash (simulated KMS)...');
        const hash = await sha256(assetId + token + Date.now());
        const sig = await hmacSign(hash, 'sporttrace-hackathon-secret-key-2026');

        setProgress(95); setProgressLabel('Registering in Firestore...');
        const embedTime = performance.now() - startTime;
        const asset: Asset = {
          id: assetId, name: file.name, owner: 'demo-user', type: 'image',
          watermarkToken: token, hash, hmacSignature: sig,
          originalUrl: URL.createObjectURL(file), watermarkedUrl, fileSize: file.size,
          createdAt: Date.now(), pingCount: 0, status: 'active',
        };

        await addAsset(asset);
        setProgress(100); setProgressLabel(`Done in ${embedTime.toFixed(0)}ms`);
        setResult({ asset, watermarkedUrl, originalUrl: URL.createObjectURL(file) });
      }

      setStage('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Watermark embedding failed');
      setStage('upload');
    }
  };

  return (
    <div className="flex min-h-screen">
     
      <main className="flex-1 flex flex-col">
        <Header title="Embed Pipeline" subtitle="Upload media → Embed invisible DNA → Register asset" />
        <div className="flex-1 p-8 space-y-6 relative z-10">

          {stage === 'upload' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--st-text-primary)' }}>Protect Your Asset</h2>
                <p className="text-sm" style={{ color: 'var(--st-text-secondary)' }}>Upload an image or video to embed invisible watermark DNA</p>
              </div>
              <FileUpload onFileSelected={handleFileSelected} />
              {file && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center">
                  <button onClick={handleEmbed} className="btn-primary text-base px-8 py-3">
                    <Upload size={18} />Embed Watermark DNA
                  </button>
                </motion.div>
              )}
              {error && <p className="text-center text-sm" style={{ color: 'var(--st-red)' }}>{error}</p>}
            </motion.div>
          )}

          {stage === 'processing' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-lg mx-auto text-center space-y-8 py-12">
              <WatermarkVisualizer isActive={true} />
              <div>
                <p className="text-sm font-medium mb-2" style={{ color: 'var(--st-text-primary)' }}>{progressLabel}</p>
                <div className="progress-bar w-full max-w-xs mx-auto">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--st-text-muted)' }}>{progress}%</p>
              </div>
            </motion.div>
          )}

          {stage === 'complete' && result && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              {/* Success header */}
              <div className="glass-card p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                  <Check size={24} style={{ color: 'var(--st-green)' }} />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold" style={{ color: 'var(--st-green)' }}>Watermark Embedded Successfully</h3>
                  <p className="text-xs mt-1" style={{ color: 'var(--st-text-secondary)' }}>{progressLabel}</p>
                </div>
                <a href={result.watermarkedUrl} download={`watermarked_${result.asset.name}`} className="btn-primary">
                  <Download size={16} />Download
                </a>
              </div>

              {/* Asset Details */}
              <div className="glass-card p-6 space-y-3">
                <h4 className="text-sm font-semibold" style={{ color: 'var(--st-text-primary)' }}>Asset Registry Entry</h4>
                {[
                  ['Asset ID', result.asset.id],
                  ['Watermark Token', result.asset.watermarkToken],
                  ['SHA-256 Hash', result.asset.hash.slice(0, 32) + '…'],
                  ['HMAC Signature', result.asset.hmacSignature.slice(0, 32) + '…'],
                  ['Type', result.asset.type.toUpperCase()],
                  ['Status', 'ACTIVE'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--st-border-subtle)' }}>
                    <span className="text-xs" style={{ color: 'var(--st-text-secondary)' }}>{label}</span>
                    <span className="text-xs font-mono" style={{ color: 'var(--st-cyan)' }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Before / After Canvas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-card p-4">
                  <p className="text-xs font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--st-text-secondary)' }}><Eye size={14} />Original</p>
                  <canvas ref={originalCanvasRef} className="w-full rounded-lg" style={{ maxHeight: 300, objectFit: 'contain' }} />
                </div>
                <div className="glass-card p-4">
                  <p className="text-xs font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--st-cyan)' }}><Eye size={14} />Watermarked (DNA Embedded)</p>
                  <canvas ref={watermarkedCanvasRef} className="w-full rounded-lg" style={{ maxHeight: 300, objectFit: 'contain' }} />
                </div>
              </div>

              <div className="flex justify-center">
                <button onClick={() => { setStage('upload'); setFile(null); setResult(null); setProgress(0); }} className="btn-secondary">Watermark Another Asset</button>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}

function drawImageDataToCanvas(data: ImageData, canvas: HTMLCanvasElement | null, w: number, h: number) {
  if (!canvas) return;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(data, 0, 0);
}

function drawFrameToCanvas(data: ImageData, canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  canvas.width = data.width;
  canvas.height = data.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(data, 0, 0);
}
