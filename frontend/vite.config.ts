import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/socket.io": {
        target: process.env.VITE_BACKEND_URL ?? "http://localhost:3000",
        ws: true
      },
      "/api": {
        target: process.env.VITE_BACKEND_URL ?? "http://localhost:3000"
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
