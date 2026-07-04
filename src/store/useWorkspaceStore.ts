import { create } from "zustand";

import type { WorkspaceSectionId } from "../types/ui";

interface WorkspaceState {
  activeSection: WorkspaceSectionId;
  isRightPanelOpen: boolean;
  setActiveSection: (section: WorkspaceSectionId) => void;
  toggleRightPanel: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeSection: "chat",
  isRightPanelOpen: false,
  setActiveSection: (section) => set({ activeSection: section }),
  toggleRightPanel: () =>
    set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
}));
