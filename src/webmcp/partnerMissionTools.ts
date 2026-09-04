/**
 * The browser WebMCP surface is deliberately kept behind this small adapter.
 * It knows how to present Field Agent-safe data, but delegates authenticated
 * reads, waits, and mutations to the normal room/application layer.
 */

export type PartnerMissionPhase =
  | "waiting_for_agent"
  | "waiting_for_signal"
  | "field_agent_turn"
  | "locked"
  | "won"
  | "lost";

export type RevealedCardResult = "target" | "decoy" | "trap";

export type FieldAgentCard =
  | {
      id: string;
      word: string;
      revealed: false;
    }
  | {
      id: string;
      word: string;
      revealed: true;
      result: RevealedCardResult;
    };

/** A server-authorized, already role-filtered Field Agent projection. */
export interface FieldAgentMissionSnapshot {
  version: number;
  phase: PartnerMissionPhase;
  agentName: string;
  signal: { word: string; count: number } | null;
  maxGuesses: number | null;
  targetsRemaining: number;
  cards: readonly FieldAgentCard[];
  lockedCardIds?: readonly string[];
}

export type PartnerMissionWebMcpCapability =
  | { kind: "inactive" }
  | { kind: "pre_join" }
  | {
      kind: "joined";
      phase: PartnerMissionPhase;
      /** Used only to make submit_guesses' JSON Schema more precise. */
      maxGuesses?: number;
    };

export type PartnerMissionToolName =
  | "choose_name"
  | "inspect_mission"
  | "submit_guesses";

export interface ChooseNameInput {
  name: string;
}

export interface SubmitGuessesInput {
  cardIds: readonly string[];
  fieldNote?: string;
}

export interface PartnerMissionWebMcpHandlers {
  /** Claims the invite using the current authenticated browser identity. */
  chooseName(input: ChooseNameInput): Promise<{ name: string }>;
  /** Returns the latest server-authorized Field Agent projection. */
  getLatestMission(): FieldAgentMissionSnapshot;
  /**
   * Waits on the application's existing subscription/polling layer. It should
   * resolve on a newer authorized snapshot or when `signal` is aborted.
   */
  waitForMissionChange(input: {
    afterVersion: number;
    waitSeconds: number;
    signal: AbortSignal;
  }): Promise<void>;
  /** Locks guesses through the normal authenticated room command path. */
  submitGuesses(
    input: SubmitGuessesInput,
    latestMission: FieldAgentMissionSnapshot,
  ): Promise<{ lockedCount: number }>;
}

export interface WebMcpToolDefinition {
  name: PartnerMissionToolName;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint: true };
  execute(input: unknown): Promise<unknown>;
}

export interface WebMcpModelContext {
  registerTool(
    definition: WebMcpToolDefinition,
    options: { signal: AbortSignal },
  ): void | Promise<void>;
}

export interface PartnerMissionWebMcpStatus {
  state: "inactive" | "ready" | "unsupported" | "registration_error";
  toolCount: number;
  toolNames: readonly PartnerMissionToolName[];
}

export interface PartnerMissionWebMcpAdapterOptions {
  /** Read at invocation time so registered tools never close over stale state. */
  getCurrentHandlers(): PartnerMissionWebMcpHandlers;
  /** Injectable for tests; production defaults to browser feature detection. */
  getModelContext?: () => WebMcpModelContext | null;
}

/** An explicitly model-safe error that may cross the WebMCP boundary. */
export class WebMcpToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebMcpToolError";
  }
}

const NO_ARGUMENTS_SCHEMA = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const;

export const CHOOSE_NAME_INPUT_SCHEMA = {
  type: "object",
  properties: {
    name: {
      type: "string",
      minLength: 1,
      maxLength: 32,
      description:
        "Choose a short display name or call sign for yourself as the Field Agent.",
    },
  },
  required: ["name"],
  additionalProperties: false,
} as const;

export const INSPECT_MISSION_INPUT_SCHEMA = {
  type: "object",
  properties: {
    wait_seconds: {
      type: "integer",
      minimum: 0,
      maximum: 8,
      description:
        "Optional bounded wait for the mission state to change before returning.",
    },
  },
  additionalProperties: false,
} as const;

const SUBMIT_GUESSES_SCHEMA_BASE = {
  type: "object",
  properties: {
    card_ids: {
      type: "array",
      minItems: 1,
      uniqueItems: true,
      items: { type: "string" },
      description: "Ordered unrevealed card IDs, strongest guess first.",
    },
    field_note: {
      type: "string",
      maxLength: 160,
      description:
        "Optional brief game rationale. Do not provide private chain-of-thought.",
    },
  },
  required: ["card_ids"],
  additionalProperties: false,
} as const;

export function createSubmitGuessesInputSchema(
  maxGuesses?: number,
): Record<string, unknown> {
  const cardIds = {
    ...SUBMIT_GUESSES_SCHEMA_BASE.properties.card_ids,
    ...(Number.isInteger(maxGuesses) && (maxGuesses ?? 0) > 0
      ? { maxItems: maxGuesses }
      : {}),
  };

  return {
    ...SUBMIT_GUESSES_SCHEMA_BASE,
    properties: {
      ...SUBMIT_GUESSES_SCHEMA_BASE.properties,
      card_ids: cardIds,
    },
  };
}

function isModelContext(value: unknown): value is WebMcpModelContext {
  return (
    typeof value === "object" &&
    value !== null &&
    "registerTool" in value &&
    typeof value.registerTool === "function"
  );
}

/** Resolve the authoritative per-document WebMCP capability, if available. */
export function detectWebMcpModelContext(): WebMcpModelContext | null {
  const documentContext =
    typeof document === "undefined"
      ? undefined
      : (document as Document & { modelContext?: unknown }).modelContext;
  if (isModelContext(documentContext)) {
    return documentContext;
  }

  const navigatorContext =
    typeof navigator === "undefined"
      ? undefined
      : (navigator as Navigator & { modelContext?: unknown }).modelContext;
  return isModelContext(navigatorContext) ? navigatorContext : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertOnlyProperties(
  input: Record<string, unknown>,
  allowed: readonly string[],
): void {
  if (Object.keys(input).some((key) => !allowed.includes(key))) {
    throw new WebMcpToolError("The tool input contains an unsupported field.");
  }
}

function readChooseNameInput(input: unknown): ChooseNameInput {
  if (!isRecord(input)) {
    throw new WebMcpToolError(
      "Choose a call sign between 1 and 32 characters.",
    );
  }
  assertOnlyProperties(input, ["name"]);
  if (typeof input.name !== "string") {
    throw new WebMcpToolError(
      "Choose a call sign between 1 and 32 characters.",
    );
  }

  const name = input.name.trim();
  if (name.length < 1 || name.length > 32) {
    throw new WebMcpToolError(
      "Choose a call sign between 1 and 32 characters.",
    );
  }
  return { name };
}

function readWaitSeconds(input: unknown): number {
  const value = input ?? {};
  if (!isRecord(value)) {
    throw new WebMcpToolError("wait_seconds must be an integer from 0 to 8.");
  }
  assertOnlyProperties(value, ["wait_seconds"]);
  if (value.wait_seconds === undefined) {
    return 0;
  }
  if (
    !Number.isInteger(value.wait_seconds) ||
    (value.wait_seconds as number) < 0 ||
    (value.wait_seconds as number) > 8
  ) {
    throw new WebMcpToolError("wait_seconds must be an integer from 0 to 8.");
  }
  return value.wait_seconds as number;
}

function readSubmitGuessesInput(input: unknown): SubmitGuessesInput {
  if (!isRecord(input)) {
    throw new WebMcpToolError(
      "Provide at least one unique unrevealed card ID in strongest-first order.",
    );
  }
  assertOnlyProperties(input, ["card_ids", "field_note"]);
  if (
    !Array.isArray(input.card_ids) ||
    input.card_ids.length < 1 ||
    input.card_ids.some(
      (cardId) => typeof cardId !== "string" || cardId.length === 0,
    ) ||
    new Set(input.card_ids).size !== input.card_ids.length
  ) {
    throw new WebMcpToolError(
      "Provide at least one unique unrevealed card ID in strongest-first order.",
    );
  }
  if (
    input.field_note !== undefined &&
    (typeof input.field_note !== "string" || input.field_note.length > 160)
  ) {
    throw new WebMcpToolError("field_note must be 160 characters or fewer.");
  }

  return {
    cardIds: input.card_ids as string[],
    ...(typeof input.field_note === "string"
      ? { fieldNote: input.field_note }
      : {}),
  };
}

function safeError(error: unknown, fallback: string): WebMcpToolError {
  return error instanceof WebMcpToolError
    ? error
    : new WebMcpToolError(fallback);
}

function nextInstruction(snapshot: FieldAgentMissionSnapshot): string {
  switch (snapshot.phase) {
    case "waiting_for_agent":
      return "The Field Agent seat is not ready yet. Inspect the mission again shortly.";
    case "waiting_for_signal":
      return "The Mission Lead must transmit a Signal. Call inspect_mission again, optionally with a brief wait.";
    case "field_agent_turn":
      return `Choose 1 to ${snapshot.maxGuesses ?? 1} unrevealed card IDs in strongest-first order and call submit_guesses.`;
    case "locked":
      return "Your guesses are locked. Wait for the Mission Lead to reveal them, then call inspect_mission again.";
    case "won":
      return "Mission complete. All Targets were found.";
    case "lost":
      return "Mission ended because the Trap was revealed.";
  }
}

function missionOutput(
  snapshot: FieldAgentMissionSnapshot,
): Record<string, unknown> {
  const cards = snapshot.cards.map((card) =>
    card.revealed
      ? {
          id: card.id,
          word: card.word,
          revealed: true,
          result: card.result,
        }
      : { id: card.id, word: card.word, revealed: false },
  );

  return {
    phase: snapshot.phase,
    agent_name: snapshot.agentName,
    signal: snapshot.phase === "waiting_for_signal" ? null : snapshot.signal,
    max_guesses:
      snapshot.phase === "field_agent_turn" ? snapshot.maxGuesses : null,
    targets_remaining: snapshot.targetsRemaining,
    cards,
    submission:
      snapshot.phase === "field_agent_turn"
        ? "open"
        : snapshot.phase === "locked"
          ? "locked"
          : "unavailable",
    ...(snapshot.phase === "locked"
      ? { locked_card_ids: [...(snapshot.lockedCardIds ?? [])] }
      : {}),
    next: nextInstruction(snapshot),
  };
}

async function waitWithinBound(
  handlers: PartnerMissionWebMcpHandlers,
  snapshot: FieldAgentMissionSnapshot,
  waitSeconds: number,
  registrationSignal: AbortSignal,
): Promise<void> {
  if (
    waitSeconds === 0 ||
    snapshot.phase !== "waiting_for_signal" ||
    registrationSignal.aborted
  ) {
    return;
  }

  const waitController = new AbortController();
  const abortWait = () => waitController.abort();
  registrationSignal.addEventListener("abort", abortWait, { once: true });
  const timeout = globalThis.setTimeout(abortWait, waitSeconds * 1_000);

  try {
    const applicationWait = handlers
      .waitForMissionChange({
        afterVersion: snapshot.version,
        waitSeconds,
        signal: waitController.signal,
      })
      .catch((error: unknown) => {
        // Timeout and lifecycle aborts are normal bounded-wait completion.
        if (!waitController.signal.aborted) {
          throw error;
        }
      });

    await Promise.race([
      applicationWait,
      new Promise<void>((resolve) => {
        waitController.signal.addEventListener("abort", () => resolve(), {
          once: true,
        });
      }),
    ]);
  } finally {
    globalThis.clearTimeout(timeout);
    registrationSignal.removeEventListener("abort", abortWait);
    waitController.abort();
  }
}

function capabilityKey(capability: PartnerMissionWebMcpCapability): string {
  if (capability.kind !== "joined") {
    return capability.kind;
  }
  return `${capability.kind}:${capability.phase}:${capability.maxGuesses ?? ""}`;
}

function legalToolNames(
  capability: PartnerMissionWebMcpCapability,
): readonly PartnerMissionToolName[] {
  if (capability.kind === "pre_join") {
    return ["choose_name"];
  }
  if (capability.kind !== "joined") {
    return [];
  }
  return capability.phase === "field_agent_turn"
    ? ["inspect_mission", "submit_guesses"]
    : ["inspect_mission"];
}

export class PartnerMissionWebMcpAdapter {
  private readonly options: PartnerMissionWebMcpAdapterOptions;
  private controller: AbortController | null = null;
  private context: WebMcpModelContext | null = null;
  private desiredKey: string | null = null;
  private generation = 0;
  private pending: Promise<PartnerMissionWebMcpStatus> | null = null;
  private status: PartnerMissionWebMcpStatus = {
    state: "inactive",
    toolCount: 0,
    toolNames: [],
  };

  constructor(options: PartnerMissionWebMcpAdapterOptions) {
    this.options = options;
  }

  getStatus(): PartnerMissionWebMcpStatus {
    return this.status;
  }

  async setCapability(
    capability: PartnerMissionWebMcpCapability,
  ): Promise<PartnerMissionWebMcpStatus> {
    const context = this.options.getModelContext
      ? this.options.getModelContext()
      : detectWebMcpModelContext();
    const key = capabilityKey(capability);

    if (this.desiredKey === key && this.context === context) {
      if (this.pending) {
        return this.pending;
      }
      if (this.status.state !== "registration_error") {
        return this.status;
      }
    }

    this.generation += 1;
    const generation = this.generation;
    this.controller?.abort();
    this.controller = null;
    this.context = context;
    this.desiredKey = key;

    if (capability.kind === "inactive") {
      this.status = { state: "inactive", toolCount: 0, toolNames: [] };
      return this.status;
    }
    if (!context) {
      this.status = { state: "unsupported", toolCount: 0, toolNames: [] };
      return this.status;
    }

    const controller = new AbortController();
    this.controller = controller;
    const toolNames = legalToolNames(capability);
    const definitions = this.createDefinitions(
      capability,
      toolNames,
      controller.signal,
    );

    const registration = (async (): Promise<PartnerMissionWebMcpStatus> => {
      // Let `pending` be assigned before a synchronous registerTool failure can
      // reach the cleanup path.
      await Promise.resolve();
      try {
        for (const definition of definitions) {
          if (controller.signal.aborted || generation !== this.generation) {
            return this.status;
          }
          await context.registerTool(definition, {
            signal: controller.signal,
          });
        }
        if (controller.signal.aborted || generation !== this.generation) {
          return this.status;
        }
        this.status = {
          state: "ready",
          toolCount: toolNames.length,
          toolNames,
        };
        return this.status;
      } catch {
        controller.abort();
        if (generation === this.generation) {
          this.controller = null;
          this.status = {
            state: "registration_error",
            toolCount: 0,
            toolNames: [],
          };
        }
        return this.status;
      } finally {
        if (generation === this.generation) {
          this.pending = null;
        }
      }
    })();

    this.pending = registration;
    return registration;
  }

  dispose(): void {
    this.generation += 1;
    this.controller?.abort();
    this.controller = null;
    this.context = null;
    this.desiredKey = null;
    this.pending = null;
    this.status = { state: "inactive", toolCount: 0, toolNames: [] };
  }

  private createDefinitions(
    capability: PartnerMissionWebMcpCapability,
    toolNames: readonly PartnerMissionToolName[],
    registrationSignal: AbortSignal,
  ): WebMcpToolDefinition[] {
    return toolNames.map((name) => {
      switch (name) {
        case "choose_name":
          return this.chooseNameDefinition();
        case "inspect_mission":
          return this.inspectMissionDefinition(registrationSignal);
        case "submit_guesses":
          return this.submitGuessesDefinition(
            capability.kind === "joined" ? capability.maxGuesses : undefined,
          );
      }
    });
  }

  private chooseNameDefinition(): WebMcpToolDefinition {
    return {
      name: "choose_name",
      description:
        "Choose your Field Agent call sign and claim the invited seat. Use this once before entering the mission, then call inspect_mission.",
      inputSchema: CHOOSE_NAME_INPUT_SCHEMA,
      execute: async (input) => {
        const parsed = readChooseNameInput(input);
        try {
          const joined = await this.options
            .getCurrentHandlers()
            .chooseName(parsed);
          return {
            joined: true,
            name: joined.name,
            role: "Field Agent",
            next: "Call inspect_mission. If the Mission Lead has not sent a Signal yet, you can briefly wait for one there.",
          };
        } catch (error) {
          throw safeError(
            error,
            "Unable to claim the Field Agent seat. Try choose_name again or ask the Mission Lead for a fresh invitation.",
          );
        }
      },
    };
  }

  private inspectMissionDefinition(
    registrationSignal: AbortSignal,
  ): WebMcpToolDefinition {
    return {
      name: "inspect_mission",
      description:
        "Inspect the public mission board, revealed results, and current Signal. Use wait_seconds for a brief bounded wait when no Signal is active; then follow the returned next instruction.",
      inputSchema: INSPECT_MISSION_INPUT_SCHEMA,
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const waitSeconds = readWaitSeconds(input);
        try {
          const handlers = this.options.getCurrentHandlers();
          const beforeWait = handlers.getLatestMission();
          await waitWithinBound(
            handlers,
            beforeWait,
            waitSeconds,
            registrationSignal,
          );
          return missionOutput(
            this.options.getCurrentHandlers().getLatestMission(),
          );
        } catch (error) {
          throw safeError(
            error,
            "Mission state is temporarily unavailable. Call inspect_mission again.",
          );
        }
      },
    };
  }

  private submitGuessesDefinition(maxGuesses?: number): WebMcpToolDefinition {
    return {
      name: "submit_guesses",
      description:
        "Lock your ordered guesses for the active Signal. Submit 1 through the allowed maximum of unique unrevealed card IDs, strongest first; an optional field_note may briefly explain the choice without private chain-of-thought. Then watch the mission reveal.",
      inputSchema: createSubmitGuessesInputSchema(maxGuesses),
      execute: async (input) => {
        const parsed = readSubmitGuessesInput(input);
        try {
          const handlers = this.options.getCurrentHandlers();
          const result = await handlers.submitGuesses(
            parsed,
            handlers.getLatestMission(),
          );
          return {
            accepted: true,
            locked_count: result.lockedCount,
            next: "Your guesses are locked. Watch the mission reveal.",
          };
        } catch (error) {
          throw safeError(
            error,
            "The mission changed. Call inspect_mission again before submitting.",
          );
        }
      },
    };
  }
}

// Kept exported for consumers that need an explicit no-argument schema.
export const EMPTY_WEBMCP_INPUT_SCHEMA = NO_ARGUMENTS_SCHEMA;
