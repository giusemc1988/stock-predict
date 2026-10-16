import { useEffect, useRef, useState } from 'react';
import { fetchAlpacaNews, type NewsItem } from '../lib/newsProvider';

interface NewsCacheEntry {
  items: NewsItem[];
  fetchedAt: number;
}

export interface NewsResult {
  items: NewsItem[];
  lastCheckedAt: number | null;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Hook to fetch and cache news for a list of stock symbols.
 * Caches news per symbol for 1 hour in memory.
 * Avoids redundant API calls for the same symbol within the cache window.
 *
 * @param symbols List of stock symbols to fetch news for (e.g., ['TSLA', 'MSFT'])
 * @param enabled Whether to fetch news (when false, returns empty items)
 * @returns Object with news items and timestamp of last fetch
 */
export function useNews(symbols: string[], enabled: boolean): NewsResult {
  const [result, setResult] = useState<NewsResult>({ items: [], lastCheckedAt: null });
  const cacheRef = useRef<Map<string, NewsCacheEntry>>(new Map());

  useEffect(() => {
    if (!enabled || !symbols || symbols.length === 0) {
      setResult({ items: [], lastCheckedAt: null });
      return;
    }

    const fetchNews = async () => {
      const results: NewsItem[] = [];
      const now = Date.now();

      for (const symbol of symbols) {
        const cached = cacheRef.current.get(symbol);
        if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
          // Use cached entry
          results.push(...cached.items);
        } else {
          // Fetch fresh news
          const fresh = await fetchAlpacaNews(symbol);
          if (fresh && fresh.length > 0) {
            cacheRef.current.set(symbol, { items: fresh, fetchedAt: now });
            results.push(...fresh);
          }
        }
      }

      // Sort by created_at desc (newest first) and take top 10
      const sorted = results
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);

      setResult({ items: sorted, lastCheckedAt: now });
    };

    fetchNews();
  }, [symbols, enabled]);

  return result;
}
