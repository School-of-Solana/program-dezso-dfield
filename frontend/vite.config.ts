import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Makes "buffer" available in the browser bundle
      buffer: "buffer",
    },
  },
  optimizeDeps: {
    include: ["buffer"],
  },
});