import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";
import { Sandbox } from "railway";

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

const template = Sandbox.template().workdir("/app");

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
  const { data: saved, error: readError } = await admin
    .from("void_runtime_sessions")
    .select("sandbox_id, checkpoint_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw new Error("Could not load your runtime session. Check the Supabase runtime table.");

  const checkpointName = saved?.checkpoint_name || ("void-user-" + userId);
  if (saved?.sandbox_id) {
    try {
      const existing = await Sandbox.connect(saved.sandbox_id);
      const check = await existing.exec("pwd", { cwd: "/app", timeoutSec: 10, ephemeral: true });
      if (check.exitCode === 0) return existing;
    } catch {
      // The idle timeout may have destroyed the VM. Restore the last saved workspace.
    }
  }

  let sandbox;
  let needsLanguageSetup = false;
  if (saved?.checkpoint_name) {
    try {
      sandbox = await Sandbox.create(checkpointName, { idleTimeoutMinutes: 5 });
    } catch {
      // If the checkpoint is unavailable, start from Railway's standard base image.
      sandbox = await Sandbox.create(template, { idleTimeoutMinutes: 5 });
      needsLanguageSetup = true;
    }
  } else {
    sandbox = await Sandbox.create(template, { idleTimeoutMinutes: 5 });
    needsLanguageSetup = true;
  }

  if (needsLanguageSetup) {
    const setup = await sandbox.execHttp(
      "apt-get update && apt-get install -y python3 lua5.4 && ln -sf /usr/bin/python3 /usr/local/bin/python && ln -sf /usr/bin/lua5.4 /usr/local/bin/lua",
      { timeoutSec: 120 }
    );
    if (setup.exitCode !== 0) {
      await sandbox.destroy().catch(() => {});
      throw new Error("The base sandbox started, but installing Python and Lua failed: " + (setup.stderr || setup.stdout || "unknown package installation error"));
    }
  }

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
        cwd: "/app",
        timeoutSec: 120,
        maxOutputBytes: 16000
      });
      const checkpointName = "void-user-" + req.voidUser.id;
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
