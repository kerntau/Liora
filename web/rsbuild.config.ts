import { defineConfig, loadEnv } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

import { APP_CONFIG } from "./src/config/app-config";
import routes from "./src/routes.json";
import { getThemeBootScript } from "./src/scripts/theme-boot";

const { parsed, publicVars } = loadEnv({ prefixes: ["PUBLIC_LIORA_"] });
const routePaths = new Set(Object.values(routes));

export default defineConfig({
  plugins: [pluginReact({ reactCompiler: true })],
  source: {
    entry: { index: "./src/main.tsx" },
    define: {
      ...publicVars,
      "process.env.PUBLIC_LIORA_SSE_BASE": JSON.stringify(
        process.env.PUBLIC_LIORA_SSE_BASE ?? parsed.PUBLIC_LIORA_SSE_BASE ?? "",
      ),
    },
  },
  html: {
    template: "./index.html",
    templateParameters: {
      title: APP_CONFIG.meta.title,
      description: APP_CONFIG.meta.description,
      themeBootScript: getThemeBootScript(),
    },
  },
  output: {
    distPath: { root: "dist" },
    copy: [
      { from: "./src/routes.json", to: "routes.json" },
      { from: "./src/assets/fonts/LICENSE.txt", to: "static/font/LICENSE.txt" },
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    htmlFallback: false,
    historyApiFallback: {
      rewrites: [
        {
          from: /./,
          to: ({ parsedUrl }) => {
            const pathname = parsedUrl.pathname ?? "/";
            const normalized = pathname.replace(/\/+$/, "") || "/";
            return routePaths.has(normalized) ? "/index.html" : pathname;
          },
        },
      ],
    },
    proxy: {
      "/api": {
        target: process.env.LIORA_API ?? parsed.LIORA_API ?? "http://127.0.0.1:8787",
        changeOrigin: true,
        proxyTimeout: 0,
        timeout: 0,
      },
    },
  },
});
