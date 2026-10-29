import { describe, expect, it } from "vitest";
import { UnsavedChangesController } from "./unsavedChanges";

describe("unsaved changes navigation", () => {
  it("keeps navigation pending until successful saving and allows retry after failure", async () => {
    const controller = new UnsavedChangesController();
    let saved = false;
    controller.register("editor", () => ({ dirty: true, label: "编辑器", save: async () => saved }));
    const leaving = controller.request();
    expect(controller.getSnapshot()?.busy).toBe(false);
    await controller.choose("save");
    expect(controller.getSnapshot()?.error).toBeTruthy();
    saved = true;
    await controller.choose("save");
    await expect(leaving).resolves.toBe(true);
    expect(controller.getSnapshot()).toBeNull();
  });

  it("cancel keeps data and discard invokes only the selected guard", async () => {
    const controller = new UnsavedChangesController();
    const discarded: string[] = [];
    for (const id of ["chat", "editor"]) controller.register(id, () => ({
      dirty: true, label: id, discard: () => { discarded.push(id); }, save: async () => true,
    }));
    const cancelled = controller.request("chat");
    await controller.choose("cancel");
    await expect(cancelled).resolves.toBe(false);
    expect(discarded).toEqual([]);
    const accepted = controller.request("editor");
    await controller.choose("discard");
    await expect(accepted).resolves.toBe(true);
    expect(discarded).toEqual(["editor"]);
  });

  it("blocks navigation during generation or saving and rejects duplicate navigation requests", async () => {
    const controller = new UnsavedChangesController();
    controller.register("chat", () => ({ dirty: true, busy: true, label: "聊天", save: async () => true }));
    const request = controller.request();
    await expect(controller.request()).resolves.toBe(false);
    await controller.choose("discard");
    expect(controller.getSnapshot()).not.toBeNull();
    await controller.choose("cancel");
    await expect(request).resolves.toBe(false);
  });

  it("removing a clean guard does not prompt on future navigation", async () => {
    const controller = new UnsavedChangesController();
    const unregister = controller.register("editor", () => ({ dirty: true, label: "编辑器", save: async () => true }));
    unregister();
    await expect(controller.request()).resolves.toBe(true);
  });

  it("releases a pending prompt if its editor has already unmounted", async () => {
    const controller = new UnsavedChangesController();
    const unregister = controller.register("editor", () => ({ dirty: true, label: "编辑器", save: async () => true }));
    const leaving = controller.request();
    unregister();
    expect(controller.getSnapshot()).toBeNull();
    await expect(leaving).resolves.toBe(true);
  });
});
