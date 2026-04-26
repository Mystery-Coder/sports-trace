import { NextRequest, NextResponse } from 'next/server';
import { WeatherSignal } from '@/lib/disruption-types';

export async function GET(request: NextRequest) {
    console.log('ENV CHECK:', {
    OPENWEATHER_KEY: process.env.OPENWEATHER_KEY,
    NEXT_PUBLIC_OPENWEATHER_KEY: process.env.NEXT_PUBLIC_OPENWEATHER_KEY,
  });
  try {
    const citiesParam = request.nextUrl.searchParams.get('cities');

    if (!citiesParam) {
      return NextResponse.json(
        { error: 'Missing required query parameter: cities' },
        { status: 400 }
      );
    }

    const cities = citiesParam.split(',').map((city) => city.trim());
    const apiKey = process.env.OPENWEATHER_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenWeatherMap API key not configured' },
        { status: 500 }
      );
    }

    const signals: WeatherSignal[] = [];

    // Fetch weather for each city
    for (const city of cities) {
      try {
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
            city
          )}&appid=${apiKey}&units=metric`
        );

        // Temporary mock — remove after key activates
        // if (!apiKey || process.env.NODE_ENV === 'development') {
        // return NextResponse.json({
        //     signals: [
        //     { city: 'Mumbai', tempC: 32, rainMmPerHour: 12, windKmh: 45, condition: 'Rain', riskPoints: 0 },
        //     { city: 'Chennai', tempC: 38, rainMmPerHour: 67, windKmh: 55, condition: 'Heavy Rain', riskPoints: 40 }
        //     ]
        // });
        // }

        if (!response.ok) {
          console.warn(`Failed to fetch weather for ${city}: ${response.statusText}`);
          continue;
        }

        const data = await response.json();

        // Extract weather data
        const tempC = data.main.temp;
        const rainMmPerHour = data.rain?.['1h'] || 0;
        const windKmh = (data.wind.speed || 0) * 3.6; // Convert m/s to km/h
        const condition = data.weather?.[0]?.main || 'Unknown';

        // Calculate risk points
        let riskPoints = 0;
        if (rainMmPerHour > 50) {
          riskPoints += 40;
        }
        if (windKmh > 80) {
          riskPoints += 30;
        }
        if (tempC > 45 || tempC < 0) {
          riskPoints += 20;
        }

        const signal: WeatherSignal = {
          city,
          tempC,
          rainMmPerHour,
          windKmh,
          condition,
          riskPoints,
        };

        signals.push(signal);
      } catch (error) {
        console.error(`Error processing weather for ${city}:`, error);
        // Continue with other cities instead of failing completely
        continue;
      }
    }

    return NextResponse.json({ signals });
  } catch (error) {
    console.error('Weather API route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
