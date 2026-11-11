import { defineConfig } from "vitest/config";

// These tests run in Node and drive real browsers against real `knobkit dev` processes: a check
// about server mode needs a server, and most checks need what only the browser's driver can do
// (real pointer and key input, the network log, new windows, the file chooser).
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./global-setup.ts"],
    testTimeout: 60_000,
    hookTimeout: 180_000,
    // each file starts its own server-mode app and two browsers
    maxWorkers: Number(process.env["E2E_WORKERS"] ?? 3),
    retry: 0,
  },
});
