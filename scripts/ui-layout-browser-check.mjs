import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";

const browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || "msedge" });
try {
  for (const viewport of [{width:320,height:640},{width:768,height:600},{width:1440,height:480}]) {
    const context = await browser.newContext({viewport});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    try {
      await page.goto(process.env.E2E_BASE_URL || "http://127.0.0.1:4174");
      const composer = page.getByRole("textbox", {name:"输入消息",exact:true});
      await expect(composer).toBeEnabled();
      const box = await composer.boundingBox();
      assert.ok(box && box.y >= 0 && box.y + box.height <= viewport.height, "composer must fit without scrolling the page");
      if(viewport.width < 1280) {
        await expect(page.getByRole("heading", {name:"对话上下文",exact:true})).toHaveCount(0);
        await page.getByRole("button", {name:"打开上下文",exact:true}).click();
        const drawer = page.getByRole("dialog", {name:"会话上下文",exact:true});
        await expect(drawer).toBeVisible();
        await expect(drawer.getByRole("combobox", {name:"角色",exact:true})).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(drawer).toBeHidden();
        await expect(page.getByRole("button", {name:"打开上下文",exact:true})).toBeFocused();
      }
      await page.screenshot({path:`.playwright-mcp/ui-chat-${viewport.width}.png`});
      await page.setViewportSize({ width: 1440, height: 480 });
      await expect(page.getByRole("heading", {name:"对话上下文",exact:true})).toBeVisible();
      await page.setViewportSize({ width: 768, height: 600 });
      await expect(page.getByRole("heading", {name:"对话上下文",exact:true})).toHaveCount(0);
      await expect(composer).toBeVisible();
      await page.setViewportSize(viewport);
      for(const [section,search] of [["角色卡","搜索角色"],["世界书","搜索世界书"],["预设","搜索预设"]]) {
        await page.getByRole("button", {name:section,exact:true}).click();
        const input=page.getByRole("searchbox", {name:search,exact:true});
        await expect(input).toBeVisible();
        const bounds=await input.boundingBox();
        assert.ok(bounds && bounds.y < viewport.height - 80, `${section} search should be above fold`);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      }
      await page.screenshot({path:`.playwright-mcp/ui-presets-${viewport.width}.png`});
      assert.deepEqual(errors, []);
      console.log({viewport,composerVisible:true,contextAccessible:true,assetSearchAboveFold:true});
    } finally {await context.close();}
  }
} finally {await browser.close();}
