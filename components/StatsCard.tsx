'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  variant: 'cyan' | 'violet' | 'green' | 'amber' | 'red';
  prefix?: string;
  suffix?: string;
}

const variantColors: Record<string, string> = {
  cyan: 'var(--st-cyan)',
  violet: 'var(--st-violet)',
  green: 'var(--st-green)',
  amber: 'var(--st-amber)',
  red: 'var(--st-red)',
};

export default function StatsCard({ label, value, icon: Icon, variant, prefix, suffix }: StatsCardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValue = useRef(0);

  // Animated counter
  useEffect(() => {
    const start = prevValue.current;
    const end = value;
    const duration = 800;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };

    animate();
    prevValue.current = value;
  }, [value]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`stat-card-${variant} rounded-2xl p-5 relative overflow-hidden`}
    >
      {/* Background glow */}
      <div
        className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20 blur-3xl"
        style={{ background: variantColors[variant] }}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-xs font-semibold tracking-wider uppercase"
            style={{ color: 'var(--st-text-secondary)' }}
          >
            {label}
          </span>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: `${variantColors[variant]}15`,
              border: `1px solid ${variantColors[variant]}30`,
            }}
          >
            <Icon size={16} style={{ color: variantColors[variant] }} />
          </div>
        </div>

        <p className="text-3xl font-bold tracking-tight" style={{ color: variantColors[variant] }}>
          {prefix}
          {displayValue.toLocaleString()}
          {suffix}
        </p>
      </div>
    </motion.div>
  );
}
