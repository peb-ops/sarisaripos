// Builds the store-computer package: release/SariSariPOS-v<version>.zip
// containing the built app plus the PowerShell launcher (no Node needed to run it).
// Run: npm run package   (builds first)
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const releaseDir = join(root, 'release');
const out = join(releaseDir, 'SariSariPOS');
const zip = join(releaseDir, `SariSariPOS-v${version}.zip`);

if (!existsSync(join(root, 'dist', 'index.html'))) throw new Error('dist/ is missing; run "npm run build" first.');
if (!existsSync(join(root, 'launcher', 'system', 'app.ico'))) throw new Error('launcher/system/app.ico is missing; run "npm run icons".');

rmSync(releaseDir, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'launcher'), out, { recursive: true });
cpSync(join(root, 'dist'), join(out, 'app'), { recursive: true });

execFileSync(
  'powershell.exe',
  ['-NoProfile', '-Command', `Compress-Archive -Path '${out}' -DestinationPath '${zip}' -Force`],
  { stdio: 'inherit' },
);
console.log(`Created ${zip}`);
