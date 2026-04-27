'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TerritoryLicense, TerritoryViolation } from '@/lib/disruption-types';
import { motion } from 'framer-motion';
import { Globe, Shield, Loader, CheckCircle, XCircle } from 'lucide-react';

const COUNTRIES = [
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰' },
  { code: 'LK', name: 'Sri Lanka', flag: '🇱🇰' },
  { code: 'AE', name: 'UAE', flag: '🇦🇪' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
];

export default function TerritoryPage() {
  // License setup state
  const [matchName, setMatchName] = useState('IPL Final 2026');
  const [matchId, setMatchId] = useState('ipl-final-2026');
  const [selectedCountries, setSelectedCountries] = useState<string[]>(['IN', 'GB', 'AU']);
  const [licenses, setLicenses] = useState<TerritoryLicense[]>([]);
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [licenseSuccess, setLicenseSuccess] = useState(false);

  // Viewer check state
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    result: 'granted' | 'blocked';
    country: string;
    matchName: string;
    licensedCountries: string[];
  } | null>(null);

  // Live violations feed
  const [violations, setViolations] = useState<TerritoryViolation[]>([]);

  // Fetch licenses on mount
  useEffect(() => {
    fetchLicenses();
  }, []);

  // Live violations listener
  useEffect(() => {
    const q = query(
      collection(db, 'territory_violations'),
      orderBy('timestamp', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => doc.data() as TerritoryViolation);
      setViolations(data);
    });

    return () => unsubscribe();
  }, []);

  const fetchLicenses = async () => {
    try {
      const res = await fetch('/api/territory/license');
      const data = await res.json();
      setLicenses(data.licenses || []);
      if (data.licenses?.length > 0) {
        setSelectedMatchId(data.licenses[0].matchId);
      }
    } catch (err) {
      console.error('Failed to fetch licenses:', err);
    }
  };

  const toggleCountry = (code: string) => {
    setSelectedCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const activateLicense = async () => {
    if (!matchId || !matchName || selectedCountries.length === 0) return;
    setLicenseLoading(true);
    try {
      const res = await fetch('/api/territory/license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, matchName, licensedCountries: selectedCountries }),
      });
      if (res.ok) {
        setLicenseSuccess(true);
        setTimeout(() => setLicenseSuccess(false), 3000);
        await fetchLicenses();
      }
    } catch (err) {
      console.error('Failed to activate license:', err);
    } finally {
      setLicenseLoading(false);
    }
  };

  const checkLocation = async () => {
    if (!selectedMatchId) return;
    setCheckLoading(true);
    setCheckResult(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch('/api/territory/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              matchId: selectedMatchId,
              lat: latitude,
              lng: longitude,
            }),
          });
          const data = await res.json();
          setCheckResult(data);
        } catch (err) {
          console.error('Check failed:', err);
        } finally {
          setCheckLoading(false);
        }
      },
      (err) => {
        console.error('Geolocation error:', err);
        setCheckLoading(false);
      }
    );
  };

  const getCountryFlag = (code: string) => {
    return COUNTRIES.find((c) => c.code === code)?.flag || '🌐';
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
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
          <h1 className="text-4xl font-bold text-white flex items-center gap-3">
            <Globe className="text-cyan-400" size={36} />
            M5 — Broadcast Territory Geo-Fence
          </h1>
          <p className="text-slate-400">Real-time broadcast rights enforcement</p>
        </motion.div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-2 gap-8">

          {/* LEFT PANEL — License Setup */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="border border-slate-700 rounded-lg p-6 bg-slate-800/40 space-y-5">
              <h2 className="text-white font-semibold text-lg flex items-center gap-2">
                <Shield size={18} className="text-cyan-400" />
                Territory License Setup
              </h2>

              {/* Match Name */}
              <div className="space-y-2">
                <label className="text-slate-400 text-sm">Match Name</label>
                <input
                  type="text"
                  value={matchName}
                  onChange={(e) => setMatchName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                  placeholder="IPL Final 2026"
                />
              </div>

              {/* Match ID */}
              <div className="space-y-2">
                <label className="text-slate-400 text-sm">Match ID</label>
                <input
                  type="text"
                  value={matchId}
                  onChange={(e) => setMatchId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                  placeholder="ipl-final-2026"
                />
              </div>

              {/* Country Picker */}
              <div className="space-y-2">
                <label className="text-slate-400 text-sm">
                  Licensed Territories ({selectedCountries.length} selected)
                </label>
                <div className="flex flex-wrap gap-2">
                  {COUNTRIES.map((country) => {
                    const isSelected = selectedCountries.includes(country.code);
                    return (
                      <button
                        key={country.code}
                        onClick={() => toggleCountry(country.code)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          isSelected
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                            : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'
                        }`}
                      >
                        {country.flag} {country.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Activate Button */}
              <button
                onClick={activateLicense}
                disabled={licenseLoading || selectedCountries.length === 0}
                className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded transition"
              >
                {licenseLoading ? 'Activating...' : 'Activate License'}
              </button>

              {/* Success Banner */}
              {licenseSuccess && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 border border-green-500/30 rounded px-3 py-2"
                >
                  <CheckCircle size={16} />
                  License activated successfully
                </motion.div>
              )}
            </div>

            {/* Active Licenses List */}
            {licenses.length > 0 && (
              <div className="border border-slate-700 rounded-lg p-6 bg-slate-800/40 space-y-3">
                <h3 className="text-white font-medium text-sm">Active Licenses</h3>
                {licenses.map((license, idx) => (
                  <div key={idx} className="p-3 bg-slate-900/50 rounded border border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-white text-sm font-medium">{license.matchName}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                        {license.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {license.licensedCountries.map((code) => (
                        <span key={code} className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                          {getCountryFlag(code)} {code}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* RIGHT PANEL — Viewer Simulation */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="border border-slate-700 rounded-lg p-6 bg-slate-800/40 space-y-5">
              <h2 className="text-white font-semibold text-lg flex items-center gap-2">
                <Globe size={18} className="text-cyan-400" />
                Viewer Access Simulation
              </h2>

              {/* Match Selector */}
              <div className="space-y-2">
                <label className="text-slate-400 text-sm">Select Match</label>
                <select
                  value={selectedMatchId}
                  onChange={(e) => setSelectedMatchId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                >
                  {licenses.length === 0 && (
                    <option value="">No active licenses — create one first</option>
                  )}
                  {licenses.map((license) => (
                    <option key={license.matchId} value={license.matchId}>
                      {license.matchName}
                    </option>
                  ))}
                </select>
              </div>

              

              {/* Result Card */}
              {checkResult && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`p-6 rounded-lg border text-center space-y-2 ${
                    checkResult.result === 'granted'
                      ? 'bg-green-500/10 border-green-500/40'
                      : 'bg-red-500/10 border-red-500/40'
                  }`}
                >
                  {checkResult.result === 'granted' ? (
                    <>
                      <CheckCircle size={40} className="text-green-400 mx-auto" />
                      <p className="text-green-400 text-2xl font-bold">✓ Access Granted</p>
                      <p className="text-slate-300 text-sm">
                        Viewing from <span className="text-white font-medium">{checkResult.country}</span>
                      </p>
                      <p className="text-slate-400 text-xs">
                        Licensed for {checkResult.matchName}
                      </p>
                    </>
                  ) : (
                    <>
                      <XCircle size={40} className="text-red-400 mx-auto" />
                      <p className="text-red-400 text-2xl font-bold">✗ 451 — Access Restricted</p>
                      <p className="text-slate-300 text-sm">
                        This broadcast is not licensed in{' '}
                        <span className="text-white font-medium">{checkResult.country}</span>
                      </p>
                      <p className="text-slate-400 text-xs mt-1">
                        You would be redirected to a licensed provider
                      </p>
                    </>
                  )}
                </motion.div>
              )}
            </div>

            {/* Live Violations Feed */}
            <div className="border border-slate-700 rounded-lg p-6 bg-slate-800/40 space-y-3">
              <h3 className="text-white font-medium text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                Live Access Log
              </h3>
              {violations.length === 0 ? (
                <p className="text-slate-500 text-sm">No checks yet — run a location check</p>
              ) : (
                violations.map((v, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getCountryFlag(v.viewerCountryCode)}</span>
                      <div>
                        <p className="text-white text-xs font-medium">{v.viewerCountry}</p>
                        <p className="text-slate-500 text-xs">{formatTime(v.timestamp)}</p>
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                        v.result === 'granted'
                          ? 'bg-green-500/20 text-green-400 border-green-500/30'
                          : 'bg-red-500/20 text-red-400 border-red-500/30'
                      }`}
                    >
                      {v.result === 'granted' ? '✓ Granted' : '✗ Blocked'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}