import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { createStorage, StorageSettings } from "@/lib/config";

type MockStep = {
  response: Response | (() => Response | Promise<Response>);
  matcher?: (input: RequestInfo | URL, init?: RequestInit) => void;
};

const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const textResponse = (text: string, status = 200) => new Response(text, { status });

const legacyFallback = (input: RequestInfo | URL) => {
  if (String(input).includes("bookmarkhub-configs.json")) {
    return textResponse("", 404);
  }
  throw new Error(`Unexpected fetch call: ${String(input)}`);
};

const makeFetchMock = (
  steps: MockStep[],
  fallback?: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>,
) => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const mock = async (input: RequestInfo | URL, init?: RequestInit) => {
    const step = steps.shift();
    if (!step) {
      if (fallback) return fallback(input, init);
      throw new Error(`Unexpected fetch call: ${String(input)}`);
    }
    step.matcher?.(input, init);
    calls.push({ input, init });
    const res = typeof step.response === "function" ? await step.response() : step.response;
    return res;
  };
  return Object.assign(mock, { calls });
};

const buildGithubSettings = (overrides?: Partial<StorageSettings["github"]>): StorageSettings => ({
  kind: "github",
  github: {
    owner: "user",
    repo: "repo",
    branch: "feature",
    token: "token",
    remotePath: "bookmarkhub",
    ...(overrides ?? {}),
  },
});

let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = global.fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

test("404 触发分支创建并写入空 index", async () => {
  const emptyIndex = { activeVersion: undefined, entries: [] };
  const steps: MockStep[] = [
    {
      matcher: (input, init) => {
        assert.match(String(input), /bookmarkhub-index\.json/);
        assert.equal(init?.method, undefined);
      },
      response: textResponse("", 404),
    },
    {
      matcher: (input) => {
        assert.match(String(input), /git\/ref\/heads\/feature/);
      },
      response: jsonResponse({ object: { sha: "feature-sha" } }),
    },
    {
      matcher: (input) => {
        assert.match(String(input), /bookmarkhub-index\.json/);
      },
      response: textResponse("", 404),
    },
    {
      matcher: (input, init) => {
        assert.match(String(input), /bookmarkhub-index\.json/);
        assert.equal(init?.method, "PUT");
      },
      response: jsonResponse({ content: { sha: "new-sha" } }, 201),
    },
    {
      matcher: (input) => {
        assert.match(String(input), /bookmarkhub-index\.json/);
      },
      response: jsonResponse({ content: Buffer.from(JSON.stringify(emptyIndex)).toString("base64"), sha: "new-sha" }),
    },
  ];

  const mockFetch = makeFetchMock(steps, legacyFallback);
  global.fetch = mockFetch as unknown as typeof fetch;

  const storage = createStorage(buildGithubSettings());
  const configs = await storage.loadStoredConfigs();
  assert.deepEqual(configs, []);
});

test("404 但分支与 index 已存在时跳过创建", async () => {
  const emptyIndex = { activeVersion: undefined, entries: [] };
  const steps: MockStep[] = [
    { response: textResponse("", 404) },
    { response: jsonResponse({ object: { sha: "feature-sha" } }) },
    {
      response: jsonResponse({ content: Buffer.from(JSON.stringify(emptyIndex)).toString("base64"), sha: "existing-sha" }, 200),
    },
  ];

  const mockFetch = makeFetchMock(steps, legacyFallback);
  global.fetch = mockFetch as unknown as typeof fetch;

  const storage = createStorage(buildGithubSettings());
  const configs = await storage.loadStoredConfigs();
  assert.deepEqual(configs, []);
});

test("分支不存在时使用默认分支创建后写入", async () => {
  const emptyIndex = { activeVersion: undefined, entries: [] };
  const steps: MockStep[] = [
    { response: textResponse("", 404) },
    { response: textResponse("", 404) },
    { response: jsonResponse({ default_branch: "main" }) },
    { response: jsonResponse({ object: { sha: "main-sha" } }) },
    {
      matcher: (input, init) => {
        assert.match(String(input), /git\/refs/);
        assert.equal(init?.method, "POST");
      },
      response: jsonResponse({}, 201),
    },
    { response: textResponse("", 404) },
    { response: jsonResponse({ content: { sha: "new-sha" } }, 201) },
    {
      response: jsonResponse({ content: Buffer.from(JSON.stringify(emptyIndex)).toString("base64"), sha: "new-sha" }, 200),
    },
  ];

  const mockFetch = makeFetchMock(steps, legacyFallback);
  global.fetch = mockFetch as unknown as typeof fetch;

  const storage = createStorage(buildGithubSettings());
  const configs = await storage.loadStoredConfigs();
  assert.deepEqual(configs, []);
});

test("index 写入冲突后重拉成功", async () => {
  const emptyIndex = { activeVersion: undefined, entries: [] };
  const steps: MockStep[] = [
    { response: textResponse("", 404) },
    { response: jsonResponse({ object: { sha: "feature-sha" } }) },
    { response: textResponse("", 404) },
    { response: jsonResponse({}, 422) },
    {
      response: jsonResponse({ content: Buffer.from(JSON.stringify(emptyIndex)).toString("base64"), sha: "existing-sha" }, 200),
    },
  ];

  const mockFetch = makeFetchMock(steps, legacyFallback);
  global.fetch = mockFetch as unknown as typeof fetch;

  const storage = createStorage(buildGithubSettings());
  const configs = await storage.loadStoredConfigs();
  assert.deepEqual(configs, []);
});

test("缺少分支直接抛错", async () => {
  const settings = buildGithubSettings({ branch: "" });
  assert.throws(() => createStorage(settings), /GitHub 存储配置不完整/);
});

test("非 404 错误按原逻辑抛出", async () => {
  const steps: MockStep[] = [{ response: textResponse("", 403) }];
  const mockFetch = makeFetchMock(steps, legacyFallback);
  global.fetch = mockFetch as unknown as typeof fetch;

  const storage = createStorage(buildGithubSettings());
  await assert.rejects(storage.loadStoredConfigs(), /GitHub index load failed/);
});
