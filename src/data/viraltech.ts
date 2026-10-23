/**
 * Viraltech snapshot from Antwork. The browser can't reach Antwork's MCP, so Claude refreshes this file
 * from Antwork (list_social_accounts, list_posts, get_performance) and ships it in a PR. Never hand-edit numbers.
 */
export type Platform = 'instagram' | 'tiktok' | 'youtube' | 'facebook'
export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed'

export interface Channel {
  platform: Platform
  name: string
  handle: string
  url: string
  /** Connected in Antwork, so Claude can post to it. */
  connected: boolean
  followers: number | null
}
export interface Post {
  id: string
  platform: Platform
  text: string
  status: PostStatus
  /** ISO time: scheduled or published. */
  at: string | null
  views: number | null
  engagement: number | null
}

export const ANTWORK_URL = 'https://antwork.io'

export const VIRALTECH = {
  asOf: '2026-10-23T00:05:00Z',
  workspace: 'Virral Tech',
  channels: [
    { platform: 'instagram', name: 'virraltech', handle: '@virraltech', url: 'https://www.instagram.com/virraltech/', connected: true, followers: null },
    { platform: 'youtube', name: 'Virral Tech', handle: '@VirralTech', url: 'https://www.youtube.com/@VirralTech', connected: true, followers: null },
    { platform: 'tiktok', name: 'virraltech', handle: '@virraltech', url: 'https://www.tiktok.com/@virraltech', connected: false, followers: null },
    { platform: 'facebook', name: 'Virral Tech', handle: 'Virral Tech', url: 'https://www.facebook.com/search/top?q=Virral%20Tech', connected: false, followers: null },
  ] as Channel[],
  posts: [] as Post[],
}

export function postCounts(posts: Post[]): Record<PostStatus, number> {
  const c: Record<PostStatus, number> = { draft: 0, scheduled: 0, published: 0, failed: 0 }
  for (const p of posts) c[p.status]++
  return c
}
