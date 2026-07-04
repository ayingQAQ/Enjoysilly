import { AppShell } from "./components/AppShell";
import { RightPanel } from "./components/RightPanel";
import { workspaceSections } from "./data/workspace";
import { CharactersScreen } from "./screens/CharactersScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { PlaceholderScreen } from "./screens/PlaceholderScreen";
import { PresetsScreen } from "./screens/PresetsScreen";
import { RegexScreen } from "./screens/RegexScreen";
import { WorldsScreen } from "./screens/WorldsScreen";
import { useWorkspaceStore } from "./store/useWorkspaceStore";

export function App() {
  const activeSection = useWorkspaceStore((state) => state.activeSection);
  const activeMeta = workspaceSections.find((section) => section.id === activeSection);

  return (
    <AppShell rightPanel={<RightPanel />}>
      {activeSection === "characters" ? <CharactersScreen /> : null}
      {activeSection === "worlds" ? <WorldsScreen /> : null}
      {activeSection === "presets" ? <PresetsScreen /> : null}
      {activeSection === "regex" ? <RegexScreen /> : null}
      {activeSection === "chat" ? <DashboardScreen /> : null}
      {activeSection !== "characters" &&
      activeSection !== "worlds" &&
      activeSection !== "presets" &&
      activeSection !== "regex" &&
      activeSection !== "chat" &&
      activeMeta ? (
        <PlaceholderScreen section={activeMeta} />
      ) : null}
    </AppShell>
  );
}
