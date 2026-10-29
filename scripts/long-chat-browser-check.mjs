import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || "msedge" });
try {
  for (const width of process.env.E2E_LONG_FOCUS === "timed" ? [] : [360, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 640 } });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    let requests = 0;
    await page.route("**/chat/completions", route => { requests++; return route.fulfill({ contentType: "text/event-stream", body: 'data: {"choices":[{"delta":{"content":"模拟回复"}}]}\n\ndata: [DONE]\n\n' }); });
    page.on("dialog", d => d.accept());
    try {
      await page.goto(process.env.E2E_BASE_URL || "http://127.0.0.1:4174");
      await expect(page.getByRole("textbox", { name: "输入消息", exact: true })).toBeEnabled();
      const start = Date.now();
      await page.getByRole("button", { name: "搜索对话", exact: true }).click();
      await page.getByRole("textbox", { name: "搜索当前对话", exact: true }).fill("唯一500🌙");
      await expect(page.getByText("没有匹配消息", { exact: true })).toBeVisible();
      if (width < 1280) await page.getByRole("button", { name: "打开上下文", exact: true }).click();
      const log = [{ user_name: "U", character_name: "N", create_date: "2026-10-29" }, ...Array.from({ length: 1000 }, (_, i) => ({ name: i % 2 ? "N" : "U", is_user: i % 2 === 0, mes: i === 500 ? "唯一500🌙" : `历史消息${i}`, send_date: "date", extra: { retained: i } }))].map(v => JSON.stringify(v)).join("\n");
      await page.locator('input[type="file"]').setInputFiles({ name: "long.jsonl", mimeType: "application/json", buffer: Buffer.from(log) });
      if (width < 1280) await page.keyboard.press("Escape");
      await expect(page.getByText("第 501 条消息 · 1 / 1", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "定位消息", exact: true }).click();
      await expect(page.locator('[data-chat-message-index="500"]')).toBeInViewport();
      const composer = page.getByRole("textbox", { name: "输入消息", exact: true });
      await composer.fill("长".repeat(9000));
      await page.getByRole("button", { name: "发送", exact: true }).click();
      await expect(page.getByText(/上下文预算超限：/)).toBeVisible();
      await expect(composer).toHaveValue("长".repeat(9000));
      assert.equal(requests, 0);
      await composer.fill("继续".repeat(600));
      await page.getByRole("button", { name: "预览提示词", exact: true }).click();
      const preview = page.getByRole("dialog", { name: "发送前提示词预览", exact: true });
      await expect(preview.getByRole("status")).toContainText(/本次省略最旧 [1-9]\d* 条历史/);
      await page.keyboard.press("Escape");
      await composer.fill("");
      const before = await readChats(page);
      await page.getByRole("button", { name: "从此创建分支", exact: true }).click();
      await expect(page.getByText(/已创建分支：/).first()).toBeVisible({ timeout: 15000 });
      const after = await readChats(page);
      assert.equal(after.length, before.length + 1);
      const branch = after.find(c => c.branch);
      assert.equal(branch.payload.messages.length, 501);
      assert.equal(branch.branch.messageIndex, 500);
      assert.deepEqual(after.find(c => c.id === before[0].id), before[0]);
      await page.reload();
      await expect(page.getByRole("textbox", { name: "输入消息", exact: true })).toBeEnabled();
      if (width < 1280) await page.getByRole("button", { name: "打开上下文", exact: true }).click();
      await page.getByRole("tab", { name: "存档", exact: true }).click();
      await page.getByRole("button", { name: "加载", exact: true }).click();
      if (width < 1280) await page.keyboard.press("Escape");
      await expect(page.getByText("对话 · 501 条消息", { exact: true })).toBeVisible();
      assert.deepEqual(errors, []);
      console.log({ width, thousandMessageSearchAndBranch: true, elapsedMs: Date.now() - start });
    } finally { await context.close(); }
  }
  const context = await browser.newContext({ viewport: { width: 768, height: 640 } });
  try {
    const page = await context.newPage();
    const sent = [];
    await page.route("**/chat/completions", route => { sent.push(route.request().postDataJSON()); return route.fulfill({ contentType: "text/event-stream", body: 'data: {"choices":[{"delta":{"content":"回复"}}]}\n\ndata: [DONE]\n\n' }); });
    await page.goto(process.env.E2E_BASE_URL || "http://127.0.0.1:4174");
    const composer = page.getByRole("textbox", { name: "输入消息", exact: true });
    await expect(composer).toBeEnabled();
    await page.getByRole("button", { name: "角色卡", exact: true }).click();
    await page.getByRole("button", { name: "导入角色卡", exact: true }).waitFor();
    await page.locator('input[type="file"]').setInputFiles({ name: "timer.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ spec: "chara_card_v2", spec_version: "2.0", data: { name: "时效卡", character_book: { entries: [{ keys: ["moon"], content: "时效设定", extensions: { sticky: 3, cooldown: 2, scan_depth: 1 } }] } } })) });
    await page.getByRole("button", { name: "预设", exact: true }).click();
    await page.getByRole("button", { name: "导入预设", exact: true }).waitFor();
    await page.locator('input[type="file"]').setInputFiles({ name: "时效预设.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ openai_max_context: 1000, openai_max_tokens: 100, prompts: [{ identifier: "worldInfoBefore", marker: true, role: "system" }, { identifier: "chatHistory", marker: true, role: "user" }], prompt_order: [] })) });
    await page.getByRole("button", { name: "对话", exact: true }).click();
    await expect(composer).toBeEnabled();
    await page.getByRole("button", { name: "打开上下文", exact: true }).click();
    await page.getByRole("combobox", { name: "预设", exact: true }).selectOption({ label: "时效预设" });
    await page.keyboard.press("Escape");
    for (const text of ["moon", "none"]) {
      await expect(composer).toBeEnabled(); await composer.fill(text);
      await page.getByRole("button", { name: "预览提示词", exact: true }).click();
      const preview = page.getByRole("dialog", { name: "发送前提示词预览", exact: true });
      await expect(preview.getByRole("button", { name: "发送此预览", exact: true })).toBeEnabled();
      if (text === "none") await expect(preview).toContainText("sticky 保持激活");
      await preview.getByRole("button", { name: "发送此预览", exact: true }).click();
      await expect(composer).toBeEnabled();
    }
    assert.equal(sent.length, 2);
    assert.ok(sent.every(body => body.messages.some(m => m.content === "时效设定")));
    await page.getByRole("button", { name: "打开上下文", exact: true }).click();
    await page.getByText("对话操作", { exact: true }).click();
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect.poll(async () => (await readChats(page)).some(c => c.payload.messages.length === 4)).toBe(true);
    await page.keyboard.press("Escape");
    await page.reload(); await expect(composer).toBeEnabled(); await composer.fill("moon");
    await page.getByRole("button", { name: "预览提示词", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "发送前提示词预览", exact: true })).toContainText("冷却中");
    assert.equal(sent.length, 2);
    console.log({ timedEffectsReplayAfterReload: true });
    await page.keyboard.press("Escape"); await composer.fill("");
    await page.getByRole("button", { name: "分组聊天", exact: true }).click();
    await page.getByRole("button", { name: "创建群组", exact: true }).click();
    await page.getByRole("textbox", { name: "群名称", exact: true }).fill("预算测试群");
    await page.getByRole("checkbox", { name: "时效卡", exact: true }).check();
    await page.getByRole("button", { name: "创建", exact: true }).click();
    await page.getByRole("button", { name: "进入群聊", exact: true }).click();
    await page.getByRole("combobox").first().selectOption({ label: "预算测试群" });
    const groupInput = page.getByPlaceholder("输入消息...");
    await groupInput.fill("长".repeat(9000));
    await page.getByRole("button", { name: "发送", exact: true }).click();
    await expect(page.getByText(/上下文预算超限：/)).toBeVisible();
    await expect(groupInput).toHaveValue("长".repeat(9000));
    assert.equal(sent.length, 2);
  } finally { await context.close(); }
} finally { await browser.close(); }
async function readChats(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("my_silly");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result; const tx = db.transaction("chats"); const read = tx.objectStore("chats").getAll(); read.onsuccess = () => resolve(read.result); tx.oncomplete = () => db.close(); };
  }));
}
