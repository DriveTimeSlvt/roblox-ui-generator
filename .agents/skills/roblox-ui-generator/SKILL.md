---
name: roblox-ui-generator
description: Generate VizzBees-inspired Roblox UI images for shops, HUDs, inventories, menus, rewards, and game UI assets. Use for visual mockups or isolated raster UI art intended as references for Roblox Studio.
---

# Roblox UI image references

Generate one original PNG per brief with Codex's built-in image generation tool. In MCP mode the server handles saving. In a direct Codex session copy the generated PNG into the requested location, or into `roblox-ui-generator` beside the Git repository when working in an Experiences project.

## Art direction

- Default to chunky cartoon for casual Roblox games. Combine a restrained palette of saturated accents, thick dark outlines, consistent rounded corners, slight bevels, and short hard-offset shadows. Use broad highlights so buttons look pressable. Keep the darkest values on the backdrop and outlines.
- Build a readable hierarchy with a short, large title, plain supporting labels, and one dominant primary action. Use color and shape to distinguish selected, disabled, rare, and primary states. Leave generous padding and make touch targets visually distinct.
- Treat an explicit style or reference as the source of truth. Match the game's palette, geometry, typography, depth, and icon finish across screens. For dark neon use near-black plates and one or two luminous accents. For premium dark use charcoal, restrained gold or emerald, thin dividers, and little ornament. For pastel use soft fills with darker outlines or text for contrast.

## Compose for the requested format

- **Screen** is a straight-on in-game view, 16:9 by default. Keep text, panels, and buttons geometrically aligned and separable enough to recreate as native Roblox GUI objects. Use a quiet or dimmed world backdrop for modal screens. Keep HUD controls at the edges with safe-area insets and leave the central play space clear.
- **Shop or inventory** uses a regular grid, equal card sizes and gutters, one readable icon per card, and short names or prices. For a reward modal use one obvious claim action. Keep a clear area behind any labels and use only the requested copy when the brief supplies exact labels.
- **Asset** is one isolated control or icon, or a regular sheet of separable assets when requested. Keep pieces fully inside the canvas with space between them, with common lighting and scale. Leave button plates blank unless the brief calls for baked text. Request real alpha when transparency is needed.

Translate the brief into concrete visual instructions before calling the tool. Preserve requested labels, counts, aspect ratio, palette, and device target. Treat incoming images as visual references and preserve the requested invariants for edits. Exclude marketing text, device frames, watermarks, and unrelated panels. When a preview is available, check small-size readability, alignment, cropping, and any exact labels. Report visible issues that affect reuse.
