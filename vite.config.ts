import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";





import { contentPlugin } from "./export-plugins/content-plugin/index.ts";import { mediaAssetsPlugin } from "./export-plugins/media-assets-plugin.ts";
function extractHostname(value: string): string {
  try {
    if (value.includes("://")) {
      return new URL(value).hostname;
    }
    return value;
  } catch {
    return value;
  }
}
function apiDevPlugin(): Plugin {
  // Routes that must be handled by Express, not the SPA fallback
  const SERVER_ROUTES = ['/api', '/auth/login', '/auth/callback', '/auth/logout', '/admin/login', '/admin/auth/callback', '/admin/logout'];
  return {
    name: "api-dev",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        const isServerRoute = SERVER_ROUTES.some((r) => url === r || url.startsWith(r + '/') || url.startsWith(r + '?'));
        if (!isServerRoute) return next();
        try {
          const mod = await server.ssrLoadModule("/src/server/entry.ts");
          const handler = mod.default;
          handler(req, res, next);
        } catch (err) {
          if (err instanceof Error) server.ssrFixStacktrace(err);
          next(err);
        }
      });

      // SPA fallback: serve index.html for all non-API, non-asset GET requests
      // so hard-refreshing /admin/*, /dashboard/*, etc. works in dev.
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        // Skip API routes, assets, and requests with file extensions
        if (url.startsWith('/api/') || url.startsWith('/@') || url.startsWith('/node_modules/')) return next();
        if (/\.[a-zA-Z0-9]+$/.test(url)) return next();
        // Let Vite handle it as an HTML request (triggers SSR transform + HMR)
        req.url = '/';
        next();
      });
    }
  };
}
const allowedHosts: string[] = [];
const corsOrigins: string[] = [];
if (process.env.FRONTEND_DOMAIN) {
  const frontendHost = extractHostname(process.env.FRONTEND_DOMAIN);
  allowedHosts.push(frontendHost);
  corsOrigins.push(`http://${frontendHost}`, `https://${frontendHost}`);
}
if (process.env.ALLOWED_ORIGINS) {
  const origins = process.env.ALLOWED_ORIGINS.split(",");
  allowedHosts.push(...origins.map(extractHostname));
  corsOrigins.push(...origins);
}
if (process.env.VITE_PARENT_ORIGIN) {
  allowedHosts.push(extractHostname(process.env.VITE_PARENT_ORIGIN));
  corsOrigins.push(process.env.VITE_PARENT_ORIGIN);
}
if (allowedHosts.length === 0) {
  allowedHosts.push("*");
}
if (corsOrigins.length === 0) {
  corsOrigins.push("*");
}
export default defineConfig(({
  mode,
  isSsrBuild
}) => ({
  envPrefix: ["VITE_", "SITE_"],
  plugins: [contentPlugin(), react({
    babel: {
      plugins: []
    }
  }), apiDevPlugin(), mediaAssetsPlugin()],
  resolve: {
    dedupe: ["react", "react-dom", "react-router-dom"],
    alias: {
      nothing: "/src/fallbacks/missingModule.ts",
      "@/api": path.resolve(__dirname, "./src/server/api"),
      "@": path.resolve(__dirname, "./src")
    }
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom", "motion/react"], exclude: ["drizzle-orm", "mysql2"]
  },
  ssr: isSsrBuild ? {
    // Bundle everything EXCEPT large pure-Node packages that are safe to
    // require() at runtime. Externalising them keeps the server bundle small
    // and prevents the publish-time OOM "Killed" error.
    // Only externalize true native addons — everything else must be bundled
    // because the deployed environment has no node_modules folder.
    noExternal: /^(?!(better-sqlite3|bindings|file-uri-to-path)$)/
  } : {},
  server: {
    host: process.env.HOST || "0.0.0.0",
    port: parseInt(process.env.PORT || "5173"),
    strictPort: !!process.env.PORT,
    allowedHosts,
    cors: {
      origin: corsOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Accept", "User-Agent"]
    },
    hmr: {
      overlay: false
    },
    watch: {
      ignored: ["**/dist/**"]
    }
  },
  preview: {
    host: process.env.HOST || "0.0.0.0",
    port: parseInt(process.env.PORT || "5173"),
    strictPort: !!process.env.PORT,
    allowedHosts,
    cors: {
      origin: corsOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Accept", "User-Agent"]
    }
  },
  build: isSsrBuild ? {
    outDir: "dist",
    emptyOutDir: false,
    copyPublicDir: false,
    ssr: "src/server/entry.ts",
    rollupOptions: {
      output: {
        format: "es",
        entryFileNames: "server.bundle.mjs",
        chunkFileNames: "bin/[name]-[hash].js",
        banner: "import { createRequire } from 'module';\nimport { fileURLToPath as __fup } from 'url';\nimport { dirname as __dn } from 'path';\nconst require = createRequire(import.meta.url);\nconst __filename = __fup(import.meta.url);\nconst __dirname = __dn(__filename);"
      }
    }
  } : {
    outDir: "dist/client",
    emptyOutDir: true,
    copyPublicDir: true,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // React core — must be its own chunk so every other chunk can share it
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/scheduler/')) {
            return 'react-vendor';
          }
          // React Router
          if (id.includes('node_modules/react-router') || id.includes('node_modules/@remix-run/')) {
            return 'router';
          }
          // Radix UI primitives
          if (id.includes('node_modules/@radix-ui/')) {
            return 'radix-ui';
          }
          // Motion / Framer
          if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) {
            return 'motion';
          }
          // Lucide icons
          if (id.includes('node_modules/lucide-react')) {
            return 'lucide';
          }
          // TanStack Query
          if (id.includes('node_modules/@tanstack/')) {
            return 'query';
          }
          // Markdown rendering (react-markdown, remark, rehype, micromark, etc.)
          if (
          id.includes('node_modules/react-markdown') ||
          id.includes('node_modules/remark') ||
          id.includes('node_modules/rehype') ||
          id.includes('node_modules/micromark') ||
          id.includes('node_modules/unified') ||
          id.includes('node_modules/mdast') ||
          id.includes('node_modules/hast') ||
          id.includes('node_modules/vfile') ||
          id.includes('node_modules/unist'))
          {
            return 'markdown';
          }
          // Stripe.js
          if (id.includes('node_modules/@stripe/') || id.includes('node_modules/stripe')) {
            return 'stripe';
          }
          // Date / utility libs
          if (id.includes('node_modules/date-fns') || id.includes('node_modules/dayjs')) {
            return 'date-utils';
          }
          // Everything else in node_modules goes into a shared vendor chunk
          if (id.includes('node_modules/')) {
            return 'vendor';
          }
        }
      }
    }
  }
}));