# AR QA Checklist

Scope: hostable web AR app using `pinata.glb`. The expected interaction is:

- Keep all pinata, confetti, message-sprite, and octopus rendering hidden until the user presses `Start AR` and the immersive session starts.
- Load the pinata in an AR camera view.
- After AR starts, place the pinata at a random reachable spot within a 5m radius of the user's current spot.
- Hits 1 through 5 emit a generous confetti burst and hit sound, then move the pinata to a new random spot with a readable transition animation.
- While active, the pinata keeps doing small jumps and slow position changes so the target is harder to hit, and varies its facing within a 60-degree cone toward the player.
- Hit 6 plays an explosion sound, emits lots of confetti, removes or explodes the pinata, shows the selected baby-blue or baby-pink text: `See you soon little one!`, starts dense matching confetti rain, and reveals a matching smiling baby octopus.

## Current Workspace Snapshot

- `pinata.glb` is the model asset.
- `index.html`, `styles.css`, and `src/main.js` implement a static WebXR app with an unsupported-device camera background.
- `package.json` provides local serve and syntax-check scripts.

## Release Blockers To Check First

- The app is served from HTTPS or `localhost`; WebXR must not be expected to work from `file://` or plain HTTP.
- The app runtime detects `navigator.xr` and calls `navigator.xr.isSessionSupported("immersive-ar")` before showing an AR start path.
- Unsupported, denied, or rejected AR startup states remain recoverable and never reveal interactive AR content.
- Hosted assets use relative URLs and fetch successfully from the deployed origin: `pinata.glb` and any external audio/confetti assets if added.
- If embedded in an iframe, the parent allows `xr-spatial-tracking`, `camera` if using a camera fallback, and `autoplay` if sound is needed.

## WebXR And Mobile Checks

- AR starts only from a clear user gesture, such as an `Enter AR` button.
- No AR scene content is visible, animated, or interactive behind the `Start AR` button before the session begins.
- The WebXR session mode is `immersive-ar`, not `immersive-vr` or only `inline`.
- Runtime handles both `isSessionSupported("immersive-ar") === false` and promise rejection.
- Test on a real target mobile AR device/browser; desktop emulation can only validate fallback rendering and state logic.
- iOS handheld browsers should be treated as fallback unless `immersive-ar` is confirmed at runtime on the exact target browser/device.
- Camera permission denied, unavailable AR runtime, unsupported browser, and interrupted session all leave the page recoverable.

## Model And AR Placement

- `pinata.glb` loads once without console errors and appears at a believable scale.
- Initial AR placement is random but constrained within 5m of the user's current spot or the chosen local anchor.
- The random spot is not behind the camera, too close to the user, inside the camera near plane, below the detected floor, or so far to the side that it is effectively unreachable.
- Repositioning after a hit keeps the next spot within the 5m radius and preserves believable scale and camera-facing orientation.
- The model remains stable as the user moves the phone; it does not follow the camera unintentionally after placement or while relocating.
- The app handles slow model loading with a visible loading state.
- GLB load failure shows a user-visible error and does not break fallback controls.

## Movement And Difficulty Checks

- Each successful non-final hit starts one relocation animation, and the next target position is different enough to be noticeable.
- Hit-triggered relocations take about 1.2 seconds, keeping the response playful without snapping too quickly.
- Relocation has a clear animated path or easing and does not teleport through the camera.
- Ongoing jump and drift are subtle enough to stay hittable but visible enough to raise difficulty.
- Idle wander moves take about 2.4–3.3 seconds, rest for 1.2–2 seconds, and do not feel frantic.
- The pinata changes its gaze smoothly within 30 degrees to either side of the user and only tilts sideways occasionally; it never turns its back on the user.
- Jump/drift and hit-triggered relocation compose cleanly; one animation does not permanently offset or shrink/grow the model.
- Random movement does not move the pinata outside the raycastable proxy, outside the 5m radius, or behind the final text.
- Reset returns movement state, target position, hit count, and visibility to the initial active state.

## Tap And Raycast Correctness

- XR interactions use the WebXR `select` event or equivalent Three.js XR controller event, not only DOM `click`.
- Fallback interactions support pointer/touch input with normalized device coordinates and a Three.js raycaster.
- Raycasts include all mesh children of the loaded GLB, or use a collider derived from the model bounds.
- Only ray hits on the pinata count; taps on empty space, overlays, text, or confetti do not increment the hit count.
- One physical tap/select increments the counter once. Guard against double counting `pointerdown` plus `click`.
- Fast repeated taps are debounced enough to preserve the exact sequence, especially around relocation start/end.
- Raycasts during jump/drift use the current world transform, not the previous frame's stale position.
- Hits cannot be counted while the pinata is hidden, exploding, or in a non-interactive relocation phase.
- Hits 1 through 5 trigger confetti plus hit sound and exactly one relocation.
- Hit 6 triggers explosion sound, large confetti, final message, and disables further hit counting.
- Hit 7 or later cannot retrigger the explosion or replay the final sequence.

## Audio Checks

- Sounds are loaded or decoded before use, but playback is unlocked by a user gesture.
- If using `AudioContext`, it is resumed from the AR start gesture or first tap before playing effects.
- If using `<audio>.play()`, rejected play promises are caught and do not break the interaction.
- Hit and explosion sounds are distinct and synchronized with their visual events.
- Muted device, silent mode, or autoplay blocking does not prevent confetti or final text from appearing.

## Confetti, Explosion, And Final Text

- Small confetti bursts originate near the pinata and clean themselves up after a short lifetime.
- Explosion confetti is visibly larger than hit confetti and does not degrade frame rate badly on mobile.
- The pinata is hidden, removed, or visibly exploded on the sixth successful hit.
- Final text is exactly `See you soon little one!`.
- Final text matches the selected baby-blue or baby-pink theme, remains readable over the AR/camera/fallback background, and fits on narrow mobile screens.
- Final text appears after the explosion sequence and remains visible.
- Dense continuous confetti rain starts after the pinata disappears, exactly matches the selected final-effect color, and stops cleanly on reset.
- Building with `FINAL_EFFECT_THEME=blue` or `FINAL_EFFECT_THEME=pink` updates the DOM text, 3D text, octopus, and rain together; no runtime theme switch is present.
- The compact smiling baby octopus appears only after the pinata disappears, enters smoothly below the final text, faces the viewer independently of the pinata's last tilt, and gently animates all eight tentacles.
- The baby octopus and its animation are hidden and returned to their initial state on reset.

## Unsupported-device Behavior

- If WebXR AR is unavailable, no pinata, confetti, octopus, or 3D final text is rendered.
- A permitted camera background may still appear, but it never starts the game without an immersive AR session.
- If camera permission is denied, the page remains stable and the AR content stays hidden.
- Unsupported devices get concise, visible status text and no uncaught errors.

## Suggested Automated Checks

- Build/lint command passes once a package exists.
- Asset smoke test verifies deployed URLs return 200 for `pinata.glb` and any external audio/confetti assets if added.
- Unit test covers the tap state machine: `0 -> 1 -> ... -> 5 -> exploded on 6`, then ignores additional taps.
- Unit test covers relocation locking: a second tap during a non-interactive relocation window cannot add an extra hit.
- Unit test covers random placement bounds: generated positions are within 5m, not too near, and not behind the active camera.
- Unit test covers raycast hit filtering: pinata hit counts, background miss does not.
- Browser test mocks missing `navigator.xr` and verifies all AR scene content stays hidden.

## Reference Notes Checked On 2026-07-09

- [MDN WebXR Device API](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API) documents WebXR as limited availability, experimental, and secure-context-only.
- [MDN `navigator.xr`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/xr) documents `navigator.xr` as the entry point to `XRSystem`.
- [MDN `isSessionSupported()`](https://developer.mozilla.org/en-US/docs/Web/API/XRSystem/isSessionSupported) documents session modes including `immersive-ar` and rejection when blocked by `xr-spatial-tracking` policy.
- [MDN `XRSession`](https://developer.mozilla.org/en-US/docs/Web/API/XRSession) documents `select` as the completed primary action event.
- [MDN autoplay guidance](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) says audible media is generally allowed only after user interaction or equivalent permission.
