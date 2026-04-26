import { NextRequest, NextResponse } from 'next/server';
import { NewsSignal } from '@/lib/disruption-types';

export async function GET(request: NextRequest) {
  try {
    const searchQuery = request.nextUrl.searchParams.get('query');

    if (!searchQuery) {
      return NextResponse.json(
        { error: 'Missing required query parameter: query' },
        { status: 400 }
      );
    }

    const apiKey = process.env.NEWS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GNews API key not configured' },
        { status: 500 }
      );
    }

    // Calculate date from 7 days ago in ISO format
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 7);
    const fromDateStr = fromDate.toISOString();

    const url = new URL('https://gnews.io/api/v4/search');
    url.searchParams.append('q', searchQuery);
    url.searchParams.append('lang', 'en');
    url.searchParams.append('max', '5');
    url.searchParams.append('from', fromDateStr);
    url.searchParams.append('apikey', apiKey);

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.error(`GNews API error: ${response.statusText}`);
      return NextResponse.json(
        { error: 'Failed to fetch news articles' },
        { status: 500 }
      );
    }

    const data = await response.json();

    if (!data.articles || data.articles.length === 0) {
      return NextResponse.json({ signals: [] });
    }

    // Risk keywords for title analysis
    const riskKeywords = [
      'strike',
      'flood',
      'storm',
      'closure',
      'delay',
      'disruption',
      'cancelled',
      'blocked',
      'suspended',
    ];

    const signals: NewsSignal[] = data.articles.map((article: any) => {
      const headline = article.title || '';
      const headlineLower = headline.toLowerCase();

      // Check if any risk keywords are in the title
      const hasRiskKeyword = riskKeywords.some((keyword) =>
        headlineLower.includes(keyword)
      );

      const riskPoints = hasRiskKeyword ? 15 : 5;

      const signal: NewsSignal = {
        headline,
        source: article.source?.name || 'Unknown',
        publishedAt: article.publishedAt || new Date().toISOString(),
        riskPoints,
      };

      return signal;
    });

    return NextResponse.json({ signals });
  } catch (error) {
    console.error('News API route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
