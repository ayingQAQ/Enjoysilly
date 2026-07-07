import { describe, expect, it } from "vitest";

import { testOpenAICompatibleConnection } from "./apiConnection";

describe("apiConnection", () => {
  it("returns ok for a successful /models endpoint", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ data: [{ id: "gpt-4" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const result = await testOpenAICompatibleConnection({
      baseUrl: "https://example.test/v1",
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(result.diagnostic).toContain("连接成功");
    expect(result.models).toEqual(["gpt-4"]);
    expect(result.selectedModel).toBe("gpt-4");
  });

  it("tries a /v1 fallback and preserves the resolved Base URL", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      calls.push(String(input));

      if (calls.length === 1) {
        return new Response("not found", { status: 404 });
      }

      return new Response(JSON.stringify({ data: [{ id: "deepseek-chat" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await testOpenAICompatibleConnection({
      baseUrl: "https://api.deepseek.com",
      fetchImpl,
    });

    expect(calls).toEqual([
      "https://api.deepseek.com/models",
      "https://api.deepseek.com/v1/models",
    ]);
    expect(result.ok).toBe(true);
    expect(result.resolvedBaseUrl).toBe("https://api.deepseek.com/v1");
    expect(result.selectedModel).toBe("deepseek-chat");
  });

  it("keeps the requested model when it exists in the returned list", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ data: [{ id: "gpt-4o-mini" }, { id: "gpt-4.1" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const result = await testOpenAICompatibleConnection({
      baseUrl: "https://example.test/v1",
      model: "gpt-4.1",
      fetchImpl,
    });

    expect(result.selectedModel).toBe("gpt-4.1");
  });

  it("detects 401 as auth failure", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ error: { message: "bad key" } }), {
        status: 401,
      });

    const result = await testOpenAICompatibleConnection({
      baseUrl: "https://example.test/v1",
      fetchImpl,
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostic).toContain("认证失败");
  });

  it("detects 404 with guidance", async () => {
    const fetchImpl = async () =>
      new Response("not found", { status: 404 });

    const result = await testOpenAICompatibleConnection({
      baseUrl: "https://example.test/no-v1",
      fetchImpl,
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostic).toContain("404");
  });

  it("reports CORS/network errors", async () => {
    const fetchImpl = async () => {
      throw new TypeError("Failed to fetch");
    };

    const result = await testOpenAICompatibleConnection({
      baseUrl: "https://blocked.test/v1",
      fetchImpl,
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostic).toContain("无法连接到服务器");
  });

  it("sends auth header when apiKey is set", async () => {
    let capturedHeaders: Record<string, string> = {};

    const fetchImpl: typeof fetch = async (_input, init) => {
      capturedHeaders = (init?.headers as Record<string, string>) ?? {};

      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    };

    await testOpenAICompatibleConnection({
      baseUrl: "https://example.test/v1",
      apiKey: "sk-test",
      fetchImpl,
    });

    expect(capturedHeaders["Authorization"]).toBe("Bearer sk-test");
  });

  it("omits auth header when apiKey is blank", async () => {
    let capturedHeaders: Record<string, string> = {};

    const fetchImpl: typeof fetch = async (_input, init) => {
      capturedHeaders = (init?.headers as Record<string, string>) ?? {};

      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    };

    await testOpenAICompatibleConnection({
      baseUrl: "https://example.test/v1",
      apiKey: "  ",
      fetchImpl,
    });

    expect(capturedHeaders["Authorization"]).toBeUndefined();
  });

  it("handles json parse failure gracefully", async () => {
    const fetchImpl = async () =>
      new Response("plain text not json", { status: 200 });

    const result = await testOpenAICompatibleConnection({
      baseUrl: "https://example.test/v1",
      fetchImpl,
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostic).toContain("无法解析");
  });
});
