import { create } from "zustand";

import type { WorkspaceSectionId } from "../types/ui";
import { unsavedChanges } from "../services/unsavedChanges";

interface WorkspaceState {
  activeSection: WorkspaceSectionId;
  pendingWorldEditorId?: string;
  setActiveSection: (section: WorkspaceSectionId) => void;
  openWorldEditor: (worldId: string) => void;
  consumeWorldEditorRequest: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  activeSection: "chat",
  setActiveSection: (section) => {
    if (section === get().activeSection) return;
    void unsavedChanges.request().then(accepted => { if (accepted) set({ activeSection: section }); });
  },
  openWorldEditor: (worldId) => {
    void unsavedChanges.request().then(accepted => {
      if (accepted) set({ activeSection: "worlds", pendingWorldEditorId: worldId });
    });
  },
  consumeWorldEditorRequest: () => set({ pendingWorldEditorId: undefined }),
}));
