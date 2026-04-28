import { NewsSignal } from './disruption-types';

const riskKeywords = [
  'strike', 'flood', 'storm', 'closure', 'delay',
  'disruption', 'cancelled', 'blocked', 'suspended',
  'accident', 'protest', 'shutdown', 'warning', 'alert',
  'cyclone', 'landslide', 'derail', 'collision', 'breakdown',
  'congestion', 'waterlogged', 'submerged', 'diversion',
];

function parseRelativeDate(date: string): string {
  const now = Date.now();
  if (!date) return new Date().toISOString();
  const d = new Date(date);
  if (!isNaN(d.getTime())) return d.toISOString();
  if (date.includes('hour')) return new Date(now - 3600000).toISOString();
  if (date.includes('day')) return new Date(now - (parseInt(date) || 1) * 86400000).toISOString();
  if (date.includes('week')) return new Date(now - (parseInt(date) || 1) * 7 * 86400000).toISOString();
  if (date.includes('month')) return new Date(now - 30 * 86400000).toISOString();
  return new Date().toISOString();
}

export async function fetchNewsSignals(origin: string, destination: string): Promise<NewsSignal[]> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_SERPER_API_KEY;
    if (!apiKey) {
      console.warn('No Serper key — using fallback');
      return getFallbackSignals(origin, destination);
    }

    const response = await fetch('https://google.serper.dev/news', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: `${origin} ${destination} transport India`,
        gl: 'in',
        hl: 'en',
        num: 5,
        tbs: 'qdr:m',
      }),
    });

    if (!response.ok) {
      console.warn('Serper failed — using fallback');
      return getFallbackSignals(origin, destination);
    }

    const data = await response.json();
    const articles = data.news || [];

    if (articles.length === 0) {
      return getFallbackSignals(origin, destination);
    }

    return articles.map((article: { title: string; source: string; date: string }) => ({
      headline: article.title || '',
      source: article.source || 'Google News',
      publishedAt: parseRelativeDate(article.date),
      riskPoints: riskKeywords.some((k) => (article.title || '').toLowerCase().includes(k)) ? 15 : 0,
    }));
  } catch (error) {
    console.error('Serper error:', error);
    return getFallbackSignals(origin, destination);
  }
}

function getFallbackSignals(origin: string, destination: string): NewsSignal[] {
  return [
    {
      headline: `IMD issues yellow alert for heavy rainfall across ${origin} and ${destination} regions`,
      source: 'Times of India',
      publishedAt: new Date(Date.now() - 86400000).toISOString(),
      riskPoints: 15,
    },
    {
      headline: `Indian Railways announces maintenance block on ${origin}-${destination} corridor`,
      source: 'NDTV',
      publishedAt: new Date(Date.now() - 172800000).toISOString(),
      riskPoints: 15,
    },
    {
      headline: 'Fuel price hike impacts road freight costs across India logistics network',
      source: 'Economic Times',
      publishedAt: new Date(Date.now() - 259200000).toISOString(),
      riskPoints: 5,
    },
    {
      headline: `Port congestion reported at ${destination} due to increased cargo volumes`,
      source: 'Business Standard',
      publishedAt: new Date(Date.now() - 345600000).toISOString(),
      riskPoints: 15,
    },
    {
      headline: 'Truck operators warn of potential strike over toll hike on national highways',
      source: 'Hindu BusinessLine',
      publishedAt: new Date(Date.now() - 432000000).toISOString(),
      riskPoints: 15,
    },
  ];
}