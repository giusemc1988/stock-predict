export interface JarvisConfig {
  jarvisValidatorOn: boolean
  jarvisRouterOn: boolean
  jarvisLearnerOn: boolean
}

export const jarvisDefaults: JarvisConfig = {
  jarvisValidatorOn: false,
  jarvisRouterOn: false,
  jarvisLearnerOn: false,
}

const CONFIG_KEY = 'arc.jarvis-config.v1'

export function getJarvisConfig(): JarvisConfig {
  if (typeof window === 'undefined') {
    return jarvisDefaults
  }

  try {
    const stored = localStorage.getItem(CONFIG_KEY)
    if (stored) {
      return JSON.parse(stored) as JarvisConfig
    }
  } catch (err) {
    console.error('Failed to load Jarvis config:', err)
  }

  return { ...jarvisDefaults }
}

export function saveJarvisConfig(config: JarvisConfig): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  } catch (err) {
    console.error('Failed to save Jarvis config:', err)
  }
}
