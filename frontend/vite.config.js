import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom", //Simulates a browser for React tests
    globals: true,
    setupFiles: "./src/test/setup.js", //Loads shared testing configuration
    css: false, //Disables CSS imports in tests
    clearMocks: true, //Clears mock history between tests
    testTimeout: 15000, //Gives slow tests (e.g. userEvent typing) more time when the machine is busy
  }
});