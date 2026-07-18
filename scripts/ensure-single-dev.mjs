/**
 * Refuses to start a second dev server for THIS project.
 *
 * Two `next dev` processes in the same folder share one .next directory and
 * corrupt each other's compiled chunks — symptoms: unstyled pages, random
 * 404s for pages that exist, "[object Object]" overlays, and
 * "Cannot find module './vendor-chunks/…'" errors.
 *
 * Runs automatically via the npm `predev` hook.
 */
import { execSync } from "node:child_process";

let ps = "";
try {
  ps = execSync("ps ax -o pid=,command=", { encoding: "utf8" });
} catch {
  process.exit(0); // can't inspect processes — don't block the dev server
}

const marker = `${process.cwd()}/node_modules/.bin/next`;
const rogue = ps
  .split("\n")
  .filter((l) => l.includes(marker) && / dev\b/.test(l))
  .map((l) => Number(l.trim().split(/\s+/)[0]))
  .filter((pid) => pid && pid !== process.pid && pid !== process.ppid);

if (rogue.length > 0) {
  console.error(
    `\n✋ A dev server for this project is already running (PID ${rogue.join(", ")}).\n` +
      `   Two dev servers share .next and corrupt each other.\n` +
      `   Use the running one, or stop it first:  pkill -f "next dev"\n`,
  );
  process.exit(1);
}
