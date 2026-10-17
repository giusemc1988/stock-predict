import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { defineConfig } from 'vite'

/** The home agent's token (npm run agent writes it), so the local app can reach the agent like the Worker does. */
function agentToken(): string {
  try {
    return process.env.AGENT_TOKEN ?? readFileSync(join(homedir(), '.jarvis-agent', 'token'), 'utf8').trim()
  } catch {
    return ''
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths so the build works from any host path (Netlify root or GitHub Pages subfolder).
  base: './',
  plugins: [react()],
  server: {
    proxy: {
      // local dev: /api/home/* goes straight to the home agent on this PC (the Worker does this online)
      '/api/home': {
        target: 'http://127.0.0.1:8787',
        rewrite: (p) => p.replace(/^\/api\/home/, '/api'),
        configure: (proxy) => proxy.on('proxyReq', (req) => req.setHeader('authorization', `Bearer ${agentToken()}`)),
      },
    },
  },
})
