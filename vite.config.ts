
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom plugin to copy root assets (icon.png, manifest.json, etc.) to dist/
const copyRootAssets = () => {
  return {
    name: 'copy-root-assets',
    closeBundle: async () => {
      const filesToCopy = ['icon.png', 'manifest.json', 'service-worker.js', 'privacy.html', 'delete-account.html'];
      const distDir = path.resolve(__dirname, 'dist');
      
      if (!fs.existsSync(distDir)) return;

      filesToCopy.forEach(file => {
        const srcPath = path.resolve(__dirname, file);
        const destPath = path.join(distDir, file);
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, destPath);
          console.log(`[Asset Copier] Copied ${file} to dist/`);
        }
      });
    }
  };
};

// Custom plugin to serve Vercel API routes locally
const vercelApiPlugin = () => {
  return {
    name: 'vercel-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith('/api/')) {
          try {
            // Parse URL to get the file path
            const url = new URL(req.url, `http://${req.headers.host}`);
            let filePath = path.join(__dirname, url.pathname + '.js');
            
            if (!fs.existsSync(filePath)) {
               filePath = path.join(__dirname, url.pathname, 'index.js');
            }

            if (fs.existsSync(filePath)) {
              // Dynamically import the API handler
              const module = await import(/* @vite-ignore */ filePath + '?t=' + Date.now());
              const handler = module.default;
              
              if (handler) {
                // Parse body for POST requests
                if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
                  let body = '';
                  req.on('data', chunk => { body += chunk.toString(); });
                  req.on('end', async () => {
                    try {
                      req.body = body ? JSON.parse(body) : {};
                    } catch (e) {
                      req.body = body;
                    }
                    
                    // Mock Vercel response object methods
                    res.status = (code) => { res.statusCode = code; return res; };
                    res.json = (data) => {
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify(data));
                    };
                    res.send = (data) => { res.end(data); };
                    
                    await handler(req, res);
                  });
                } else {
                  // Mock Vercel response object methods
                  res.status = (code) => { res.statusCode = code; return res; };
                  res.json = (data) => {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(data));
                  };
                  res.send = (data) => { res.end(data); };
                  
                  await handler(req, res);
                }
                return;
              }
            }
          } catch (error) {
            console.error('Local API Error:', error);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Internal Server Error', details: error.message }));
            return;
          }
        }
        next();
      });
    }
  };
};

// https://vitejs.dev/config/
export default defineConfig(() => {
  return {
    plugins: [
      react(),
      copyRootAssets(),
      vercelApiPlugin()
    ],
    // Ensure relative paths for Android WebView
    base: './',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      minify: 'esbuild',
      target: 'es2020',
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
        },
        output: {
          // Manual chunks to separate vendor code (React, etc) from app code
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom')) {
                return 'vendor-react';
              }
              // Fix circular dependencies by grouping all mobile/native libs together
              if (id.includes('@capacitor') || id.includes('codetrix') || id.includes('revenuecat')) {
                return 'vendor-capacitor';
              }
              return 'vendor-libs';
            }
          }
        }
      }
    },
    server: {
      port: 3000,
      host: true
    }
  };
});
