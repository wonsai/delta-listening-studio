import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const tmpPagesDir = path.join(rootDir, '.gh-pages-tmp');
const ghExe = 'C:\\Program Files\\GitHub CLI\\gh.exe';

function run(bin, args, cwd = rootDir) {
  return execFileSync(bin, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function tryRun(bin, args, cwd = rootDir) {
  try {
    return { ok: true, out: run(bin, args, cwd) };
  } catch (err) {
    const stderr = err && err.stderr ? String(err.stderr) : String(err);
    return { ok: false, out: stderr };
  }
}

console.log('1) Setting up GitHub CLI git credential helper...');
run(ghExe, ['auth', 'setup-git']);

const owner = run(ghExe, ['api', 'user', '--jq', '.login']);
const repoName = 'delta-listening-studio';
const fullRepo = `${owner}/${repoName}`;
const remoteUrl = `https://github.com/${fullRepo}.git`;

console.log(`2) Checking repository ${fullRepo}...`);
const repoCheck = tryRun(ghExe, ['repo', 'view', fullRepo, '--json', 'url']);
if (!repoCheck.ok) {
  console.log(`Creating public repository ${fullRepo} for GitHub Pages...`);
  run(ghExe, [
    'repo',
    'create',
    fullRepo,
    '--public',
    '--description',
    'DELTA 출제 스튜디오 · 대구형 영어듣기 평가 출제 도움 플랫폼',
  ]);
}

console.log('3) Committing and pushing main branch...');
if (!fs.existsSync(path.join(rootDir, '.git'))) {
  run('git', ['init', '-b', 'main'], rootDir);
}
const hasName = tryRun('git', ['config', 'user.name'], rootDir);
if (!hasName.ok || !hasName.out) {
  run('git', ['config', 'user.name', owner], rootDir);
}
const hasEmail = tryRun('git', ['config', 'user.email'], rootDir);
if (!hasEmail.ok || !hasEmail.out) {
  run('git', ['config', 'user.email', `${owner}@users.noreply.github.com`], rootDir);
}

const hasOrigin = tryRun('git', ['remote', 'get-url', 'origin'], rootDir);
if (!hasOrigin.ok) {
  run('git', ['remote', 'add', 'origin', remoteUrl], rootDir);
} else {
  run('git', ['remote', 'set-url', 'origin', remoteUrl], rootDir);
}

run('git', ['checkout', '-B', 'main'], rootDir);
run('git', ['add', '-A'], rootDir);
const status = run('git', ['status', '--porcelain'], rootDir);
const commitMsg = process.argv[2] || 'Update DELTA listening studio: official exam HWPX template';
if (status) {
  run('git', ['commit', '-m', commitMsg], rootDir);
}
run('git', ['push', '-u', 'origin', 'main', '--force'], rootDir);

console.log('4) Publishing dist/ to gh-pages branch...');
if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  throw new Error('dist/index.html not found. Run npm run build first.');
}
fs.writeFileSync(path.join(distDir, '.nojekyll'), '', 'utf8');

if (fs.existsSync(tmpPagesDir)) {
  fs.rmSync(tmpPagesDir, { recursive: true, force: true });
}
fs.cpSync(distDir, tmpPagesDir, { recursive: true });

run('git', ['init', '-b', 'gh-pages'], tmpPagesDir);
run('git', ['config', 'user.name', owner], tmpPagesDir);
run('git', ['config', 'user.email', `${owner}@users.noreply.github.com`], tmpPagesDir);
run('git', ['add', '-A'], tmpPagesDir);
run('git', ['commit', '-m', 'Deploy DELTA listening studio to GitHub Pages'], tmpPagesDir);
run('git', ['push', remoteUrl, 'gh-pages:gh-pages', '--force'], tmpPagesDir);

fs.rmSync(tmpPagesDir, { recursive: true, force: true });

console.log('5) Enabling GitHub Pages...');
const pagesCheck = tryRun(ghExe, ['api', `repos/${fullRepo}/pages`]);
if (!pagesCheck.ok) {
  tryRun(ghExe, [
    'api',
    '-X',
    'POST',
    `repos/${fullRepo}/pages`,
    '-f',
    'build_type=legacy',
    '-f',
    'source[branch]=gh-pages',
    '-f',
    'source[path]=/',
  ]);
} else {
  tryRun(ghExe, [
    'api',
    '-X',
    'PUT',
    `repos/${fullRepo}/pages`,
    '-f',
    'build_type=legacy',
    '-f',
    'source[branch]=gh-pages',
    '-f',
    'source[path]=/',
  ]);
}

const pagesUrl = `https://${owner}.github.io/${repoName}/`;
console.log('SUCCESS! GitHub Pages URL:', pagesUrl);
