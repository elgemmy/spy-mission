import { afterEach, describe, expect, it, vi } from "vitest";
import type { HintContext } from "../../room/hints";
import { scoreHint } from "./jev";

const context: HintContext = {
  team: "red",
  turnId: "turn-1",
  lang: "en",
  clue: { word: "space", count: 2 },
  board: [
    { id: "moon", word: "MOON", revealed: false },
    { id: "clock", word: "CLOCK", revealed: false },
    { id: "star", word: "STAR", revealed: true },
  ],
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("JEV semantic hints", () => {
  it("uses independent noul questions for unrevealed words and sends only public context", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "server-test-key");
    const fetcher = vi.fn(async () =>
      Response.json({
        answers: {
          card_0: { type: "noul", noul: 0.95 },
          card_1: { type: "noul", noul: 0.35 },
        },
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(scoreHint(context)).resolves.toEqual({
      moon: 0.95,
      clock: 0.35,
    });
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer server-test-key",
    });
    const payload = JSON.parse(init.body as string);
    expect(payload.model).toBe("jev-latest");
    expect(payload.state).toEqual({
      language: "en",
      clue: context.clue,
      board: context.board.map(({ word, revealed }) => ({ word, revealed })),
    });
    expect(payload.questions.card_0).toMatchObject({
      type: "noul",
      instructions: { candidate_word: "MOON" },
    });
    expect(payload.questions).not.toHaveProperty("card_2");
    expect(JSON.stringify(payload)).not.toMatch(/"(?:kind|team|turnId|id)":/);
  });

  it.each(["", "__REPLACE_ME__", "  __REPLACE_ME__  "])(
    "rejects missing/placeholder configuration %j before fetch",
    async (key) => {
      vi.stubEnv("TYPESAFE_API_KEY", key);
      const fetcher = vi.fn();
      vi.stubGlobal("fetch", fetcher);
      await expect(scoreHint(context)).rejects.toThrow("HINT_NOT_CONFIGURED");
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it.each([
    {},
    { answers: {} },
    { answers: { card_0: { type: "noul", noul: 0.8 } } },
    {
      answers: {
        card_0: { type: "noul", noul: "0.8" },
        card_1: { type: "noul", noul: 0.5 },
      },
    },
    {
      answers: {
        card_0: { type: "choice", noul: 0.8 },
        card_1: { type: "noul", noul: 0.5 },
      },
    },
    {
      answers: {
        card_0: { type: "noul", noul: 1.2 },
        card_1: { type: "noul", noul: 0.5 },
      },
    },
    {
      answers: {
        card_0: { type: "noul", noul: 0.8 },
        card_1: { type: "noul", noul: 0.5 },
        extra: { type: "noul", noul: 0.8 },
      },
    },
  ])("rejects incomplete or malformed output", async (body) => {
    vi.stubEnv("TYPESAFE_API_KEY", "server-test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(body)),
    );
    await expect(scoreHint(context)).rejects.toThrow("HINT_INVALID_RESPONSE");
  });

  it("does not retry a provider failure or expose its response body", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "server-test-key");
    const fetcher = vi.fn(
      async () => new Response("sensitive provider error", { status: 429 }),
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(scoreHint(context)).rejects.toThrow("HINT_PROVIDER_FAILED");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("aborts the complete provider request after ten seconds", async () => {
    vi.useFakeTimers();
    vi.stubEnv("TYPESAFE_API_KEY", "server-test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal!.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      ),
    );
    const result = expect(scoreHint(context)).rejects.toThrow("HINT_TIMEOUT");
    await vi.advanceTimersByTimeAsync(10_000);
    await result;
  });
});
