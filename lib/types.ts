// ─── M1 Asset DNA Watermark — Type Definitions ─────────────────────────────

export interface Asset {
  id: string;
  name: string;
  owner: string;
  type: 'image' | 'video';
  watermarkToken: string;
  hash: string;
  hmacSignature: string;
  originalUrl: string;
  watermarkedUrl: string;
  thumbnailUrl?: string;
  fileSize: number;
  createdAt: number;
  pingCount: number;
  status: 'active' | 'suspended' | 'revoked';
}

export interface DetectionPing {
  id: string;
  assetId: string;
  watermarkToken: string;
  timestamp: number;
  gps: {
    lat: number;
    lng: number;
  };
  platform: string;
  userAgent: string;
  ipAddress: string;
  action: 'log' | 'offer' | 'dmca';
  isLicensed: boolean;
}

export interface EnforcementAction {
  id: string;
  assetId: string;
  pingId: string;
  type: 'dmca' | 'micro-license' | 'suspension' | 'log';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence: {
    timestamp: number;
    gps: { lat: number; lng: number };
    platform: string;
    screenshotUrl?: string;
  };
  createdAt: number;
  completedAt?: number;
}

export interface LicenseOffer {
  id: string;
  assetId: string;
  pingId: string;
  price: number;
  currency: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  offerUrl: string;
  expiresAt: number;
  createdAt: number;
}

export interface DashboardStats {
  totalAssets: number;
  totalPings: number;
  totalEnforcements: number;
  licensedViews: number;
  unlicensedViews: number;
  revenueGenerated: number;
  activeAlerts: number;
}

export interface WatermarkResult {
  success: boolean;
  assetId: string;
  token: string;
  hash: string;
  watermarkedData: Blob | null;
  embedTimeMs: number;
}

export interface DecodeResult {
  success: boolean;
  token: string | null;
  assetId: string | null;
  confidence: number;
  decodeTimeMs: number;
}
