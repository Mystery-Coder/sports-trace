'use client';

import { Wifi, WifiOff, Bell } from 'lucide-react';
import { useSportTraceStore } from '@/lib/store';

export default function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const { isFirebaseConnected, stats } = useSportTraceStore();

  return (
    <header
      className="flex items-center justify-between px-8 py-4 border-b"
      style={{
        borderColor: 'var(--st-border-subtle)',
        background: 'rgba(5, 10, 18, 0.8)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div>
        <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--st-text-primary)' }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm mt-0.5" style={{ color: 'var(--st-text-secondary)' }}>
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Active alerts badge */}
        {stats.activeAlerts > 0 && (
          <div className="relative">
            <Bell size={20} style={{ color: 'var(--st-amber)' }} />
            <span
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
              style={{ background: 'var(--st-red)', color: 'white' }}
            >
              {stats.activeAlerts}
            </span>
          </div>
        )}

        {/* Firebase connection status */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{
            background: isFirebaseConnected
              ? 'rgba(34, 197, 94, 0.1)'
              : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${
              isFirebaseConnected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'
            }`,
            color: isFirebaseConnected ? 'var(--st-green)' : 'var(--st-red)',
          }}
        >
          {isFirebaseConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
          {isFirebaseConnected ? 'Firestore Connected' : 'Offline Mode'}
        </div>
      </div>
    </header>
  );
}
