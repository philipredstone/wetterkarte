// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

import robotsTxt from 'astro-robots-txt';

// https://astro.build/config
export default defineConfig({
    site: 'https://wetterkarte.org',
    integrations: [sitemap(), robotsTxt()],
    build: {
        assets: 'assets',
        // format: 'file',
    },
    vite: {
        build: {
            sourcemap: false,
            inlineStylesheets: `never`,
        },
        resolve: {
            preserveSymlinks: true
        },
        css: {
            devSourcemap: false,
            transformer: 'postcss'
        }
    }
});