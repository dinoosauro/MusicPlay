import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { writeFileSync } from 'fs';

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte(), {
    name: "Build FFmpeg WebAssembly for Workers",
    buildStart: async() => {
      const req = await fetch("https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js");
      writeFileSync("public/ffmpeg.min.js", (await req.text()).replace("document.baseURI||", ""));
    }
  }],
    build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`
      }
    }
  },
  base: "",
})
