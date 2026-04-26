'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, MapPin, Clock, Monitor, CheckCircle, Send, DollarSign, FileWarning } from 'lucide-react';

import Header from '@/components/Header';
import { useSportTraceStore } from '@/lib/store';
import type { EnforcementAction } from '@/lib/types';

const severityConfig = {
  low: { badge: 'badge-green', label: 'Low' },
  medium: { badge: 'badge-amber', label: 'Medium' },
  high: { badge: 'badge-red', label: 'High' },
  critical: { badge: 'badge-red', label: 'Critical' },
};

const typeConfig = {
  dmca: { icon: FileWarning, label: 'DMCA Takedown', color: 'var(--st-red)' },
  'micro-license': { icon: DollarSign, label: 'Micro-License Offer', color: 'var(--st-amber)' },
  suspension: { icon: ShieldAlert, label: 'Account Suspension', color: 'var(--st-red)' },
  log: { icon: CheckCircle, label: 'Logged', color: 'var(--st-green)' },
};

const statusColors: Record<string, string> = {
  pending: 'var(--st-amber)',
  processing: 'var(--st-cyan)',
  completed: 'var(--st-green)',
  failed: 'var(--st-red)',
};

export default function EnforcePage() {
  const { enforcements, fetchEnforcements, subscribeToRealtime, updateEnforcementStatus } = useSportTraceStore();

  useEffect(() => {
    fetchEnforcements();
    const unsub = subscribeToRealtime();
    return () => unsub();
  }, [fetchEnforcements, subscribeToRealtime]);

  const pending = enforcements.filter((e) => e.status === 'pending' || e.status === 'processing');
  const completed = enforcements.filter((e) => e.status === 'completed' || e.status === 'failed');

  const handleAction = async (id: string, action: 'process' | 'complete' | 'dismiss') => {
    if (action === 'process') await updateEnforcementStatus(id, 'processing');
    else if (action === 'complete') await updateEnforcementStatus(id, 'completed');
    else await updateEnforcementStatus(id, 'failed');
  };

  return (
    <div className="flex min-h-screen">
      
      <main className="flex-1 flex flex-col">
        <Header title="Enforcement Queue" subtitle="DMCA takedowns · Micro-license offers · Cloud Tasks simulation" />
        <div className="flex-1 p-8 space-y-8 relative z-10">

          {/* Summary strip */}
          <div className="flex gap-4">
            {[
              { label: 'Pending', count: pending.length, color: 'var(--st-amber)' },
              { label: 'Completed', count: completed.filter(e => e.status === 'completed').length, color: 'var(--st-green)' },
              { label: 'Failed', count: completed.filter(e => e.status === 'failed').length, color: 'var(--st-red)' },
            ].map((s) => (
              <div key={s.label} className="glass-card px-5 py-3 flex items-center gap-3">
                <div className="w-2 h-8 rounded-full" style={{ background: s.color }} />
                <div>
                  <p className="text-2xl font-bold" style={{ color: s.color }}>{s.count}</p>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--st-text-secondary)' }}>{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Pending Queue */}
          <div>
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--st-text-primary)' }}>
              Active Queue ({pending.length})
            </h3>
            {pending.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <p className="text-sm" style={{ color: 'var(--st-text-secondary)' }}>
                  No pending enforcement actions. Decode a watermarked asset to generate detections.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {pending.map((item) => (
                    <EnforcementCard key={item.id} item={item} onAction={handleAction} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Completed */}
          {completed.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--st-text-secondary)' }}>
                History ({completed.length})
              </h3>
              <div className="space-y-2 opacity-60">
                {completed.map((item) => (
                  <EnforcementCard key={item.id} item={item} onAction={handleAction} isHistory />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function EnforcementCard({ item, onAction, isHistory }: { item: EnforcementAction; onAction: (id: string, action: 'process' | 'complete' | 'dismiss') => void; isHistory?: boolean }) {
  const type = typeConfig[item.type];
  const severity = severityConfig[item.severity];
  const TypeIcon = type.icon;
  const time = new Date(item.createdAt);

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30 }} className="glass-card p-5">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${type.color}15`, border: `1px solid ${type.color}30` }}>
          <TypeIcon size={20} style={{ color: type.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: 'var(--st-text-primary)' }}>{type.label}</span>
            <span className={`badge ${severity.badge}`}>{severity.label}</span>
            <span className="badge" style={{ background: `${statusColors[item.status]}15`, color: statusColors[item.status], border: `1px solid ${statusColors[item.status]}30` }}>
              {item.status.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] mb-2" style={{ color: 'var(--st-text-secondary)' }}>
            <span className="font-mono">Asset: {item.assetId.slice(0, 8)}…</span>
            <span className="flex items-center gap-1"><MapPin size={10} />{item.evidence.gps.lat.toFixed(2)}, {item.evidence.gps.lng.toFixed(2)}</span>
            <span className="flex items-center gap-1"><Monitor size={10} />{item.evidence.platform}</span>
            <span className="flex items-center gap-1"><Clock size={10} />{time.toLocaleString()}</span>
          </div>
        </div>
        {!isHistory && (
          <div className="flex gap-2 flex-shrink-0">
            {item.status === 'pending' && (
              <button onClick={() => onAction(item.id, 'process')} className="btn-primary text-xs px-3 py-2">
                <Send size={12} />{item.type === 'dmca' ? 'Send DMCA' : 'Send Offer'}
              </button>
            )}
            {item.status === 'processing' && (
              <button onClick={() => onAction(item.id, 'complete')} className="btn-primary text-xs px-3 py-2">
                <CheckCircle size={12} />Complete
              </button>
            )}
            <button onClick={() => onAction(item.id, 'dismiss')} className="btn-secondary text-xs px-3 py-2">Dismiss</button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
