import { AppShell } from "./components/AppShell";
import { UnsavedChangesDialog } from "./components/UnsavedChangesDialog";
import { PageErrorBoundary } from "./components/PageErrorBoundary";
import { ChatScreen } from "./screens/ChatScreen";
import { lazy, Suspense, useEffect } from "react";
import { applyAppAppearance } from "./services/appAppearance";
import { loadAppSettings } from "./services/settingsStore";
import { useWorkspaceStore } from "./store/useWorkspaceStore";

const CharactersScreen = lazy(() => import("./screens/CharactersScreen").then(m => ({ default: m.CharactersScreen })));
const GroupsScreen = lazy(() => import("./screens/GroupsScreen").then(m => ({ default: m.GroupsScreen })));
const PresetsScreen = lazy(() => import("./screens/PresetsScreen").then(m => ({ default: m.PresetsScreen })));
const QuickReplyScreen = lazy(() => import("./screens/QuickReplyScreen").then(m => ({ default: m.QuickReplyScreen })));
const RegexScreen = lazy(() => import("./screens/RegexScreen").then(m => ({ default: m.RegexScreen })));
const SettingsScreen = lazy(() => import("./screens/SettingsScreen").then(m => ({ default: m.SettingsScreen })));
const WorldsScreen = lazy(() => import("./screens/WorldsScreen").then(m => ({ default: m.WorldsScreen })));

export function App() {
  const activeSection = useWorkspaceStore((state) => state.activeSection);

  useEffect(() => {
    loadAppSettings()
      .then(applyAppAppearance)
      .catch(() => {});
  }, []);

  return (
    <AppShell>
      <PageErrorBoundary key={activeSection}>
      <Suspense fallback={<p role="status" className="p-6">正在加载页面…</p>}>
      {activeSection === "characters" ? <CharactersScreen /> : null}
      {activeSection === "worlds" ? <WorldsScreen /> : null}
      {activeSection === "presets" ? <PresetsScreen /> : null}
      {activeSection === "regex" ? <RegexScreen /> : null}
      {activeSection === "quickReplies" ? <QuickReplyScreen /> : null}
      {activeSection === "groups" ? <GroupsScreen /> : null}
      {activeSection === "settings" ? <SettingsScreen /> : null}
      {activeSection === "chat" ? <ChatScreen /> : null}
      </Suspense>
      </PageErrorBoundary>
      <UnsavedChangesDialog />
    </AppShell>
  );
}
