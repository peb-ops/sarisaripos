// Builds the store-computer package: release/SariSariPOS-v<version>.zip
// containing the built app plus the PowerShell launcher (no Node needed to run it).
// Run: npm run package   (builds first)
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
// The release workflow passes the version typed into GitHub's "Run workflow" box.
const version = process.env.POS_VERSION || JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const releaseDir = join(root, 'release');
const out = join(releaseDir, 'SariSariPOS');
const zip = join(releaseDir, `SariSariPOS-v${version}.zip`);

if (!existsSync(join(root, 'dist', 'index.html'))) throw new Error('dist/ is missing; run "npm run build" first.');
if (!existsSync(join(root, 'launcher', 'system', 'app.ico'))) throw new Error('launcher/system/app.ico is missing; run "npm run icons".');

rmSync(releaseDir, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'launcher'), out, { recursive: true });
cpSync(join(root, 'dist'), join(out, 'app'), { recursive: true });

// Tells the installed launcher which version it has and where to look for updates.
function githubRepo() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY; // set in GitHub Actions
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8' }).trim();
    return url.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/)?.[1] ?? null;
  } catch {
    return null; // no git remote: updates are simply not offered
  }
}
writeFileSync(join(out, 'system', 'release.json'), JSON.stringify({ version, repo: githubRepo() }, null, 2));

execFileSync(
  'powershell.exe',
  ['-NoProfile', '-Command', `Compress-Archive -Path '${out}' -DestinationPath '${zip}' -Force`],
  { stdio: 'inherit' },
);
console.log(`Created ${zip}`);
