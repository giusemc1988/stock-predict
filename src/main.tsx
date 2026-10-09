import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Offline app shell for the installed (home-screen) build only; dev uses Vite's live reload.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}

// Reload the page when a newer build is deployed, so the app never runs an old version.
if (import.meta.env.PROD) {
  const current = document.querySelector<HTMLScriptElement>('script[type="module"]')?.getAttribute('src')
  const checkForUpdate = async () => {
    if (document.visibilityState !== 'visible' || !current) return
    try {
      const html = await fetch('./', { cache: 'no-store' }).then((r) => r.text())
      const latest = new DOMParser().parseFromString(html, 'text/html').querySelector<HTMLScriptElement>('script[type="module"]')?.getAttribute('src')
      if (latest && latest !== current) window.location.reload()
    } catch {
      /* offline or blocked: try again on the next check */
    }
  }
  setInterval(checkForUpdate, 3 * 60 * 1000)
  document.addEventListener('visibilitychange', checkForUpdate)
}
