'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Radio, ShieldAlert, Eye, EyeOff, DollarSign, AlertCircle, Dna, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import StatsCard from '@/components/StatsCard';
import DetectionFeed from '@/components/DetectionFeed';
import WatermarkVisualizer from '@/components/WatermarkVisualizer';
import { useSportTraceStore } from '@/lib/store';

export default function Dashboard() {
  const { stats, pings, fetchAssets, fetchPings, fetchEnforcements, subscribeToRealtime } = useSportTraceStore();

  useEffect(() => {
    fetchAssets();
    fetchPings();
    fetchEnforcements();
    const unsub = subscribeToRealtime();
    return () => unsub();
  }, [fetchAssets, fetchPings, fetchEnforcements, subscribeToRealtime]);

  const quickActions = [
    { href: '/embed', title: 'Embed Watermark', desc: 'Upload and protect a new asset', color: 'var(--st-cyan)' },
    { href: '/decode', title: 'Decode & Detect', desc: 'Scan media for hidden watermarks', color: 'var(--st-violet)' },
    { href: '/enforce', title: 'Enforcement Queue', desc: 'Manage DMCA and license actions', color: 'var(--st-red)' },
    { href: '/assets', title: 'Asset Registry', desc: 'Browse all protected assets', color: 'var(--st-green)' },
  ];

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col">
        <Header title="M1 — Asset DNA Watermark" subtitle="Real-time digital asset protection dashboard" />
        <div className="flex-1 p-8 space-y-8 relative z-10">
          {/* Hero */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 flex items-center gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--st-cyan), var(--st-violet))' }}>
                  <Dna size={22} color="#050a12" strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: 'var(--st-text-primary)' }}>SportTrace Asset DNA</h2>
                  <p className="text-xs" style={{ color: 'var(--st-text-secondary)' }}>Every stolen copy identifies itself</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--st-text-secondary)' }}>
                Invisible spread-spectrum watermarks survive re-encoding, screen recording, 50% crop, and compression. Content self-reports its location — no crawlers needed.
              </p>
              <div className="flex gap-3">
                <Link href="/embed" className="btn-primary"><Shield size={16} />Watermark Asset</Link>
                <Link href="/decode" className="btn-secondary"><Radio size={16} />Decode & Ping</Link>
              </div>
            </div>
            <div className="hidden lg:block"><WatermarkVisualizer isActive={true} /></div>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
            <StatsCard label="Protected" value={stats.totalAssets} icon={Shield} variant="cyan" />
            <StatsCard label="Pings" value={stats.totalPings} icon={Radio} variant="violet" />
            <StatsCard label="Enforcements" value={stats.totalEnforcements} icon={ShieldAlert} variant="red" />
            <StatsCard label="Licensed" value={stats.licensedViews} icon={Eye} variant="green" />
            <StatsCard label="Unlicensed" value={stats.unlicensedViews} icon={EyeOff} variant="amber" />
            <StatsCard label="Revenue" value={stats.revenueGenerated} icon={DollarSign} variant="green" prefix="$" />
            <StatsCard label="Alerts" value={stats.activeAlerts} icon={AlertCircle} variant="red" />
          </div>

          {/* Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--st-text-primary)' }}>Live Detection Feed</h3>
                <span className="badge badge-cyan"><span className="w-1.5 h-1.5 rounded-full animate-pulse-glow" style={{ background: 'var(--st-cyan)' }} />Real-time</span>
              </div>
              <DetectionFeed pings={pings} maxItems={10} />
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--st-text-primary)' }}>Quick Actions</h3>
              {quickActions.map((a) => (
                <Link key={a.href} href={a.href}>
                  <motion.div whileHover={{ x: 4 }} className="glass-card p-4 flex items-center gap-4 cursor-pointer">
                    <div className="w-2 h-10 rounded-full flex-shrink-0" style={{ background: a.color }} />
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: 'var(--st-text-primary)' }}>{a.title}</p>
                      <p className="text-xs" style={{ color: 'var(--st-text-secondary)' }}>{a.desc}</p>
                    </div>
                    <ArrowRight size={16} style={{ color: 'var(--st-text-muted)' }} />
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
