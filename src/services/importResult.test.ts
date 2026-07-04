import { describe, expect, it } from "vitest";

import {
  createImportResult,
  regexScriptsDetectedWarning,
  unknownFieldsPreservedWarning,
  unsupportedThirdPartyDataPreservedWarning,
} from "./importResult";

describe("import result helpers", () => {
  it("creates a normalized import result", () => {
    const stored = {
      id: "asset-1",
      name: "资产",
    };
    const payload = {
      value: true,
    };
    const warning = unknownFieldsPreservedWarning();

    const result = createImportResult(
      "preset",
      "preset.json",
      stored,
      payload,
      [warning],
    );

    expect(result).toEqual({
      assetKind: "preset",
      fileName: "preset.json",
      stored,
      payload,
      warnings: [warning],
    });
  });

  it("formats reusable warning messages", () => {
    expect(regexScriptsDetectedWarning(10)).toMatchObject({
      code: "regex-scripts-detected",
    });
    expect(unknownFieldsPreservedWarning()).toMatchObject({
      code: "unknown-fields-preserved",
    });
    expect(unsupportedThirdPartyDataPreservedWarning()).toMatchObject({
      code: "unsupported-third-party-data-preserved",
    });
  });
});
