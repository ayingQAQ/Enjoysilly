// @vitest-environment jsdom

import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatSidebar } from "./ChatSidebar";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const roots: Root[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount());
  }
  for (const container of containers.splice(0)) {
    container.remove();
  }
});

function findButton(container: HTMLElement, label: string) {
  return Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === label,
  );
}

describe("ChatSidebar", () => {
  it("keeps secondary context behind explicit tabs and allows the panel to close", async () => {
    const onClose = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    containers.push(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <ChatSidebar
          activeCharacterName="默认角色"
          archiveActionId={null}
          archiveError={null}
          archives={[]}
          assetError={null}
          characterDescription=""
          characterDetail={null}
          characterDetailError={null}
          characterName="默认角色"
          characters={[]}
          canContinue={false}
          canExport={false}
          canImport={true}
          canSave={false}
          chatImportInputRef={createRef<HTMLInputElement>()}
          disabled={false}
          greetings={["你好，{{user}}。"]}
          isArchiveLoading={false}
          isAssetLoading={false}
          isImporting={false}
          isSaving={false}
          loadingArchiveId={null}
          localCharacterOptionId="__local_character__"
          loadedArchiveName={null}
          minimalPresetOptionId="__minimal_preset__"
          model="gpt-4o-mini"
          personaDescription=""
          presetDetail={null}
          presetDetailError={null}
          presets={[]}
          selectedArchiveId={null}
          selectedCharacterId="__local_character__"
          selectedPresetId="__minimal_preset__"
          tokenCount={0}
          userName="User"
          onApplyGreeting={vi.fn()}
          onCharacterDescriptionChange={vi.fn()}
          onCharacterNameChange={vi.fn()}
          onChatImportChange={vi.fn()}
          onClose={onClose}
          onContinue={vi.fn()}
          onDeleteArchive={vi.fn()}
          onExport={vi.fn()}
          onLoadArchive={vi.fn()}
          onNewChat={vi.fn()}
          onPersonaDescriptionChange={vi.fn()}
          onPickChatImport={vi.fn()}
          onRenameArchive={vi.fn()}
          onSelectedCharacterIdChange={vi.fn()}
          onSelectedPresetIdChange={vi.fn()}
          onSave={vi.fn()}
          onUserNameChange={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("本次对话对象");
    expect(container.textContent).toContain("会话信息");
    expect(container.textContent).toContain("对话操作");
    expect(container.textContent).toContain("模型：gpt-4o-mini");
    expect(container.textContent).not.toContain("当前筛选下还没有已保存的对话。");

    await act(async () => {
      findButton(container, "存档")?.click();
    });
    expect(container.textContent).toContain("本地存档");
    expect(container.textContent).toContain("当前筛选下还没有已保存的对话。");

    await act(async () => {
      findButton(container, "问候")?.click();
    });
    expect(container.textContent).toContain("首条问候");
    expect(container.textContent).toContain("你好，{{user}}。");

    const closeButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="收起对话上下文"]',
    );
    await act(async () => {
      closeButton?.click();
    });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
