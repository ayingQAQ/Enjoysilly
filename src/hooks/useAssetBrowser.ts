import { useEffect, useState } from "react";
import { filterAssets, loadAssetTags, saveAssetTags, type AssetKind, type AssetTags, type AssetQuery } from "../services/assetOrganization";

export function useAssetBrowser<T extends { id: string; name: string; updatedAt: string; createdAt: string }>(kind: AssetKind, items: T[]) {
  const [query, setQuery] = useState<AssetQuery>({ query: "", tag: "", sort: "updated" });
  const [tags, setTags] = useState<AssetTags>({});
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    void loadAssetTags(kind).then(value => { if (active) { setTags(value); setError(""); } })
      .catch(() => { if (active) setError("本地标签读取失败，请重试。"); });
    return () => { active = false; };
  }, [kind, reload]);
  const saveTags = async (id: string, values: string[]) => {
    const normalized = await saveAssetTags(kind, id, values);
    setTags(current => ({ ...current, [id]: normalized }));
  };
  return { query, setQuery, tags, saveTags, error, retry: () => setReload(n => n + 1),
    visible: filterAssets(items, query, tags),
    allTags: [...new Set(items.flatMap(item => tags[item.id] ?? []))].sort((a,b) => a.localeCompare(b, "zh-CN")),
  };
}
