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

    const apiKey = process.env.SERPER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Serper API key not configured' },
        { status: 500 }
      );
    }

    const response = await fetch('https://google.serper.dev/news', {
      
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: searchQuery,
        gl: 'in',        // India region
        hl: 'en',        // English
        num: 5,          // 5 results
        tbs: 'qdr:m',   // past month
      }),
    });

    if (!response.ok) {
      console.error(`Serper API error: ${response.statusText}`);
      return NextResponse.json(
        { error: 'Failed to fetch news' },
        { status: 500 }
      );
    }
    

    const data = await response.json();
    console.log('Serper raw response:', JSON.stringify(data, null, 2));

    const articles = data.news || [];

    if (articles.length === 0) {
      return NextResponse.json({ signals: [] });
    }

    const riskKeywords = [
      'strike', 'flood', 'storm', 'closure', 'delay',
      'disruption', 'cancelled', 'blocked', 'suspended',
      'accident', 'protest', 'shutdown', 'warning', 'alert',
    ];

    const signals: NewsSignal[] = articles.map((article: {
      title: string;
      source: string;
      date: string;
    }) => {
      const headline = article.title || '';
      const headlineLower = headline.toLowerCase();

      const hasRiskKeyword = riskKeywords.some((keyword) =>
        headlineLower.includes(keyword)
      );

      return {
        headline,
        source: article.source || 'Google News',
        publishedAt: (() => {
          if (!article.date) return new Date().toISOString();

          const d = new Date(article.date);

          // If it's a valid date → use it
          if (!isNaN(d.getTime())) return d.toISOString();

          // Handle relative dates like "2 days ago"
          const now = Date.now();

          if (article.date.includes('hour')) {
            return new Date(now - 1 * 3600000).toISOString();
          }

          if (article.date.includes('day')) {
            const days = parseInt(article.date) || 1;
            return new Date(now - days * 86400000).toISOString();
          }

          if (article.date.includes('week')) {
            const weeks = parseInt(article.date) || 1;
            return new Date(now - weeks * 7 * 86400000).toISOString();
          }

          if (article.date.includes('month')) {
            return new Date(now - 30 * 86400000).toISOString();
          }

          return new Date().toISOString();
        })(),
        riskPoints: hasRiskKeyword ? 15 : 5,
      } as NewsSignal;
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