import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// For GitHub Pages set VITE_BASE_PATH="/REPO_NAME/". For Vercel leave unset.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH ?? "/"
});
