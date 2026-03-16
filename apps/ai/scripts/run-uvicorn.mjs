import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");

const isWindows = process.platform === "win32";
const pythonPath = isWindows
  ? path.join(appRoot, ".venv", "Scripts", "python.exe")
  : path.join(appRoot, ".venv", "bin", "python");

if (!existsSync(pythonPath)) {
  console.error(`[codinator/ai] Python executable not found: ${pythonPath}`);
  console.error(
    "[codinator/ai] First create the virtual environment and install dependencies in apps/ai."
  );
  process.exit(1);
}

const extraArgs = process.argv.slice(2);

const hasPortArg = extraArgs.includes("--port");
const defaultPort = process.env.AI_PORT ?? "8000";

const uvicornArgs = [
  "-m",
  "uvicorn",
  "app.main:app",
  ...(hasPortArg ? [] : ["--port", defaultPort]),
  ...extraArgs,
];

const child = spawn(pythonPath, uvicornArgs, {
  cwd: appRoot,
  stdio: "inherit",
  shell: false,
  env: process.env,
});

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
};

process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on("error", (err) => {
  console.error("[codinator/ai] Failed to start uvicorn:", err);
  process.exit(1);
});