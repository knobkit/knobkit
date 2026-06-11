// Electron shell: a desktop window that hosts the knobkit dev server.
// The knobkit app itself (demo.tsx) is an ordinary mount app — unchanged from the browser version.
// `npm run dev` starts `knobkit dev` on KNOBKIT_PORT, waits for it, then opens this window at that URL.
const { app, BrowserWindow } = require("electron");

const PORT = process.env.KNOBKIT_PORT || "5180";
const URL = process.env.KNOBKIT_URL || `http://localhost:${PORT}`;

// Qwen runs in the renderer via WebGPU (demo.tsx uses device: "webgpu"); enable it before the app is ready.
app.commandLine.appendSwitch("enable-unsafe-webgpu");

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 720,
    title: "Desktop Chatbot",
    webPreferences: { contextIsolation: true },
  });
  win.loadURL(URL);
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
