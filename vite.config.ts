import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function leafletSafePlugin(): Plugin {
  return {
    name: 'vite-plugin-leaflet-safe',
    enforce: 'pre',
    transform(code: string, id: string) {
      if (id.includes('leaflet')) {
        let transformed = code;
        transformed = transformed.replace(
          /return\s+([a-zA-Z0-9_$]+)\._leaflet_pos\s*\|\|\s*new\s+Point\(0,\s*0\);/g,
          'return ($1 && $1._leaflet_pos) ? $1._leaflet_pos : new Point(0, 0);'
        );
        transformed = transformed.replace(
          /([a-zA-Z0-9_$]+)\._leaflet_pos\s*=\s*([a-zA-Z0-9_$]+);/g,
          'if ($1) { $1._leaflet_pos = $2; }'
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

export default defineConfig(() => {
  return {
    plugins: [leafletSafePlugin(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
