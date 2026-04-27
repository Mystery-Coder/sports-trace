import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TerritoryLicense, TerritoryViolation } from '@/lib/disruption-types';
import { getCountryFromCoords } from '@/lib/geo_lookup';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matchId, lat, lng } = body;

    if (!matchId || lat === undefined || lng === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: matchId, lat, lng' },
        { status: 400 }
      );
    }

    // Step 1: Get country from coordinates
    const { country, countryCode } = await getCountryFromCoords(lat, lng);

    // Step 2: Fetch active license for this match
    const licenseQuery = query(
      collection(db, 'territory_licenses'),
      where('matchId', '==', matchId),
      where('status', '==', 'active')
    );
    const licenseSnap = await getDocs(licenseQuery);

    if (licenseSnap.empty) {
      return NextResponse.json(
        { error: 'No active license found for this match' },
        { status: 404 }
      );
    }

    const license = licenseSnap.docs[0].data() as TerritoryLicense;

    // Step 3: Check if viewer country is licensed
    const isLicensed = license.licensedCountries
      .map((c) => c.toUpperCase())
      .includes(countryCode.toUpperCase());

    // Step 4: Build violation record
    const violation: TerritoryViolation = {
      id: crypto.randomUUID(),
      matchId,
      viewerLat: lat,
      viewerLng: lng,
      viewerCountry: country,
      viewerCountryCode: countryCode,
      licensedCountries: license.licensedCountries,
      result: isLicensed ? 'granted' : 'blocked',
      timestamp: new Date().toISOString(),
    };

    // Step 5: Save to Firestore
    await addDoc(collection(db, 'territory_violations'), violation);

    // Step 6: Return result
    if (isLicensed) {
      return NextResponse.json({
        result: 'granted',
        country,
        countryCode,
        matchName: license.matchName,
        licensedCountries: license.licensedCountries,
      });
    } else {
      return NextResponse.json(
        {
          result: 'blocked',
          country,
          countryCode,
          matchName: license.matchName,
          licensedCountries: license.licensedCountries,
        },
        { status: 451 }
      );
    }
  } catch (error) {
    console.error('Territory check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}