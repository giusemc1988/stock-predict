import type { NewsItem } from '../lib/newsProvider';
import './NewsBox.css';

interface NewsBoxProps {
  news: NewsItem[];
  enabled: boolean;
  lastCheckedAt: number | null;
}

/**
 * Display box showing latest news for watched symbols.
 * Hidden when disabled; shows empty state when no news available.
 */
export function NewsBox({ news, enabled, lastCheckedAt }: NewsBoxProps) {
  if (!enabled) return null;

  if (news.length === 0) {
    const timeStr = lastCheckedAt ? formatCheckTime(lastCheckedAt) : 'never';
    return <div className="news-box empty">No news yet, last checked {timeStr}</div>;
  }

  return (
    <div className="news-box">
      <h4>Latest News</h4>
      {news.slice(0, 5).map((item) => (
        <a
          key={item.id}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="news-item"
        >
          <span className="headline">{item.headline}</span>
          <span className="time">{formatTime(item.created_at)}</span>
        </a>
      ))}
    </div>
  );
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

function formatCheckTime(timestampMs: number): string {
  const date = new Date(timestampMs);
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${mins}`;
}
