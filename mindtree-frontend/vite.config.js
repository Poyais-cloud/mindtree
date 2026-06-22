import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

const DEFAULT_DEV_PROXY_TARGET = 'http://localhost:3000'

export function resolveDevProxyTarget(env = {}) {
  const configuredTarget = [
    env.VITE_DEV_PROXY_TARGET,
    env.VITE_API_BASE_URL,
  ].find(value => typeof value === 'string' && value.trim())

  return (configuredTarget || DEFAULT_DEV_PROXY_TARGET).trim().replace(/\/+$/, '')
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devProxyTarget = resolveDevProxyTarget(env)

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: devProxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
