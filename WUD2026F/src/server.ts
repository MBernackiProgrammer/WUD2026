import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
const allowedHosts = process.env['NG_ALLOWED_HOSTS']
  ?.split(',')
  .map((host) => host.trim())
  .filter(Boolean);
const angularApp = new AngularNodeAppEngine({
  ...(allowedHosts?.length ? { allowedHosts } : {}),
  trustProxyHeaders:
    process.env['TRUST_PROXY_HEADERS'] === 'true'
      ? ['x-forwarded-for', 'x-forwarded-proto', 'x-forwarded-host']
      : false,
});

// Only explicitly public URLs are exposed; never serialize process.env.
app.get('/runtime-config.js', (_req, res) => {
  const config = {publicApiUrl: process.env['PUBLIC_API_URL'] || '/api', publicAdminUrl: process.env['PUBLIC_ADMIN_URL'] || '/admin/'};
  res.setHeader('Cache-Control', 'no-store');
  res.type('application/javascript').send('window.__FILHARMONIA_CONFIG__ = ' + JSON.stringify(config) + ';');
});
app.get('/_health', (_req, res) => res.status(200).send('ok'));

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use('/**', (req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Start the server if this module is the main entry point.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(Number(port), process.env['HOST'] || '0.0.0.0', () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
