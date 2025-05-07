/// <reference types="node" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@shared": resolve(__dirname, "../shared"),
      "@types": resolve(__dirname, "./src/types"),
      "@backend": resolve(__dirname, "../backend-smartproject/src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://api.smartproject.in.net',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path
      }
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
