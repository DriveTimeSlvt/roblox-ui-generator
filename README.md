# roblox-ui-generator

[English](#english) · [Русский](#русский)

## English

A local MCP server that lets Claude Code use Codex to generate PNG mockups and UI assets for Roblox Studio. Use it for shops, inventories, HUDs, menus, reward screens, buttons, and icons. The PNGs serve as visual references for building UI in Studio.

### Set up Claude Code

You need Node.js 18 or later, Claude Code, and a signed-in Codex CLI with access to built-in image generation. Run this in PowerShell from the cloned repository. Set the projects path to the directory that contains your Roblox projects.

```powershell
$nodePath = (Get-Command node -ErrorAction Stop).Source
$serverPath = (Resolve-Path -LiteralPath './server.mjs' -ErrorAction Stop).Path
$mcpConfig = @{
  type = 'stdio'
  command = $nodePath
  args = @($serverPath)
  env = @{
    ROBLOX_UI_GENERATOR_EXPERIENCES_PATH = 'C:\Roblox\Experiences'
  }
  timeout = 960000
} | ConvertTo-Json -Depth 4 -Compress

claude mcp add-json --scope user roblox-ui-generator $mcpConfig
```

Open a new Claude Code session and check the server with `/mcp`. On Windows, the server looks for the Codex Desktop CLI in the user profile, then tries `codex` on `PATH`. If needed, set `ROBLOX_UI_GENERATOR_CODEX_PATH` in the MCP entry’s `env` to the full executable path. Each call has a 15-minute server timeout. [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp)

### Generate a reference

Ask Claude Code to use `mcp__roblox-ui-generator__create_ui_reference`. The tool takes an absolute `repository` path and a `prompt`. Use the project folder if it contains exactly one Git repository directly inside it, or pass the absolute path to that repository.

- `name` sets an optional filename prefix.
- `kind` defaults to `screen`. Use `asset` for a standalone element or a sheet of assets.
- `reference_images` accepts up to three absolute paths to PNG, JPG, or WebP files within the selected repository or its sibling `roblox-ui-generator` folder. The server attaches these images to the Codex request.

> Use roblox-ui-generator for the project at C:\Roblox\Experiences\ExampleProject. Make a 16:9 shop mockup with three item cards, clear price labels, and a bright primary button on each card. Name it upgrade-shop and return the PNG path.

For a repository at `C:\Roblox\Experiences\ExampleProject\game`, the server saves the PNG in `C:\Roblox\Experiences\ExampleProject\roblox-ui-generator`. It creates the folder on the first successful call and returns the absolute path, filename, file size, and image dimensions.

### Visual style

The bundled skill defaults to a chunky cartoon look with rounded panels, dark outlines, saturated accents, and clearly defined buttons. Specify a different style in your prompt or supply reference images to match an existing interface. VizzBees UI Maker is the inspiration for the mockup stage. Its editable Studio export is a separate stage in the VizzBees workflow. [Bundled skill](.agents/skills/roblox-ui-generator/SKILL.md) · [VizzBees UI Maker](https://www.vizzbees.com/ui-maker) · [Roblox UI style examples](https://vizzbees.com/blog/roblox-ui-design-ideas)

## Русский

Локальный MCP-сервер, через который Claude Code запускает Codex для генерации PNG-макетов и элементов интерфейса Roblox Studio. Подходит для магазинов, инвентарей, HUD, меню, экранов наград, кнопок и иконок. PNG служат визуальными референсами для сборки интерфейса в Studio.

### Подключение к Claude Code

Понадобятся Node.js 18 или новее, Claude Code и авторизованный Codex CLI с доступом к встроенной генерации изображений. Откройте PowerShell в папке клонированного репозитория и выполните команду из английского раздела. В `ROBLOX_UI_GENERATOR_EXPERIENCES_PATH` укажите папку с вашими проектами Roblox. [Команда подключения](#set-up-claude-code)

Откройте новую сессию Claude Code и проверьте сервер через `/mcp`. В Windows сервер ищет CLI Codex Desktop в профиле пользователя, затем пробует запустить `codex` из `PATH`. При необходимости задайте полный путь к CLI через `ROBLOX_UI_GENERATOR_CODEX_PATH` в `env` записи MCP. Тайм-аут сервера на один вызов составляет 15 минут. [Документация Claude Code по MCP](https://code.claude.com/docs/en/mcp)

### Генерация референса

Попросите Claude Code вызвать `mcp__roblox-ui-generator__create_ui_reference`. Инструмент принимает абсолютный путь `repository` и описание `prompt`. Можно указать папку проекта с одним Git-репозиторием непосредственно внутри неё или абсолютный путь к самому репозиторию.

- `name` задаёт необязательный префикс имени файла.
- `kind` по умолчанию равен `screen`. Для отдельного элемента или листа элементов используйте `asset`.
- `reference_images` принимает до трёх абсолютных путей к PNG, JPG или WebP из выбранного репозитория или соседней папки `roblox-ui-generator`. Сервер прикладывает эти изображения к запросу Codex.

> Используй roblox-ui-generator для проекта C:\Roblox\Experiences\ExampleProject. Сделай макет магазина 16:9 с тремя карточками товаров, читаемыми ценами и яркой кнопкой на каждой карточке. Назови файл upgrade-shop и верни путь к PNG.

Для репозитория `C:\Roblox\Experiences\ExampleProject\game` сервер сохраняет PNG в `C:\Roblox\Experiences\ExampleProject\roblox-ui-generator`. Папка создаётся при первом успешном вызове. Сервер возвращает абсолютный путь, имя файла, размер в байтах и разрешение изображения.

### Визуальный стиль

Скилл по умолчанию использует мультяшный стиль со скруглёнными панелями, тёмными обводками, насыщенными акцентами и хорошо заметными кнопками. Другой стиль можно описать в запросе или показать на референсах. Генерацию макетов вдохновил VizzBees UI Maker. Экспорт редактируемого интерфейса в Studio у VizzBees происходит на отдельном этапе. [Скилл](.agents/skills/roblox-ui-generator/SKILL.md) · [VizzBees UI Maker](https://www.vizzbees.com/ui-maker) · [Примеры стилей Roblox UI](https://vizzbees.com/blog/roblox-ui-design-ideas)
