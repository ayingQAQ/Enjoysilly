import { AppShell } from "./components/AppShell";
import { RightPanel } from "./components/RightPanel";
import { workspaceSections } from "./data/workspace";
import { CharactersScreen } from "./screens/CharactersScreen";
import { ChatScreen } from "./screens/ChatScreen";
import { PlaceholderScreen } from "./screens/PlaceholderScreen";
import { PresetsScreen } from "./screens/PresetsScreen";
import { QuickReplyScreen } from "./screens/QuickReplyScreen";
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
      {activeSection === "quickReplies" ? <QuickReplyScreen /> : null}
      {activeSection === "chat" ? <ChatScreen /> : null}
      {activeSection !== "characters" &&
      activeSection !== "worlds" &&
      activeSection !== "presets" &&
      activeSection !== "regex" &&
      activeSection !== "quickReplies" &&
      activeSection !== "chat" &&
      activeMeta ? (
        <PlaceholderScreen section={activeMeta} />
      ) : null}
    </AppShell>
  );
}
