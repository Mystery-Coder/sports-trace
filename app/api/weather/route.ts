import { NextRequest, NextResponse } from 'next/server';
import { WeatherSignal } from '@/lib/disruption-types';

export async function GET(request: NextRequest) {
    console.log('ENV CHECK:', {
    OPENWEATHER_KEY: process.env.OPENWEATHER_KEY,
    NEXT_PUBLIC_OPENWEATHER_KEY: process.env.NEXT_PUBLIC_OPENWEATHER_KEY,
  });
  try {
    const citiesParam = request.nextUrl.searchParams.get('cities');
    const forecastDate = request.nextUrl.searchParams.get('date');

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
        // const response = await fetch(
        //   `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
        //     city
        //   )}&appid=${apiKey}&units=metric`
        // );


        // if (!response.ok) {
        //   console.warn(`Failed to fetch weather for ${city}: ${response.statusText}`);
        //   continue;
        // }

        // const data = await response.json();

        // // Extract weather data
        // const tempC = data.main.temp;
        // const rainMmPerHour = data.rain?.['1h'] || 0;
        // const windKmh = (data.wind.speed || 0) * 3.6; // Convert m/s to km/h
        // const condition = data.weather?.[0]?.main || 'Unknown';

        // // Calculate risk points
        // let riskPoints = 0;
        // if (rainMmPerHour > 50) {
        //   riskPoints += 40;
        // }
        // if (windKmh > 80) {
        //   riskPoints += 30;
        // }
        // if (tempC > 45 || tempC < 0) {
        //   riskPoints += 20;
        // }

        // const signal: WeatherSignal = {
        //   city,
        //   tempC,
        //   rainMmPerHour,
        //   windKmh,
        //   condition,
        //   riskPoints,
        // };

        // signals.push(signal);

        let tempC = 0;
        let rainMmPerHour = 0;
        let windKmh = 0;
        let condition = 'Unknown';
        let humidity = 0;

        if (forecastDate) {
          // 🔮 FORECAST MODE
          const response = await fetch(
            `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`
          );

          if (!response.ok) {
            console.warn(`Forecast failed for ${city}: ${response.statusText}`);
            continue;
          }

          const data = await response.json();

          const targetDate = new Date(forecastDate);
          const forecasts = data.list || [];

          const closest = forecasts.reduce((prev: any, curr: any) => {
            const prevDiff = Math.abs(prev.dt * 1000 - targetDate.getTime());
            const currDiff = Math.abs(curr.dt * 1000 - targetDate.getTime());
            return currDiff < prevDiff ? curr : prev;
          });

          tempC = closest.main.temp;
          rainMmPerHour = closest.rain?.['3h'] ? closest.rain['3h'] / 3 : 0;
          windKmh = (closest.wind.speed || 0) * 3.6;
          condition = closest.weather?.[0]?.main || 'Unknown';
          humidity = closest.main.humidity || 0;

        } else {
          // 🌤 CURRENT WEATHER (your existing logic)
          const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`
          );

          if (!response.ok) {
            console.warn(`Weather failed for ${city}: ${response.statusText}`);
            continue;
          }

          const data = await response.json();

          tempC = data.main.temp;
          rainMmPerHour = data.rain?.['1h'] || 0;
          windKmh = (data.wind.speed || 0) * 3.6;
          condition = data.weather?.[0]?.main || 'Unknown';
          humidity = data.main.humidity || 0;
        }

        // risk logic (keep this)
        let riskPoints = 0;
        
        if (rainMmPerHour > 50) riskPoints += 40;
        else if (rainMmPerHour > 20) riskPoints += 25;
        else if (rainMmPerHour > 7) riskPoints += 15;
        else if (rainMmPerHour > 2) riskPoints += 8;

        if (windKmh > 80) riskPoints += 30;
        else if (windKmh > 50) riskPoints += 20;
        else if (windKmh > 30) riskPoints += 10;

        if (tempC > 45 || tempC < 0) riskPoints += 20;
        else if (tempC > 40) riskPoints += 12;
        else if (tempC > 35) riskPoints += 6;

        const conditionLower = condition.toLowerCase();
        if (['thunderstorm','tornado','squall'].some(c => conditionLower.includes(c))) riskPoints += 20;
        else if (['haze','fog','mist','smoke','dust','sand'].some(c => conditionLower.includes(c))) riskPoints += 8;

        if (humidity > 85) {
          riskPoints += 8;
        }

        signals.push({
          city,
          tempC,
          rainMmPerHour,
          windKmh,
          humidity,
          condition,
          riskPoints,
        });
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
