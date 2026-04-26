'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Cloud,
  Wind,
  Droplets,
  Newspaper,
  ArrowRight,
  Loader,
} from 'lucide-react';
import { DisruptionReport, WeatherSignal, NewsSignal } from '@/lib/disruption-types';

export default function DisruptionPage() {
  const router = useRouter();
  const [origin, setOrigin] = useState('Mumbai');
  const [destination, setDestination] = useState('Chennai');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DisruptionReport | null>(null);

  const handleAnalyse = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/disruption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          destination,
          routeId: `route-${Date.now()}`,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to analyse route: ${response.statusText}`);
      }

      const data = await response.json();
      setResult(data);
      localStorage.setItem('disruptionId', data.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An error occurred'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleComputeRoutes = () => {
    if (result) {
      localStorage.setItem('disruptionId', result.id);
      router.push('/routes');
    }
  };

  const getRiskColor = (score: number) => {
    if (score < 30) return 'text-green-500';
    if (score <= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getRiskBgColor = (score: number) => {
    if (score < 30) return 'bg-green-500/10 border-green-500/30';
    if (score <= 60) return 'bg-yellow-500/10 border-yellow-500/30';
    return 'bg-red-500/10 border-red-500/30';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <h1 className="text-4xl font-bold text-white flex items-center gap-3">
            <AlertTriangle size={32} className="text-cyan-400" />
            Disruption Early Warning
          </h1>
          <p className="text-slate-400">T-72hr pre-event logistics monitor</p>
        </motion.div>

        {/* Form Card */}
        {!result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-slate-700 rounded-lg p-8 bg-slate-800/40 backdrop-blur"
          >
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Origin City
                </label>
                <input
                  type="text"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50"
                  placeholder="e.g., Mumbai"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Destination City
                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50"
                  placeholder="e.g., Chennai"
                />
              </div>
            </div>

            <button
              onClick={handleAnalyse}
              disabled={loading}
              className="w-full px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition"
            >
              {loading ? (
                <>
                  <Loader size={20} className="animate-spin" />
                  Analysing...
                </>
              ) : (
                <>
                  Analyse Route
                </>
              )}
            </button>

            {error && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}
          </motion.div>
        )}

        {/* Results */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Risk Score Card */}
            <div
              className={`border rounded-lg p-8 backdrop-blur ${getRiskBgColor(result.riskScore)}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm mb-2">Risk Score</p>
                  <div className="flex items-center gap-4">
                    <div className={`text-6xl font-bold ${getRiskColor(result.riskScore)}`}>
                      {result.riskScore}
                    </div>
                    <div className="space-y-2">
                      <div className={`px-3 py-1 rounded-full text-sm font-semibold w-fit ${
                        result.riskLevel === 'LOW'
                          ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                          : result.riskLevel === 'MEDIUM'
                          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                          : 'bg-red-500/20 text-red-400 border border-red-500/50'
                      }`}>
                        {result.riskLevel}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-slate-900/50 rounded border border-slate-700">
                <p className="font-mono text-xs text-slate-300 leading-relaxed">
                  {/* {result.breakdown} */}
                </p>
              </div>
            </div>

            {/* Weather Cards */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Weather Conditions</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {result.weatherSignals.map((signal: WeatherSignal) => (
                  <div
                    key={signal.city}
                    className="border border-slate-700 rounded-lg p-6 bg-slate-800/40 backdrop-blur"
                  >
                    <h4 className="text-white font-semibold mb-4">{signal.city}</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Cloud size={18} className="text-blue-400" />
                        <span className="text-slate-300 text-sm">
                          {signal.tempC}°C, {signal.condition}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Droplets size={18} className="text-cyan-400" />
                        <span className="text-slate-300 text-sm">
                          {signal.rainMmPerHour}mm/hr
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Wind size={18} className="text-violet-400" />
                        <span className="text-slate-300 text-sm">
                          {signal.windKmh}km/h
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* News Signals */}
            {result.newsSignals.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">News Alerts</h3>
                <div className="space-y-3">
                  {result.newsSignals.map((signal: NewsSignal, idx: number) => (
                    <div
                      key={idx}
                      className="border border-slate-700 rounded-lg p-4 bg-slate-800/40 backdrop-blur flex items-start gap-4"
                    >
                      <Newspaper size={18} className="text-orange-400 flex-shrink-0 mt-1" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium mb-1">
                          {signal.headline}
                        </p>
                        <p className="text-slate-400 text-xs">
                          {signal.source} • Risk: {signal.riskPoints}pts
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setResult(null);
                  setError(null);
                }}
                className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition"
              >
                Analyse Different Route
              </button>
              <button
                onClick={handleComputeRoutes}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition"
              >
                Compute Alternative Routes
                <ArrowRight size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
