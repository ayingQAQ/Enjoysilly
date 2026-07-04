export type ImportAssetKind = "character" | "preset" | "world" | "chat";

export type ImportMessageCode =
  | "unknown-fields-preserved"
  | "regex-scripts-detected"
  | "synthetic-jsonl-fixture"
  | "unsupported-third-party-data-preserved";

export interface ImportMessage {
  code: ImportMessageCode;
  message: string;
}

export interface ImportResult<TStored, TPayload = unknown> {
  assetKind: ImportAssetKind;
  fileName: string;
  stored: TStored;
  payload: TPayload;
  warnings: ImportMessage[];
}

export function createImportResult<TStored, TPayload>(
  assetKind: ImportAssetKind,
  fileName: string,
  stored: TStored,
  payload: TPayload,
  warnings: ImportMessage[] = [],
): ImportResult<TStored, TPayload> {
  return {
    assetKind,
    fileName,
    stored,
    payload,
    warnings,
  };
}

export function unknownFieldsPreservedWarning(): ImportMessage {
  return {
    code: "unknown-fields-preserved",
    message: "已保留未知字段和 extensions，导出时会原样带回。",
  };
}

export function regexScriptsDetectedWarning(count: number): ImportMessage {
  return {
    code: "regex-scripts-detected",
    message: `已从预设 extensions.regex_scripts 读取 ${count} 条正则脚本。`,
  };
}

export function unsupportedThirdPartyDataPreservedWarning(): ImportMessage {
  return {
    code: "unsupported-third-party-data-preserved",
    message: "检测到第三方扩展数据；my_silly 会保留但不会执行。",
  };
}
