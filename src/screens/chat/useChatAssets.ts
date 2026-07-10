import { useEffect, useMemo, useState } from "react";

import { getWorldInfo, listQuickReplySets, type StoredQuickReplySet } from "../../lib/db";
import { extractRegexScripts } from "../../lib/presetIO";
import type { WorldInfoScanInputEntry } from "../../lib/worldInfoScan";
import {
  loadCharacterAssetSummaries,
  loadPresetAssetSummaries,
  type CharacterAssetSummary,
  type PresetAssetSummary,
} from "../../services/assetCatalog";
import {
  loadCharacterDetailSummary,
  type CharacterDetailSummary,
} from "../../services/characterDetails";
import {
  loadPresetDetailSummary,
  type PresetDetailSummary,
} from "../../services/presetDetails";
import {
  loadAppSettings,
  loadUserPersonas,
  selectDefaultPersona,
} from "../../services/settingsStore";
import {
  createCharacterGreetingOptions,
  createLocalChatCharacter,
  createMinimalChatPreset,
  defaultBaseUrl,
  defaultCharacterDescription,
  defaultCharacterName,
  defaultModel,
  defaultPersonaDescription,
  defaultUserName,
  extractCharacterRegexScripts,
  extractWorldInfoEntries,
  formatUnknownError,
  localCharacterOptionId,
  minimalPresetOptionId,
  resolveDefaultWorldInfoEntries,
  selectChatCharacterPayload,
  selectChatPresetPayload,
  selectVisibleQuickReplySets,
} from "../chatScreenHelpers";

interface UseChatAssetsInput {
  loadedArchiveId: string | null;
  messageCount: number;
}

export function useChatAssets({ loadedArchiveId, messageCount }: UseChatAssetsInput) {
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(defaultModel);
  const [userName, setUserName] = useState(defaultUserName);
  const [characterName, setCharacterName] = useState(defaultCharacterName);
  const [characterDescription, setCharacterDescription] = useState(
    defaultCharacterDescription,
  );
  const [personaDescription, setPersonaDescription] = useState(
    defaultPersonaDescription,
  );
  const [assetError, setAssetError] = useState<string | null>(null);
  const [isAssetLoading, setIsAssetLoading] = useState(true);
  const [characters, setCharacters] = useState<CharacterAssetSummary[]>([]);
  const [presets, setPresets] = useState<PresetAssetSummary[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState(
    localCharacterOptionId,
  );
  const [selectedPresetId, setSelectedPresetId] = useState(minimalPresetOptionId);
  const [selectedCharacterDetail, setSelectedCharacterDetail] =
    useState<CharacterDetailSummary | null>(null);
  const [selectedPresetDetail, setSelectedPresetDetail] =
    useState<PresetDetailSummary | null>(null);
  const [characterDetailError, setCharacterDetailError] = useState<string | null>(null);
  const [presetDetailError, setPresetDetailError] = useState<string | null>(null);
  const [quickReplySets, setQuickReplySets] = useState<StoredQuickReplySet[]>([]);
  const [worldInfoEntries, setWorldInfoEntries] = useState<
    WorldInfoScanInputEntry[] | undefined
  >(undefined);
  const [defaultQuickReplySetId, setDefaultQuickReplySetId] = useState<
    string | undefined
  >(undefined);

  const fallbackPreset = useMemo(() => createMinimalChatPreset(), []);
  const localCharacter = useMemo(
    () =>
      createLocalChatCharacter({
        name: characterName,
        description: characterDescription,
      }),
    [characterDescription, characterName],
  );
  const activeCharacter = selectChatCharacterPayload(
    selectedCharacterDetail?.stored.payload,
    localCharacter,
  );
  const activePreset = selectChatPresetPayload(
    selectedPresetDetail?.stored.payload,
    fallbackPreset,
  );
  const greetingOptions = useMemo(
    () => createCharacterGreetingOptions(activeCharacter),
    [activeCharacter],
  );
  const embeddedWorldInfoEntries = useMemo(() => {
    const embeddedBook = selectedCharacterDetail?.stored.payload.data.character_book;
    if (!embeddedBook) return undefined;
    const entries = extractWorldInfoEntries(embeddedBook);
    return entries.length > 0 ? entries : undefined;
  }, [selectedCharacterDetail]);
  const activeWorldInfoEntries = embeddedWorldInfoEntries ?? worldInfoEntries;
  const activeRegexScripts = useMemo(
    () => [
      ...extractRegexScripts(activePreset),
      ...extractCharacterRegexScripts(activeCharacter),
    ],
    [activeCharacter, activePreset],
  );
  const visibleQuickReplySets = useMemo(
    () => selectVisibleQuickReplySets(quickReplySets, defaultQuickReplySetId),
    [defaultQuickReplySetId, quickReplySets],
  );
  const isCharacterReady =
    selectedCharacterId === localCharacterOptionId || selectedCharacterDetail !== null;
  const isPresetReady =
    selectedPresetId === minimalPresetOptionId || selectedPresetDetail !== null;

  useEffect(() => {
    let active = true;
    setIsAssetLoading(true);
    setAssetError(null);

    Promise.all([loadCharacterAssetSummaries(), loadPresetAssetSummaries()])
      .then(([loadedCharacters, loadedPresets]) => {
        if (!active) return;
        setCharacters(loadedCharacters);
        setPresets(loadedPresets);
      })
      .catch((error: unknown) => {
        if (active) setAssetError(formatUnknownError(error));
      })
      .finally(() => {
        if (active) setIsAssetLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (
      isAssetLoading ||
      selectedCharacterId !== localCharacterOptionId ||
      characters.length === 0 ||
      messageCount > 0 ||
      loadedArchiveId
    ) {
      return;
    }
    setSelectedCharacterId(characters[0]?.id ?? localCharacterOptionId);
  }, [characters, isAssetLoading, loadedArchiveId, messageCount, selectedCharacterId]);

  useEffect(() => {
    let active = true;
    void listQuickReplySets()
      .then((sets) => {
        if (active) setQuickReplySets(sets);
      })
      .catch(() => {
        if (active) setQuickReplySets([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([loadAppSettings(), loadUserPersonas()])
      .then(async ([settings, personas]) => {
        if (!active) return;
        const persona = selectDefaultPersona(personas);
        setBaseUrl(settings.api.baseUrl);
        setModel(settings.api.model);
        if (settings.api.apiKey) setApiKey(settings.api.apiKey);
        setUserName(persona.name);
        if (persona.description) setPersonaDescription(persona.description);
        if (settings.defaultPresetId) setSelectedPresetId(settings.defaultPresetId);
        setDefaultQuickReplySetId(settings.defaultQuickReplySetId);

        if (!settings.defaultWorldId) return;
        try {
          const world = await getWorldInfo(settings.defaultWorldId);
          if (active) {
            setWorldInfoEntries(
              resolveDefaultWorldInfoEntries(settings.defaultWorldId, world ?? null),
            );
          }
        } catch {
          if (active) setWorldInfoEntries(undefined);
        }
      })
      .catch(() => {
        // Settings are optional; the hook keeps its local defaults.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (selectedCharacterId === localCharacterOptionId) {
      setSelectedCharacterDetail(null);
      setCharacterDetailError(null);
      return;
    }

    let active = true;
    setSelectedCharacterDetail(null);
    setCharacterDetailError(null);
    void loadCharacterDetailSummary(selectedCharacterId)
      .then((detail) => {
        if (active) setSelectedCharacterDetail(detail);
      })
      .catch((error: unknown) => {
        if (active) setCharacterDetailError(formatUnknownError(error));
      });
    return () => {
      active = false;
    };
  }, [selectedCharacterId]);

  useEffect(() => {
    if (selectedPresetId === minimalPresetOptionId) {
      setSelectedPresetDetail(null);
      setPresetDetailError(null);
      return;
    }

    let active = true;
    setSelectedPresetDetail(null);
    setPresetDetailError(null);
    void loadPresetDetailSummary(selectedPresetId)
      .then((detail) => {
        if (active) setSelectedPresetDetail(detail);
      })
      .catch((error: unknown) => {
        if (active) setPresetDetailError(formatUnknownError(error));
      });
    return () => {
      active = false;
    };
  }, [selectedPresetId]);

  return {
    activeCharacter,
    activePreset,
    activeRegexScripts,
    activeWorldInfoEntries,
    apiKey,
    assetError,
    baseUrl,
    characterDescription,
    characterDetailError,
    characterName,
    characters,
    embeddedWorldInfoEntries,
    greetingOptions,
    isAssetLoading,
    isCharacterReady,
    isPresetReady,
    model,
    personaDescription,
    presetDetailError,
    presets,
    selectedCharacterDetail,
    selectedCharacterId,
    selectedPresetDetail,
    selectedPresetId,
    setCharacterDescription,
    setCharacterName,
    setPersonaDescription,
    setSelectedCharacterId,
    setSelectedPresetId,
    setUserName,
    userName,
    visibleQuickReplySets,
  };
}
