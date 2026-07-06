import { AppShell } from "./components/AppShell";
import { RightPanel } from "./components/RightPanel";
import { workspaceSections } from "./data/workspace";
import { CharactersScreen } from "./screens/CharactersScreen";
import { ChatScreen } from "./screens/ChatScreen";
import { GroupsScreen } from "./screens/GroupsScreen";
import { PlaceholderScreen } from "./screens/PlaceholderScreen";
import { PresetsScreen } from "./screens/PresetsScreen";
import { QuickReplyScreen } from "./screens/QuickReplyScreen";
import { RegexScreen } from "./screens/RegexScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { WorldsScreen } from "./screens/WorldsScreen";
import { useEffect } from "react";
import { applyAppAppearance } from "./services/appAppearance";
import { loadAppSettings } from "./services/settingsStore";
import { useWorkspaceStore } from "./store/useWorkspaceStore";

export function App() {
  const activeSection = useWorkspaceStore((state) => state.activeSection);
  const activeMeta = workspaceSections.find((section) => section.id === activeSection);

  useEffect(() => {
    loadAppSettings()
      .then(applyAppAppearance)
      .catch(() => {});
  }, []);

  return (
    <AppShell rightPanel={<RightPanel />}>
      {activeSection === "characters" ? <CharactersScreen /> : null}
      {activeSection === "worlds" ? <WorldsScreen /> : null}
      {activeSection === "presets" ? <PresetsScreen /> : null}
      {activeSection === "regex" ? <RegexScreen /> : null}
      {activeSection === "quickReplies" ? <QuickReplyScreen /> : null}
      {activeSection === "groups" ? <GroupsScreen /> : null}
      {activeSection === "settings" ? <SettingsScreen /> : null}
      {activeSection === "chat" ? <ChatScreen /> : null}
      {activeSection !== "characters" &&
      activeSection !== "worlds" &&
      activeSection !== "presets" &&
      activeSection !== "regex" &&
      activeSection !== "quickReplies" &&
      activeSection !== "groups" &&
      activeSection !== "settings" &&
      activeSection !== "chat" &&
      activeMeta ? (
        <PlaceholderScreen section={activeMeta} />
      ) : null}
    </AppShell>
  );
}
