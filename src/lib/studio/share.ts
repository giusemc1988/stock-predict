/** Quick-post: copy the caption, then hand the finished MP4 to the phone share sheet. The person posts; nothing is sent from here. */
export type ShareResult = 'shared' | 'downloaded' | 'cancelled'

/** The MP4 as a File, ready for the share sheet. Fetch it BEFORE the tap: the phone only opens the sheet within a few seconds of a tap, and a long download in between makes it refuse. */
export async function fetchVideoFile(id: string, topic: string): Promise<File> {
  const r = await fetch(`/api/studio/video?id=${id}`)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return new File([await r.blob()], `${topic.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40) || 'nova'}.mp4`, { type: 'video/mp4' })
}

export async function shareVideo(id: string, topic: string, text: string, ready?: File): Promise<ShareResult> {
  try {
    // copy first, inside the tap, so the caption is on the clipboard whatever the share sheet does
    await navigator.clipboard?.writeText(text).catch(() => null)
    const file = ready ?? (await fetchVideoFile(id, topic))
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text })
      return 'shared'
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(file)
    a.download = file.name
    a.click()
    return 'downloaded'
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'cancelled'
    throw e
  }
}
