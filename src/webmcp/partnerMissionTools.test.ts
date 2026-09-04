import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHOOSE_NAME_INPUT_SCHEMA,
  INSPECT_MISSION_INPUT_SCHEMA,
  PartnerMissionWebMcpAdapter,
  WebMcpToolError,
  createSubmitGuessesInputSchema,
  detectWebMcpModelContext,
  type FieldAgentMissionSnapshot,
  type PartnerMissionWebMcpCapability,
  type PartnerMissionWebMcpHandlers,
  type WebMcpModelContext,
  type WebMcpToolDefinition,
} from "./partnerMissionTools";

interface RegisteredTool {
  definition: WebMcpToolDefinition;
  signal: AbortSignal;
}

function modelContextHarness() {
  const registered: RegisteredTool[] = [];
  const context: WebMcpModelContext = {
    registerTool: vi.fn((definition, options) => {
      registered.push({ definition, signal: options.signal });
    }),
  };
  return { context, registered };
}

function mission(
  overrides: Partial<FieldAgentMissionSnapshot> = {},
): FieldAgentMissionSnapshot {
  return {
    version: 4,
    phase: "waiting_for_signal",
    agentName: "Cipher",
    signal: null,
    maxGuesses: null,
    targetsRemaining: 8,
    cards: [
      { id: "c01", word: "Moon", revealed: false },
      { id: "c02", word: "Bridge", revealed: true, result: "decoy" },
    ],
    ...overrides,
  };
}

function handlersHarness(initial = mission()) {
  let current = initial;
  const handlers: PartnerMissionWebMcpHandlers = {
    chooseName: vi.fn(async ({ name }) => ({ name })),
    getLatestMission: vi.fn(() => current),
    waitForMissionChange: vi.fn(async () => undefined),
    submitGuesses: vi.fn(async ({ cardIds }) => ({
      lockedCount: cardIds.length,
    })),
  };
  return {
    handlers,
    setMission(next: FieldAgentMissionSnapshot) {
      current = next;
    },
  };
}

function adapterHarness(initial = mission()) {
  const modelContext = modelContextHarness();
  const handlerState = handlersHarness(initial);
  let currentHandlers = handlerState.handlers;
  const adapter = new PartnerMissionWebMcpAdapter({
    getCurrentHandlers: () => currentHandlers,
    getModelContext: () => modelContext.context,
  });
  return {
    adapter,
    ...modelContext,
    ...handlerState,
    setHandlers(handlers: PartnerMissionWebMcpHandlers) {
      currentHandlers = handlers;
    },
  };
}

function byName(
  registered: readonly RegisteredTool[],
  name: WebMcpToolDefinition["name"],
): RegisteredTool {
  const tool = registered.find((entry) => entry.definition.name === name);
  if (!tool) {
    throw new Error(`Missing registered tool ${name}`);
  }
  return tool;
}

function setBrowserModelContext(
  target: Document | Navigator,
  value: WebMcpModelContext | undefined,
): void {
  Object.defineProperty(target, "modelContext", {
    configurable: true,
    value,
  });
}

afterEach(() => {
  vi.useRealTimers();
  setBrowserModelContext(document, undefined);
  setBrowserModelContext(navigator, undefined);
});

describe("WebMCP capability detection", () => {
  it("prefers document.modelContext and falls back to navigator.modelContext", () => {
    const documentContext = modelContextHarness().context;
    const navigatorContext = modelContextHarness().context;
    setBrowserModelContext(navigator, navigatorContext);

    expect(detectWebMcpModelContext()).toBe(navigatorContext);

    setBrowserModelContext(document, documentContext);
    expect(detectWebMcpModelContext()).toBe(documentContext);
  });

  it("reports an actionable unsupported state without registering tools", async () => {
    const adapter = new PartnerMissionWebMcpAdapter({
      getCurrentHandlers: () => handlersHarness().handlers,
      getModelContext: () => null,
    });

    await expect(adapter.setCapability({ kind: "pre_join" })).resolves.toEqual({
      state: "unsupported",
      toolCount: 0,
      toolNames: [],
    });
  });
});

describe("WebMCP tool schemas and legal sets", () => {
  it("publishes strict JSON Schemas for all three tools", () => {
    expect(CHOOSE_NAME_INPUT_SCHEMA).toMatchObject({
      type: "object",
      required: ["name"],
      additionalProperties: false,
      properties: { name: { minLength: 1, maxLength: 32 } },
    });
    expect(INSPECT_MISSION_INPUT_SCHEMA).toMatchObject({
      type: "object",
      additionalProperties: false,
      properties: { wait_seconds: { minimum: 0, maximum: 8 } },
    });
    expect(createSubmitGuessesInputSchema(3)).toMatchObject({
      type: "object",
      required: ["card_ids"],
      additionalProperties: false,
      properties: {
        card_ids: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          uniqueItems: true,
          items: { type: "string" },
        },
        field_note: { type: "string", maxLength: 160 },
      },
    });
  });

  it.each<[PartnerMissionWebMcpCapability, string[]]>([
    [{ kind: "pre_join" }, ["choose_name"]],
    [{ kind: "joined", phase: "waiting_for_signal" }, ["inspect_mission"]],
    [
      { kind: "joined", phase: "field_agent_turn", maxGuesses: 3 },
      ["inspect_mission", "submit_guesses"],
    ],
    [{ kind: "joined", phase: "locked" }, ["inspect_mission"]],
    [{ kind: "joined", phase: "won" }, ["inspect_mission"]],
    [{ kind: "joined", phase: "lost" }, ["inspect_mission"]],
  ])("registers only the legal tools for %o", async (capability, expected) => {
    const { adapter, registered } = adapterHarness();

    const status = await adapter.setCapability(capability);

    expect(registered.map(({ definition }) => definition.name)).toEqual(
      expected,
    );
    expect(status).toMatchObject({
      state: "ready",
      toolCount: expected.length,
    });
    for (const { definition } of registered) {
      expect(definition.inputSchema).toBeDefined();
      if (definition.name === "inspect_mission") {
        expect(definition.annotations).toEqual({ readOnlyHint: true });
      } else {
        expect(definition.annotations).toBeUndefined();
      }
    }
  });
});

describe("WebMCP registration lifecycle", () => {
  it("does not re-register for an unchanged capability", async () => {
    const { adapter, context, registered } = adapterHarness();
    const capability: PartnerMissionWebMcpCapability = {
      kind: "joined",
      phase: "field_agent_turn",
      maxGuesses: 3,
    };

    await adapter.setCapability(capability);
    await adapter.setCapability(capability);

    expect(context.registerTool).toHaveBeenCalledTimes(2);
    expect(registered).toHaveLength(2);
  });

  it("aborts the prior group on a phase change and on dispose", async () => {
    const { adapter, registered } = adapterHarness();
    await adapter.setCapability({
      kind: "joined",
      phase: "field_agent_turn",
      maxGuesses: 3,
    });
    const firstGroupSignals = registered.map(({ signal }) => signal);

    await adapter.setCapability({ kind: "joined", phase: "locked" });
    expect(firstGroupSignals.every((signal) => signal.aborted)).toBe(true);
    expect(registered.at(-1)?.signal.aborted).toBe(false);

    adapter.dispose();
    expect(registered.at(-1)?.signal.aborted).toBe(true);
    expect(adapter.getStatus()).toEqual({
      state: "inactive",
      toolCount: 0,
      toolNames: [],
    });
  });

  it("aborts partial registrations and hides tools on registration failure", async () => {
    const firstSignal: AbortSignal[] = [];
    const context: WebMcpModelContext = {
      registerTool: vi.fn((_definition, { signal }) => {
        firstSignal.push(signal);
        throw new Error("browser internals must not escape");
      }),
    };
    const adapter = new PartnerMissionWebMcpAdapter({
      getCurrentHandlers: () => handlersHarness().handlers,
      getModelContext: () => context,
    });

    await expect(adapter.setCapability({ kind: "pre_join" })).resolves.toEqual({
      state: "registration_error",
      toolCount: 0,
      toolNames: [],
    });
    expect(firstSignal[0]?.aborted).toBe(true);
  });

  it("retries the same capability after a registration failure", async () => {
    let attempts = 0;
    const context: WebMcpModelContext = {
      registerTool: vi.fn(() => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("temporary browser failure");
        }
      }),
    };
    const adapter = new PartnerMissionWebMcpAdapter({
      getCurrentHandlers: () => handlersHarness().handlers,
      getModelContext: () => context,
    });

    await expect(adapter.setCapability({ kind: "pre_join" })).resolves.toEqual({
      state: "registration_error",
      toolCount: 0,
      toolNames: [],
    });
    await expect(adapter.setCapability({ kind: "pre_join" })).resolves.toEqual({
      state: "ready",
      toolCount: 1,
      toolNames: ["choose_name"],
    });
    expect(context.registerTool).toHaveBeenCalledTimes(2);
  });
});

describe("WebMCP tool execution", () => {
  it("choose_name normalizes the name and returns only compact safe output", async () => {
    const { adapter, registered, handlers } = adapterHarness();
    await adapter.setCapability({ kind: "pre_join" });

    const output = await byName(registered, "choose_name").definition.execute({
      name: "  Cipher  ",
    });

    expect(handlers.chooseName).toHaveBeenCalledWith({ name: "Cipher" });
    expect(output).toEqual({
      joined: true,
      name: "Cipher",
      role: "Field Agent",
      next: expect.stringContaining("inspect_mission"),
    });
  });

  it("inspect_mission reconstructs a whitelist with no unrevealed kind", async () => {
    const unsafeSource = mission({
      phase: "field_agent_turn",
      signal: { word: "orbit", count: 2 },
      maxGuesses: 3,
      cards: [
        {
          id: "c01",
          word: "Moon",
          revealed: false,
          kind: "trap",
        } as FieldAgentMissionSnapshot["cards"][number],
        { id: "c02", word: "Bridge", revealed: true, result: "target" },
      ],
    });
    const { adapter, registered } = adapterHarness(unsafeSource);
    await adapter.setCapability({
      kind: "joined",
      phase: "field_agent_turn",
      maxGuesses: 3,
    });

    const output = await byName(
      registered,
      "inspect_mission",
    ).definition.execute({});

    expect(output).toMatchObject({
      phase: "field_agent_turn",
      signal: { word: "orbit", count: 2 },
      max_guesses: 3,
      submission: "open",
      cards: [
        { id: "c01", word: "Moon", revealed: false },
        {
          id: "c02",
          word: "Bridge",
          revealed: true,
          result: "target",
        },
      ],
    });
    expect(JSON.stringify(output)).not.toContain("trap");
    expect(JSON.stringify(output)).not.toContain("kind");
  });

  it("waits through the app layer only while waiting for a Signal, then reads fresh state", async () => {
    const harness = adapterHarness();
    harness.handlers.waitForMissionChange = vi.fn(async ({ afterVersion }) => {
      expect(afterVersion).toBe(4);
      harness.setMission(
        mission({
          version: 5,
          phase: "field_agent_turn",
          signal: { word: "orbit", count: 2 },
          maxGuesses: 3,
        }),
      );
    });
    await harness.adapter.setCapability({
      kind: "joined",
      phase: "waiting_for_signal",
    });

    const output = await byName(
      harness.registered,
      "inspect_mission",
    ).definition.execute({ wait_seconds: 8 });

    expect(harness.handlers.waitForMissionChange).toHaveBeenCalledOnce();
    expect(output).toMatchObject({
      phase: "field_agent_turn",
      signal: { word: "orbit", count: 2 },
      max_guesses: 3,
    });
  });

  it("bounds a non-resolving wait and returns the current waiting state", async () => {
    vi.useFakeTimers();
    const harness = adapterHarness();
    harness.handlers.waitForMissionChange = vi.fn(
      () => new Promise<void>(() => undefined),
    );
    await harness.adapter.setCapability({
      kind: "joined",
      phase: "waiting_for_signal",
    });

    const result = byName(
      harness.registered,
      "inspect_mission",
    ).definition.execute({ wait_seconds: 2 });
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(result).resolves.toMatchObject({
      phase: "waiting_for_signal",
      signal: null,
      submission: "unavailable",
      next: expect.stringContaining("Mission Lead"),
    });
  });

  it("returns locked IDs but no guessed-card correctness before resolution", async () => {
    const { adapter, registered } = adapterHarness(
      mission({
        phase: "locked",
        lockedCardIds: ["c02", "c01"],
        cards: [
          { id: "c01", word: "Moon", revealed: false },
          { id: "c02", word: "Bridge", revealed: false },
        ],
      }),
    );
    await adapter.setCapability({ kind: "joined", phase: "locked" });

    const output = await byName(
      registered,
      "inspect_mission",
    ).definition.execute({});

    expect(output).toMatchObject({
      submission: "locked",
      locked_card_ids: ["c02", "c01"],
    });
    expect(JSON.stringify(output)).not.toContain("result");
  });

  it("submit_guesses preserves order, uses latest state, and never leaks correctness", async () => {
    const harness = adapterHarness(
      mission({
        version: 9,
        phase: "field_agent_turn",
        signal: { word: "orbit", count: 2 },
        maxGuesses: 3,
      }),
    );
    harness.handlers.submitGuesses = vi.fn(async () => ({
      lockedCount: 2,
      result: "trap",
    }));
    await harness.adapter.setCapability({
      kind: "joined",
      phase: "field_agent_turn",
      maxGuesses: 3,
    });

    const output = await byName(
      harness.registered,
      "submit_guesses",
    ).definition.execute({
      card_ids: ["c07", "c02"],
      field_note: "Orbit-related words",
    });

    expect(harness.handlers.submitGuesses).toHaveBeenCalledWith(
      {
        cardIds: ["c07", "c02"],
        fieldNote: "Orbit-related words",
      },
      expect.objectContaining({ version: 9 }),
    );
    expect(output).toEqual({
      accepted: true,
      locked_count: 2,
      next: "Your guesses are locked. Watch the mission reveal.",
    });
    expect(JSON.stringify(output)).not.toContain("trap");
  });

  it("reads replacement handlers instead of retaining stale callback closures", async () => {
    const harness = adapterHarness();
    await harness.adapter.setCapability({ kind: "pre_join" });
    const replacement = handlersHarness().handlers;
    replacement.chooseName = vi.fn(async () => ({ name: "Fresh" }));
    harness.setHandlers(replacement);

    const output = await byName(
      harness.registered,
      "choose_name",
    ).definition.execute({ name: "Fresh" });

    expect(replacement.chooseName).toHaveBeenCalledOnce();
    expect(output).toMatchObject({ name: "Fresh" });
    expect(harness.handlers.chooseName).not.toHaveBeenCalled();
  });

  it("rejects malformed tool input before calling application handlers", async () => {
    const { adapter, registered, handlers } = adapterHarness();
    await adapter.setCapability({
      kind: "joined",
      phase: "field_agent_turn",
      maxGuesses: 3,
    });

    await expect(
      byName(registered, "submit_guesses").definition.execute({
        card_ids: ["c01", "c01"],
      }),
    ).rejects.toThrow("unique unrevealed card ID");
    expect(handlers.submitGuesses).not.toHaveBeenCalled();
  });

  it("preserves explicit safe errors and replaces unknown infrastructure errors", async () => {
    const safeHarness = adapterHarness();
    safeHarness.handlers.chooseName = vi.fn(async () => {
      throw new WebMcpToolError("The Field Agent seat is already occupied.");
    });
    await safeHarness.adapter.setCapability({ kind: "pre_join" });
    await expect(
      byName(safeHarness.registered, "choose_name").definition.execute({
        name: "Cipher",
      }),
    ).rejects.toThrow("The Field Agent seat is already occupied.");

    const unknownHarness = adapterHarness();
    unknownHarness.handlers.submitGuesses = vi.fn(async () => {
      throw new Error("private SQL details");
    });
    await unknownHarness.adapter.setCapability({
      kind: "joined",
      phase: "field_agent_turn",
      maxGuesses: 3,
    });
    await expect(
      byName(unknownHarness.registered, "submit_guesses").definition.execute({
        card_ids: ["c01"],
      }),
    ).rejects.toThrow(
      "The mission changed. Call inspect_mission again before submitting.",
    );
  });
});
