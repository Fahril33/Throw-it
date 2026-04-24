import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/socket.io": {
        target: process.env.VITE_BACKEND_URL ?? "http://localhost:3010",
        ws: true
      },
      "/api": {
        target: process.env.VITE_BACKEND_URL ?? "http://localhost:3010"
      }
    },
    allowedHosts: [
      ".pinggy.io",
      ".pinggy-free.link",
      "serveo.net",
      ".loca.lt",
      ".ngrok-free.app",
      ".trycloudflare.com"
    ]
  }
});
