import { AppShell } from "./components/AppShell";
import { CharactersScreen } from "./screens/CharactersScreen";
import { ChatScreen } from "./screens/ChatScreen";
import { GroupsScreen } from "./screens/GroupsScreen";
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

  useEffect(() => {
    loadAppSettings()
      .then(applyAppAppearance)
      .catch(() => {});
  }, []);

  return (
    <AppShell>
      {activeSection === "characters" ? <CharactersScreen /> : null}
      {activeSection === "worlds" ? <WorldsScreen /> : null}
      {activeSection === "presets" ? <PresetsScreen /> : null}
      {activeSection === "regex" ? <RegexScreen /> : null}
      {activeSection === "quickReplies" ? <QuickReplyScreen /> : null}
      {activeSection === "groups" ? <GroupsScreen /> : null}
      {activeSection === "settings" ? <SettingsScreen /> : null}
      {activeSection === "chat" ? <ChatScreen /> : null}
    </AppShell>
  );
}
