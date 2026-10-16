/**
 * Alpaca News API provider.
 * Fetches latest news from Worker endpoint /api/news/{symbol}.
 * The Worker holds the Alpaca API key in its environment secrets, never exposed to client.
 * Quota: 288,000 calls/day (unlimited free tier as of Oct 2026).
 * Latency: ~15 min (news articles update periodically).
 */

export interface NewsItem {
  id: string;
  headline: string;
  created_at: string; // ISO 8601 timestamp
  url: string;
}

/**
 * Fetch latest news for a stock symbol via Worker endpoint.
 * The Worker fetches from Alpaca News API using its own API key (stored in secrets).
 * @param symbol Stock symbol (e.g., 'TSLA')
 * @returns Top 5 most recent news items, or empty array on error
 */
export async function fetchAlpacaNews(symbol: string): Promise<NewsItem[]> {
  if (!symbol) return [];

  try {
    const response = await fetch(`/api/news/${encodeURIComponent(symbol)}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      // 404 = symbol not found, 429 = rate limited, others = API error
      return [];
    }

    const data = (await response.json()) as { news?: NewsItem[] };

    if (!data.news || !Array.isArray(data.news)) {
      return [];
    }

    // Return top 5, already sorted by created_at desc from API
    return data.news.slice(0, 5);
  } catch (error) {
    // Network error, timeout, or parse error — return empty
    return [];
  }
}
