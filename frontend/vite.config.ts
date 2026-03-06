import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

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
        target: process.env.VITE_BACKEND_URL || "http://localhost:5000",
        changeOrigin: true,
        secure: true,
      },
      "/health": {
        target: process.env.VITE_BACKEND_URL || "http://localhost:5000",
        changeOrigin: true,
        secure: true,
      },
      "/ws": {
        target: (process.env.VITE_BACKEND_URL || "http://localhost:5000").replace("https://", "wss://").replace("http://", "ws://"),
        ws: true,
      },
    },
  },
});
