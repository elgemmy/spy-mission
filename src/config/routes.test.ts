import { describe, expect, it } from "vitest";
import {
  LANDING_PATH,
  PLAY_PATH,
  absolutePlayUrl,
  playHostLabel,
  playUrl,
  readPlayParams,
} from "./routes";

describe("route constants", () => {
  it("reserves the root for the landing page and /play/ for the game", () => {
    expect(LANDING_PATH).toBe("/");
    expect(PLAY_PATH).toBe("/play/");
  });
});

describe("playUrl", () => {
  it("returns the bare play path with no options", () => {
    expect(playUrl()).toBe("/play/");
    expect(playUrl({})).toBe("/play/");
  });

  it("adds the room code", () => {
    expect(playUrl({ room: "ABC12" })).toBe("/play/?room=ABC12");
  });

  it("trims and upper-cases the room code", () => {
    expect(playUrl({ room: "  abc12 " })).toBe("/play/?room=ABC12");
  });

  it("ignores an empty or whitespace-only room code", () => {
    expect(playUrl({ room: "" })).toBe("/play/");
    expect(playUrl({ room: "   " })).toBe("/play/");
  });

  it("adds create and install flags", () => {
    expect(playUrl({ create: true })).toBe("/play/?create=1");
    expect(playUrl({ install: true })).toBe("/play/?install=1");
  });

  it("omits falsy flags", () => {
    expect(playUrl({ create: false, install: false })).toBe("/play/");
  });

  it("emits params in a stable order regardless of option order", () => {
    expect(playUrl({ install: true, create: true, room: "zz9" })).toBe(
      "/play/?room=ZZ9&create=1&install=1",
    );
  });

  it("escapes unusual room codes", () => {
    expect(playUrl({ room: "a b" })).toBe("/play/?room=A+B");
  });
});

describe("absolutePlayUrl", () => {
  it("prefixes the origin", () => {
    expect(absolutePlayUrl("https://spymission.dev")).toBe(
      "https://spymission.dev/play/",
    );
  });

  it("carries options through", () => {
    expect(absolutePlayUrl("https://spymission.dev", { room: "abc12" })).toBe(
      "https://spymission.dev/play/?room=ABC12",
    );
  });

  it("does not double the slash when the origin has a trailing one", () => {
    expect(absolutePlayUrl("http://localhost:5173/")).toBe(
      "http://localhost:5173/play/",
    );
  });
});

describe("readPlayParams", () => {
  it("returns empty values for an empty search", () => {
    expect(readPlayParams("")).toEqual({
      room: null,
      create: false,
      install: false,
    });
  });

  it("reads and normalises the room code", () => {
    expect(readPlayParams("?room=abc12").room).toBe("ABC12");
    expect(readPlayParams("room=abc12").room).toBe("ABC12");
    expect(readPlayParams("?room=%20abc12%20").room).toBe("ABC12");
  });

  it("treats an empty room code as absent", () => {
    expect(readPlayParams("?room=").room).toBeNull();
    expect(readPlayParams("?room=%20").room).toBeNull();
  });

  it("accepts 1, true and a bare param for flags", () => {
    expect(readPlayParams("?create=1").create).toBe(true);
    expect(readPlayParams("?create=true").create).toBe(true);
    expect(readPlayParams("?create=TRUE").create).toBe(true);
    expect(readPlayParams("?create").create).toBe(true);
    expect(readPlayParams("?create=").create).toBe(true);
    expect(readPlayParams("?install=1").install).toBe(true);
    expect(readPlayParams("?install").install).toBe(true);
  });

  it("rejects other flag values", () => {
    expect(readPlayParams("?create=0").create).toBe(false);
    expect(readPlayParams("?create=no").create).toBe(false);
    expect(readPlayParams("?install=false").install).toBe(false);
  });

  it("reads every param at once", () => {
    expect(readPlayParams("?room=abc12&create=1&install=true")).toEqual({
      room: "ABC12",
      create: true,
      install: true,
    });
  });

  it("round-trips playUrl output", () => {
    const url = playUrl({ room: "abc12", create: true, install: true });
    const search = url.slice(url.indexOf("?"));
    expect(readPlayParams(search)).toEqual({
      room: "ABC12",
      create: true,
      install: true,
    });
  });
});

describe("playHostLabel", () => {
  it("appends the play path without a trailing slash", () => {
    expect(playHostLabel("spymission.dev")).toBe("spymission.dev/play");
  });

  it("tolerates a trailing slash on the host", () => {
    expect(playHostLabel("spymission.dev/")).toBe("spymission.dev/play");
  });

  it("keeps a port", () => {
    expect(playHostLabel("localhost:4173")).toBe("localhost:4173/play");
  });
});
