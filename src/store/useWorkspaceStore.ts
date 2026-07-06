import { create } from "zustand";

import type { WorkspaceSectionId } from "../types/ui";

interface WorkspaceState {
  activeSection: WorkspaceSectionId;
  setActiveSection: (section: WorkspaceSectionId) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeSection: "chat",
  setActiveSection: (section) => set({ activeSection: section }),
}));
