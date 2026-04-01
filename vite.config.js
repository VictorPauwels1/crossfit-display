import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        display: resolve(__dirname, "display.html"),
        remote:  resolve(__dirname, "remote.html"),
      },
    },
  },
});
