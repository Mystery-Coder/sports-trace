'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Upload,
  ScanSearch,
  ShieldAlert,
  Database,
  CloudLightning,
  Route,
  Camera,
  Globe,
  Fingerprint,
  Scan,
  Eye,
  BarChart3,
  Lock,
  Dna,
  AlertTriangle,
  MapPin,
} from 'lucide-react';

const modules = [
  {
    id: 'm1',
    label: 'Asset DNA Watermark',
    icon: Dna,
    enabled: true,
    children: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/embed', label: 'Embed Pipeline', icon: Upload },
      { href: '/decode', label: 'Decode & Ping', icon: ScanSearch },
      { href: '/enforce', label: 'Enforcement', icon: ShieldAlert },
      { href: '/assets', label: 'Asset Registry', icon: Database },
    ],
  },
  { id: 'm2', label: 'Disruption Warning', icon: CloudLightning, enabled: false },
  { id: 'm3', label: 'Dynamic Re-Routing', icon: Route, enabled: false },
  { id: 'm4', label: 'Photo Rights', icon: Camera, enabled: false },
  { id: 'm5', label: 'Territory Geo-Fence', icon: Globe, enabled: false },
  { id: 'm6', label: 'NFT Registry', icon: Fingerprint, enabled: false },
  { id: 'm7', label: 'Piracy Tracer', icon: Scan, enabled: false },
  { id: 'm8', label: 'Dark Web Monitor', icon: Eye, enabled: false },
  { id: 'm9', label: 'Velocity Anomaly', icon: BarChart3, enabled: false },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="glass-card-static flex flex-col w-[260px] min-h-screen p-4 gap-2"
      style={{ borderRadius: 0, borderLeft: 'none', borderTop: 'none', borderBottom: 'none' }}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 px-3 py-4 mb-2">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, var(--st-cyan), var(--st-violet))',
          }}
        >
          <Dna size={20} color="#050a12" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight" style={{ color: 'var(--st-text-primary)' }}>
            SportTrace
          </h1>
          <p className="text-[10px] font-medium tracking-widest uppercase" style={{ color: 'var(--st-text-muted)' }}>
            Asset DNA
          </p>
        </div>
      </Link>

      {/* M1 Navigation */}
      <div className="mb-4">
        <p
          className="px-3 mb-2 text-[10px] font-semibold tracking-widest uppercase"
          style={{ color: 'var(--st-cyan-dim)' }}
        >
          M1 — Watermark
        </p>
        <nav className="flex flex-col gap-1">
          {modules[0].children!.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Pre-Event Navigation */}
      <div className="mb-4">
        <p
          className="px-3 mb-2 text-[10px] font-semibold tracking-widest uppercase"
          style={{ color: 'var(--st-cyan-dim)' }}
        >
          Pre-Event (M2·M3)
        </p>
        <nav className="flex flex-col gap-1">
          {[
            { href: '/disruption', label: 'Disruption Monitor', icon: AlertTriangle },
            { href: '/routes', label: 'Route Alternatives', icon: MapPin },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Divider */}
      <div className="h-px mx-3 mb-3" style={{ background: 'var(--st-border-subtle)' }} />

      {/* Other Modules — Locked */}
      <p
        className="px-3 mb-2 text-[10px] font-semibold tracking-widest uppercase"
        style={{ color: 'var(--st-text-muted)' }}
      >
        Modules
      </p>
      <nav className="flex flex-col gap-1">
        {modules.slice(1).map((mod) => {
          const Icon = mod.icon;
          return (
            <div
              key={mod.id}
              className="sidebar-link disabled"
            >
              <Icon size={18} />
              <span className="flex-1">{mod.label}</span>
              <Lock size={12} style={{ color: 'var(--st-text-muted)' }} />
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto pt-4">
        <div
          className="px-3 py-3 rounded-lg text-center"
          style={{
            background: 'rgba(0, 240, 255, 0.04)',
            border: '1px solid rgba(0, 240, 255, 0.08)',
          }}
        >
          <p className="text-[11px] font-medium" style={{ color: 'var(--st-text-secondary)' }}>
            Google Solutions Challenge
          </p>
          <p className="text-[10px] mt-1" style={{ color: 'var(--st-text-muted)' }}>
            April 2026
          </p>
        </div>
      </div>
    </aside>
  );
}
