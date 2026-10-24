import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
const installed =
  "/home/anton/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome";
export default defineConfig({
  testDir: "./tests",
  timeout: 45000,
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: "artifacts/3d-test-results.json" }],
  ],
  webServer: {
    command: "npm run dev -- --port 5174 --strictPort",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: true,
  },
  use: {
    baseURL: "http://127.0.0.1:5174",
    viewport: { width: 1600, height: 1000 },
    launchOptions: {
      ...(existsSync(installed) ? { executablePath: installed } : {}),
      args: [
        "--no-sandbox",
        "--enable-webgl",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
  },
});
