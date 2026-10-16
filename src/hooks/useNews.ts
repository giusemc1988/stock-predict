import { useEffect, useRef, useState } from 'react';
import { fetchAlpacaNews, type NewsItem } from '../lib/newsProvider';

interface NewsCacheEntry {
  items: NewsItem[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Hook to fetch and cache news for a list of stock symbols.
 * Caches news per symbol for 1 hour in memory.
 * Avoids redundant API calls for the same symbol within the cache window.
 *
 * @param symbols List of stock symbols to fetch news for (e.g., ['TSLA', 'MSFT'])
 * @param enabled Whether to fetch news (when false, returns empty array)
 * @returns Flattened list of latest news items (max 10 total), sorted by created_at desc
 */
export function useNews(symbols: string[], enabled: boolean): NewsItem[] {
  const [news, setNews] = useState<NewsItem[]>([]);
  const cacheRef = useRef<Map<string, NewsCacheEntry>>(new Map());

  useEffect(() => {
    if (!enabled || !symbols || symbols.length === 0) {
      setNews([]);
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

      setNews(sorted);
    };

    fetchNews();
  }, [symbols, enabled]);

  return news;
}
