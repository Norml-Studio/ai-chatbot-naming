# Naming decision lab

## Local mode: ratings + automatic Codex batches

From the repository root, run:

```bash
node naming/decide/bridge.mjs
```

Open [http://127.0.0.1:4310/naming/decide/](http://127.0.0.1:4310/naming/decide/).

The bridge serves the decision lab locally and invokes `codex exec` only after you complete a batch and press **Analyze & generate 20**. No API key is embedded in the browser or committed to the repository.

The source of truth is a SQLite file on the Mac:

```text
~/Library/Application Support/Norml Studio/Naming Decision Lab/decision-lab.sqlite
```

It contains the complete app state—initial and generated candidates, every rating, batch reflection, and AI analysis—so a reload or a second device can resume the same decision session.

## Use it on an iPhone

Put the Mac and iPhone on the same Wi‑Fi, then run:

```bash
node naming/decide/bridge.mjs --lan
```

The terminal prints a `.local` address and a Wi‑Fi IP fallback. Open that address in Safari on the iPhone. The phone talks directly to the Mac bridge; swipes write to the Mac’s SQLite file and a completed batch triggers Codex on the Mac.

Use this only on a trusted Wi‑Fi network. The bridge is not a public server and should not be exposed to the internet.

## Vercel mode: ratings only

The deployed page can record scores and keep them through reloads using the browser’s local storage. It cannot invoke Codex running on your Mac: a hosted Vercel function has no access to your local machine, CLI session, or credentials.

Use local mode whenever you want the automatic analysis/generation loop.

## Rating gesture

- Upper left → 3
- Lower left → 2
- Upper right → 4
- Lower right → 5

Desktop controls and number keys `2`–`5` do the same thing. `Cmd/Ctrl + Z` undoes the latest score.
