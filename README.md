# roblox-ui-generator

[English](#english) · [Русский](#русский)

## English

A local MCP server that lets Claude Code use Codex to generate PNG mockups and UI assets for Roblox Studio. Use it for shops, inventories, HUDs, menus, reward screens, buttons, and icons. The PNGs serve as visual references for building UI in Studio.

### Quick start

You need Node.js 18 or later on `PATH`, Claude Code, and a signed-in Codex CLI with access to built-in image generation. Install the plugin once in Claude Code:

```
/plugin marketplace add DriveTimeSlvt/roblox-ui-generator
/plugin install roblox-ui-generator@roblox-ui-generator
```

Then open Claude Code in your game's repository and say “connect to roblox-ui-generator” or run `/mcp__roblox-ui-generator__new-ui`. Claude inspects the project and asks what to build: screen, devices, style, and where to save the references. The folder choice is stored in `.roblox-ui-generator.json` in the repository root, for example `{ "outputDir": "art/ui-references" }`; commit it to share it with the team. The folder must be inside the repository or its parent project folder. Without the file, images go to `roblox-ui-generator` beside the repository.

### Manual setup

Instead of the plugin, you can register the server yourself. Use one or the other: with both, Claude Code runs two copies of the server. Run this in PowerShell from the cloned repository:

```powershell
$nodePath = (Get-Command node -ErrorAction Stop).Source
$serverPath = (Resolve-Path -LiteralPath './server.mjs' -ErrorAction Stop).Path
$mcpConfig = @{
  type = 'stdio'
  command = $nodePath
  args = @($serverPath)
  timeout = 960000
} | ConvertTo-Json -Depth 4 -Compress

claude mcp add-json --scope user roblox-ui-generator $mcpConfig
```

Open a new Claude Code session and check the server with `/mcp`. [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp)

Optional environment variables, set in the MCP entry's `env`:

- `ROBLOX_UI_GENERATOR_EXPERIENCES_PATH` limits the server to projects under this folder: a project folder or a repository one level inside it. Unset, any local Git repository works.
- `ROBLOX_UI_GENERATOR_CODEX_PATH` is the full path to the Codex executable. By default on Windows the server looks for the Codex Desktop CLI in the user profile, then tries `codex` on `PATH`.

### How it works

When the server connects, it tells Claude to start with `start_ui_session` and to interview the user before generating anything. The interview follows [workflow/NEW_UI.md](workflow/NEW_UI.md): Claude inspects the project, asks with ready-made options, generates, shows the result and iterates. Assets and the Studio build come only after the user approves the mockup.

Both tools take `repository`: an absolute path to a Git repository, or to a project folder with exactly one Git repository directly inside it.

**`start_ui_session`** generates nothing and returns at once: the interview workflow, the settings from `.roblox-ui-generator.json`, the output folder, and up to 50 latest images in it.

**`create_ui_reference`** generates one PNG through Codex. It takes several minutes, and the server runs one generation at a time with a 15-minute limit.

- `prompt` is the brief: the game, layout, style, labels, device, or aspect ratio.
- `kind` defaults to `screen`. Use `asset` for a standalone element or a sheet of assets.
- `name` sets an optional filename prefix.
- `reference_images` accepts up to three absolute paths to PNG, JPG, or WebP files inside the project folder. The server attaches them to the Codex request.
- `output_dir` is an absolute folder for this image only and overrides the project setting.

The PNG goes to `output_dir`, else to `outputDir` from `.roblox-ui-generator.json` (relative to the repository), else to `roblox-ui-generator` beside the repository. The folder must be inside the project folder, the repository's parent, and must not be a symbolic link. The server creates it on the first save and returns the absolute path, filename, file size, and image dimensions.

For a repository at `C:\Roblox\Experiences\ExampleProject\game` with no settings file, images go to `C:\Roblox\Experiences\ExampleProject\roblox-ui-generator`. With `{ "outputDir": "art/ui-references" }`, they go to `C:\Roblox\Experiences\ExampleProject\game\art\ui-references`.

You can skip the interview and give a concrete request:

> Use roblox-ui-generator for this project. Make a 16:9 shop mockup with three item cards, clear price labels, and a bright primary button on each card. Name it upgrade-shop and return the PNG path.

### Visual style

The bundled skill defaults to a chunky cartoon look with rounded panels, dark outlines, saturated accents, and clearly defined buttons. Specify a different style in your prompt or supply reference images to match an existing interface. VizzBees UI Maker is the inspiration for the mockup stage. Its editable Studio export is a separate stage in the VizzBees workflow. [Bundled skill](.agents/skills/roblox-ui-generator/SKILL.md) · [VizzBees UI Maker](https://www.vizzbees.com/ui-maker) · [Roblox UI style examples](https://vizzbees.com/blog/roblox-ui-design-ideas)

## Русский

Локальный MCP-сервер, через который Claude Code запускает Codex для генерации PNG-макетов и элементов интерфейса Roblox Studio. Подходит для магазинов, инвентарей, HUD, меню, экранов наград, кнопок и иконок. PNG служат визуальными референсами для сборки интерфейса в Studio.

### Быстрый старт

Понадобятся Node.js 18 или новее в `PATH`, Claude Code и авторизованный Codex CLI с доступом к встроенной генерации изображений. Один раз установите плагин в Claude Code командами из [английского раздела](#quick-start).

Потом откройте Claude Code в репозитории игры и скажите «подключись к roblox-ui-generator» или выполните `/mcp__roblox-ui-generator__new-ui`. Claude посмотрит проект и спросит, что собирать: экран, устройства, стиль и куда сохранять референсы. Выбор папки хранится в `.roblox-ui-generator.json` в корне репозитория, например `{ "outputDir": "art/ui-references" }`; закоммитьте файл, чтобы настройка была общей для команды. Папка должна быть внутри репозитория или его родительской папки проекта. Без файла картинки сохраняются в `roblox-ui-generator` рядом с репозиторием.

### Ручное подключение

Вместо плагина можно подключить сервер командой PowerShell из [английского раздела](#manual-setup). Выберите что-то одно: при обоих способах Claude Code запустит две копии сервера. Потом откройте новую сессию Claude Code и проверьте сервер через `/mcp`. [Документация Claude Code по MCP](https://code.claude.com/docs/en/mcp)

Необязательные переменные окружения задаются в `env` записи MCP:

- `ROBLOX_UI_GENERATOR_EXPERIENCES_PATH` ограничивает сервер проектами внутри этой папки: папкой проекта или репозиторием на уровень глубже. Без неё подходит любой локальный Git-репозиторий.
- `ROBLOX_UI_GENERATOR_CODEX_PATH` — полный путь к исполняемому файлу Codex. По умолчанию в Windows сервер ищет CLI Codex Desktop в профиле пользователя, затем пробует `codex` из `PATH`.

### Как это работает

При подключении сервер просит Claude начать с `start_ui_session` и сначала опросить пользователя, а не генерировать сразу. Опрос идёт по [workflow/NEW_UI.md](workflow/NEW_UI.md): Claude смотрит проект, задаёт вопросы с готовыми вариантами, генерирует, показывает результат и вносит правки. Ассеты и сборка в Studio — только после того, как пользователь утвердит макет.

Оба инструмента принимают `repository` — абсолютный путь к Git-репозиторию или к папке проекта, в которой непосредственно лежит ровно один Git-репозиторий.

**`start_ui_session`** ничего не генерирует и отвечает сразу: сценарий опроса, настройки из `.roblox-ui-generator.json`, папка для картинок и до 50 последних изображений в ней.

**`create_ui_reference`** генерирует один PNG через Codex. Это занимает несколько минут; сервер выполняет одну генерацию за раз с лимитом 15 минут.

- `prompt` — описание: игра, раскладка, стиль, надписи, устройство или соотношение сторон.
- `kind` по умолчанию равен `screen`. Для отдельного элемента или листа элементов используйте `asset`.
- `name` задаёт необязательный префикс имени файла.
- `reference_images` принимает до трёх абсолютных путей к PNG, JPG или WebP внутри папки проекта. Сервер прикладывает их к запросу Codex.
- `output_dir` — абсолютный путь к папке только для этой картинки, важнее настройки проекта.

PNG сохраняется в `output_dir`, иначе в `outputDir` из `.roblox-ui-generator.json` (путь от корня репозитория), иначе в `roblox-ui-generator` рядом с репозиторием. Папка должна быть внутри папки проекта, то есть родительской папки репозитория, и не может быть символической ссылкой. Сервер создаёт её при первом сохранении и возвращает абсолютный путь, имя файла, размер в байтах и разрешение изображения.

Для репозитория `C:\Roblox\Experiences\ExampleProject\game` без файла настроек картинки попадут в `C:\Roblox\Experiences\ExampleProject\roblox-ui-generator`. С `{ "outputDir": "art/ui-references" }` — в `C:\Roblox\Experiences\ExampleProject\game\art\ui-references`.

Опрос можно пропустить и сразу дать конкретную задачу:

> Используй roblox-ui-generator для этого проекта. Сделай макет магазина 16:9 с тремя карточками товаров, читаемыми ценами и яркой кнопкой на каждой карточке. Назови файл upgrade-shop и верни путь к PNG.

### Визуальный стиль

Скилл по умолчанию использует мультяшный стиль со скруглёнными панелями, тёмными обводками, насыщенными акцентами и хорошо заметными кнопками. Другой стиль можно описать в запросе или показать на референсах. Генерацию макетов вдохновил VizzBees UI Maker. Экспорт редактируемого интерфейса в Studio у VizzBees происходит на отдельном этапе. [Скилл](.agents/skills/roblox-ui-generator/SKILL.md) · [VizzBees UI Maker](https://www.vizzbees.com/ui-maker) · [Примеры стилей Roblox UI](https://vizzbees.com/blog/roblox-ui-design-ideas)
