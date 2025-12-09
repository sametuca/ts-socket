import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    root: 'client',
    publicDir: 'public',
    server: {
        port: 5173,
        open: true
    },
    build: {
        outDir: '../dist/client',
        emptyOutDir: true
    },
    resolve: {
        alias: {
            '@shared': resolve(__dirname, 'shared')
        }
    }
});
