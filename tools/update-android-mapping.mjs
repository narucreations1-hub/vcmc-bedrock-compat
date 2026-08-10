import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(root, 'manifest.json');
const candidatePath = resolve(root, 'candidates', 'android-arm64.json');
const upstreamPath = 'include/bedrocktools/sdk/offsets/World.hpp';
const upstreamApi =
  `https://api.github.com/repos/QYCottage/BedrockTools/commits?path=${upstreamPath}&per_page=1`;
const rawBase = 'https://raw.githubusercontent.com/QYCottage/BedrockTools';
const repoRawBase =
  'https://raw.githubusercontent.com/narucreations1-hub/vcmc-bedrock-compat/main';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function namespaceBody(source, name) {
  const marker = `namespace ${name}`;
  const namespaceAt = source.indexOf(marker);
  assert(namespaceAt >= 0, `Missing namespace ${name}`);
  const opening = source.indexOf('{', namespaceAt + marker.length);
  assert(opening >= 0, `Malformed namespace ${name}`);
  let depth = 0;
  for (let index = opening; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}' && --depth === 0) {
      return source.slice(opening + 1, index);
    }
  }
  throw new Error(`Unclosed namespace ${name}`);
}

function offset(source, namespace, field) {
  const body = namespaceBody(source, namespace);
  const match = body.match(new RegExp(`\\b${field}\\s*=\\s*(0x[0-9a-fA-F]+|[0-9]+)\\s*;`));
  assert(match, `Missing ${namespace}::${field}`);
  const value = Number.parseInt(match[1], match[1].startsWith('0x') ? 16 : 10);
  assert(Number.isSafeInteger(value) && value > 0 && value <= 0x10000,
    `Unsafe ${namespace}::${field}`);
  return value;
}

async function githubJson(url) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'vcmc-bedrock-compat',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(url, { headers });
  assert(response.ok, `GitHub API ${response.status}: ${url}`);
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'vcmc-bedrock-compat' } });
  assert(response.ok, `HTTP ${response.status}: ${url}`);
  return response.text();
}

async function importBedrockTools() {
  const commits = await githubJson(upstreamApi);
  assert(Array.isArray(commits) && commits.length > 0, 'No BedrockTools commit returned');
  const commit = commits[0];
  const commitSha = commit.sha;
  assert(/^[a-f0-9]{40}$/.test(commitSha), 'Invalid BedrockTools commit SHA');
  const rawUrl = `${rawBase}/${commitSha}/${upstreamPath}`;
  const header = await fetchText(rawUrl);
  const offsets = {
    clientGraphScanBytes: 6144,
    clientGraphScanDepth: 3,
    playerName: offset(header, 'Player', 'mName'),
    actorDimension: offset(header, 'Actor', 'mDimension'),
    actorStateVector: offset(header, 'Actor', 'mStateVectorComponent'),
    actorRotation: offset(header, 'Actor', 'mActorRotationComponent'),
  };
  const updatedAt = new Date(commit.commit.committer.date).toISOString();
  const candidate = {
    schemaVersion: 1,
    adapter: 'bedrock.android-arm64',
    updatedAt,
    source: {
      repository: 'https://github.com/QYCottage/BedrockTools',
      commit: commitSha,
      file: upstreamPath,
      rawUrl,
      license: 'GPL-3.0',
      usage: 'Discovery input only; VCMC must certify the layout at runtime before emitting telemetry.',
    },
    candidates: [{ id: `bedrocktools-${commitSha.slice(0, 12)}`, offsets }],
  };
  const bytes = Buffer.from(`${JSON.stringify(candidate, null, 2)}\n`);
  await writeFile(candidatePath, bytes);

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.updatedAt = updatedAt;
  manifest.candidateFeeds ??= {};
  manifest.candidateFeeds['bedrock.android-arm64'] = {
    version: `bedrocktools-${commitSha.slice(0, 12)}`,
    url: `${repoRawBase}/candidates/android-arm64.json`,
    sha256: sha256(bytes),
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`Imported BedrockTools ${commitSha}\n`);
}

function validateOffsets(offsets, label) {
  for (const key of [
    'clientGraphScanBytes',
    'clientGraphScanDepth',
    'playerName',
    'actorDimension',
    'actorStateVector',
    'actorRotation',
  ]) {
    assert(Number.isInteger(offsets?.[key]) && offsets[key] > 0,
      `${label}: invalid ${key}`);
  }
  assert(offsets.clientGraphScanBytes <= 0x8000, `${label}: scan is too large`);
  assert(offsets.clientGraphScanDepth <= 3, `${label}: scan depth is too large`);
  for (const key of ['playerName', 'actorDimension', 'actorStateVector', 'actorRotation']) {
    assert(offsets[key] <= 0x10000, `${label}: unsafe ${key}`);
  }
}

async function check() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert(manifest.schemaVersion === 1, 'Unsupported manifest schema');
  const feed = manifest.candidateFeeds?.['bedrock.android-arm64'];
  assert(feed && /^bedrocktools-[a-f0-9]{12}$/.test(feed.version),
    'Missing Android candidate feed');
  const candidateBytes = await readFile(candidatePath);
  assert(sha256(candidateBytes) === feed.sha256, 'Android candidate feed hash mismatch');
  const candidates = JSON.parse(candidateBytes);
  assert(candidates.schemaVersion === 1 &&
    candidates.adapter === 'bedrock.android-arm64', 'Invalid Android candidate feed');
  assert(Array.isArray(candidates.candidates) && candidates.candidates.length > 0 &&
    candidates.candidates.length <= 16, 'Invalid Android candidate count');
  for (const candidate of candidates.candidates) {
    assert(typeof candidate.id === 'string' && candidate.id.length > 0 &&
      candidate.id.length <= 96, 'Invalid candidate id');
    validateOffsets(candidate.offsets, candidate.id);
  }

  for (const [gameVersion, game] of Object.entries(manifest.gameVersions ?? {})) {
    const android = game.adapters?.['bedrock.android-arm64'];
    if (!android) continue;
    assert(android.enabled === true && android.channel === 'stable',
      `${gameVersion}: Android mapping must be stable`);
    assert(Array.isArray(android.binaries) && android.binaries.length > 0,
      `${gameVersion}: missing exact binary selectors`);
    const relative = `mappings/android-arm64/${gameVersion}.json`;
    const bytes = await readFile(resolve(root, relative));
    assert(sha256(bytes) === android.mapping.sha256,
      `${gameVersion}: mapping hash mismatch`);
    const mapping = JSON.parse(bytes);
    assert(mapping.gameVersion === gameVersion && mapping.adapter === 'bedrock.android-arm64',
      `${gameVersion}: mapping identity mismatch`);
    validateOffsets(mapping.offsets, gameVersion);
  }
  process.stdout.write('Compatibility catalog is valid\n');
}

const args = new Set(process.argv.slice(2));
if (args.has('--import-bedrocktools')) await importBedrockTools();
if (args.has('--check')) await check();
if (!args.has('--import-bedrocktools') && !args.has('--check')) {
  throw new Error('Use --import-bedrocktools and/or --check');
}
