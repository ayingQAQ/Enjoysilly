import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { expect } from "@playwright/test";

// Invoke with a Playwright Browser instance; every run owns an isolated context.
// No real model requests or existing browser data are used.
export async function runReliabilityChecks(browser, baseURL = "http://127.0.0.1:4174") {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("dialog", dialog => dialog.accept());
  const fixture = name => fileURLToPath(new URL(`../test-fixtures/${name}`, import.meta.url));
  const nav = name => page.getByRole("button", { name, exact: true }).click();
  const waitText = text => page.waitForFunction(text => document.body.textContent.includes(text), text);
  try {
    await page.route("**/chat/completions", route => route.fulfill({ status: 200,
      contentType: "text/event-stream", body: 'data: {"choices":[{"delta":{"content":"本地模拟回复🌙"},"finish_reason":null}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n' }));
    await page.goto(baseURL);
    await expect(page.getByRole("textbox", { name: "输入消息", exact: true })).toBeEnabled();
    await nav("角色卡");
    await page.getByRole("heading", { name: "角色库", exact: true }).waitFor();
    await page.locator('input[type="file"]').setInputFiles(fixture("红楼.png"));
    await page.getByRole("button", { name: "编辑角色卡", exact: true }).click();
    await page.getByLabel("角色名称", { exact: false }).fill("红楼·可靠性回归");
    await page.keyboard.press("Escape");
    const leave = page.getByRole("dialog", { name: "离开前保存修改？" });
    await leave.getByRole("button", { name: "取消", exact: true }).click();
    assert.equal(await page.getByLabel("角色名称", { exact: false }).inputValue(), "红楼·可靠性回归");
    await page.keyboard.press("Escape");
    await leave.getByRole("button", { name: "保存并离开", exact: true }).click();
    await nav("预设");
    await page.getByRole("button", { name: "导入预设", exact: true }).waitFor();
    await page.locator('input[type="file"]').setInputFiles(fixture("【DarkSide-小猫之神】v2test.json"));
    await page.getByRole("button", { name: "编辑", exact: true }).click();
    await page.getByLabel("核采样", { exact: true }).fill("1.2");
    await page.getByRole("button", { name: "保存预设", exact: true }).click();
    await waitText("top_p 必须在");
    await page.getByLabel("核采样", { exact: true }).fill("0.9");
    await page.getByRole("button", { name: "保存预设", exact: true }).click();
    await page.getByRole("dialog", { name: "编辑预设" }).waitFor({ state: "hidden" });

    await nav("角色卡");
    await page.getByRole("heading", { name: "红楼·可靠性回归", exact: true }).waitFor();
    await page.getByRole("button", { name: "编辑角色卡", exact: true }).click();
    await page.getByRole("button", { name: "打开内嵌世界书编辑器", exact: true }).click();
    await page.getByRole("textbox", { name: "注入内容 content", exact: true }).fill("世界书浏览器回归🌙");
    await page.getByRole("button", { name: "保存世界书", exact: true }).click();
    await page.getByRole("textbox", { name: "注入内容 content", exact: true }).waitFor({ state: "hidden" });

    await nav("对话");
    await waitText("对话已保存到本地数据库");
    await page.getByRole("textbox", { name: "输入消息", exact: true }).fill("浏览器模拟测试");
    await page.getByRole("button", { name: "发送", exact: true }).click();
    await waitText("本地模拟回复🌙");
    await waitText("对话已保存到本地数据库");
    await page.getByRole("button", { name: "编辑", exact: true }).last().click();
    await page.getByRole("textbox", { name: "消息内容", exact: true }).fill("编辑后的消息\n第二行🌙");
    await expect.poll(() => page.evaluate(() => new Promise(resolve => {
      const open = indexedDB.open("my_silly");
      open.onsuccess = () => {
        const db = open.result;
        const get = db.transaction("settings").objectStore("settings").get(`chatDraft:v1:${sessionStorage.getItem("enjoy-silly:chat-draft-tab")}`);
        get.onsuccess = () => { resolve(get.result?.value.messageEdit?.text === "编辑后的消息\n第二行🌙"); db.close(); };
      };
    }))).toBe(true);
    await page.reload();
    await page.getByRole("textbox", { name: "消息内容", exact: true }).waitFor();
    assert.equal(await page.getByRole("textbox", { name: "消息内容", exact: true }).inputValue(), "编辑后的消息\n第二行🌙");
    await page.getByRole("textbox", { name: "消息内容", exact: true }).press("Control+Enter");
    await page.getByRole("dialog", { name: "编辑消息", exact: true }).waitFor({ state: "hidden" });
    await waitText("对话已保存到本地数据库");
    await page.getByRole("textbox", { name: "输入消息", exact: true }).fill("待发送草稿🌙");
    await nav("角色卡");
    await leave.getByRole("button", { name: "保存并离开", exact: true }).click();
    await page.getByRole("heading", { name: "角色库", exact: true }).waitFor();
    await nav("对话");
    await page.waitForFunction(() => document.querySelector("textarea")?.value === "待发送草稿🌙");
    await page.reload();
    await page.waitForFunction(() => document.querySelector("textarea")?.value === "待发送草稿🌙");
    await waitText("编辑后的消息");

    // Duplicate Tab copies sessionStorage; it must not share a writable draft key.
    const sourceId = await page.evaluate(() => sessionStorage.getItem("enjoy-silly:chat-draft-tab"));
    const duplicate = await context.newPage();
    duplicate.on("dialog", dialog => dialog.accept());
    await duplicate.addInitScript(id => sessionStorage.setItem("enjoy-silly:chat-draft-tab", id), sourceId);
    await duplicate.goto(baseURL);
    await duplicate.waitForFunction(() => document.querySelector("textarea")?.value === "待发送草稿🌙");
    const duplicateId = await duplicate.evaluate(() => sessionStorage.getItem("enjoy-silly:chat-draft-tab"));
    assert.notEqual(duplicateId, sourceId);
    await duplicate.close();

    // A database error must remain visible, retain dirty content and allow manual retry.
    await page.evaluate(() => {
      const original = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        if (this.name === "chats") {
          IDBObjectStore.prototype.put = original;
          throw new DOMException("模拟存储配额不足", "QuotaExceededError");
        }
        return original.apply(this, args);
      };
    });
    await page.getByRole("button", { name: "编辑", exact: true }).last().click();
    await page.getByRole("textbox", { name: "消息内容", exact: true }).fill("编辑后的消息\n失败重试后🌙");
    await page.getByRole("button", { name: "保存消息", exact: true }).click();
    await waitText("保存失败，请重试");

    // Save must update the active archive, not create duplicates.
    await page.getByText("对话操作", { exact: true }).click();
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await waitText("对话已保存到本地数据库");
    const archiveCount = await page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open("my_silly");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const count = db.transaction("chats").objectStore("chats").count();
        count.onsuccess = () => { resolve(count.result); db.close(); };
      };
    }));
    assert.equal(archiveCount, 1);
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: "导出", exact: true }).click();
    const download = await downloadEvent;
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const exported = Buffer.concat(chunks).toString("utf8");
    assert.match(exported, /编辑后的消息/);
    assert.doesNotMatch(exported, /待发送草稿/);
    await page.locator('input[type="file"]').setInputFiles({ name: "回归.jsonl", mimeType: "application/x-ndjson", buffer: Buffer.from(exported) });
    await waitText("JSONL 已导入到当前页面和本地数据库");

    const layouts = [];
    for (const [width, height] of [[360, 640], [768, 600], [1440, 480]]) {
      await page.setViewportSize({ width, height });
      await page.getByRole("textbox", { name: "输入消息", exact: true }).scrollIntoViewIfNeeded();
      layouts.push(await page.evaluate(() => ({ width: innerWidth, height: innerHeight,
        documentOverflow: document.documentElement.scrollWidth > innerWidth,
        inputVisible: (() => { const r = document.querySelector("textarea").getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })() })));
    }
    assert.ok(layouts.every(x => !x.documentOverflow && x.inputVisible), JSON.stringify(layouts));
    await page.setViewportSize({ width: 1440, height: 900 });
    let releaseRequest;
    await page.route("**/chat/completions", async route => {
      await new Promise(resolve => { releaseRequest = resolve; });
      await route.fulfill({ status: 200, contentType: "text/event-stream", body: "data: [DONE]\n\n" }).catch(() => {});
    });
    await page.getByRole("textbox", { name: "输入消息", exact: true }).fill("测试停止生成");
    await page.getByRole("button", { name: "发送", exact: true }).click();
    await page.getByRole("button", { name: "停止生成", exact: true }).waitFor();
    await nav("角色卡");
    await leave.getByRole("button", { name: "保存并离开", exact: true }).click();
    await waitText("正在生成、导入或保存");
    await leave.getByRole("button", { name: "取消", exact: true }).click();
    await page.getByRole("button", { name: "停止生成", exact: true }).click();
    releaseRequest?.();
    await page.getByRole("button", { name: "停止生成", exact: true }).waitFor({ state: "hidden" });
    assert.deepEqual(errors, []);
    return { archiveCount, exportedLines: exported.trim().split("\n").length, duplicateDraftIsolation: true,
      saveFailureRetry: true, messageEditRecovery: true, streamingLeaveProtection: true, layouts, consoleErrors: errors.length };
  } catch (error) {
    console.error("Browser failure state:", (await page.locator("body").ariaSnapshot()).slice(-7000));
    throw error;
  } finally { await context.close(); }
}
