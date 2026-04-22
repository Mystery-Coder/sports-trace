'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * Animated DNA helix visualization representing the spread-spectrum watermark.
 * Pure CSS/SVG animation — no external dependencies.
 */
export default function WatermarkVisualizer({ isActive = false }: { isActive?: boolean }) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const strandCount = 12;
  const height = 200;

  if (!mounted) {
    return <div className="dna-helix flex items-center justify-center" style={{ height }} />;
  }

  return (
    <div className="dna-helix flex items-center justify-center" style={{ height }}>
      <motion.div
        className="dna-strand relative"
        style={{ width: 80, height }}
        animate={isActive ? { rotateY: 360 } : { rotateY: 0 }}
        transition={isActive ? { duration: 6, repeat: Infinity, ease: 'linear' } : {}}
      >
        {Array.from({ length: strandCount }).map((_, i) => {
          const y = (i / (strandCount - 1)) * (height - 20) + 10;
          const phase = (i / strandCount) * Math.PI * 2;
          const x1 = 20 + Math.sin(phase) * 20;
          const x2 = 60 - Math.sin(phase) * 20;
          const opacity = 0.3 + Math.abs(Math.sin(phase)) * 0.7;

          return (
            <motion.div
              key={i}
              className="absolute"
              style={{ top: y, left: 0, width: '100%', height: 2 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: isActive ? opacity : 0.3 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
            >
              {/* Left node */}
              <div
                className="absolute w-3 h-3 rounded-full"
                style={{
                  left: x1,
                  top: -4,
                  background: isActive ? 'var(--st-cyan)' : 'var(--st-text-muted)',
                  boxShadow: isActive ? '0 0 8px var(--st-cyan)' : 'none',
                  transition: 'all 0.4s ease',
                }}
              />
              {/* Bridge */}
              <div
                className="absolute h-px"
                style={{
                  left: x1 + 6,
                  width: x2 - x1 - 6,
                  top: -1,
                  background: isActive
                    ? 'linear-gradient(90deg, var(--st-cyan), var(--st-violet))'
                    : 'var(--st-border-glass)',
                  transition: 'all 0.4s ease',
                }}
              />
              {/* Right node */}
              <div
                className="absolute w-3 h-3 rounded-full"
                style={{
                  left: x2,
                  top: -4,
                  background: isActive ? 'var(--st-violet)' : 'var(--st-text-muted)',
                  boxShadow: isActive ? '0 0 8px var(--st-violet)' : 'none',
                  transition: 'all 0.4s ease',
                }}
              />
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
