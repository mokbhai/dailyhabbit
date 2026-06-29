import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticHostServer, discoverMountedSites } from './static-host.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

const host = process.env.HOST ?? '0.0.0.0';
const port = Number.parseInt(process.env.PORT ?? '4321', 10);

// Each subdirectory of SITES_DIR is a static frontend build staged by
// scripts/build-frontends.mjs. The primary frontend is mounted at /, every
// other frontend at /<dir-name>. Adding a frontend requires no change here.
const sitesDir = process.env.SITES_DIR ?? path.resolve(moduleDir, '../sites');
const primaryFrontend = process.env.PRIMARY_FRONTEND ?? 'web';

const sites = discoverMountedSites(sitesDir, primaryFrontend);

const server = createStaticHostServer({ sites });

server.listen(port, host, () => {
  console.log(`Web host listening on http://${host}:${port}`);
  for (const site of sites) {
    console.log(
      `${site.name} mounted at ${site.basePath} from ${site.rootDir}`,
    );
  }
});
