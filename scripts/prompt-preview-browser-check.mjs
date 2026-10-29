import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

await mkdir(".playwright-mcp", { recursive: true });
const readChats = page => page.evaluate(() => new Promise((resolve, reject) => {
  const request = indexedDB.open("my_silly");
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const db = request.result;
    const transaction = db.transaction("chats", "readonly");
    const read = transaction.objectStore("chats").getAll();
    read.onsuccess = () => resolve(read.result);
    read.onerror = () => reject(read.error);
    transaction.oncomplete = () => db.close();
  };
}));

const browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || "msedge" });
try {
  for (const width of [360, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 640 } });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const sent = [], errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/chat/completions", route => { sent.push(route.request().postDataJSON()); return route.fulfill({ contentType: "text/event-stream", body: 'data: {"choices":[{"delta":{"content":"预览确认回复"}}]}\n\ndata: [DONE]\n\n' }); });
    try {
      await page.goto(process.env.E2E_BASE_URL || "http://127.0.0.1:4174");
      const composer = page.getByRole("textbox", { name: "输入消息", exact: true });
      await expect(composer).toBeEnabled();
      await page.getByRole("button", { name: "设置", exact: true }).click();
      await page.getByRole("textbox", { name: "API Key", exact: false }).fill("preview-secret-key");
      await page.getByRole("button", { name: "保存基础设置", exact: true }).click();
      await page.getByRole("button", { name: "角色卡", exact: true }).click();
      await page.getByRole("button", { name: "导入角色卡", exact: true }).waitFor();
      await page.locator('input[type="file"]').setInputFiles({ name: "预览卡.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ spec: "chara_card_v3", spec_version: "3.0", data: { name: "预览卡", description: "预览角色设定", extensions: { tavern_helper: { content: "<script>neverExecute()</script>" } }, character_book: { entries: [{ keys: ["预览"], content: "月宫世界🌙", enabled: true, position: "before_char" }, { keys: ["从未出现"], content: "未命中条目", enabled: true }] } } })) });
      await page.getByRole("button", { name: "查看详情", exact: true }).click();
      const compatibility = page.getByRole("region", { name: "兼容性报告" });
      await expect(compatibility).toContainText("不执行");
      await expect(compatibility).toContainText("TavernHelper");
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "对话", exact: true }).click();
      await expect(composer).toBeEnabled();
      await composer.fill("预览测试🌙");
      const chatsBefore = await readChats(page);
      await page.getByRole("button", { name: "预览提示词", exact: true }).click();
      const preview = page.getByRole("dialog", { name: "发送前提示词预览", exact: true });
      await expect(preview).toBeVisible();
      await expect(preview.getByRole("button", { name: "发送此预览", exact: true })).toBeEnabled();
      const messages = await preview.locator("[data-prompt-role]").evaluateAll(nodes => nodes.map(node => ({ role: node.getAttribute("data-prompt-role"), content: node.textContent })));
      assert.ok(messages.some(m => m.content.includes("预览测试🌙")));
      await expect(preview).not.toContainText("preview-secret-key");
      await expect(preview).toContainText("扫描选中");
      await expect(preview).toContainText("关键词未命中");
      assert.equal(sent.length, 0);
      assert.deepEqual(await readChats(page), chatsBefore);
      await page.screenshot({ path: `.playwright-mcp/prompt-preview-${width}.png` });
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: "预览提示词", exact: true })).toBeFocused();
      await expect(composer).toHaveValue("预览测试🌙");
      await composer.fill("更新后的预览🌙");
      await page.getByRole("button", { name: "预览提示词", exact: true }).click();
      await expect(preview.getByRole("button", { name: "发送此预览", exact: true })).toBeEnabled();
      const updated = await preview.locator("[data-prompt-role]").evaluateAll(nodes => nodes.map(node => ({ role: node.getAttribute("data-prompt-role"), content: node.textContent })));
      assert.ok(updated.some(m => m.content.includes("更新后的预览🌙")));
      await preview.getByRole("button", { name: "发送此预览", exact: true }).click();
      await expect(page.getByText("预览确认回复", { exact: true })).toBeVisible();
      assert.deepEqual(sent[0].messages, updated);
      assert.equal(sent.length, 1);
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      console.log({ width, previewMatchesSend: true, readOnlyPreview: true, focusRestored: true });
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
