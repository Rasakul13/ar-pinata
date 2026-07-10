# AR Pinata

A static browser AR pinata experience using WebXR where available and a camera overlay elsewhere.

## Gameplay

- AR content remains hidden until the user presses `Start AR` and the immersive session is ready.
- In WebXR, the pinata starts at a random point within a 5 meter radius of the current user spot. Camera-overlay placement uses a tighter visible range so the target remains large enough to hit.
- Hits 1 through 3 play a hit sound, spawn a generous confetti burst, and move the pinata to a new random spot with a jump animation.
- The pinata keeps doing small jumps and gentle wander moves between hits. Its gaze drifts smoothly within a 60-degree cone toward the user, with an occasional sideways tilt.
- Hit 4 plays the explosion sound, spawns a large confetti burst, hides the pinata, shows `See you soon little one!`, starts dense confetti rain, and reveals a smiling baby octopus.
- The build-time theme switches the text, octopus, and rain together between baby blue and baby pink.

## Final-effect theme

Set the theme in `.env` using exactly one of these values:

```dotenv
FINAL_EFFECT_THEME=blue
```

or:

```dotenv
FINAL_EFFECT_THEME=pink
```

Then run `npm run build`. The finished deployable application is written to `dist/`. Each build creates a content-versioned theme configuration, so changing the theme cannot reuse an older cached configuration file. There is intentionally no runtime color switch or URL override.

## GitHub Pages deployment

The `Deploy GitHub Pages` workflow is the only publishing path. On every push to `main` it:

1. deletes and recreates `dist/` from the committed sources and `.env`;
2. versions the JavaScript, CSS, octopus import, model, and theme configuration with one build ID;
3. publishes only the generated `dist/` artifact;
4. checks the live `version.json` repeatedly until build ID, commit, theme, and required hit count stably match the pushed build.

Configure the repository once under **Settings > Pages > Build and deployment > Source** and select **GitHub Actions**. Publishing directly from the `main` branch is intentionally unsupported because a branch deployment cannot evaluate `.env` through the build script.

The active deployment can be inspected at:

```text
https://rasakul13.github.io/ar-pinata/version.json
```

A successful workflow guarantees that this file reports the deployed commit, selected `blue` or `pink` theme, and `hitsToExplode: 4`. If GitHub Pages serves an older or branch-based version, the final workflow verification fails with a specific configuration message instead of reporting a misleading successful deployment.

## Run locally

```sh
npm start
```

`npm start` builds from `.env`, serves `dist/`, and makes the app available at `http://localhost:5174`.

WebXR AR needs a secure context. `localhost` works for local testing; deployed hosting should use HTTPS. On a WebXR-capable mobile browser, use the AR button to open the camera AR view.

## Android and iOS modes

The same GitHub Pages link automatically selects the best browser mode:

- Android browsers with WebXR `immersive-ar` support use the full WebXR version.
- Safari on iPhone and iPad uses the camera-overlay version because Safari does not expose the required immersive WebXR session.
- Other browsers without immersive WebXR also use the camera overlay when camera access is available.

Both modes use the same four-hit game, movement, sounds, confetti, final text, theme, and baby octopus. In camera-overlay mode, the 3D scene is composited over the rear camera image and does not have ARKit/WebXR world tracking. No app installation, TestFlight account, or Apple Developer membership is required.

The pinata and camera remain hidden until the user presses `Start AR`. Camera access requires HTTPS on a phone; GitHub Pages already provides HTTPS.

To test from a phone through ngrok:

```sh
ngrok http 5174
```

Open the HTTPS forwarding URL on the phone.

## Files

- `index.html` defines the static page and Three.js import map.
- `.env` selects the build-time `blue` or `pink` final-effect theme.
- `scripts/build.js` validates `.env` and produces the cache-versioned application in `dist/`.
- `scripts/verify-deployment.js` confirms that GitHub Pages serves the exact artifact created for the latest push.
- `styles.css` handles the fullscreen AR/camera overlay and themeable farewell text.
- `src/main.js` loads the GLB model, starts WebXR AR, handles pinata taps, confetti, synthesized hit/explosion sounds, and the final reveal.
- `src/baby-octopus.js` builds and animates the original, primitive-based baby octopus shown after the explosion.
