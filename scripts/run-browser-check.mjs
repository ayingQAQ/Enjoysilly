import { chromium } from "@playwright/test";
import { runReliabilityChecks } from "./reliability-browser-check.mjs";

const browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || "msedge", headless: true });
try {
  console.log(JSON.stringify(await runReliabilityChecks(browser, process.env.E2E_BASE_URL), null, 2));
} finally { await browser.close(); }
