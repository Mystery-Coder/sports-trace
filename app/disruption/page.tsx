'use client';

import { useState, useEffect, useRef } from 'react';
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
import { fetchNewsSignals } from '@/lib/serper-news';

function RiskGauge({ score, level }: { score: number; level: 'LOW' | 'MEDIUM' | 'HIGH' }) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const increment = score / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= score) {
        setAnimatedScore(score);
        clearInterval(timer);
      } else {
        setAnimatedScore(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [score]);

  // SVG semicircle gauge
  const radius = 80;
  const circumference = Math.PI * radius;
  const progress = (animatedScore / 100) * circumference;

  const color =
    level === 'LOW' ? '#22c55e' :
    level === 'MEDIUM' ? '#f59e0b' :
    '#ef4444';

  const levelBg =
    level === 'LOW' ? 'rgba(34,197,94,0.1)' :
    level === 'MEDIUM' ? 'rgba(245,158,11,0.1)' :
    'rgba(239,68,68,0.1)';

  return (
    <div className="flex flex-col items-center justify-center py-4">
      <div className="relative" style={{ width: 200, height: 110 }}>
        <svg width="200" height="110" viewBox="0 0 200 110">
          {/* Background arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="16"
            strokeLinecap="round"
          />
          {/* Animated foreground arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={color}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={`${progress} ${circumference}`}
            style={{ transition: 'stroke-dasharray 0.05s linear, stroke 0.5s ease' }}
          />
          {/* Score text */}
          <text
            x="100"
            y="85"
            textAnchor="middle"
            fontSize="32"
            fontWeight="bold"
            fill={color}
          >
            {animatedScore}
          </text>
          <text
            x="100"
            y="105"
            textAnchor="middle"
            fontSize="11"
            fill="rgba(255,255,255,0.4)"
          >
            / 100
          </text>
        </svg>
      </div>

      {/* Level badge */}
      <div
        className="mt-2 px-4 py-1.5 rounded-full text-sm font-bold border"
        style={{
          color,
          backgroundColor: levelBg,
          borderColor: color + '50',
        }}
      >
        {level} RISK
      </div>

      {/* Breakdown */}
    </div>
  );
}

export default function DisruptionPage() {
  const router = useRouter();
  const [origin, setOrigin] = useState('Mumbai');
  const [destination, setDestination] = useState('Chennai');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DisruptionReport | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const monitorIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [forecastDate, setForecastDate] = useState<string>('');

  const handleAnalyse = async () => {
    setLoading(true);
    setError(null);

    try {
      const newsSignals = await fetchNewsSignals(origin, destination);
      const response = await fetch('/api/disruption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          destination,
          routeId: `${origin}-${destination}`.toLowerCase(),
          newsSignals, // pass them in directly
          forecastDate: forecastDate || undefined,
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

  const startMonitoring = () => {
  if (isMonitoring) {
    // Stop monitoring
    if (monitorIntervalRef.current) {
      clearInterval(monitorIntervalRef.current);
      monitorIntervalRef.current = null;
    }
    setIsMonitoring(false);
    return;
  }

  // Start monitoring — re-analyse every 60 seconds
  setIsMonitoring(true);
  monitorIntervalRef.current = setInterval(async () => {
    await handleAnalyse(); // calls your existing analyse function
    setLastUpdated(new Date().toLocaleTimeString());
  }, 60000);
};

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (monitorIntervalRef.current) {
      clearInterval(monitorIntervalRef.current);
    }
  };
}, []);

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

      
        {/* Route Input */}
<div className="border border-slate-700 rounded-lg p-6 bg-slate-800/40 space-y-4">
  <h2 className="text-white font-semibold text-sm">Route Configuration</h2>
  
  <div className="grid grid-cols-2 gap-4">
    {/* Origin */}
    <div className="space-y-2">
      <label className="text-slate-400 text-xs">Origin City</label>
      <input
        type="text"
        value={origin}
        onChange={(e) => setOrigin(e.target.value)}
        placeholder="e.g. Mumbai"
        className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
      />
    </div>

    {/* Destination */}
    <div className="space-y-2">
      <label className="text-slate-400 text-xs">Destination City</label>
      <input
        type="text"
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
        placeholder="e.g. Chennai"
        className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
      />
    </div>
  </div>
  {/* Forecast Date Picker */}
<div className="space-y-2">
  <label className="text-slate-400 text-xs flex items-center gap-2">
    Forecast Date
    <span className="text-cyan-400 text-xs font-medium">
      T-72hr simulation
    </span>
  </label>

  <div className="flex items-center gap-3">
    <input
      type="date"
      value={forecastDate}
      min={new Date().toISOString().split('T')[0]}
      max={new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0]}
      onChange={(e) => setForecastDate(e.target.value)}
      className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm"
    />

    {forecastDate && (
      <button
        onClick={() => setForecastDate('')}
        className="text-slate-500 text-xs px-3 py-2 border border-slate-600 rounded"
      >
        Use current
      </button>
    )}
  </div>

  <p className="text-slate-600 text-xs">
    {forecastDate
      ? `Showing forecast for ${new Date(forecastDate).toLocaleDateString('en-IN')}`
      : 'Using current weather'}
  </p>
</div>

  {/* Quick presets */}
  <div className="space-y-1">
    <p className="text-slate-500 text-xs">Quick presets:</p>
    <div className="flex flex-wrap gap-2">
      {[
        { from: 'Mumbai', to: 'Chennai' },
        { from: 'Delhi', to: 'Kolkata' },
        { from: 'Bangalore', to: 'Hyderabad' },
        { from: 'Mumbai', to: 'Delhi' },
        { from: 'Chennai', to: 'Kolkata' },
      ].map((preset) => (
        <button
          key={`${preset.from}-${preset.to}`}
          onClick={() => {
            setOrigin(preset.from);
            setDestination(preset.to);
          }}
          className="px-3 py-1 rounded-full text-xs border border-slate-600 text-slate-400 hover:border-cyan-500 hover:text-cyan-400 transition"
        >
          {preset.from} → {preset.to}
        </button>
      ))}
    </div>
  </div>

  {/* Button row */}
  <div className="flex gap-3 pt-1">
    <button
      onClick={handleAnalyse}
      disabled={loading || !origin || !destination}
      className="flex-1 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded transition"
    >
      {loading ? 'Analysing...' : 'Analyse Route'}
    </button>

    <button
      onClick={startMonitoring} 
      disabled={!result}
      className={`flex items-center gap-2 px-4 py-2.5 rounded font-semibold text-sm transition border ${
        isMonitoring
          ? 'bg-green-500/10 border-green-500 text-green-400 hover:bg-green-500/20'
          : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500 disabled:opacity-40'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
      {isMonitoring ? 'Monitoring...' : 'Monitor Live'}
    </button>
  </div>

  {isMonitoring && lastUpdated && (
    <p className="text-slate-500 text-xs">
      Last updated: {lastUpdated} · Next update in 60s
    </p>
  )}
</div>

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
              <RiskGauge score={result.riskScore} level={result.riskLevel} />

              <div className="mt-6 p-4 bg-slate-900/50 rounded border border-slate-700">
                <p className="font-mono text-xs text-slate-300 leading-relaxed">
                  {/* {result.breakdown} */}
                </p>
              </div>
            </div>
            {result.weatherSignals.length > 0 && forecastDate && (
  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 w-fit">
    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
    <p className="text-cyan-400 text-xs font-medium">
      Forecast mode — {new Date(forecastDate).toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long'
      })}
    </p>
  </div>
)}

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
                      <div className="flex items-center gap-2 text-sm">
  <span style={{ color: 'var(--st-cyan)' }}>💧</span>
  <span>{signal.humidity}% humidity</span>
</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* News Signals Feed */}
            {result.newsSignals.length > 0 && (
              <div className="border border-slate-700 rounded-lg p-6 bg-slate-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                    News Risk Signals
                  </h3>
                  <span className="text-xs text-slate-500">
                    {result.newsSignals.length} article{result.newsSignals.length !== 1 ? 's' : ''} found
                  </span>
                </div>

                {/* Scrollable feed */}
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {result.newsSignals.map((signal, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border transition ${
                        signal.riskPoints >= 15
                          ? 'border-red-500/30 bg-red-500/5'
                          : 'border-slate-700 bg-slate-900/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-white text-xs leading-relaxed flex-1">
                          {signal.headline}
                        </p>
                        <span
                          className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium border ${
                            signal.riskPoints >= 15
                              ? 'bg-red-500/20 text-red-400 border-red-500/30'
                              : 'bg-slate-700 text-slate-400 border-slate-600'
                          }`}
                        >
                          +{signal.riskPoints}pts
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-slate-500 text-xs">{signal.source}</span>
                        <span className="text-slate-700 text-xs">·</span>
                        <span className="text-slate-500 text-xs">
                          {new Date(signal.publishedAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {signal.riskPoints >= 15 && (
                          <>
                            <span className="text-slate-700 text-xs">·</span>
                            <span className="text-red-400 text-xs font-medium">⚠ Risk keyword detected</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total news risk contribution */}
                <div className="pt-2 border-t border-slate-700 flex items-center justify-between">
                  <span className="text-slate-400 text-xs">Total news risk contribution</span>
                  <span className="text-yellow-400 text-xs font-bold">
                    +{Math.min(result.newsSignals.reduce((sum, s) => sum + s.riskPoints, 0), 45)}pts
                    {result.newsSignals.reduce((sum, s) => sum + s.riskPoints, 0) > 45 && (
                      <span className="text-slate-500 font-normal"> (capped at 45)</span>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Empty state */}
            {result.newsSignals.length === 0 && (
              <div className="border border-slate-700 rounded-lg p-6 bg-slate-800/40 text-center">
                <p className="text-slate-500 text-sm">No news signals found for this route</p>
                <p className="text-slate-600 text-xs mt-1">Low media coverage — baseline risk only</p>
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
