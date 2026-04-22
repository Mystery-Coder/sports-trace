// ─── M1 Asset DNA Watermark — Zustand Store with Firestore Sync ─────────────
import { create } from 'zustand';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  Asset,
  DetectionPing,
  EnforcementAction,
  DashboardStats,
} from './types';

// ─── Store Interface ────────────────────────────────────────────────────────

interface SportTraceStore {
  // State
  assets: Asset[];
  pings: DetectionPing[];
  enforcements: EnforcementAction[];
  stats: DashboardStats;
  isLoading: boolean;
  isFirebaseConnected: boolean;

  // Actions
  addAsset: (asset: Asset) => Promise<void>;
  addPing: (ping: DetectionPing) => Promise<void>;
  addEnforcement: (action: EnforcementAction) => Promise<void>;
  updateEnforcementStatus: (id: string, status: EnforcementAction['status']) => Promise<void>;
  fetchAssets: () => Promise<void>;
  fetchPings: () => Promise<void>;
  fetchEnforcements: () => Promise<void>;
  subscribeToRealtime: () => () => void;
  computeStats: () => void;
}

// ─── Store Implementation ───────────────────────────────────────────────────

export const useSportTraceStore = create<SportTraceStore>((set, get) => ({
  assets: [],
  pings: [],
  enforcements: [],
  stats: {
    totalAssets: 0,
    totalPings: 0,
    totalEnforcements: 0,
    licensedViews: 0,
    unlicensedViews: 0,
    revenueGenerated: 0,
    activeAlerts: 0,
  },
  isLoading: false,
  isFirebaseConnected: false,

  // ─── Write asset to Firestore ─────────────────────────────────────────
  addAsset: async (asset: Asset) => {
    try {
      await setDoc(doc(db, 'assets', asset.id), {
        ...asset,
        createdAt: Timestamp.fromMillis(asset.createdAt),
      });
      set((state) => ({
        assets: [asset, ...state.assets],
      }));
      get().computeStats();
    } catch (error) {
      console.error('Failed to add asset to Firestore:', error);
      // Still update local state for demo
      set((state) => ({
        assets: [asset, ...state.assets],
      }));
      get().computeStats();
    }
  },

  // ─── Write detection ping to Firestore ────────────────────────────────
  addPing: async (ping: DetectionPing) => {
    try {
      await setDoc(doc(db, 'pings', ping.id), {
        ...ping,
        timestamp: Timestamp.fromMillis(ping.timestamp),
      });
      set((state) => ({
        pings: [ping, ...state.pings],
      }));
      get().computeStats();
    } catch (error) {
      console.error('Failed to add ping to Firestore:', error);
      set((state) => ({
        pings: [ping, ...state.pings],
      }));
      get().computeStats();
    }
  },

  // ─── Write enforcement action to Firestore ────────────────────────────
  addEnforcement: async (action: EnforcementAction) => {
    try {
      await setDoc(doc(db, 'enforcements', action.id), {
        ...action,
        createdAt: Timestamp.fromMillis(action.createdAt),
      });
      set((state) => ({
        enforcements: [action, ...state.enforcements],
      }));
      get().computeStats();
    } catch (error) {
      console.error('Failed to add enforcement to Firestore:', error);
      set((state) => ({
        enforcements: [action, ...state.enforcements],
      }));
      get().computeStats();
    }
  },

  // ─── Update enforcement status ────────────────────────────────────────
  updateEnforcementStatus: async (id: string, status: EnforcementAction['status']) => {
    try {
      await updateDoc(doc(db, 'enforcements', id), { status });
      set((state) => ({
        enforcements: state.enforcements.map((e) =>
          e.id === id ? { ...e, status } : e
        ),
      }));
    } catch (error) {
      console.error('Failed to update enforcement:', error);
      set((state) => ({
        enforcements: state.enforcements.map((e) =>
          e.id === id ? { ...e, status } : e
        ),
      }));
    }
  },

  // ─── Fetch all assets from Firestore ──────────────────────────────────
  fetchAssets: async () => {
    set({ isLoading: true });
    try {
      const q = query(collection(db, 'assets'), orderBy('createdAt', 'desc'), limit(100));
      const snapshot = await getDocs(q);
      const assets = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          createdAt: data.createdAt?.toMillis?.() || data.createdAt,
        } as Asset;
      });
      set({ assets, isLoading: false, isFirebaseConnected: true });
      get().computeStats();
    } catch (error) {
      console.error('Failed to fetch assets:', error);
      set({ isLoading: false });
    }
  },

  // ─── Fetch all pings from Firestore ───────────────────────────────────
  fetchPings: async () => {
    try {
      const q = query(collection(db, 'pings'), orderBy('timestamp', 'desc'), limit(200));
      const snapshot = await getDocs(q);
      const pings = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          timestamp: data.timestamp?.toMillis?.() || data.timestamp,
        } as DetectionPing;
      });
      set({ pings });
      get().computeStats();
    } catch (error) {
      console.error('Failed to fetch pings:', error);
    }
  },

  // ─── Fetch all enforcements from Firestore ────────────────────────────
  fetchEnforcements: async () => {
    try {
      const q = query(
        collection(db, 'enforcements'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      const snapshot = await getDocs(q);
      const enforcements = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          createdAt: data.createdAt?.toMillis?.() || data.createdAt,
        } as EnforcementAction;
      });
      set({ enforcements });
      get().computeStats();
    } catch (error) {
      console.error('Failed to fetch enforcements:', error);
    }
  },

  // ─── Real-time Firestore listeners ────────────────────────────────────
  subscribeToRealtime: () => {
    const unsubscribers: (() => void)[] = [];

    // Assets listener
    const assetsQuery = query(
      collection(db, 'assets'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    unsubscribers.push(
      onSnapshot(assetsQuery, (snapshot) => {
        const assets = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            ...data,
            id: d.id,
            createdAt: data.createdAt?.toMillis?.() || data.createdAt,
          } as Asset;
        });
        set({ assets, isFirebaseConnected: true });
        get().computeStats();
      })
    );

    // Pings listener
    const pingsQuery = query(
      collection(db, 'pings'),
      orderBy('timestamp', 'desc'),
      limit(200)
    );
    unsubscribers.push(
      onSnapshot(pingsQuery, (snapshot) => {
        const pings = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            ...data,
            id: d.id,
            timestamp: data.timestamp?.toMillis?.() || data.timestamp,
          } as DetectionPing;
        });
        set({ pings });
        get().computeStats();
      })
    );

    // Enforcements listener
    const enfQuery = query(
      collection(db, 'enforcements'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    unsubscribers.push(
      onSnapshot(enfQuery, (snapshot) => {
        const enforcements = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            ...data,
            id: d.id,
            createdAt: data.createdAt?.toMillis?.() || data.createdAt,
          } as EnforcementAction;
        });
        set({ enforcements });
        get().computeStats();
      })
    );

    return () => unsubscribers.forEach((fn) => fn());
  },

  // ─── Compute dashboard stats from current state ───────────────────────
  computeStats: () => {
    const { assets, pings, enforcements } = get();
    set({
      stats: {
        totalAssets: assets.length,
        totalPings: pings.length,
        totalEnforcements: enforcements.filter((e) => e.status !== 'completed').length,
        licensedViews: pings.filter((p) => p.isLicensed).length,
        unlicensedViews: pings.filter((p) => !p.isLicensed).length,
        revenueGenerated: enforcements
          .filter((e) => e.type === 'micro-license' && e.status === 'completed')
          .length * 2.99,
        activeAlerts: enforcements.filter(
          (e) => e.status === 'pending' || e.status === 'processing'
        ).length,
      },
    });
  },
}));
