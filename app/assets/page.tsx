'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Database, Shield, Radio, Clock, FileImage, FileVideo, Search } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useSportTraceStore } from '@/lib/store';
import type { Asset } from '@/lib/types';

export default function AssetsPage() {
  const { assets, pings, fetchAssets, subscribeToRealtime } = useSportTraceStore();
  const [search, setSearch] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  useEffect(() => {
    fetchAssets();
    const unsub = subscribeToRealtime();
    return () => unsub();
  }, [fetchAssets, subscribeToRealtime]);

  const filtered = assets.filter(
    (a) => a.name.toLowerCase().includes(search.toLowerCase()) || a.id.includes(search) || a.watermarkToken.includes(search)
  );

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col">
        <Header title="Asset Registry" subtitle="Browse all watermarked assets stored in Firestore" />
        <div className="flex-1 p-8 space-y-6 relative z-10">

          {/* Search */}
          <div className="glass-card p-4 flex items-center gap-3">
            <Search size={18} style={{ color: 'var(--st-text-muted)' }} />
            <input
              type="text" placeholder="Search by name, ID, or token..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-sm"
              style={{ color: 'var(--st-text-primary)' }}
            />
            <span className="text-xs" style={{ color: 'var(--st-text-muted)' }}>{filtered.length} assets</span>
          </div>

          {/* Two-panel layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Asset list */}
            <div className="lg:col-span-2 space-y-3">
              {filtered.length === 0 ? (
                <div className="glass-card p-12 text-center">
                  <Database size={40} style={{ color: 'var(--st-text-muted)' }} className="mx-auto mb-4" />
                  <p className="text-sm" style={{ color: 'var(--st-text-secondary)' }}>
                    {assets.length === 0 ? 'No assets registered yet. Go to Embed Pipeline to watermark your first asset.' : 'No assets match your search.'}
                  </p>
                </div>
              ) : (
                filtered.map((asset, i) => {
                  const assetPings = pings.filter((p) => p.assetId === asset.id);
                  const isSelected = selectedAsset?.id === asset.id;
                  return (
                    <motion.div
                      key={asset.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`glass-card p-5 cursor-pointer transition-all ${isSelected ? '' : ''}`}
                      style={isSelected ? { borderColor: 'var(--st-cyan)', boxShadow: 'var(--st-glow-cyan)' } : {}}
                      onClick={() => setSelectedAsset(asset)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: asset.type === 'video' ? 'rgba(168, 85, 247, 0.12)' : 'rgba(0, 240, 255, 0.12)', border: `1px solid ${asset.type === 'video' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(0, 240, 255, 0.2)'}` }}>
                          {asset.type === 'video' ? <FileVideo size={20} style={{ color: 'var(--st-violet)' }} /> : <FileImage size={20} style={{ color: 'var(--st-cyan)' }} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--st-text-primary)' }}>{asset.name}</p>
                          <div className="flex items-center gap-3 mt-1 text-[11px]" style={{ color: 'var(--st-text-secondary)' }}>
                            <span className="font-mono">{asset.watermarkToken}</span>
                            <span>·</span>
                            <span>{(asset.fileSize / 1024 / 1024).toFixed(1)} MB</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-bold" style={{ color: 'var(--st-violet)' }}>{assetPings.length}</p>
                            <p className="text-[10px]" style={{ color: 'var(--st-text-muted)' }}>pings</p>
                          </div>
                          <span className={`badge ${asset.status === 'active' ? 'badge-green' : 'badge-red'}`}>{asset.status}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Detail panel */}
            <div>
              {selectedAsset ? (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-6 space-y-4 sticky top-8">
                  <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--st-text-primary)' }}>
                    <Shield size={16} style={{ color: 'var(--st-cyan)' }} />Asset Detail
                  </h3>
                  {[
                    ['Name', selectedAsset.name],
                    ['ID', selectedAsset.id.slice(0, 20) + '…'],
                    ['Type', selectedAsset.type.toUpperCase()],
                    ['Token', selectedAsset.watermarkToken],
                    ['Hash', selectedAsset.hash.slice(0, 24) + '…'],
                    ['HMAC', selectedAsset.hmacSignature.slice(0, 24) + '…'],
                    ['Size', (selectedAsset.fileSize / 1024 / 1024).toFixed(2) + ' MB'],
                    ['Created', new Date(selectedAsset.createdAt).toLocaleString()],
                    ['Status', selectedAsset.status.toUpperCase()],
                    ['Pings', pings.filter((p) => p.assetId === selectedAsset.id).length.toString()],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: 'var(--st-border-subtle)' }}>
                      <span className="text-xs" style={{ color: 'var(--st-text-secondary)' }}>{label}</span>
                      <span className="text-xs font-mono max-w-[160px] truncate" style={{ color: 'var(--st-cyan)' }}>{value}</span>
                    </div>
                  ))}

                  {/* Recent pings for this asset */}
                  <div className="mt-4">
                    <h4 className="text-xs font-semibold mb-2" style={{ color: 'var(--st-text-secondary)' }}>Recent Pings</h4>
                    {pings.filter((p) => p.assetId === selectedAsset.id).slice(0, 5).map((p) => (
                      <div key={p.id} className="flex items-center gap-2 py-1.5 text-[10px]" style={{ color: 'var(--st-text-muted)' }}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: p.isLicensed ? 'var(--st-green)' : 'var(--st-red)' }} />
                        <span>{new Date(p.timestamp).toLocaleTimeString()}</span>
                        <span>·</span>
                        <span>{p.platform}</span>
                      </div>
                    ))}
                    {pings.filter((p) => p.assetId === selectedAsset.id).length === 0 && (
                      <p className="text-[11px]" style={{ color: 'var(--st-text-muted)' }}>No pings yet</p>
                    )}
                  </div>
                </motion.div>
              ) : (
                <div className="glass-card p-8 text-center">
                  <Database size={32} style={{ color: 'var(--st-text-muted)' }} className="mx-auto mb-3" />
                  <p className="text-xs" style={{ color: 'var(--st-text-secondary)' }}>Select an asset to view details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
