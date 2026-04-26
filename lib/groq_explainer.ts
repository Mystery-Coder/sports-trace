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

    const userPrompt = `Evaluate this route alternative for a sports logistics shipment:

Route: ${route.name}
- Distance: ${route.distanceKm}km
- Duration: ${route.durationHours} hours
- Cost: $${route.costUSD}
- Mode: ${route.mode}

Current disruption context:
- From: ${disruptionReport.origin} to ${disruptionReport.destination}
- Risk Level: ${disruptionReport.riskLevel}
- Risk Breakdown: ${disruptionReport.weatherSignals.length} weather signals, ${disruptionReport.newsSignals.length} news alerts

Is this route a good alternative? Explain why or why not in max 3 sentences, ending with one sentence recommendation.`;

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
          max_tokens: 150,
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
