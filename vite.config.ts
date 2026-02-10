import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/kentem-re-hiramatsu.github.io/",
  plugins: [react()],
});
