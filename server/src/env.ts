import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Side-effect import: must be the first import in `index.ts` so module-level
 * reads (e.g. `sessionSecret` in auth.ts) see the values.
 * Loads the monorepo-root `.env` too, because the server runs with cwd `server/`.
 */
const here = dirname(fileURLToPath(import.meta.url));

loadEnv({ path: resolve(here, "../.env") }); // server/.env
loadEnv({ path: resolve(here, "../../.env") }); // repo root .env
loadEnv(); // cwd fallback
