# New Roblox UI: workflow for Claude

The user wants UI for their Roblox game and may know nothing about this tool. Lead them: look at the project yourself, ask short questions with ready-made options, generate, show, iterate. Every image takes several minutes, so say so before the first generation.

**Language.** This document, the tool results and the style catalog are in English; that says nothing about how to talk to the user.

- Talk in the language of the user's messages. If they mix languages or write only a command ("connect to roblox-ui-generator"), use the language they write the rest in; with nothing else to go on, the language the project's docs are written in.
- A language rule in the project's `CLAUDE.md`, `AGENTS.md` or the user's own instructions wins over this.
- Everything the user reads is in that language: question text, option labels and descriptions, style lines from the catalog, notes on results. Translate them; keep only proper names (style directions, file names, code identifiers) as they are.
- Briefs for `create_ui_reference` and the `style` saved in the config stay in English: the image model follows English best. Show the user a translation when you show the style line.
- The language of labels inside the mockups is a separate question (round 2): the game's own players, not this conversation, decide it.

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

1. **What to make.** Up to 4 options:
   - **Common reference** — a UI kit sheet for the whole game (see "Common reference" below). Offer it first and mark it Recommended when `style_reference` from `start_ui_session` is empty: every later screen is generated against it.
   - **Whole project** — find every window and button the game has or plans, and make mockups for all of them (see "Whole project" below).
   - One or two concrete screens from the project: screens the game has or its docs mention (HUD, shop, inventory, rewards, settings, results). For a new project: HUD, shop.

   When `style_reference` is set, drop "Common reference" from the options and offer up to three concrete screens instead; mention that the kit can be redone on request.
2. **Devices.** Phone landscape (Recommended for most Roblox games) · Phone + PC · PC first · Every device including console.
3. **Style.** Ask only when `config.style` is empty; otherwise use it and say so. Two options:
   - **Claude's suggestion (Recommended).** Your own style line for this game, built from its docs, art, genre and existing references. Put the line itself in the option description, e.g. "plastic toy, flat colours, thick dark outlines, 16 px corners".
   - **From the catalog.** Pick one of the 12 directions below; you ask a follow-up.

   For the catalog follow-up, offer the 3 directions that fit the game's genre best, best first, each with its style line as the description. List all 12 names in the question text so the user can type any other one through "Other".
4. **Where to save references.** Ask only when `config.outputDir` is empty. Options:
   - **Next to the repository** — `<project_folder>/roblox-ui-generator/`, outside Git; images do not bloat the repository (Recommended).
   - **Inside the repository** — suggest a folder that fits its layout, e.g. `art/ui-references/` or `docs/ui/`. The team gets the images through Git; each PNG is 1–3 MB, so mention Git LFS if the repository already uses it.
   - A custom folder is allowed through "Other", but it must be inside `project_folder`.

   Write the answers to `config_file`, keeping any other keys in it:

   ```json
   { "outputDir": "../roblox-ui-generator", "style": "dark neon UI, near-black panels, ...", "styleReference": "../roblox-ui-generator/ui-kit-<id>.png" }
   ```

   `outputDir` is relative to the repository (`"../roblox-ui-generator"` for the default). `style` is the chosen style line. `styleReference` is the approved common reference, relative to the repository; set it only after the user approves the kit. Tell the user the file can be committed so teammates share the settings. Later sessions read it and do not ask again; the user changes it by editing the file or asking you.

### Style catalog

Twelve directions after the VizzBees overview [12 Roblox UI design ideas](https://vizzbees.com/blog/roblox-ui-design-ideas). Each style line is a starting point: adapt the colours to the game.

| Direction | Style line | Fits |
|---|---|---|
| Chunky cartoon | bold dark outlines, big rounded corners (~16 px), saturated primary colours, hard offset shadows, oversized pressable buttons | obbies, simulators, tycoons, young players |
| Dark neon | near-black panels, one or two glowing accents (e.g. cyan and magenta), thin luminous strokes, soft vertical gradients | shooters, racing, cyberpunk, competitive |
| Clean minimal | flat panels, one neutral base and one accent, no gradients, lots of empty space, crisp sans-serif, small corners (~8 px) | roleplay, social, building, text-heavy games |
| Fantasy parchment | aged cream paper panels, ornate gold frames, serif headings, warm cream-and-brown palette; ornament on frames, content plain | RPG, medieval, magic, adventure |
| Glassmorphism | translucent frosted panels over the world, thin light borders, soft inner glow, light shadows | life sims, city games, colourful worlds |
| Retro arcade | pixel-art panels, square corners, small limited palette, chunky pixel font, high contrast, no gradients | retro, arcade minigames, nostalgia |
| Y2K chrome | glossy metallic gradients, bevelled edges, bright blue and silver, sparkle accents, see-through plastic buttons | fashion, dance, music, social, trend-led |
| Anime HUD | angular panels with diagonal cuts, bold slanted type, one vivid accent (red and white), speed lines, energy bars | anime fighting, battlegrounds, action RPG |
| Soft pastel | muted pink, lavender, mint and cream, large corners (~20 px), thin outlines, gentle shadows, rounded friendly type; check contrast | cafés, pets, decorating, cosy sims |
| Industrial sci-fi | brushed metal, rivets and panel seams, hazard stripes, stencil or monospace type, amber and gunmetal, status lights | space, mining, survival, horror |
| Hand-drawn sketch | wobbly ink outlines, paper texture, marker fills, handwritten headings, slightly rotated panels, same wobble everywhere | puzzles, storybook, indie feel |
| Premium dark | charcoal panels, one restrained gold or emerald accent, hairline dividers, tight modern sans-serif, almost no ornament | battle pass, VIP shop, ranked modes |

Whatever the user picks, put the same style line into every brief for this project: it keeps the HUD, shop and menus looking like one game.

**Round 2 — only what is still unknown**

- References to attach: list found images (the latest mockup, art references). Up to 3.
- Exact labels and the language of in-game text.
- Anything the chosen screen needs: e.g. for a shop the number of items and the currency.

## 3. Generate

1. Write a concrete brief for `create_ui_reference`: game and genre, screen, device and aspect ratio, the project's style line word for word, every element with its position, exact labels. Mention safe areas: the Roblox top bar and the default thumbstick and jump zones on phones.
2. Use `kind: "screen"` for mockups. When `style_reference` is set, always pass it as the first of `reference_images` and say in the brief "match the UI kit in the first reference image"; the other two slots are for earlier screens.
3. Open the result and look at it yourself. Show the path and your notes: what matches the brief, what is off, what is inconsistent with earlier screens.
4. Ask with AskUserQuestion: Approve · Fix (what) · Another variant.

### Common reference

One 16:9 sheet that fixes the look of the whole game, generated with `kind: "screen"` and `name: "ui-kit"`. Brief it as a style board on a plain neutral background, not an in-game screen. It shows, in the project's style line:

- the palette as labelled swatches: panel, text, primary accent, secondary, warning;
- headings, body text and numbers in the chosen type;
- buttons in each state: primary, secondary, pressed, disabled, locked; a round icon button;
- a modal panel with a title bar and close button, a card, a tab bar;
- a progress bar, a currency counter, a notification badge, a toggle;
- 8–10 icons the game needs (taken from the project), in one finish.

Use the game's real words where possible (its currency, its stats). After the user approves it, write `styleReference` to the config. If an existing mockup already shows the look the user wants, offer to brief the kit with that mockup as a reference.

### Whole project

1. **Inventory.** Search the project for UI: `ScreenGui`, `BillboardGui`, `SurfaceGui`, `Frame`, `TextButton`, `ImageButton`, `ProximityPrompt`, and the screens the docs plan but the code does not have yet. Group the findings into screens: HUD, each menu or window, popups and notifications, world prompts, and in-world labels.
2. **Show the list** as a table: screen, what is on it (main windows and buttons), where it lives in the code or docs, status (exists / planned). Give the estimate: one generation per screen, several minutes each.
3. **Confirm** with AskUserQuestion: All screens (Recommended) · Pick screens (the user names them in "Other") · Only the existing ones. Save the table as `ui-inventory.md` in the output folder so the user and later sessions can follow progress.
4. **Common reference first.** If `style_reference` is empty, make the kit and get it approved before any screen.
5. **Generate screen by screen** in the table's order, with the kit as the first reference. After each one, look at it, mark it in `ui-inventory.md` (path, notes) and go on; do not stop to ask after every screen. Stop and ask only when a result clearly breaks the kit's style.
6. **Review together** at the end: list all paths with short notes, then ask which to approve, which to redo, and which to start building.

## 4. After approval

Offer the next step, each one only on the user's yes:

- **Assets.** `kind: "asset"`: icon sheets on a regular grid, button plates without text for 9-slice, transparent background.
- **Build in Studio.** Recreate the screen with native GUI objects (Frame, UICorner, UIStroke, UIGradient, layouts) following the project's own code conventions; images only where native objects cannot draw it. Check on the phone emulator.
- **Upload images to Roblox** only after the user approves each asset.

Run one generation at a time: the server refuses a second one while the first runs.
