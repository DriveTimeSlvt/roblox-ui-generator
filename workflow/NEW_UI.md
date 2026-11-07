# New Roblox UI: workflow for Claude

The user wants UI for their Roblox game and may know nothing about this tool. Lead them: look at the project yourself, ask short questions with ready-made options, generate, show, iterate. Talk in the user's language. Every image takes several minutes, so say so before the first generation.

**Start now, in this same turn.** "Connect to roblox-ui-generator" means "start making UI with me". Do not end the turn with a report about the connection, the tools or what you are going to ask: go straight to step 1, then call AskUserQuestion with round 1. The user's first sight of you is one line ("Connected, looked at your project — a few questions") followed by the questions. Only if AskUserQuestion is not available, ask the same questions as a short numbered list with the options.

## 1. Look at the project first

Before asking anything, spend a few tool calls on the repository from `start_ui_session`:

- `README`, `CLAUDE.md`/`AGENTS.md`, docs about the game, art style, palette or UI.
- Existing UI code (`ScreenGui`, `Frame`, `TextLabel` in `.luau`/`.lua`), and which screens already exist.
- `existing_references` from `start_ui_session`: earlier mockups the user may want to continue.

Use what you find as the options in the questions below. A question whose answer is already clear from the project is skipped, and you say what you took from where.

## 2. Ask with AskUserQuestion

At most 4 questions per call, 2–4 options each; the user can always type their own answer. Put your recommended option first and mark it "(Recommended)". Ask all of round 1 in one call.

**Round 1**

1. **What to make.** Options from the project: screens the game has or its docs mention (HUD, shop, inventory, rewards, settings, results). For a new project: HUD, shop, main menu.
2. **Devices.** Phone landscape (Recommended for most Roblox games) · Phone + PC · PC first · Every device including console.
3. **Style.** "As in the project" when the docs describe one or references exist (Recommended then) · Chunky cartoon · Dark neon · Clean premium.
4. **Where to save references.** Ask only when `config_exists` is false. Options:
   - **Next to the repository** — `<project_folder>/roblox-ui-generator/`, outside Git; images do not bloat the repository (Recommended).
   - **Inside the repository** — suggest a folder that fits its layout, e.g. `art/ui-references/` or `docs/ui/`. The team gets the images through Git; each PNG is 1–3 MB, so mention Git LFS if the repository already uses it.
   - A custom folder is allowed through "Other", but it must be inside `project_folder`.

   Write the answer to `config_file` as `{ "outputDir": "<path relative to the repository>" }` (for the default: `"../roblox-ui-generator"`). Tell the user the file can be committed so teammates share the setting. Later sessions read it and do not ask again; the user changes it by editing the file or asking you.

**Round 2 — only what is still unknown**

- References to attach: list found images (the latest mockup, art references). Up to 3.
- Exact labels and the language of in-game text.
- Anything the chosen screen needs: e.g. for a shop the number of items and the currency.

## 3. Generate

1. Write a concrete brief for `create_ui_reference`: game and genre, screen, device and aspect ratio, style and palette, every element with its position, exact labels. Mention safe areas: the Roblox top bar and the default thumbstick and jump zones on phones.
2. Use `kind: "screen"` for mockups. Pass `reference_images` for consistency with earlier screens.
3. Open the result and look at it yourself. Show the path and your notes: what matches the brief, what is off, what is inconsistent with earlier screens.
4. Ask with AskUserQuestion: Approve · Fix (what) · Another variant.

## 4. After approval

Offer the next step, each one only on the user's yes:

- **Assets.** `kind: "asset"`: icon sheets on a regular grid, button plates without text for 9-slice, transparent background.
- **Build in Studio.** Recreate the screen with native GUI objects (Frame, UICorner, UIStroke, UIGradient, layouts) following the project's own code conventions; images only where native objects cannot draw it. Check on the phone emulator.
- **Upload images to Roblox** only after the user approves each asset.

Run one generation at a time: the server refuses a second one while the first runs.
