export interface RouteOption {
  id: string;
  name: string;
  origin: string;
  destination: string;
  distanceKm: number;
  durationHours: number;
  costUSD: number;
  mode: 'road' | 'air' | 'sea';
}

export interface WeatherSignal {
  city: string;
  tempC: number;
  rainMmPerHour: number;
  windKmh: number;
  condition: string;
  riskPoints: number;
}

export interface NewsSignal {
  headline: string;
  source: string;
  publishedAt: string;
  riskPoints: number;
}

export interface DisruptionReport {
  id: string;
  routeId: string;
  origin: string;
  destination: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  weatherSignals: WeatherSignal[];
  newsSignals: NewsSignal[];
  timestamp: string;
  status: 'active' | 'resolved';
}

export interface RouteAlternative {
  id: string;
  disruptionId: string;
  routes: RouteOption[];
  groqExplanations: Array<{
    routeId: string;
    explanation: string;
  }>;
  computedAt: string;
}
