/** Quick-post: copy the caption, then hand the finished MP4 to the phone share sheet. The person posts; nothing is sent from here. */
export type ShareResult = 'shared' | 'downloaded' | 'cancelled'

export async function shareVideo(id: string, topic: string, text: string): Promise<ShareResult> {
  try {
    await navigator.clipboard?.writeText(text).catch(() => null)
    const blob = await (await fetch(`/api/studio/video?id=${id}`)).blob()
    const file = new File([blob], `${topic.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40) || 'nova'}.mp4`, { type: 'video/mp4' })
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
