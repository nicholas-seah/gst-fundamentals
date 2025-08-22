// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import netlify from '@astrojs/netlify';

export default defineConfig({
  site: 'https://gst-fundamentals.netlify.app', // Replace with your actual Netlify domain
  integrations: [react(), tailwind()],
  output: 'server',
  adapter: netlify(),
  build: {
    assets: '_astro'
  },
  vite: {
    build: {
      rollupOptions: {
        external: ['@prisma/client']
      }
    },
    define: {
      // Ensure assets load from correct domain
      'import.meta.env.ASSET_URL': JSON.stringify('https://gst-fundamentals.netlify.app') // Replace with your actual domain
    }
  }
}); 