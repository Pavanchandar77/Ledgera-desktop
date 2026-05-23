const { contextBridge } = require('electron');

// Expose a small read-only API to the renderer.  Sandbox + contextIsolation
// are both on, so the renderer has no direct Node access.
//
// NOTE: With sandbox enabled, only `require('electron')` works in preload.
// The app version is injected by main.js via webPreferences.additionalArguments
// to avoid a `require('./package.json')` call that crashes in sandboxed mode.
let appVersion = '0.0.0';
for (const arg of process.argv) {
  if (arg.startsWith('--app-version=')) {
    appVersion = arg.split('=')[1];
    break;
  }
}

contextBridge.exposeInMainWorld('ledgeraDesktop', {
  platform: process.platform,
  arch: process.arch,
  electronVersion: process.versions.electron,
  nodeVersion: process.versions.node,
  chromeVersion: process.versions.chrome,
  appVersion,
});

// Future IPC bridges for desktop-specific features (file dialogs,
// OS notifications, local Gemma) will be added here.
