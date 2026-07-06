export interface ConnectionTestResult {
  ok: boolean;
  diagnostic: string;
  detail?: string;
  models?: string[];
  resolvedBaseUrl?: string;
  selectedModel?: string;
}

export interface ConnectionTestInput {
  baseUrl: string;
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

export async function testOpenAICompatibleConnection(
  input: ConnectionTestInput,
): Promise<ConnectionTestResult> {
  const fetchFn = input.fetchImpl ?? fetch;
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (input.apiKey && input.apiKey.trim().length > 0) {
    headers["Authorization"] = `Bearer ${input.apiKey.trim()}`;
  }

  let response: Response;
  let resolvedBaseUrl = baseUrl;

  try {
    response = await fetchModels(fetchFn, {
      baseUrls: createBaseUrlCandidates(baseUrl),
      headers,
      signal: input.signal,
      onResolvedBaseUrl: (value) => {
        resolvedBaseUrl = value;
      },
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, diagnostic: "连接测试已取消。" };
    }

    const message = err instanceof Error ? err.message : String(err);

    if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
      return {
        ok: false,
        diagnostic: "无法连接到服务器。",
        detail: "可能是地址错误、服务未启动、或浏览器 CORS 策略拦截了请求。如果使用 OpenAI 官方接口，需要配合 CORS 代理或本地推理端点。",
      };
    }

    return {
      ok: false,
      diagnostic: "网络请求失败。",
      detail: message,
    };
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      diagnostic: `认证失败（${response.status}）。`,
      detail: "API Key 无效或权限不足，请检查 API Key 是否正确。",
    };
  }

  if (response.status === 404) {
    return {
      ok: false,
      diagnostic: `端点未找到（404）。`,
      detail: "Base URL 可能不是 /v1 路径，或此端点不支持 GET /models。请确认地址格式，如 https://api.openai.com/v1。",
    };
  }

  if (response.status >= 500) {
    return {
      ok: false,
      diagnostic: `服务器错误（${response.status}）。`,
      detail: "服务端暂时不可用，请稍后重试或检查服务状态。",
    };
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    return {
      ok: false,
      diagnostic: "服务器返回了无法解析的响应。",
      detail: "端点可能不是 OpenAI 兼容格式，请检查 Base URL 是否正确。",
    };
  }

  if (response.ok) {
    const models = extractModelIds(body);
    const modelCount = models.length > 0 ? String(models.length) : undefined;

    return {
      ok: true,
      diagnostic: "连接成功！端点返回了模型列表。",
      detail: modelCount ? `检测到 ${modelCount} 个可用模型。` : undefined,
      models,
      resolvedBaseUrl,
      selectedModel: selectModel(input.model, models),
    };
  }

  return {
    ok: false,
    diagnostic: `服务器返回未预期的状态码 ${response.status}。`,
    detail: JSON.stringify(body).slice(0, 200),
  };
}

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");

  return trimmed || "http://127.0.0.1:8000/v1";
}

async function fetchModels(
  fetchFn: typeof fetch,
  input: {
    baseUrls: string[];
    headers: Record<string, string>;
    onResolvedBaseUrl: (baseUrl: string) => void;
    signal?: AbortSignal;
  },
): Promise<Response> {
  let lastResponse: Response | undefined;

  for (const candidateBaseUrl of input.baseUrls) {
    const response = await fetchFn(`${candidateBaseUrl}/models`, {
      method: "GET",
      headers: input.headers,
      signal: input.signal,
    });

    input.onResolvedBaseUrl(candidateBaseUrl);

    if (response.status !== 404) {
      return response;
    }

    lastResponse = response;
  }

  if (!lastResponse) {
    throw new Error("没有可用的 Base URL 候选。");
  }

  return lastResponse;
}

function createBaseUrlCandidates(baseUrl: string): string[] {
  if (/\/v1$/u.test(baseUrl)) {
    return [baseUrl];
  }

  return [baseUrl, `${baseUrl}/v1`];
}

function extractModelIds(body: unknown): string[] {
  if (typeof body !== "object" || body === null || !("data" in body)) {
    return [];
  }

  const data = (body as Record<string, unknown>).data;

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (typeof item === "object" && item !== null) {
        const id = (item as Record<string, unknown>).id;

        return typeof id === "string" ? id : undefined;
      }

      return undefined;
    })
    .filter((id): id is string => Boolean(id && id.trim().length > 0));
}

function selectModel(
  requestedModel: string | undefined,
  models: string[],
): string | undefined {
  const normalized = requestedModel?.trim();

  if (normalized && models.includes(normalized)) {
    return normalized;
  }

  return models[0];
}
