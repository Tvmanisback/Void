import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";
import { Sandbox } from "railway";
import chromium from "@sparticuz/chromium";
import { chromium as playwrightChromium } from "playwright-core";

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RAILWAY_API_TOKEN", "RAILWAY_ENVIRONMENT_ID"];
for (const key of required) {
  if (!process.env[key]) {
    console.error("Missing required environment variable:", key);
    process.exit(1);
  }
}

const app = express();
const port = Number(process.env.PORT || 3000);
const allowedOrigins = new Set([
  "https://tvmanisback.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000"
]);
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.has(origin)) return res.status(403).json({ error: "Origin not allowed." });
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "16kb" }));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 45, standardHeaders: "draft-8", legacyHeaders: false }));

// Use Railway's standard Ubuntu sandbox image. Node.js is preinstalled;
// Python and Lua are installed after the VM starts, outside template builds.

const queues = new Map();
async function forUser(userId, task) {
  const previous = queues.get(userId) || Promise.resolve();
  const current = previous.catch(() => {}).then(task);
  queues.set(userId, current);
  try { return await current; }
  finally { if (queues.get(userId) === current) queues.delete(userId); }
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Sign in to use the Void runtime." });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ error: "Your sign-in session is invalid. Sign in again." });
  req.voidUser = data.user;
  next();
}

async function getUserSandbox(userId) {
  // Start with Railway's standard image. Do not attempt checkpoint/template
  // restoration until the first clean sandbox has been proven to work.
  const sandbox = await Sandbox.create({ idleTimeoutMinutes: 5 });

  const setup = await sandbox.exec(
    "apt-get update && apt-get install -y python3 lua5.4",
    { timeoutSec: 180 }
  );
  if (setup.exitCode !== 0) {
    await sandbox.destroy().catch(() => {});
    const details = (setup.stderr || setup.stdout || "Package installation failed.").slice(-1200);
    throw new Error("Could not prepare Python and Lua in the runtime: " + details);
  }

  const checkpointName = "void-user-v5-" + userId;
  const { error: saveError } = await admin.from("void_runtime_sessions").upsert({
    user_id: userId,
    sandbox_id: sandbox.id,
    checkpoint_name: checkpointName,
    updated_at: new Date().toISOString()
  }, { onConflict: "user_id" });

  if (saveError) {
    await sandbox.destroy().catch(() => {});
    throw new Error("Could not save your runtime session. Check the Supabase runtime table.");
  }

  return sandbox;
}


const browserSessions = new Map();
const BROWSER_IDLE_MS = 10 * 60 * 1000;
const browserLocks = new Map();

function validBrowserUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return null;
  let url;
  try { url = new URL(value); } catch { return null; }
  if (!["http:", "https:"].includes(url.protocol)) return null;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
      host === "0.0.0.0" || host === "::" || host === "::1" ||
      /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) ||
      host === "metadata.google.internal" || host === "169.254.169.254") return null;
  return url.href;
}

async function withBrowserLock(userId, task) {
  const previous = browserLocks.get(userId) || Promise.resolve();
  const current = previous.catch(() => {}).then(task);
  browserLocks.set(userId, current);
  try { return await current; }
  finally { if (browserLocks.get(userId) === current) browserLocks.delete(userId); }
}

async function getBrowserSession(userId) {
  let session = browserSessions.get(userId);
  if (session?.browser?.isConnected() && !session.page.isClosed()) {
    session.lastUsed = Date.now();
    return session;
  }
  if (session) browserSessions.delete(userId);
  const executablePath = await chromium.executablePath();
  const browser = await playwrightChromium.launch({
    args: chromium.args,
    executablePath,
    headless: true,
    defaultViewport: { width: 1365, height: 850 }
  });
  const context = await browser.newContext({
    viewport: { width: 1365, height: 850 },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: false
  });
  const page = await context.newPage();
  await page.route("**/*", async route => {
    const requestUrl = route.request().url();
    if (requestUrl.startsWith("data:") || requestUrl.startsWith("blob:") || requestUrl.startsWith("about:")) return route.continue();
    const safe = validBrowserUrl(requestUrl);
    if (!safe) return route.abort("blockedbyclient");
    return route.continue();
  });
  session = { browser, context, page, lastUsed: Date.now() };
  browserSessions.set(userId, session);
  browser.on("disconnected", () => {
    if (browserSessions.get(userId) === session) browserSessions.delete(userId);
  });
  return session;
}

async function browserNavigate(session, url) {
  const safeUrl = validBrowserUrl(url);
  if (!safeUrl) throw new Error("Enter a public HTTP or HTTPS website address.");
  try {
    await session.page.goto(safeUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  } catch (error) {
    if (!/timeout/i.test(error.message || "")) throw error;
  }
  session.lastUsed = Date.now();
  return { url: session.page.url(), title: await session.page.title().catch(() => "Browser") };
}

app.post("/api/browser/open", authenticate, async (req, res) => {
  const url = validBrowserUrl(req.body?.url);
  if (!url) return res.status(400).json({ error: "Enter a public HTTP or HTTPS website address." });
  try {
    const result = await withBrowserLock(req.voidUser.id, async () => {
      const session = await getBrowserSession(req.voidUser.id);
      return browserNavigate(session, url);
    });
    res.json({ ok: true, ...result, width: 1365, height: 850 });
  } catch (error) {
    console.error("Void browser launch/navigation failed:", error);
    res.status(503).json({ error: error.message || "The hosted browser could not start." });
  }
});

app.post("/api/browser/navigate", authenticate, async (req, res) => {
  const url = validBrowserUrl(req.body?.url);
  if (!url) return res.status(400).json({ error: "Enter a public HTTP or HTTPS website address." });
  try {
    const result = await withBrowserLock(req.voidUser.id, async () => {
      const session = await getBrowserSession(req.voidUser.id);
      return browserNavigate(session, url);
    });
    res.json({ ok: true, ...result, width: 1365, height: 850 });
  } catch (error) {
    res.status(503).json({ error: error.message || "Navigation failed." });
  }
});

app.get("/api/browser/screenshot", authenticate, async (req, res) => {
  const session = browserSessions.get(req.voidUser.id);
  if (!session || !session.browser.isConnected() || session.page.isClosed()) {
    return res.status(404).json({ error: "No active browser session. Open a website first." });
  }
  try {
    session.lastUsed = Date.now();
    const image = await session.page.screenshot({ type: "jpeg", quality: 68, fullPage: false, animations: "disabled" });
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("X-Void-Page-Width", "1365");
    res.setHeader("X-Void-Page-Height", "850");
    res.send(image);
  } catch (error) {
    res.status(503).json({ error: "Could not capture the browser screen." });
  }
});

app.post("/api/browser/input", authenticate, async (req, res) => {
  const session = browserSessions.get(req.voidUser.id);
  if (!session || !session.browser.isConnected() || session.page.isClosed()) {
    return res.status(404).json({ error: "Open a website before interacting with it." });
  }
  const body = req.body || {};
  try {
    await withBrowserLock(req.voidUser.id, async () => {
      const page = session.page;
      if (body.type === "click" && Number.isFinite(body.x) && Number.isFinite(body.y)) {
        await page.mouse.click(Math.max(0, Math.min(1365, body.x)), Math.max(0, Math.min(850, body.y)), { button: body.button === "right" ? "right" : "left" });
      } else if (body.type === "scroll") {
        await page.mouse.wheel(Number(body.deltaX) || 0, Math.max(-1200, Math.min(1200, Number(body.deltaY) || 0)));
      } else if (body.type === "key" && typeof body.key === "string" && body.key.length <= 32) {
        await page.keyboard.press(body.key);
      } else if (body.type === "text" && typeof body.text === "string" && body.text.length <= 4000) {
        await page.keyboard.insertText(body.text);
      } else if (body.type === "back") {
        await page.goBack({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
      } else if (body.type === "forward") {
        await page.goForward({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
      } else if (body.type === "reload") {
        await page.reload({ waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
      } else {
        throw new Error("Unsupported browser input.");
      }
      session.lastUsed = Date.now();
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message || "Browser input failed." });
  }
});

app.post("/api/browser/close", authenticate, async (req, res) => {
  const session = browserSessions.get(req.voidUser.id);
  if (session) {
    browserSessions.delete(req.voidUser.id);
    await session.browser.close().catch(() => {});
  }
  res.json({ ok: true });
});

setInterval(() => {
  const cutoff = Date.now() - BROWSER_IDLE_MS;
  for (const [userId, session] of browserSessions) {
    if (session.lastUsed < cutoff) {
      browserSessions.delete(userId);
      session.browser.close().catch(() => {});
    }
  }
}, 60_000).unref();

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "void-runtime" }));

app.post("/api/exec", authenticate, async (req, res) => {
  const command = req.body?.command;
  if (typeof command !== "string" || !command.trim() || command.length > 12000 || command.includes("\0")) {
    return res.status(400).json({ error: "Enter a command between 1 and 12,000 characters." });
  }

  try {
    const result = await forUser(req.voidUser.id, async () => {
      const sandbox = await getUserSandbox(req.voidUser.id);
      const output = await sandbox.exec(command, {
        timeoutSec: 10
      });
      const checkpointName = "void-user-v4-" + req.voidUser.id;
      await sandbox.checkpoint(checkpointName);
      const { error: checkpointSaveError } = await admin.from("void_runtime_sessions")
        .update({
          sandbox_id: sandbox.id,
          checkpoint_name: checkpointName,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", req.voidUser.id);
      if (checkpointSaveError) throw new Error("Command ran, but the workspace checkpoint could not be saved.");
      return output;
    });
    res.json({
      exitCode: result.exitCode,
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      timedOut: Boolean(result.timedOut),
      truncated: Boolean(result.truncated)
    });
  } catch (error) {
    console.error("Void runtime execution failed:", error);
    res.status(503).json({ error: error.message || "The runtime could not start. Check the Railway service configuration." });
  }
});

app.listen(port, "0.0.0.0", () => console.log("Void runtime API listening on", port));
