/**
 * Builds the site for Vercel (Build Output API v3) into apps/web/.vercel/output.
 * The site is fully static: it reads the contract and the DAO straight from
 * NEAR testnet in the browser, so there is no server and no secret.
 * Deploy with: vercel deploy --prebuilt --prod   (from apps/web)
 */
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = `${root}.vercel/output`;

execSync("pnpm exec vite build", { stdio: "inherit", cwd: root });
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(`${root}dist`, `${out}/static`, { recursive: true });
writeFileSync(
  `${out}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        {
          src: "/(.*)",
          headers: {
            "x-content-type-options": "nosniff",
            "referrer-policy": "strict-origin-when-cross-origin",
            "x-frame-options": "DENY",
            "permissions-policy": "camera=(), microphone=(), geolocation=()",
          },
          continue: true,
        },
        { src: "^/assets/(.*)$", headers: { "cache-control": "public, max-age=31536000, immutable" }, continue: true },
        { handle: "filesystem" },
        // Single-page app: unknown paths load it and it routes itself.
        { src: "/(.*)", dest: "/index.html" },
      ],
    },
    null,
    2,
  ),
);
console.log(`built ${out}`);
