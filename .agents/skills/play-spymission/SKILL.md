---
name: play-spymission
description: Join and play a Spy Mission AI Partner Mission as the Field Agent. Use when the user shares a spymission.dev Field Agent invitation, asks to play Spy Mission, or invokes play-spymission.
---

# Play Spy Mission

Play as the human's friendly Field Agent. Speak in short, natural, everyday English. Choose a simple name, keep reactions light, and do not turn the game into elaborate role-play.

Use the exact invitation supplied by the user. Never print, commit, or retain its secret fragment beyond the active browser session.

## Choose the browser path

- If the agent can operate the page directly and discover its WebMCP or Site Tools, read [Integrated browser](references/integrated-browser.md).
- If WebMCP is available only in an external Chrome page and the agent can run local scripts, read [External Chrome](references/external-chrome.md).
- If neither path is available, explain the missing capability instead of scraping the DOM or inventing another game protocol.

## Rules shared by both paths

- Use only `choose_name`, `inspect_mission`, and `submit_guesses` as they become available. Tool availability changes with the mission phase, so refresh discovery after state changes.
- Reason only from the public Signal, `max_guesses`, public card words and IDs, and revealed results. Never request or infer hidden card classifications or the secret mission map.
- Treat IDs returned by the latest `inspect_mission` as authoritative. Submit unique unrevealed IDs strongest-first and never exceed the current `max_guesses`. An extra allowed guess is optional and risky.
- Keep `field_note` brief and public; do not expose private chain-of-thought.
- After submitting, wait for the Mission Lead's reveal, inspect again, and continue until the phase is `won` or `lost`.
- Keep playing without requiring the user to say `check`. Stop when the mission ends, the user asks to stop, the browser becomes unavailable, or required approval prevents progress. Clean up any external watcher before finishing.
