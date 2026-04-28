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
  humidity: number;
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

export interface TerritoryLicense {
  id: string;
  matchId: string;
  matchName: string;
  licensedCountries: string[];
  createdAt: string;
  status: 'active' | 'expired';
}

export interface TerritoryCheck {
  lat: number;
  lng: number;
  country: string;
  countryCode: string;
}

export interface TerritoryViolation {
  id: string;
  matchId: string;
  viewerLat: number;
  viewerLng: number;
  viewerCountry: string;
  viewerCountryCode: string;
  licensedCountries: string[];
  result: 'granted' | 'blocked';
  timestamp: string;
}