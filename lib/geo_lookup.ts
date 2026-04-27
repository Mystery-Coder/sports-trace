export async function getCountryFromCoords(
  lat: number,
  lng: number
): Promise<{ country: string; countryCode: string }> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      {
        headers: {
          'User-Agent': 'SportTrace/1.0',
        },
      }
    );

    if (!response.ok) {
      console.error('Nominatim error:', response.statusText);
      return { country: 'Unknown', countryCode: 'XX' };
    }

    const data = await response.json();

    const country = data.address?.country || 'Unknown';
    const countryCode = (data.address?.country_code || 'XX').toUpperCase();

    return { country, countryCode };
  } catch (error) {
    console.error('Geo lookup error:', error);
    return { country: 'Unknown', countryCode: 'XX' };
  }
}