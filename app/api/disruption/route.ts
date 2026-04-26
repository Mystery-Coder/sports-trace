import { NextRequest, NextResponse } from 'next/server';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  DisruptionReport,
  WeatherSignal,
  NewsSignal,
} from '@/lib/disruption-types';
import { computeRiskScore } from '@/lib/risk-scorer';

interface DisruptionRequestBody {
  origin: string;
  destination: string;
  routeId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: DisruptionRequestBody = await request.json();
    const { origin, destination, routeId } = body;

    if (!origin || !destination || !routeId) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: origin, destination, routeId',
        },
        { status: 400 }
      );
    }

    // Get the base URL for internal API calls
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    // Step 1: Call weather API
    let weatherSignals: WeatherSignal[] = [];
    try {
      const weatherUrl = `${baseUrl}/api/weather?cities=${encodeURIComponent(
        origin
      )},${encodeURIComponent(destination)}`;
      const weatherResponse = await fetch(weatherUrl);

      if (weatherResponse.ok) {
        const weatherData = await weatherResponse.json();
        weatherSignals = weatherData.signals || [];
      } else {
        console.warn('Weather API failed:', weatherResponse.statusText);
      }
    } catch (error) {
      console.error('Error calling weather API:', error);
    }

    // Step 2: Call news API
    let newsSignals: NewsSignal[] = [];
    try {
      const newsQuery = `${origin} ${destination} port disruption`;
      const newsUrl = `${baseUrl}/api/news?query=${encodeURIComponent(
        newsQuery
      )}`;
      const newsResponse = await fetch(newsUrl);

      if (newsResponse.ok) {
        const newsData = await newsResponse.json();
        newsSignals = newsData.signals || [];
      } else {
        console.warn('News API failed:', newsResponse.statusText);
      }
    } catch (error) {
      console.error('Error calling news API:', error);
    }

    // Step 3: Compute risk score
    const riskScoreResult = computeRiskScore(weatherSignals, newsSignals);

    // Step 4: Build DisruptionReport
    const disruptionReport: DisruptionReport = {
      id: crypto.randomUUID(),
      routeId,
      origin,
      destination,
      riskScore: riskScoreResult.score,
      riskLevel: riskScoreResult.level,
      weatherSignals,
      newsSignals,
      timestamp: new Date().toISOString(),
      status: 'active',
    };

    // Step 5: Save to Firestore
    const docRef = await addDoc(collection(db, 'disruptions'), disruptionReport);

    console.log('DisruptionReport saved with ID:', docRef.id);

    // Step 6: Return the full DisruptionReport
    return NextResponse.json(disruptionReport);
  } catch (error) {
    console.error('Disruption API route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
