import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const apiInternalPort = Number(process.env.API_INTERNAL_PORT || process.env.API_PORT || 4000);
  const vitePort = Number(process.env.PORT) || getDashboardPort(process.env.DASHBOARD_URL);
  const allowedHosts = getAllowedHosts(process.env.DASHBOARD_URL);

  const isLocalDev = !allowedHosts || allowedHosts === true;
  const plugins = [tailwindcss()];
  if (isLocalDev) {
    plugins.unshift(react());
  }

  return {
    plugins,
    server: {
      port: vitePort,
      strictPort: true,
      host: '0.0.0.0',
      allowedHosts,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiInternalPort}`,
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

function getAllowedHosts(dashboardUrl: string | undefined): string[] | true {
  if (!dashboardUrl) {
    return true;
  }

  try {
    const url = new URL(dashboardUrl);
    const host = url.hostname;

    if (host === 'localhost' || host === '127.0.0.1') {
      return true;
    }

    return [host, `.${host}`];
  } catch {
    return true;
  }
}

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
