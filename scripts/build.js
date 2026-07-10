import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(projectRoot, 'dist');
const env = readEnvFile(join(projectRoot, '.env'));
const theme = (env.FINAL_EFFECT_THEME ?? '').trim().toLowerCase();

if (!['blue', 'pink'].includes(theme)) {
  throw new Error('FINAL_EFFECT_THEME in .env must be either "blue" or "pink".');
}

const sourceIndex = readFileSync(join(projectRoot, 'index.html'), 'utf8');
const sourceMain = readFileSync(join(projectRoot, 'src/main.js'), 'utf8');
const sourceOctopus = readFileSync(join(projectRoot, 'src/baby-octopus.js'), 'utf8');
const sourceStyles = readFileSync(join(projectRoot, 'styles.css'), 'utf8');
const buildId = createHash('sha256')
  .update(theme)
  .update(sourceMain)
  .update(sourceOctopus)
  .update(sourceStyles)
  .digest('hex')
  .slice(0, 10);
const configFileName = `env.${buildId}.js`;

mkdirSync(distDir, { recursive: true });
mkdirSync(join(distDir, 'src'), { recursive: true });

readdirSync(distDir)
  .filter((fileName) => /^env\.[a-f0-9]{10}\.js$/.test(fileName))
  .forEach((fileName) => unlinkSync(join(distDir, fileName)));

cpSync(join(projectRoot, 'pinata.glb'), join(distDir, 'pinata.glb'));
cpSync(join(projectRoot, 'styles.css'), join(distDir, 'styles.css'));
cpSync(join(projectRoot, 'src'), join(distDir, 'src'), { recursive: true });

const builtIndex = sourceIndex
  .replace('./styles.css', `./styles.css?v=${buildId}`)
  .replace('<!-- BUILD_THEME_CONFIG -->', `<script src="./${configFileName}"></script>`)
  .replace('./src/main.js', `./src/main.js?v=${buildId}`);

if (builtIndex === sourceIndex) {
  throw new Error('Build placeholders could not be found in index.html.');
}

writeFileSync(join(distDir, 'index.html'), builtIndex);
writeFileSync(
  join(distDir, configFileName),
  `window.AR_PINATA_ENV = Object.freeze({ FINAL_EFFECT_THEME: '${theme}' });\n`,
);

console.log(`Built AR Pinata with theme "${theme}" (${buildId}).`);

function readEnvFile(filePath) {
  const values = {};
  const contents = readFileSync(filePath, 'utf8');

  contents.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex < 1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    values[key] = value;
  });

  return values;
}
