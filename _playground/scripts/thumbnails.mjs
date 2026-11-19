import { spawn, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { createServer } from "node:net";
import { setTimeout as pause } from "node:timers/promises";
import { chromium } from "playwright";
import sharp from "sharp";
import { discover, generateRegistry } from "./registry.mjs";

const args = process.argv.slice(2);
const slugs = args.filter((arg) => !arg.startsWith("--"));
if (
  args.some(
    (arg) => arg.startsWith("--") && !["--missing", "--slug"].includes(arg),
  )
)
  throw Error("Use --slug NAME [NAME ...] or --missing.");
const all = discover();
for (const slug of slugs)
  if (!all.some((p) => p.slug === slug))
    throw Error("Unknown prototype: " + slug);
const targets = all.filter(
  (p) =>
    (!slugs.length || slugs.includes(p.slug)) &&
    (!args.includes("--missing") || !p.preview),
);
if (!targets.length) {
  console.log("All requested thumbnails are present.");
  process.exit(0);
}
const password = randomBytes(32).toString("hex");
const env = { ...process.env, PLAYGROUND_PASSWORD: password };
execFileSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
  env,
  stdio: "inherit",
});
const socket = createServer();
await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const origin = "http://127.0.0.1:" + port;
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "-H",
    "127.0.0.1",
    "-p",
    String(port),
  ],
  { env, stdio: "inherit" },
);
let browser;
const temp = await mkdtemp(".capture-");
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error("Production server exited");
    try {
      ready = (await fetch(origin + "/login")).ok;
    } catch {}
    if (ready) break;
    await pause(200);
  }
  if (!ready) throw Error("Production server timed out");
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  await mkdir("public/thumbnails", { recursive: true });
  for (const p of targets) {
    const staged = [];
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width: 1360, height: 850 },
        colorScheme: theme,
        reducedMotion: "reduce",
      });
      try {
        const auth = await context.request.post(origin + "/api/auth", {
          data: { password },
        });
        if (!auth.ok()) throw Error("Capture login failed");
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const response = await page.goto(origin + "/prototypes/" + p.slug);
        if (!response.ok() || page.url().includes("/login"))
          throw Error("Prototype failed to load: " + p.slug);
        await page.locator("html." + theme).waitFor();
        await page.evaluate(() => document.fonts.ready);
        const subject = page.locator("[data-thumbnail]");
        const target = (await subject.count())
          ? subject.first()
          : page.locator("main").first();
        const png = await target.screenshot({ animations: "disabled" });
        if (errors.length) throw Error(errors.join("\n"));
        const name = p.slug + "-" + theme + ".webp";
        await sharp(png)
          .resize({ width: 960, withoutEnlargement: true })
          .webp({ quality: 88 })
          .toFile(join(temp, name));
        staged.push(name);
      } finally {
        await context.close();
      }
    }
    for (const name of staged)
      await rename(join(temp, name), join("public/thumbnails", name));
    console.log("Captured " + p.slug);
  }
  generateRegistry();
} finally {
  await browser?.close();
  server.kill();
  await rm(temp, { recursive: true, force: true });
}
