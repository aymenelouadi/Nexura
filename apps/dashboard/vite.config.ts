import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const apiPort = Number(process.env.API_PORT ?? 4000);
  const dashboardPort = getDashboardPort(process.env.DASHBOARD_URL);

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: dashboardPort,
      strictPort: true,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
    build: {
      target: 'es2022',
      sourcemap: true,
    },
  };
});

function getDashboardPort(dashboardUrl: string | undefined): number {
  if (!dashboardUrl) {
    return 5173;
  }

  try {
    const url = new URL(dashboardUrl);
    if (url.port) {
      return Number(url.port);
    }
    return url.protocol === 'https:' ? 443 : 80;
  } catch {
    return 5173;
  }
}
