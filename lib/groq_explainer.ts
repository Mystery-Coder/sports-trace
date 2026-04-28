import { RouteOption, DisruptionReport } from './disruption-types';

export async function explainRoute(
  route: RouteOption,
  disruptionReport: DisruptionReport
): Promise<string> {
  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return `Route ${route.name}: ${route.distanceKm}km via ${route.mode}. Recommendation: Consider alternative routes due to disruption risk level ${disruptionReport.riskLevel}.`;
    }

    const systemPrompt =
      'You are a logistics analyst for a sports media company. Be concise and practical.';

    const userPrompt = `You are evaluating route alternatives for a sports broadcast equipment shipment in India.

DISRUPTION CONTEXT:
- Route: ${disruptionReport.origin} to ${disruptionReport.destination}
- Risk Level: ${disruptionReport.riskLevel} (Score: ${disruptionReport.riskScore}/100)
- Weather: ${disruptionReport.weatherSignals.map(w => 
    `${w.city}: ${w.condition}, ${w.tempC.toFixed(1)}°C, wind ${w.windKmh.toFixed(0)}km/h`
  ).join(' | ')}
- Active news alerts: ${disruptionReport.newsSignals.filter(n => n.riskPoints > 0).length} risk signals

ROUTE BEING EVALUATED:
- Name: ${route.name}
- Mode: ${route.mode}
- Distance: ${route.distanceKm}km
- Duration: ${route.durationHours} hours
- Cost: $${route.costUSD} USD

EVALUATION RULES:
- Road convoy: affected by rain, wind, road conditions, traffic. Good for cost, slow.
- Air freight: unaffected by ground disruptions. Fast but expensive. Best for HIGH risk scenarios.
- Coastal shipping: unaffected by road/weather inland. Cheapest but slowest. Best for LOW urgency.

Given the ${disruptionReport.riskLevel} risk level and current weather in ${disruptionReport.origin} and ${disruptionReport.destination}:
Write 2 sentences analyzing this specific route mode against the disruption context.
End with exactly 1 sentence starting with "Recommendation:".
Be specific about weather/risk impact on this transport mode. Do not be generic.`;

    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          temperature: 0.5,
          max_tokens: 200,
        }),
      }
    );

    if (!response.ok) {
      console.error(
        `Groq API error: ${response.status} ${response.statusText}`
      );
      return `Route ${route.name}: ${route.distanceKm}km via ${route.mode}. Recommendation: Consider alternative routes due to disruption risk level ${disruptionReport.riskLevel}.`;
    }

    const data = await response.json();
    const explanation =
      data.choices?.[0]?.message?.content ||
      `Route ${route.name}: ${route.distanceKm}km via ${route.mode}. Recommendation: Consider alternative routes due to disruption risk level ${disruptionReport.riskLevel}.`;

    return explanation.trim();
  } catch (error) {
    console.error('Groq explainer error:', error);
    return `Route ${route.name}: ${route.distanceKm}km via ${route.mode}. Recommendation: Consider alternative routes due to disruption risk level ${disruptionReport.riskLevel}.`;
  }
}
