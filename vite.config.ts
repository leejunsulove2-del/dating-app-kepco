import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, Plugin } from "vite";

function leafletSafePlugin(): Plugin {
  return {
    name: "vite-plugin-leaflet-safe",
    enforce: "pre",
    transform(code: string, id: string) {
      if (id.includes("leaflet")) {
        let transformed = code;

        transformed = transformed.replace(
          /return\s+\(\(\s*\[A-Z0-9_\$]+,\s*\[A-Z0-9_\$]+\s*\]\)\s*=>\s*new\s+Point\(0,\s*0\)\)/g,
          "return (L && L._leaflet_pos) ? L._leaflet_pos : new Point(0, 0);"
        );

        transformed = transformed.replace(
          /if\s*\(\s*\!\[A-Z0-9_\$]+\s*\|\s*\!\[A-Z0-9_\$]+\.leaflet_pos\s*\)\s*=>\s*\{\s*if\s*\(\s*\!\[A-Z0-9_\$]+\s*\)\s*=>\s*\{\s*\}\s*\}/g,
          "if (!L || !L._leaflet_pos) { return; }"
        );

        return {
          code: transformed,
          map: null,
        };
      }
      return null;
    },
  };
}

export default defineConfig(() => ({
  // GitHub Pages 저장소 경로에 맞게 고정값으로 수정
  base: "/dating-app-kepco/",
  plugins: [leafletSafePlugin(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    "process.env.DISABLE_HM": "false",
    watch: process.env.DISABLE_HMR === "true" ? null : {},
  },
}));
