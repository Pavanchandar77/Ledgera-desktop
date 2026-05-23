/**
 * copy-renderer.js
 *
 * Builds the Vite client and copies the output into desktop/renderer/
 * so electron-builder can bundle it into the asar archive.
 *
 * Works on Windows, macOS, and Linux (pure Node.js, no shell assumptions).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const CLIENT_DIR = path.join(ROOT, 'client');
const CLIENT_DIST = path.join(CLIENT_DIR, 'dist');
const RENDERER_DIR = path.join(__dirname, '..', 'renderer');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Step 1: Install client deps
console.log('[copy-renderer] Installing client dependencies...');
execSync('npm install', { cwd: CLIENT_DIR, stdio: 'inherit' });

// Step 2: Build client
console.log('[copy-renderer] Building client...');
execSync('npm run build', { cwd: CLIENT_DIR, stdio: 'inherit' });

// Step 3: Verify build output exists
if (!fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
  console.error('[copy-renderer] ERROR: client/dist/index.html not found after build!');
  process.exit(1);
}

// Step 4: Clean old renderer dir
if (fs.existsSync(RENDERER_DIR)) {
  fs.rmSync(RENDERER_DIR, { recursive: true, force: true });
}

// Step 5: Copy dist -> renderer
console.log(`[copy-renderer] Copying ${CLIENT_DIST} -> ${RENDERER_DIR}`);
copyRecursive(CLIENT_DIST, RENDERER_DIR);

// Step 6: Verify
if (fs.existsSync(path.join(RENDERER_DIR, 'index.html'))) {
  console.log('[copy-renderer] Done — renderer/ is ready for packaging.');
} else {
  console.error('[copy-renderer] ERROR: Copy failed, index.html missing in renderer/');
  process.exit(1);
}
