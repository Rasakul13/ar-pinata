# AR Pinata

A static WebXR AR pinata experience using `pinata.glb`.

## Gameplay

- AR content remains hidden until the user presses `Start AR` and the immersive session is ready.
- The pinata starts at a random point within a 5 meter radius of the current camera/user spot.
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

## Native iOS AR

Safari on iPhone and iPad does not currently provide the `immersive-ar` session required by the WebXR game. The repository therefore contains a separate native ARKit implementation at:

```text
ios/ARPinataIOS/ARPinataIOS.xcodeproj
```

It implements the same six-hit game with true world tracking, randomized movement, native hit testing, hit and explosion confetti, theme-colored rain, final text, and an animated baby octopus. It is not a camera-overlay fallback.

To install it on an iPhone or iPad for testing:

1. Install the full Xcode application from Apple.
2. Open `ios/ARPinataIOS/ARPinataIOS.xcodeproj`.
3. Select the `ARPinataIOS` target and choose your Apple development team under Signing & Capabilities.
4. Connect the device, enable Developer Mode when prompted, select it as the run destination, and press Run.

The Xcode build reads `FINAL_EFFECT_THEME` from the same repository `.env`. The native app registers the URL scheme `arpinata://start`.

The GitHub Pages frontend detects iOS/iPadOS when WebXR AR is unavailable and routes to the native application instead of starting a camera overlay. `IOS_APP_URL` in `.env` controls that destination.

Keep it empty until an installable native build exists:

```dotenv
IOS_APP_URL=
```

After installing directly from Xcode, you can use the registered custom scheme:

```dotenv
IOS_APP_URL=arpinata://start
```

For external distribution, publish the app through TestFlight or the App Store and replace `IOS_APP_URL` with the resulting HTTPS link. When the value is empty, the website shows installation guidance and no broken Safari link.

The two platform implementations coexist as follows:

- WebXR-capable device: launch the browser AR game directly.
- iPhone/iPad without WebXR AR: route to the installed native ARKit app.
- Unsupported non-iOS browser: retain the existing browser fallback behavior.

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
