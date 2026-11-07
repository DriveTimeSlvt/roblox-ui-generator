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
const experiencesPath = process.env.ROBLOX_UI_GENERATOR_EXPERIENCES_PATH || join(serverDir, '../../Experiences');
const codexHome = resolve(process.env.CODEX_HOME || join(homedir(), '.codex'));
const outputFolder = 'roblox-ui-generator';
const timeoutMs = 15 * 60 * 1000;
const uuid = '[\\da-f]{8}(?:-[\\da-f]{4}){3}-[\\da-f]{12}';
const threadIdPattern = new RegExp('^' + uuid + '$', 'i');
const pngNamePattern = new RegExp('^exec-' + uuid + '\\.png$', 'i');
const tool = {
  name: 'create_ui_reference',
  description: 'Use Codex and the roblox-ui-generator skill to generate one Roblox UI PNG. The file is saved in roblox-ui-generator beside the selected Git repository. Generation may take several minutes.',
  inputSchema: {
    type: 'object',
    properties: {
      repository: { type: 'string', minLength: 1, description: 'Absolute path to the project folder or its Git repository under ROBLOX_UI_GENERATOR_EXPERIENCES_PATH.' },
      prompt: { type: 'string', minLength: 1, maxLength: 8000, description: 'Describe the game, layout, visual style, labels, target device or aspect ratio. For an isolated asset, specify whether you need transparency.' },
      name: { type: 'string', maxLength: 80, description: 'Optional short filename label.' },
      kind: { type: 'string', enum: ['screen', 'asset'], default: 'screen', description: 'Full interface mockup or isolated UI artwork.' },
      reference_images: {
        type: 'array', maxItems: 3, uniqueItems: true, items: { type: 'string', minLength: 1 },
        description: 'Absolute paths to existing PNG, JPG or WebP references inside the selected repository or its roblox-ui-generator folder.',
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
  const root = realpathSync(experiencesPath);
  const selected = realpathSync(path);
  const parts = relative(root, selected).split(sep);
  if (!inside(root, selected) || parts.length > 2 || !statSync(selected).isDirectory()) {
    throw new Error('Select a project or its Git repository under ' + root + '.');
  }
  if (parts.length === 2 && existsSync(join(selected, '.git'))) return selected;
  if (parts.length === 1) {
    const candidates = readdirSync(selected, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && existsSync(join(selected, entry.name, '.git')));
    if (candidates.length === 1) {
      const repo = realpathSync(join(selected, candidates[0].name));
      if (relative(selected, repo) !== candidates[0].name) throw new Error('The repository must be inside its project.');
      return repo;
    }
    throw new Error('The project has ' + candidates.length + ' nested Git repositories. Specify the repository directly.');
  }
  throw new Error('The selected directory does not contain .git.');
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

function publishPng(threadId, lastMessage, project, name) {
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
  const output = join(project, outputFolder);
  mkdirSync(output, { recursive: true });
  if (relative(project, realpathSync(output)) !== outputFolder || lstatSync(output).isSymbolicLink()) {
    throw new Error(outputFolder + ' must be a real directory beside the repository.');
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
  const { repository, prompt, name = '', kind = 'screen', reference_images: images = [] } = args ?? {};
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 8000 ||
      typeof name !== 'string' || name.length > 80 || !['screen', 'asset'].includes(kind) ||
      !Array.isArray(images) || images.length > 3 || new Set(images).size !== images.length) {
    throw new Error('Provide a prompt of up to 8000 characters, an optional name of up to 80 characters, a valid kind, and up to three unique references.');
  }
  const repo = resolveRepository(repository);
  const project = dirname(repo);
  const output = join(project, outputFolder);
  if (existsSync(output) && (relative(project, realpathSync(output)) !== outputFolder || !lstatSync(output).isDirectory())) {
    throw new Error(outputFolder + ' must be a real directory beside the repository.');
  }
  const references = images.map(path => {
    if (typeof path !== 'string' || !isAbsolute(path)) throw new Error('Reference images require absolute paths.');
    const file = realpathSync(path);
    if ((!inside(repo, file) && !inside(output, file)) || !statSync(file).isFile() ||
        !['.png', '.jpg', '.jpeg', '.webp'].includes(extname(file).toLowerCase())) {
      throw new Error('References must be PNG, JPG or WebP files in the selected repository or its ' + outputFolder + ' folder.');
    }
    return file;
  });
  const { threadId, lastMessage } = await runCodex({ kind, prompt: prompt.trim() }, references, signal);
  signal.throwIfAborted();
  return publishPng(threadId, lastMessage, project, name);
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
      capabilities: { tools: {} }, serverInfo: { name: 'roblox-ui-generator', version: '1.0.0' },
    } });
  } else if (method === 'ping' || method === 'tools/list') {
    send({ id, result: method === 'ping' ? {} : { tools: [tool] } });
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
