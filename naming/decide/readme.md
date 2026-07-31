# Naming decision lab

## Local mode: ratings + automatic Codex batches

From the repository root, run:

```bash
node naming/decide/bridge.mjs
```

Open [http://127.0.0.1:4310/naming/decide/](http://127.0.0.1:4310/naming/decide/).

The bridge binds only to `127.0.0.1`. It serves the decision lab locally and invokes `codex exec` only after you complete a batch and press **Analyze & generate 20**. No API key is embedded in the browser or committed to the repository.

## Vercel mode: ratings only

The deployed page can record scores and keep them through reloads using the browser’s local storage. It cannot invoke Codex running on your Mac: a hosted Vercel function has no access to your local machine, CLI session, or credentials.

Use local mode whenever you want the automatic analysis/generation loop.

## Rating gesture

- Upper left → 3
- Lower left → 2
- Upper right → 4
- Lower right → 5

Desktop controls and number keys `2`–`5` do the same thing. `Cmd/Ctrl + Z` undoes the latest score.
