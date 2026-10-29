import assert from "node:assert/strict";
import { expect } from "@playwright/test";

export async function runDailyWorkflowChecks(browser, baseURL = "http://127.0.0.1:4174") {
  const results = [];
  for (const viewport of [{ width: 360, height: 640 }, { width: 768, height: 600 }, { width: 1440, height: 480 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("dialog", d => d.accept());
    const nav = async name => {
      await page.getByRole("button", { name, exact: true }).click();
      if (name === "对话") await expect(page.getByRole("textbox", { name: "输入消息", exact: true })).toBeEnabled();
      else await expect(page.getByRole("button", { name: { "角色卡": "导入角色卡", "世界书": "导入世界书", "预设": "导入预设", "设置": "保存基础设置", "分组聊天": "创建群组" }[name], exact: true })).toBeVisible();
    };
    const importJson = (name, payload) => page.locator('input[type="file"]').setInputFiles({ name: `${name}.json`, mimeType: "application/json", buffer: Buffer.from(JSON.stringify(payload)) });
    const exportJson = async () => {
      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: "导出 JSON", exact: true }).click();
      const stream = await (await download).createReadStream();
      const chunks = []; for await (const chunk of stream) chunks.push(chunk);
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    };
    const checkModal = async (name, saveName) => {
      const dialog = page.getByRole("dialog", { name, exact: true });
      await expect(dialog).toBeVisible();
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press(i % 2 ? "Shift+Tab" : "Tab");
        assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true, "focus escaped modal");
      }
      const save = dialog.getByRole("button", { name: saveName, exact: true });
      await save.scrollIntoViewIfNeeded();
      const box = await save.boundingBox();
      assert.ok(box && box.y >= 0 && box.y + box.height <= viewport.height + 1, "save button outside viewport");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    };
    try {
      await page.route("**/chat/completions", route => route.fulfill({ contentType: "text/event-stream", body: 'data: {"choices":[{"delta":{"content":"日常回归回复🌙"}}]}\n\ndata: [DONE]\n\n' }));
      await page.goto(baseURL);
      await expect(page.getByRole("textbox", { name: "输入消息", exact: true })).toBeEnabled();
      await nav("角色卡");
      await importJson("月角色", { spec: "chara_card_v2", spec_version: "2.0", data: { name: "月角色", description: "测试", first_mes: "你好", tags: ["冒险"], extensions: { keep: true } } });
      await page.getByRole("button", { name: "编辑角色卡", exact: true }).click();
      await checkModal("编辑角色卡", "保存角色卡");
      await page.getByRole("textbox", { name: "角色名称" }).fill("月角色修改");
      await page.keyboard.press("Escape");
      const leave = page.getByRole("dialog", { name: "离开前保存修改？" });
      await leave.getByRole("button", { name: "取消", exact: true }).click();
      await expect(page.getByRole("textbox", { name: "角色名称" })).toHaveValue("月角色修改");
      await page.getByRole("button", { name: "保存角色卡", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "编辑角色卡" })).toBeHidden();
      await expect(page.getByRole("button", { name: "编辑角色卡", exact: true })).toBeFocused();
      await page.getByRole("combobox", { name: "角色标签筛选" }).selectOption("冒险");
      await page.getByRole("searchbox", { name: "搜索角色" }).fill("不存在");
      await expect(page.getByRole("button", { name: "编辑角色卡", exact: true })).toHaveCount(0);
      await page.getByRole("searchbox", { name: "搜索角色" }).fill("月");
      await expect(page.getByRole("button", { name: "编辑角色卡", exact: true })).toHaveCount(1);

      await nav("分组聊天");
      await page.getByRole("button", { name: "创建群组", exact: true }).click();
      await page.getByRole("textbox", { name: "群名称", exact: true }).fill("群组草稿");
      await page.getByRole("checkbox", { name: "月角色修改", exact: true }).check();
      await page.keyboard.press("Escape");
      await leave.getByRole("button", { name: "取消", exact: true }).click();
      await expect(page.getByRole("textbox", { name: "群名称", exact: true })).toHaveValue("群组草稿");
      await page.keyboard.press("Escape");
      await leave.getByRole("button", { name: "保存并离开", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "创建新群组", exact: true })).toBeHidden();
      await expect(page.getByRole("heading", { name: "群组草稿", exact: true })).toBeVisible();

      for (const [section, name, payload] of [
        ["世界书", "月世界", { entries: { "0": { uid: 0, key: ["月"], content: "旧内容", comment: "月条目", order: 100, disable: false, position: 0, future: true } }, future: { keep: true } }],
        ["预设", "月预设", { prompts: [{ identifier: "main", name: "基础", role: "system", content: "原始", custom: { keep: true } }], prompt_order: [{ character_id: 100000, extra: true, order: [{ identifier: "main", enabled: true, custom: 1 }] }, { character_id: 100001, order: [{ identifier: "main", enabled: true }] }], extensions: { future: true } }],
      ]) {
        await nav(section);
        await importJson(name, payload);
        await page.getByRole("button", { name: "管理标签", exact: true }).click();
        await page.getByRole("textbox", { name: "标签", exact: true }).fill("冒险\n中文🌙");
        await page.getByRole("button", { name: "保存标签", exact: true }).click();
        await expect(page.getByRole("dialog", { name: "管理本地标签" })).toBeHidden();
        await page.getByRole("combobox", { name: `${section}标签筛选` }).selectOption("冒险");
        await page.getByRole("combobox", { name: `${section}排序` }).selectOption("name");
        await page.getByRole("searchbox", { name: `搜索${section}` }).fill("不存在");
        await expect(page.getByRole("status")).toContainText("没有匹配结果");
        await page.getByRole("button", { name: "重置筛选" }).click();
        await page.getByRole("button", { name: "编辑", exact: true }).click();
        await checkModal(`编辑${section}`, `保存${section}`);
        if (section === "世界书") {
          await page.getByRole("textbox", { name: "注入内容 content", exact: true }).fill("世界新内容🌙");
        } else {
          await page.getByRole("button", { name: "新增提示词" }).click();
          const detail = page.locator("details").nth(1);
          await detail.locator("summary").click();
          await detail.getByRole("textbox", { name: "名称", exact: true }).fill("自定义🌙");
          await detail.getByRole("textbox", { name: "内容", exact: true }).fill("自定义内容\n第二行");
          await detail.getByRole("button", { name: "复制提示词" }).click();
          const copy = page.locator("details").filter({ has: page.locator("summary", { hasText: "自定义🌙 副本" }) });
          await copy.locator("summary").click();
          await copy.getByRole("button", { name: "删除提示词" }).click();
          await copy.getByRole("button", { name: "确认删除", exact: true }).click();
          await detail.getByRole("checkbox").uncheck();
          await page.getByRole("region", { name: "排序槽 100001" }).getByRole("button", { name: "上移", exact: true }).last().click();
        }
        await page.getByRole("button", { name: `保存${section}`, exact: true }).click();
        await expect(page.getByRole("dialog", { name: `编辑${section}`, exact: true })).toBeHidden();
        await expect(page.getByRole("button", { name: "编辑", exact: true })).toBeFocused();
        const exported = await exportJson();
        assert.ok(!JSON.stringify(exported).includes("中文🌙"), "local tags leaked into ST export");
        if (section === "预设") {
          assert.deepEqual(exported.extensions, { future: true });
          assert.equal(exported.prompts.length, 2);
          assert.equal(exported.prompts[1].enabled, false);
          assert.equal(exported.prompt_order[1].order[0].identifier, exported.prompts[1].identifier);
          assert.equal(exported.prompt_order[0].extra, true);
        } else {
          assert.equal(exported.entries["0"].content, "世界新内容🌙");
          assert.deepEqual(exported.future, { keep: true });
        }
      }
      await nav("设置");
      await page.getByRole("combobox", { name: "主题", exact: true }).selectOption("light");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      const model = page.getByRole("textbox", { name: "模型", exact: false }).first();
      await model.fill("unsaved-local-model");
      await page.getByRole("button", { name: "切换明暗主题" }).click();
      await expect(page.getByRole("combobox", { name: "主题", exact: true })).toHaveValue("dark");
      await expect(model).toHaveValue("unsaved-local-model");
      await page.getByRole("combobox", { name: "字号", exact: true }).selectOption("lg");
      await page.getByRole("button", { name: "保存基础设置", exact: true }).click();
      await expect(page.getByText("设置已保存", { exact: true })).toBeVisible();
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await expect(page.locator("html")).toHaveAttribute("data-font-scale", "lg");
      await nav("对话");
      const composer = page.getByRole("textbox", { name: "输入消息", exact: true });
      await composer.fill("月，开始冒险");
      await page.getByRole("button", { name: "发送", exact: true }).click();
      await expect(page.getByText("日常回归回复🌙", { exact: true })).toBeVisible();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), true, "document scroll escaped app shell");
      assert.deepEqual(errors, []);
      results.push({ ...viewport, importEditExport: true, modalKeyboard: true, themeSync: true, tags: true, promptOperations: true, chat: true });
    } catch (e) { console.error(`Daily workflow failed at ${viewport.width}x${viewport.height}`, (await page.locator("body").ariaSnapshot()).slice(-7000)); throw e; }
    finally { await context.close(); }
  }
  return results;
}
