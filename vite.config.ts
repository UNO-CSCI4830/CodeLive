import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const backendTarget = process.env.VITE_BACKEND_URL || "http://localhost:5000";
const backendSecure = backendTarget.startsWith("https://");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: backendTarget,
        changeOrigin: true,
        secure: backendSecure,
      },
      "/health": {
        target: backendTarget,
        changeOrigin: true,
        secure: backendSecure,
      },
      "/ws": {
        target: backendTarget,
        ws: true,
        changeOrigin: true,
        secure: backendSecure,
      },
    },
  },
});
