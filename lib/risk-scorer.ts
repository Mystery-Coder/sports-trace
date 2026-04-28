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
  // Rain risk — realistic thresholds
  if (signal.rainMmPerHour > 50) {
    weatherRisk += 40;
    weatherConditions.add('extreme rainfall');
  } else if (signal.rainMmPerHour > 20) {
    weatherRisk += 25;
    weatherConditions.add('heavy rain');
  } else if (signal.rainMmPerHour > 7) {
    weatherRisk += 15;
    weatherConditions.add('moderate rain');
  } else if (signal.rainMmPerHour > 2) {
    weatherRisk += 8;
    weatherConditions.add('light rain');
  }

  // Wind risk
  if (signal.windKmh > 80) {
    weatherRisk += 30;
    weatherConditions.add('severe winds');
  } else if (signal.windKmh > 50) {
    weatherRisk += 20;
    weatherConditions.add('strong winds');
  } else if (signal.windKmh > 30) {
    weatherRisk += 10;
    weatherConditions.add('moderate winds');
  }

  // Temperature risk
  if (signal.tempC > 45 || signal.tempC < 0) {
    weatherRisk += 20;
    weatherConditions.add('extreme temperature');
  } else if (signal.tempC > 40) {
    weatherRisk += 12;
    weatherConditions.add('very high heat');
  } else if (signal.tempC > 35) {
    weatherRisk += 6;
    weatherConditions.add('high heat');
  }

  // Visibility/condition risk
  const badConditions = ['thunderstorm', 'tornado', 'squall'];
  const moderateConditions = ['haze', 'fog', 'mist', 'smoke', 'dust', 'sand'];
  const conditionLower = signal.condition.toLowerCase();

  if (badConditions.some(c => conditionLower.includes(c))) {
    weatherRisk += 20;
    weatherConditions.add('severe weather');
  } else if (moderateConditions.some(c => conditionLower.includes(c))) {
    weatherRisk += 8;
    weatherConditions.add('poor visibility');
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
