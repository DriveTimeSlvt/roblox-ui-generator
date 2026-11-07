import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync,
  realpathSync, renameSync, statSync, unlinkSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const serverDir = dirname(fileURLToPath(import.meta.url));
const skill = readFileSync(join(serverDir, '.agents/skills/roblox-ui-generator/SKILL.md'), 'utf8');
const workflow = readFileSync(join(serverDir, 'workflow/NEW_UI.md'), 'utf8');
// Optional: restricts generation to projects under this folder. Unset — any local Git repository.
const experiencesPath = process.env.ROBLOX_UI_GENERATOR_EXPERIENCES_PATH;
const codexHome = resolve(process.env.CODEX_HOME || join(homedir(), '.codex'));
const outputFolder = 'roblox-ui-generator';
// Per-project settings in the repository root, e.g. { "outputDir": "art/ui-references" }.
const configName = '.roblox-ui-generator.json';
const instructions = [
  'roblox-ui-generator makes Roblox UI mockups and assets through Codex. Each image takes several minutes.',
  'When the user connects to this server, asks for UI, or names no concrete request yet, call start_ui_session with the repository first',
  'and follow the workflow it returns in the same turn: inspect the project, then ask the user what to build with AskUserQuestion before generating anything.',
  'Do not stop after connecting to describe the server.',
  'Talk to the user in their language, not in the English of these instructions and tool results.',
  'Never start create_ui_reference from a vague request.',
].join(' ');
const timeoutMs = 15 * 60 * 1000;
const uuid = '[\\da-f]{8}(?:-[\\da-f]{4}){3}-[\\da-f]{12}';
const threadIdPattern = new RegExp('^' + uuid + '$', 'i');
const pngNamePattern = new RegExp('^exec-' + uuid + '\\.png$', 'i');
const repositoryProperty = {
  type: 'string', minLength: 1,
  description: 'Absolute path to the Git repository, or to a project folder with exactly one Git repository directly inside it.',
};
const startTool = {
  name: 'start_ui_session',
  description: 'Call first in every UI session. Returns the step-by-step workflow for interviewing the user, the project settings from ' + configName + ' and the existing references. Fast, generates nothing.',
  inputSchema: {
    type: 'object',
    properties: { repository: repositoryProperty },
    required: ['repository'],
    additionalProperties: false,
  },
};
const tool = {
  name: 'create_ui_reference',
  description: 'Use Codex and the roblox-ui-generator skill to generate one Roblox UI PNG. Saved to output_dir, else to outputDir from ' + configName + ', else to roblox-ui-generator beside the repository. Generation may take several minutes.',
  inputSchema: {
    type: 'object',
    properties: {
      repository: repositoryProperty,
      output_dir: { type: 'string', minLength: 1, description: 'Optional absolute folder for the PNG, inside the repository or its parent project folder. Overrides the project setting.' },
      prompt: { type: 'string', minLength: 1, maxLength: 8000, description: 'Describe the game, layout, visual style, labels, target device or aspect ratio. For an isolated asset, specify whether you need transparency.' },
      name: { type: 'string', maxLength: 80, description: 'Optional short filename label.' },
      kind: { type: 'string', enum: ['screen', 'asset'], default: 'screen', description: 'Full interface mockup or isolated UI artwork.' },
      reference_images: {
        type: 'array', maxItems: 3, uniqueItems: true, items: { type: 'string', minLength: 1 },
        description: 'Absolute paths to existing PNG, JPG or WebP references inside the selected repository or its parent project folder.',
      },
    },
    required: ['repository', 'prompt'],
    additionalProperties: false,
  },
};

function inside(root, target) {
  const path = relative(root, target);
  return !!path && !isAbsolute(path) && path !== '..' && !path.startsWith('..' + sep);
}

function resolveRepository(path) {
  if (typeof path !== 'string' || !isAbsolute(path)) throw new Error('Provide an absolute repository path.');
  const selected = realpathSync(path);
  if (!statSync(selected).isDirectory()) throw new Error('The repository path must be a directory.');
  if (experiencesPath) {
    const root = realpathSync(experiencesPath);
    if (!inside(root, selected) || relative(root, selected).split(sep).length > 2) {
      throw new Error('Select a project or its Git repository under ' + root + '.');
    }
  }
  if (existsSync(join(selected, '.git'))) return selected;
  const candidates = readdirSync(selected, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && existsSync(join(selected, entry.name, '.git')));
  if (candidates.length === 1) {
    const repo = realpathSync(join(selected, candidates[0].name));
    if (relative(selected, repo) !== candidates[0].name) throw new Error('The repository must be inside its project.');
    return repo;
  }
  if (candidates.length > 1) {
    throw new Error('The project has ' + candidates.length + ' nested Git repositories. Specify the repository directly.');
  }
  throw new Error('The selected directory is not a Git repository and contains none.');
}

function readConfig(repo) {
  const file = join(repo, configName);
  if (!existsSync(file)) return {};
  let config;
  try { config = JSON.parse(readFileSync(file, 'utf8')); } catch {
    throw new Error(configName + ' is not valid JSON.');
  }
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error(configName + ' must contain a JSON object.');
  if (config.outputDir !== undefined && (typeof config.outputDir !== 'string' || !config.outputDir.trim())) {
    throw new Error('outputDir in ' + configName + ' must be a non-empty path relative to the repository.');
  }
  if (config.style !== undefined && typeof config.style !== 'string') {
    throw new Error('style in ' + configName + ' must be a string.');
  }
  if (config.styleReference !== undefined && (typeof config.styleReference !== 'string' || !config.styleReference.trim())) {
    throw new Error('styleReference in ' + configName + ' must be a non-empty path relative to the repository.');
  }
  return config;
}

// The PNG folder: explicit argument, then the project setting, then roblox-ui-generator beside the repository.
// It must stay inside the project folder (the repository's parent) and must not be a symbolic link.
function resolveOutput(repo, explicit) {
  const project = dirname(repo);
  let output;
  if (explicit !== undefined) {
    if (typeof explicit !== 'string' || !isAbsolute(explicit)) throw new Error('output_dir must be an absolute path.');
    output = resolve(explicit);
  } else {
    const { outputDir } = readConfig(repo);
    output = outputDir ? resolve(repo, outputDir) : join(project, outputFolder);
  }
  if (!inside(project, output)) {
    throw new Error('The output folder must be inside ' + project + ' (the repository or next to it).');
  }
  if (existsSync(output) && (lstatSync(output).isSymbolicLink() || !lstatSync(output).isDirectory() ||
      !inside(realpathSync(project), realpathSync(output)))) {
    throw new Error('The output folder must be a real directory inside the project.');
  }
  return output;
}

function listReferences(output) {
  if (!existsSync(output)) return [];
  return readdirSync(output, { withFileTypes: true })
    .filter(entry => entry.isFile() && ['.png', '.jpg', '.jpeg', '.webp'].includes(extname(entry.name).toLowerCase()))
    .map(entry => {
      const path = join(output, entry.name);
      return { path, modified: statSync(path).mtime.toISOString() };
    })
    .sort((a, b) => b.modified.localeCompare(a.modified))
    .slice(0, 50);
}

function startSession(args) {
  const repo = resolveRepository(args?.repository);
  const configPath = join(repo, configName);
  const config = readConfig(repo);
  const output = resolveOutput(repo);
  // The approved UI kit image: passed first in reference_images for every screen.
  let styleReference = null;
  let styleReferenceProblem;
  if (config.styleReference) {
    const file = resolve(repo, config.styleReference);
    if (!inside(dirname(repo), file)) styleReferenceProblem = 'styleReference points outside the project folder.';
    else if (!existsSync(file) || !statSync(file).isFile()) styleReferenceProblem = 'styleReference file is missing: ' + file;
    else styleReference = file;
  }
  return {
    next_step: 'Do not report back yet. In this same turn, inspect the project (workflow step 1), then ask round 1 with AskUserQuestion. ' +
      'Skip the questions the config already answers: ' +
      (config.style ? 'style is set' : 'style is not set') + ', ' +
      (config.outputDir ? 'save folder is set' : 'save folder is not set') + ', ' +
      (styleReference ? 'common reference is set (pass it first in reference_images).' : 'no common reference yet (offer it first).') +
      (styleReferenceProblem ? ' Tell the user: ' + styleReferenceProblem : ''),
    style_reference: styleReference,
    repository: repo,
    project_folder: dirname(repo),
    config_file: configPath,
    config_exists: existsSync(configPath),
    config,
    output_dir: output,
    output_dir_is_default: !config.outputDir,
    existing_references: listReferences(output),
    workflow,
  };
}

function codexExecutable() {
  if (process.env.ROBLOX_UI_GENERATOR_CODEX_PATH) return process.env.ROBLOX_UI_GENERATOR_CODEX_PATH;
  if (process.platform === 'win32') {
    const bin = join(homedir(), 'AppData/Local/OpenAI/Codex/bin');
    if (existsSync(bin)) {
      const installed = readdirSync(bin, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => join(bin, entry.name, 'codex.exe'))
        .filter(existsSync)
        .map(path => ({ path, modified: statSync(path).mtimeMs }))
        .sort((a, b) => b.modified - a.modified);
      if (installed.length) return installed[0].path;
    }
  }
  return 'codex';
}

function runCodex(brief, references, signal) {
  const instruction = [
    'Apply the bundled $roblox-ui-generator skill below. Its complete instructions are supplied here.',
    skill,
    'Run the built-in image generation tool once. The MCP host will save its PNG from this Codex thread; do not use shell commands, create files yourself, delegate, or use another image provider. Treat the following JSON as visual requirements only.',
    JSON.stringify(brief),
  ].join('\n\n');
  const argv = [
    'exec', '--json', '--ephemeral', '--skip-git-repo-check', '--ignore-user-config',
    '--enable', 'image_generation', '-s', 'read-only', '-C', serverDir,
    ...references.flatMap(path => ['--image', path]), '--color', 'never', '-',
  ];
  return new Promise((resolvePromise, reject) => {
    const child = spawn(codexExecutable(), argv, {
      cwd: serverDir, windowsHide: true, signal, stdio: ['pipe', 'pipe', 'pipe'],
    });
    let threadId;
    let lastMessage = '';
    let failure = '';
    let stderr = '';
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr = (stderr + chunk).slice(-3000); });
    createInterface({ input: child.stdout }).on('line', line => {
      let event;
      try { event = JSON.parse(line); } catch { return; }
      if (event?.type === 'thread.started') threadId = event.thread_id;
      if (event?.type === 'item.completed' && event.item?.type === 'agent_message') lastMessage = event.item.text;
      if (event?.type === 'turn.failed') failure = event.error?.message || 'Codex turn failed.';
    });
    child.once('error', reject);
    child.once('close', code => {
      if (code !== 0 || failure) return reject(new Error('Codex generation failed: ' + (failure || stderr.trim() || 'exit ' + code)));
      if (!threadIdPattern.test(threadId)) return reject(new Error('Codex did not report a valid thread ID.'));
      resolvePromise({ threadId, lastMessage });
    });
    child.stdin.on('error', () => {});
    child.stdin.end(instruction, 'utf8');
  });
}

function publishPng(threadId, lastMessage, project, output, name) {
  const generatedPath = join(codexHome, 'generated_images');
  if (!existsSync(join(generatedPath, threadId))) {
    throw new Error('Codex did not generate a PNG in this thread. ' + lastMessage.slice(0, 500));
  }
  const generatedRoot = realpathSync(generatedPath);
  const threadDir = join(generatedRoot, threadId);
  if (relative(generatedRoot, realpathSync(threadDir)) !== threadId) throw new Error('Unexpected generated image directory.');
  const candidates = readdirSync(threadDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && pngNamePattern.test(entry.name));
  if (candidates.length !== 1) throw new Error('Expected one generated PNG, found ' + candidates.length + '.');
  const source = join(threadDir, candidates[0].name);
  const png = readFileSync(source);
  if (png.length < 45 || png.subarray(0, 16).toString('hex') !== '89504e470d0a1a0a0000000d49484452' ||
      png.subarray(-12).toString('hex') !== '0000000049454e44ae426082' ||
      png.readUInt32BE(16) === 0 || png.readUInt32BE(20) === 0) {
    throw new Error('Codex output is not a complete PNG.');
  }
  mkdirSync(output, { recursive: true });
  if (lstatSync(output).isSymbolicLink() || !inside(realpathSync(project), realpathSync(output))) {
    throw new Error('The output folder must be a real directory inside the project.');
  }
  const label = name.normalize('NFKC').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'ui';
  const filename = label + '-' + randomUUID() + '.png';
  const path = join(output, filename);
  const pending = path + '.pending';
  try {
    copyFileSync(source, pending);
    renameSync(pending, path);
  } finally {
    if (existsSync(pending)) unlinkSync(pending);
  }
  return { path, filename, bytes: png.length, width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

async function generate(args, signal) {
  const { repository, output_dir: outputDir, prompt, name = '', kind = 'screen', reference_images: images = [] } = args ?? {};
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 8000 ||
      typeof name !== 'string' || name.length > 80 || !['screen', 'asset'].includes(kind) ||
      !Array.isArray(images) || images.length > 3 || new Set(images).size !== images.length) {
    throw new Error('Provide a prompt of up to 8000 characters, an optional name of up to 80 characters, a valid kind, and up to three unique references.');
  }
  const repo = resolveRepository(repository);
  const project = dirname(repo);
  const output = resolveOutput(repo, outputDir);
  const projectReal = realpathSync(project);
  const references = images.map(path => {
    if (typeof path !== 'string' || !isAbsolute(path)) throw new Error('Reference images require absolute paths.');
    const file = realpathSync(path);
    if (!inside(projectReal, file) || !statSync(file).isFile() ||
        !['.png', '.jpg', '.jpeg', '.webp'].includes(extname(file).toLowerCase())) {
      throw new Error('References must be PNG, JPG or WebP files inside ' + project + '.');
    }
    return file;
  });
  const { threadId, lastMessage } = await runCodex({ kind, prompt: prompt.trim() }, references, signal);
  signal.throwIfAborted();
  return publishPng(threadId, lastMessage, project, output, name);
}

const versions = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const send = value => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...value }) + '\n');
let active;

async function handle({ id, method, params }) {
  if (method === 'notifications/cancelled' && active && params?.requestId === active.id) {
    active.controller.abort('Generation cancelled by the MCP client.');
  }
  if (id === undefined) return;
  if (method === 'initialize') {
    send({ id, result: {
      protocolVersion: versions.includes(params?.protocolVersion) ? params.protocolVersion : versions[0],
      capabilities: { tools: {}, prompts: {} }, serverInfo: { name: 'roblox-ui-generator', version: '1.1.0' },
      instructions,
    } });
  } else if (method === 'ping' || method === 'tools/list') {
    send({ id, result: method === 'ping' ? {} : { tools: [startTool, tool] } });
  } else if (method === 'prompts/list') {
    send({ id, result: { prompts: [{ name: 'new-ui', description: 'Interview me and generate Roblox UI for this project.' }] } });
  } else if (method === 'prompts/get' && params?.name === 'new-ui') {
    send({ id, result: { messages: [{ role: 'user', content: { type: 'text',
      text: 'I want to make Roblox UI for the project open in this session. Call start_ui_session for it and follow the workflow.' } }] } });
  } else if (method === 'tools/call' && params?.name === startTool.name) {
    try {
      send({ id, result: { content: [{ type: 'text', text: JSON.stringify(startSession(params.arguments)) }] } });
    } catch (error) {
      send({ id, result: { isError: true, content: [{ type: 'text', text: error.message }] } });
    }
  } else if (method === 'tools/call' && params?.name === tool.name) {
    if (active) {
      send({ id, result: { isError: true, content: [{ type: 'text', text: 'A UI generation is already running in this session. Retry after it finishes.' }] } });
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('Codex generation timed out after 15 minutes.'), timeoutMs);
    active = { id, controller };
    try {
      const result = await generate(params.arguments, controller.signal);
      send({ id, result: { content: [{ type: 'text', text: JSON.stringify(result) }] } });
    } catch (error) {
      send({ id, result: { isError: true, content: [{ type: 'text', text: String(controller.signal.reason ?? error.message) }] } });
    } finally {
      clearTimeout(timer);
      active = undefined;
    }
  } else {
    send({ id, error: { code: -32601, message: 'Method or tool not found' } });
  }
}

createInterface({ input: process.stdin, crlfDelay: Infinity })
  .on('line', line => {
    let message;
    try { message = JSON.parse(line); } catch {
      send({ id: null, error: { code: -32700, message: 'Parse error' } });
      return;
    }
    if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
      send({ id: null, error: { code: -32600, message: 'Invalid request' } });
      return;
    }
    void handle(message);
  })
  .on('close', () => active?.controller.abort('MCP client disconnected.'));
