export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { addDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  RouteOption,
  DisruptionReport,
  RouteAlternative,
} from '@/lib/disruption-types';
import { explainRoute } from '@/lib/groq_explainer';

interface RerouteRequestBody {
  disruptionId: string;
  origin: string;
  destination: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RerouteRequestBody = await request.json();
    const { disruptionId, origin, destination } = body;

    if (!disruptionId || !origin || !destination) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: disruptionId, origin, destination',
        },
        { status: 400 }
      );
    }

    // Step 1: Fetch DisruptionReport from Firestore
    const q = query(
    collection(db, 'disruptions'),
    where('id', '==', disruptionId)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
    return NextResponse.json(
        { error: `DisruptionReport not found: ${disruptionId}` },
        { status: 404 }
    );
    }

    const disruptionReport = snapshot.docs[0].data() as DisruptionReport;

    // Define 3 hardcoded route alternatives for India sports broadcast use case
    const routeA: RouteOption = {
      id: crypto.randomUUID(),
      name: 'Road Convoy',
      origin,
      destination,
      distanceKm: 1200,
      durationHours: 18,
      costUSD: 800,
      mode: 'road',
    };

    const routeB: RouteOption = {
      id: crypto.randomUUID(),
      name: 'Air Freight',
      origin,
      destination,
      distanceKm: 2000, // Approximate air distance
      durationHours: 2,
      costUSD: 3200,
      mode: 'air',
    };

    const routeC: RouteOption = {
      id: crypto.randomUUID(),
      name: 'Coastal Shipping',
      origin,
      destination,
      distanceKm: 900,
      durationHours: 36,
      costUSD: 400,
      mode: 'sea',
    };

    const routes = [routeA, routeB, routeC];

    // Step 2: Call explainRoute for each route in parallel
    const explanationPromises = routes.map((route) =>
      explainRoute(route, disruptionReport)
    );

    const explanations = await Promise.all(explanationPromises);

    // Step 3: Build RouteAlternative
    const routeAlternative: RouteAlternative = {
      id: crypto.randomUUID(),
      disruptionId,
      routes,
      groqExplanations: routes.map((route, index) => ({
        routeId: route.id,
        explanation: explanations[index],
      })),
      computedAt: new Date().toISOString(),
    };

    // Step 4: Save to Firestore
    const docRef = await addDoc(collection(db, 'routes'), routeAlternative);

    console.log('RouteAlternative saved with ID:', docRef.id);

    // Step 5: Return the full RouteAlternative
    return NextResponse.json(routeAlternative);
  } catch (error) {
    console.error('Reroute API route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

