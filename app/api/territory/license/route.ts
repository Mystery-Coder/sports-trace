import { NextRequest, NextResponse } from 'next/server';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TerritoryLicense } from '@/lib/disruption-types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matchId, matchName, licensedCountries } = body;

    if (!matchId || !matchName || !licensedCountries || licensedCountries.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: matchId, matchName, licensedCountries' },
        { status: 400 }
      );
    }

    const license: TerritoryLicense = {
      id: crypto.randomUUID(),
      matchId,
      matchName,
      licensedCountries,
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    await addDoc(collection(db, 'territory_licenses'), license);

    return NextResponse.json(license);
  } catch (error) {
    console.error('License creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const snapshot = await getDocs(collection(db, 'territory_licenses'));

    const licenses: TerritoryLicense[] = snapshot.docs.map(
      (doc) => doc.data() as TerritoryLicense
    );

    return NextResponse.json({ licenses });
  } catch (error) {
    console.error('License fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}