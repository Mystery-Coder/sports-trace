import { WeatherSignal, NewsSignal } from './disruption-types';

interface RiskScoreResult {
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  breakdown: string;
}

export function computeRiskScore(
  weatherSignals: WeatherSignal[],
  newsSignals: NewsSignal[]
): RiskScoreResult {
  // Calculate weather risk and track conditions
  let weatherRisk = 0;
  const weatherConditions = new Set<string>();

  for (const signal of weatherSignals) {
    if (signal.rainMmPerHour > 50) {
      weatherRisk += 40;
      weatherConditions.add('heavy rain');
    }
    if (signal.windKmh > 80) {
      weatherRisk += 30;
      weatherConditions.add('strong winds');
    }
    if (signal.tempC > 45 || signal.tempC < 0) {
      weatherRisk += 20;
      weatherConditions.add('extreme temperature');
    }
  }

  // Calculate news risk (capped at 45)
  let newsRisk = newsSignals.reduce((sum, signal) => sum + signal.riskPoints, 0);
  newsRisk = Math.min(newsRisk, 45);

  // Base risk
  const baseRisk = 15;

  // Total score
  const score = weatherRisk + newsRisk + baseRisk;

  // Determine level
  let level: 'LOW' | 'MEDIUM' | 'HIGH';
  if (score < 30) {
    level = 'LOW';
  } else if (score <= 60) {
    level = 'MEDIUM';
  } else {
    level = 'HIGH';
  }

  // Create breakdown string
  const weatherDesc = weatherConditions.size > 0
    ? ` (${Array.from(weatherConditions).join(', ')})`
    : '';

  const newsCount = newsSignals.length;
  const newsDesc = newsCount > 0
    ? ` (${newsCount} alert${newsCount !== 1 ? 's' : ''})`
    : '';

  const breakdown = `Weather: ${weatherRisk}pts${weatherDesc} | News: ${newsRisk}pts${newsDesc} | Base: ${baseRisk}pts`;

  return {
    score,
    level,
    breakdown,
  };
}
