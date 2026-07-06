import { describe, expect, it } from "vitest";

import {
  createQuickReplyFileName,
  encodeQuickReplySetJson,
  parseQuickReplySetJson,
  serializeQuickReplySetJson,
} from "./quickReplyIO";

describe("quickReplyIO", () => {
  it("parses a complete Quick Reply v2 set", () => {
    const result = parseQuickReplySetJson(JSON.stringify({
      version: 2,
      name: "测试集",
      qrList: [
        { label: "问候", message: "你好，{{user}}！" },
        { label: "告辞", message: "再见。", isAuto: true, trigger: "end" },
      ],
    }));

    expect(result.version).toBe(2);
    expect(result.name).toBe("测试集");
    expect(result.qrList).toHaveLength(2);
    expect(result.qrList[0].label).toBe("问候");
    expect(result.qrList[0].message).toBe("你好，{{user}}！");
    expect(result.qrList[1].isAuto).toBe(true);
    expect(result.qrList[1].trigger).toBe("end");
  });

  it("falls back to default name for empty set name", () => {
    const result = parseQuickReplySetJson(JSON.stringify({
      qrList: [{ label: "A", message: "B" }],
    }));

    expect(result.name).toBe("未命名快捷回复");
  });

  it("falls back to default label for empty item label", () => {
    const result = parseQuickReplySetJson(JSON.stringify({
      name: "S",
      qrList: [
        { message: "hello" },
        { label: "", message: "world" },
      ],
    }));

    expect(result.qrList[0].label).toBe("QR #1");
    expect(result.qrList[1].label).toBe("QR #2");
  });

  it("preserves unknown fields on the set and items", () => {
    const result = parseQuickReplySetJson(JSON.stringify({
      name: "S",
      customField: "keep-me",
      qrList: [
        { label: "A", message: "B", extraProp: 42 },
      ],
    }));

    expect((result as Record<string, unknown>).customField).toBe("keep-me");
    expect((result.qrList[0] as Record<string, unknown>).extraProp).toBe(42);
  });

  it("serializes a set back to JSON with unknown fields preserved", () => {
    const set = parseQuickReplySetJson(JSON.stringify({
      version: 2,
      name: "T",
      qrList: [{ label: "L", message: "M", x: 1 }],
      top: "keep",
    }));

    const serialized = serializeQuickReplySetJson(set);
    const reparsed = parseQuickReplySetJson(serialized);

    expect(reparsed.name).toBe("T");
    expect(reparsed.version).toBe(2);
    expect(reparsed.qrList[0].label).toBe("L");
    expect((reparsed as Record<string, unknown>).top).toBe("keep");
    expect((reparsed.qrList[0] as Record<string, unknown>).x).toBe(1);
  });

  it("encodes a set to Uint8Array bytes", () => {
    const set = parseQuickReplySetJson(JSON.stringify({
      name: "E",
      qrList: [{ label: "L", message: "M" }],
    }));

    const bytes = encodeQuickReplySetJson(set);
    const decoded = new TextDecoder().decode(bytes);

    expect(JSON.parse(decoded)).toMatchObject({
      name: "E",
      qrList: [{ label: "L", message: "M" }],
    });
  });

  it("rejects JSON without qrList array", () => {
    expect(() => parseQuickReplySetJson('{"name":"bad"}')).toThrow(
      "missing qrList",
    );
  });

  it("rejects non-object JSON", () => {
    expect(() => parseQuickReplySetJson("[]")).toThrow("object");
  });

  it("creates safe file names", () => {
    expect(createQuickReplyFileName("我的快捷回复")).toBe("我的快捷回复.json");
    expect(createQuickReplyFileName("a/b:c")).toBe("a_b_c.json");
    expect(createQuickReplyFileName("  ")).toBe("quick-reply.json");
  });
});
