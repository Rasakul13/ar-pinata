import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
const sourceModel = readFileSync(join(projectRoot, 'pinata.glb'));
const hitsMatch = sourceMain.match(/const HITS_TO_EXPLODE = (\d+);/);

if (!hitsMatch) {
  throw new Error('HITS_TO_EXPLODE could not be read from src/main.js.');
}

const hitsToExplode = Number(hitsMatch[1]);
const commit = (process.env.BUILD_COMMIT ?? 'local').trim() || 'local';
const buildId = createHash('sha256')
  .update(theme)
  .update(sourceIndex)
  .update(sourceMain)
  .update(sourceOctopus)
  .update(sourceStyles)
  .update(sourceModel)
  .digest('hex')
  .slice(0, 10);
const configFileName = `env.${buildId}.js`;

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });
mkdirSync(join(distDir, 'src'), { recursive: true });

cpSync(join(projectRoot, 'pinata.glb'), join(distDir, 'pinata.glb'));
cpSync(join(projectRoot, 'styles.css'), join(distDir, 'styles.css'));
cpSync(join(projectRoot, 'src'), join(distDir, 'src'), { recursive: true });

const builtMain = sourceMain.replace(
  "'./baby-octopus.js'",
  `'./baby-octopus.js?v=${buildId}'`,
);

if (builtMain === sourceMain) {
  throw new Error('The baby-octopus import could not be versioned in src/main.js.');
}

const builtIndex = sourceIndex
  .replace('./styles.css', `./styles.css?v=${buildId}`)
  .replace('<!-- BUILD_THEME_CONFIG -->', `<script src="./${configFileName}"></script>`)
  .replace('./src/main.js', `./src/main.js?v=${buildId}`);

if (builtIndex === sourceIndex) {
  throw new Error('Build placeholders could not be found in index.html.');
}

writeFileSync(join(distDir, 'index.html'), builtIndex);
writeFileSync(join(distDir, 'src/main.js'), builtMain);
writeFileSync(
  join(distDir, configFileName),
  `window.AR_PINATA_ENV = Object.freeze(${JSON.stringify({
    FINAL_EFFECT_THEME: theme,
    BUILD_ID: buildId,
    BUILD_COMMIT: commit,
    HITS_TO_EXPLODE: hitsToExplode,
  })});\n`,
);
writeFileSync(
  join(distDir, 'version.json'),
  `${JSON.stringify({
    buildId,
    commit,
    theme,
    hitsToExplode,
  }, null, 2)}\n`,
);

console.log(`Built AR Pinata ${buildId}: theme=${theme}, hits=${hitsToExplode}, commit=${commit}.`);

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
