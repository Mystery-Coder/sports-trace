'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Clock, Monitor, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import type { DetectionPing } from '@/lib/types';

interface DetectionFeedProps {
  pings: DetectionPing[];
  maxItems?: number;
}

const actionConfig = {
  log: {
    icon: CheckCircle,
    label: 'Licensed',
    badgeClass: 'badge-green',
    dotColor: 'var(--st-green)',
  },
  offer: {
    icon: AlertTriangle,
    label: 'License Offered',
    badgeClass: 'badge-amber',
    dotColor: 'var(--st-amber)',
  },
  dmca: {
    icon: XCircle,
    label: 'DMCA Queued',
    badgeClass: 'badge-red',
    dotColor: 'var(--st-red)',
  },
};

export default function DetectionFeed({ pings, maxItems = 20 }: DetectionFeedProps) {
  const displayPings = pings.slice(0, maxItems);

  if (displayPings.length === 0) {
    return (
      <div
        className="glass-card p-8 text-center"
      >
        <p className="text-sm" style={{ color: 'var(--st-text-secondary)' }}>
          No detections yet. Watermark a file and decode it to see pings appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {displayPings.map((ping) => {
          const config = actionConfig[ping.action];
          const ActionIcon = config.icon;
          const time = new Date(ping.timestamp);

          return (
            <motion.div
              key={ping.id}
              layout
              initial={{ opacity: 0, x: 30, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -30, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="glass-card p-4 flex items-center gap-4"
            >
              {/* Status dot */}
              <div className="relative flex-shrink-0">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: config.dotColor }}
                />
                <div
                  className="absolute inset-0 w-2.5 h-2.5 rounded-full animate-pulse-glow"
                  style={{ background: config.dotColor }}
                />
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-xs font-mono truncate"
                    style={{ color: 'var(--st-text-primary)' }}
                  >
                    {ping.assetId.slice(0, 8)}…
                  </span>
                  <span className={`badge ${config.badgeClass}`}>
                    <ActionIcon size={10} />
                    {config.label}
                  </span>
                </div>
                <div
                  className="flex items-center gap-3 text-[11px]"
                  style={{ color: 'var(--st-text-secondary)' }}
                >
                  <span className="flex items-center gap-1">
                    <MapPin size={10} />
                    {ping.gps.lat.toFixed(2)}, {ping.gps.lng.toFixed(2)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Monitor size={10} />
                    {ping.platform}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {time.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
