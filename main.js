const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Environment detection
// ---------------------------------------------------------------------------
// In a packaged Electron app, app.isPackaged === true and the source files
// live inside an asar archive under process.resourcesPath.  During
// development (electron .) app.isPackaged is false.
const isDev = !app.isPackaged;

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
// In production the Vite-built client is copied into the asar under
// renderer/ (configured via electron-builder "files" in package.json).
// In development we load the Vite dev server.
const RENDERER_DIR = path.join(__dirname, 'renderer');
const INDEX_HTML   = path.join(RENDERER_DIR, 'index.html');
const DEV_URL      = process.env.LEDGERA_DEV_URL || 'http://localhost:8080';

// ---------------------------------------------------------------------------
// Logging helper (safe for production — writes to stderr / OS log)
// ---------------------------------------------------------------------------
function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[Ledgera ${ts}] ${msg}`);
}

// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#06050A',
    title: 'Ledgera',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    show: false, // show after content is ready to avoid flash
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalArguments: [`--app-version=${app.getVersion()}`],
    },
  });

  // Show window once the renderer has painted (avoids white/black flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    log('Window shown');
  });

  // -----------------------------------------------------------------------
  // Load content
  // -----------------------------------------------------------------------
  if (isDev) {
    log(`DEV mode — loading ${DEV_URL}`);
    mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Production — load bundled frontend
    if (fs.existsSync(INDEX_HTML)) {
      log(`PROD mode — loading ${INDEX_HTML}`);
      mainWindow.loadFile(INDEX_HTML);
    } else {
      log(`ERROR — index.html not found at ${INDEX_HTML}`);
      showFatalError(
        'Frontend files are missing from the application package.\n\n' +
        `Expected: ${INDEX_HTML}\n\n` +
        'Please reinstall Ledgera or contact support.'
      );
      return;
    }
  }

  // -----------------------------------------------------------------------
  // Error handling for renderer load failures
  // -----------------------------------------------------------------------
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDesc, validatedURL) => {
    log(`did-fail-load: code=${errorCode} desc="${errorDesc}" url=${validatedURL}`);

    if (isDev) {
      // In dev, the Vite server might not be up yet — retry after a delay
      log('Dev server may not be ready, retrying in 2s...');
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(DEV_URL);
        }
      }, 2000);
    } else {
      showErrorPage(
        'Failed to load the application.',
        `Error ${errorCode}: ${errorDesc}`
      );
    }
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log(`Renderer crashed: reason=${details.reason} exitCode=${details.exitCode}`);
    showErrorPage(
      'The application encountered an unexpected error.',
      `Renderer process exited (${details.reason}). Please restart Ledgera.`
    );
  });

  mainWindow.webContents.on('unresponsive', () => {
    log('Renderer became unresponsive');
  });

  mainWindow.webContents.on('responsive', () => {
    log('Renderer is responsive again');
  });

  // Open external links in default browser instead of Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Intercept navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Allow in-app navigation (file:// in prod, localhost in dev)
    if (url.startsWith('file://') || url.startsWith(DEV_URL)) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// Error display helpers
// ---------------------------------------------------------------------------
function showFatalError(message) {
  dialog.showErrorBox('Ledgera — Startup Error', message);
  app.quit();
}

function showErrorPage(title, detail) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Ledgera — Error</title></head>
    <body style="margin:0;padding:40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
                 background:#06050A;color:#e0e0e0;display:flex;align-items:center;justify-content:center;
                 height:100vh;box-sizing:border-box;">
      <div style="text-align:center;max-width:500px;">
        <h1 style="font-size:22px;color:#ff6b6b;margin-bottom:12px;">${title}</h1>
        <p style="font-size:14px;color:#999;line-height:1.6;">${detail}</p>
        <button onclick="location.reload()"
                style="margin-top:24px;padding:10px 28px;background:#7c3aed;color:#fff;border:none;
                       border-radius:6px;font-size:14px;cursor:pointer;">
          Retry
        </button>
      </div>
    </body>
    </html>`;
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  log(`Ledgera v${app.getVersion()} starting (packaged=${app.isPackaged}, platform=${process.platform})`);

  // Remove default menu on Windows/Linux for a cleaner look
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------------------------------------------------------------------------
// Uncaught exception safety net
// ---------------------------------------------------------------------------
process.on('uncaughtException', (err) => {
  log(`Uncaught exception: ${err.stack || err.message}`);
  dialog.showErrorBox(
    'Ledgera — Unexpected Error',
    `${err.message}\n\nThe application will now close.`
  );
  app.quit();
});
