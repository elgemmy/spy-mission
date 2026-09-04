# External Chrome

Use this path when the coding agent can run local scripts but needs a separate WebMCP-enabled Chrome page. The scripts beside this reference preserve the working local watcher flow; they do not implement a second game protocol.

## Requirements

- Node.js and npm
- Google Chrome or Chromium with the experimental WebMCP features used by the launcher
- A graphical desktop session
- Permission to install `puppeteer-core` in a user cache and launch or attach to Chrome

Set the skill directory from its installed location, then prepare the helper cache:

```bash
SKILL_PATH="path/to/play-spymission"
bash "$SKILL_PATH/scripts/setup.sh"
```

Optional environment variables:

- `PLAY_SPYMISSION_HOME`: helper cache and dedicated Chrome profile
- `PLAY_SPYMISSION_PORT`: Chrome remote-debugging port; default `9222`
- `PLAY_SPYMISSION_CHROME`: Chrome or Chromium executable
- `PLAY_SPYMISSION_PUPPETEER_VERSION`: helper version override; the tested default is pinned

## Join and call the page tools

Launch or reuse the dedicated Chrome and open the exact user-supplied invitation without printing it:

```bash
node "$SKILL_PATH/scripts/launch.mjs" "$INVITE_URL"
node "$SKILL_PATH/scripts/webmcp.mjs" status
node "$SKILL_PATH/scripts/webmcp.mjs" list
```

Wait until page tools are present. Use the same tool sequence as integrated mode:

```bash
node "$SKILL_PATH/scripts/webmcp.mjs" call choose_name '{"name":"Sam"}'
node "$SKILL_PATH/scripts/webmcp.mjs" call inspect_mission '{"wait_seconds":8}'
node "$SKILL_PATH/scripts/webmcp.mjs" call submit_guesses '{"card_ids":["card-id"],"field_note":"Short public reason."}'
```

Do not show command details in ordinary game messages.

## Watch for meaningful changes

Start exactly one watcher as a background process:

```bash
node "$SKILL_PATH/scripts/watch.mjs"
```

The watcher writes the latest public mission snapshot to the cache, blocks through the page's bounded `inspect_mission` wait when possible, and emits a line beginning with `AGENT_LOOP_WAKE_mission` only for:

- a new Signal
- a newly revealed card
- mission win or loss
- browser or WebMCP disconnection that needs attention

Configure the coding-agent shell runner to wake on `^AGENT_LOOP_WAKE_mission`. On wake, read the emitted public summary or the cache snapshot, refresh the page tools, and keep playing. Do not mention the watcher in normal game conversation.

Stop the watcher when the mission ends or the user stops:

```bash
bash "$SKILL_PATH/scripts/stop.sh"
```

The stop helper checks that the recorded PID is a `watch.mjs` process before sending a signal. The watcher also removes its PID file on normal exit and terminal mission phases. It disconnects from Chrome but does not close the user's browser.
