# AR Pinata

A static browser AR pinata experience using WebXR where available and a camera overlay elsewhere.

## Gameplay

- AR content remains hidden until the user presses `Start AR` and the immersive session is ready.
- In WebXR, the pinata starts at a random point within a 5 meter radius of the current user spot. Camera-overlay placement uses a tighter visible range so the target remains large enough to hit.
- Hits 1 through 5 play a hit sound, spawn a generous confetti burst, and move the pinata to a new random spot with a jump animation.
- The pinata keeps doing small jumps and gentle wander moves between hits. Its gaze drifts smoothly within a 60-degree cone toward the user, with an occasional sideways tilt.
- Hit 6 plays the explosion sound, spawns a large confetti burst, hides the pinata, shows `See you soon little one!`, starts dense confetti rain, and reveals a smiling baby octopus.
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

Both modes use the same six-hit game, movement, sounds, confetti, final text, theme, and baby octopus. In camera-overlay mode, the 3D scene is composited over the rear camera image and does not have ARKit/WebXR world tracking. No app installation, TestFlight account, or Apple Developer membership is required.

The pinata and camera remain hidden until the user presses `Start AR`. Camera access requires HTTPS on a phone; GitHub Pages already provides HTTPS.

The repository still contains the earlier native ARKit prototype under `ios/`, but the deployed website does not redirect to or require it.

To test from a phone through ngrok:

```sh
ngrok http 5174
```

Open the HTTPS forwarding URL on the phone.

## Files

- `index.html` defines the static page and Three.js import map.
- `.env` selects the build-time `blue` or `pink` final-effect theme.
- `scripts/build.js` validates `.env` and produces the cache-versioned application in `dist/`.
- `styles.css` handles the fullscreen AR/camera overlay and themeable farewell text.
- `src/main.js` loads the GLB model, starts WebXR AR, handles pinata taps, confetti, synthesized hit/explosion sounds, and the final reveal.
- `src/baby-octopus.js` builds and animates the original, primitive-based baby octopus shown after the explosion.
