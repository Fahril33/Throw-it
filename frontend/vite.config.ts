import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/socket.io": {
        // Use 127.0.0.1 to avoid IPv6 localhost (::1) mismatch when backend binds IPv4 only.
        target: process.env.VITE_BACKEND_URL ?? "http://127.0.0.1:3000",
        ws: true
      },
      "/api": {
        target: process.env.VITE_BACKEND_URL ?? "http://127.0.0.1:3000"
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
