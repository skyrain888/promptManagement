import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, '..');
const outfile = path.join(pkgRoot, 'dist/main/index.js');

// Step 0: Rebuild better-sqlite3 for Electron's Node ABI
execSync('node scripts/native-rebuild.mjs electron', { cwd: pkgRoot, stdio: 'inherit' });

// Step 1: esbuild watch for main process
const ctx = await esbuild.context({
  entryPoints: [path.join(pkgRoot, 'src/main/index.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile,
  external: ['electron', 'better-sqlite3'],
  sourcemap: true,
  logLevel: 'info',
});

await ctx.watch();
console.log('[dev] Main process watching...');

// Step 2: Start Vite dev server
const vite = spawn('npx', ['vite', '--port', '5173'], {
  cwd: pkgRoot,
  stdio: ['ignore', 'pipe', 'inherit'],
  env: { ...process.env },
});

// Wait for Vite to be ready
const viteUrl = await new Promise((resolve) => {
  vite.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);
    const match = text.match(/Local:\s+(https?:\/\/[^\s]+)/);
    if (match) resolve(match[1]);
  });
});

console.log(`[dev] Vite ready at ${viteUrl}`);

// Step 3: Launch Electron
let electronProc = null;

function startElectron() {
  if (electronProc) {
    electronProc.kill();
    electronProc = null;
  }

  electronProc = spawn('npx', ['electron', outfile], {
    stdio: 'inherit',
    env: { ...process.env, VITE_DEV_SERVER_URL: viteUrl },
  });

  electronProc.on('close', (code) => {
    if (code !== null) {
      console.log(`[dev] Electron exited with code ${code}`);
    }
  });
}

startElectron();

// Cleanup: restore native modules for system Node
function cleanup() {
  ctx.dispose();
  vite.kill();
  if (electronProc) electronProc.kill();
  console.log('[dev] Restoring native modules for system Node...');
  try {
    execSync('node scripts/native-rebuild.mjs node', { cwd: pkgRoot, stdio: 'ignore' });
  } catch { /* best effort */ }
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
