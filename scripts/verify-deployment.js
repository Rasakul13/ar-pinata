const [siteURL, expectedBuildId, expectedCommit, expectedTheme, expectedHitsRaw] = process.argv.slice(2);

if (!siteURL || !expectedBuildId || !expectedCommit || !expectedTheme || !expectedHitsRaw) {
  throw new Error(
    'Usage: node scripts/verify-deployment.js <site-url> <build-id> <commit> <theme> <hits>',
  );
}

const expectedHits = Number(expectedHitsRaw);
const attempts = Number(process.env.DEPLOY_VERIFY_ATTEMPTS ?? 18);
const delayMs = Number(process.env.DEPLOY_VERIFY_DELAY_MS ?? 10000);
const baseURL = siteURL.endsWith('/') ? siteURL : `${siteURL}/`;
const versionURL = new URL('version.json', baseURL);
versionURL.searchParams.set('build', expectedBuildId);
versionURL.searchParams.set('commit', expectedCommit);

let lastResult = 'No response received.';

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    const response = await fetch(versionURL, {
      headers: {
        accept: 'application/json',
        'cache-control': 'no-cache',
      },
    });

    if (!response.ok) {
      lastResult = `HTTP ${response.status} from ${versionURL}`;
    } else {
      const live = await response.json();
      const matches = live.buildId === expectedBuildId
        && live.commit === expectedCommit
        && live.theme === expectedTheme
        && live.hitsToExplode === expectedHits;

      if (matches) {
        console.log(
          `Verified live build ${live.buildId}: theme=${live.theme}, hits=${live.hitsToExplode}, commit=${live.commit}.`,
        );
        process.exit(0);
      }

      lastResult = `Expected ${JSON.stringify({
        buildId: expectedBuildId,
        commit: expectedCommit,
        theme: expectedTheme,
        hitsToExplode: expectedHits,
      })}, received ${JSON.stringify(live)}.`;
    }
  } catch (error) {
    lastResult = error instanceof Error ? error.message : String(error);
  }

  if (attempt < attempts) {
    console.log(`Deployment not current yet (${attempt}/${attempts}): ${lastResult}`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

throw new Error(
  `The newest build was not served by GitHub Pages. ${lastResult} `
  + 'In repository Settings > Pages, set Build and deployment > Source to GitHub Actions, then rerun the workflow.',
);
