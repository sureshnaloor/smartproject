import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as true,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  
  // Handle all routes that should be handled by the client-side router
  const clientRoutes = [
    '/',
    '/projects/:projectId',
    '/projects/:projectId/wbs',
    '/projects/:projectId/schedule',
    '/projects/:projectId/costs',
    '/projects/:projectId/reports'
  ];
  
  // Create regex patterns for each route
  const clientRoutePatterns = clientRoutes.map(route => 
    new RegExp('^' + route.replace(/:\w+/g, '[^/]+') + '/?$')
  );
  
  // Serve index.html for all client-side routes
  app.get('*', async (req, res, next) => {
    const url = req.originalUrl;
    
    // Skip API routes - they should be handled by the server
    if (url.startsWith('/api/')) {
      return next();
    }
    
    // Check if this is a client route
    const isClientRoute = clientRoutePatterns.some(pattern => pattern.test(url));
    
    // If it's a known client route or the root, serve the index.html
    if (isClientRoute || url === '/') {
      try {
        const clientTemplate = path.resolve(
          import.meta.dirname,
          "..",
          "client",
          "index.html",
        );

        // always reload the index.html file from disk incase it changes
        let template = await fs.promises.readFile(clientTemplate, "utf-8");
        template = template.replace(
          `src="/src/main.tsx"`,
          `src="/src/main.tsx?v=${nanoid()}"`,
        );
        const page = await vite.transformIndexHtml(url, template);
        return res.status(200).set({ "Content-Type": "text/html" }).end(page);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        return next(e);
      }
    }
    
    // For other routes, let the static middleware handle it first
    next();
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Handle all routes that should be handled by the client-side router
  const clientRoutes = [
    '/',
    '/projects/:projectId',
    '/projects/:projectId/wbs',
    '/projects/:projectId/schedule',
    '/projects/:projectId/costs',
    '/projects/:projectId/reports'
  ];
  
  // Create regex patterns for each route
  const clientRoutePatterns = clientRoutes.map(route => 
    new RegExp('^' + route.replace(/:\w+/g, '[^/]+') + '/?$')
  );

  // Serve static assets
  app.use(express.static(distPath));

  // Serve index.html for all client-side routes
  app.get('*', (req, res, next) => {
    const url = req.originalUrl;
    
    // Skip API routes - they should be handled by the server
    if (url.startsWith('/api/')) {
      return next();
    }
    
    // Check if this is a client route
    const isClientRoute = clientRoutePatterns.some(pattern => pattern.test(url));
    
    // If it's a known client route or the root, serve the index.html
    if (isClientRoute || url === '/') {
      return res.sendFile(path.resolve(distPath, "index.html"));
    }
    
    // For unknown routes, serve 404
    next();
  });
}
