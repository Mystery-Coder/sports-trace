'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader, Truck, Plane, Ship } from 'lucide-react';
import { RouteAlternative } from '@/lib/disruption-types';



export default function RoutesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RouteAlternative | null>(null);
  const [recommendedRouteId, setRecommendedRouteId] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  const handleSelectRoute = (route: any) => {
  // 1. Save to localStorage
  localStorage.setItem('selectedRoute', JSON.stringify(route));

  // 2. Update selected state
  setSelectedRouteId(route.id);

  // 3. Show banner
  setShowBanner(true);

  // 4. Auto dismiss after 4 sec
  setTimeout(() => {
    setShowBanner(false);
  }, 4000);
};

  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const disruptionId = localStorage.getItem('disruptionId');

        if (!disruptionId) {
          setError('No disruption ID found. Please analyse a route first.');
          setLoading(false);
          return;
        }

        const response = await fetch('/api/reroute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            disruptionId,
            origin: 'Mumbai',
            destination: 'Chennai',
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch routes: ${response.statusText}`);
        }

        const data = await response.json();
        setResult(data);

        // Calculate best cost/time balance
        let bestRouteId = data.routes[0].id;
        let bestScore = Infinity;

        for (const route of data.routes) {
          const score = route.costUSD / 3200 + route.durationHours / 36;
          if (score < bestScore) {
            bestScore = score;
            bestRouteId = route.id;
          }
        }

        setRecommendedRouteId(bestRouteId);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load routes'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRoutes();
  }, []);

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'road':
        return <Truck size={24} className="text-yellow-400" />;
      case 'air':
        return <Plane size={24} className="text-blue-400" />;
      case 'sea':
        return <Ship size={24} className="text-cyan-400" />;
      default:
        return null;
    }
  };

  const getModeName = (mode: string) => {
    switch (mode) {
      case 'road':
        return 'Road Convoy';
      case 'air':
        return 'Air Freight';
      case 'sea':
        return 'Coastal Shipping';
      default:
        return mode;
    }
  };

  const getRecommendedRouteName = () => {
    if (!result || !recommendedRouteId) return null;
    const route = result.routes.find((r) => r.id === recommendedRouteId);
    return route?.name || null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <h1 className="text-4xl font-bold text-white">Alternative Routes</h1>
          <p className="text-slate-400">AI-powered logistics optimization</p>
        </motion.div>

        {/* Loading State */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 gap-4"
          >
            <Loader size={40} className="text-cyan-400 animate-spin" />
            <p className="text-slate-300">
              Groq is generating route explanations...
            </p>
            <p className="text-slate-500 text-sm">This takes 3-5 seconds</p>
          </motion.div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Route Cards */}
        {result && !loading && (
          <>
            {showBanner && selectedRouteId && (
            <div className="mb-4 p-3 rounded-lg bg-green-900/30 border border-green-500 text-green-300 text-sm">
                ✓ {result.routes.find(r => r.id === selectedRouteId)?.name} selected — logistics team notified
            </div>
            )}
            <div className="grid md:grid-cols-3 gap-6">
              {result.routes.map((route, idx) => {
                const explanation = result.groqExplanations.find(
                  (e) => e.routeId === route.id
                )?.explanation;
                const isRecommended = route.id === recommendedRouteId;

                return (
                  <motion.div
                    key={route.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`border rounded-lg p-6 backdrop-blur transition-all ${
                    selectedRouteId === route.id
                        ? 'border-green-500 ring-2 ring-green-400 bg-green-500/5'
                        : selectedRouteId
                        ? 'opacity-50 border-slate-700 bg-slate-800/40'
                        : isRecommended
                        ? 'border-cyan-500/50 bg-cyan-500/5 ring-1 ring-cyan-500/20'
                        : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
                    }`}
                  >
                    {/* Route Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {getModeIcon(route.mode)}
                        <div>
                          <h3 className="text-white font-semibold">
                            {route.name}
                          </h3>
                          <p className="text-slate-400 text-sm">
                            {getModeName(route.mode)}
                          </p>
                        </div>
                      </div>
                      {isRecommended && (
                        <div className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-400 text-xs font-semibold border border-cyan-500/50">
                          RECOMMENDED
                        </div>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex gap-2 mb-4">
                      <div className="px-3 py-1 rounded bg-slate-700/50 text-slate-300 text-xs font-medium">
                        {route.distanceKm}km
                      </div>
                      <div className="px-3 py-1 rounded bg-slate-700/50 text-slate-300 text-xs font-medium">
                        {route.durationHours}hrs
                      </div>
                    </div>

                    {/* Cost */}
                    <div className="mb-4">
                      <p className="text-slate-400 text-xs mb-1">Total Cost</p>
                      <p className="text-2xl font-bold text-cyan-400">
                        ${route.costUSD}
                      </p>
                    </div>

                    {/* Explanation */}
                    <div className="mb-6 p-4 border-l-2 border-slate-600 bg-slate-900/50 rounded">
                      <p className="text-slate-300 text-sm italic leading-relaxed">
                        "{explanation}"
                      </p>
                    </div>

                    {/* Select Button */}
                    <button className="w-full px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-medium rounded transition"
                    onClick={() => handleSelectRoute(route)}>
                      {selectedRouteId === route.id ? "Selected ✓" : "Select Route"}
                    </button>
                  </motion.div>
                );
              })}
            </div>

            {/* Recommendation Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="border border-cyan-500/30 rounded-lg p-6 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 backdrop-blur"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                <p className="text-slate-400 text-sm font-medium">
                  M3 Decision Engine
                </p>
              </div>
              <p className="text-white text-lg font-semibold">
                Route{' '}
                <span className="text-cyan-400">
                  {getRecommendedRouteName()}
                </span>{' '}
                recommended
              </p>
              <p className="text-slate-400 text-sm mt-2">
                Best cost/time balance for sports broadcast logistics
              </p>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
