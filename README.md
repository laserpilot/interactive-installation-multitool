# Installation Screen Multitool

A browser tool for AV / experiential installers to sanity-check **touchscreen and
display placement** before anything gets mounted. Set a screen size, mount height,
and viewing distance, and it tells you whether the placement is reachable (ADA),
comfortable to see, and sharp enough — with a 3D scene and a "view from their eyes"
first-person mode.

It exists to turn two recurring gut-feel arguments into numbers you can share:

1. **A screen too big for its distance.** e.g. a 65" panel ~1 ft from the user
   subtends ~134° of visual field — physically impossible to take in. The tool
   prints the angle and flags it.
2. **The "let's make the 12 ft LED wall a touchscreen" request.** It's
   self-defeating: at touch distance you can't see it, you can't reach the top
   7 ft, and the pixel pitch shows pixels up close. The tool says so, with the
   FOV, the unreachable %, and the pitch math.

## The three competing constraints

The whole tool is a small engine that resolves three demands that fight each other:

| Constraint | Rule of thumb | Source |
|---|---|---|
| **Reach** | Interactive controls within **15"–48"** off the floor | ADA / ICC A117.1 §308 |
| **Visual angle** | `θ = 2·atan(W / 2D)`; ≤30° ideal, ~40° OK, >50° you can't see the edges | viewing ergonomics |
| **Resolution** | Eye resolves ~**60 px/°** (1 arcmin); LED needs ~`pitch_mm` metres to look clean | visual acuity |

The punchline the tool keeps surfacing: **touch forces you close, big screens need
distance** — contradictory above a certain size.

## Stack

- **Vite + React + TypeScript**
- **Three.js** via **@react-three/fiber** + **@react-three/drei** for the 3D scene
- **zustand** for config state
- **vitest** for the engine unit tests

No backend — it's a static site, and uploaded content never leaves the browser.

## Project layout

```
src/
  ergonomics/
    constants.ts    # anthropometric + ADA constants, persona definitions
    engine.ts       # PURE math: angles, reach, pixels, overall verdict
    engine.test.ts  # vitest — the trust core (run `npm test`)
  store/
    useConfigStore.ts  # all inputs + derived getVerdict()
  scene/
    Scene.tsx        # <Canvas>, lights, floor, wall + camera rig
    CameraRig (in Scene.tsx)  # orbit  <->  first-person (avatar eye) switch
    Avatar.tsx       # parametric mannequin (adult/child/wheelchair) + reach arm
    avatarLayout.ts  # shared eye/shoulder/hand math (avatar + FP camera agree)
    Bone.tsx         # capsule between two world points (limbs/segments)
    ScreenMesh.tsx   # wall-mounted screen + content texture
    ReachBandOverlay.tsx  # the 15–48" ADA band painted on the wall
    scale.ts         # world units are FEET; f(inches) -> feet
  ui/
    ControlPanel.tsx # inputs + presets
    VerdictPanel.tsx # live Good/Caution/Bad verdict + reasons + metrics
    ContentUpload.tsx# image -> screen texture (client-side only)
    UnitToggle.tsx   # US <-> metric
    units.ts         # formatting/conversion helpers
```

### Where the real logic lives

`src/ergonomics/engine.ts` is the heart and is intentionally framework-free and
fully unit-tested. Everything else (store, UI, 3D) is presentation over it. If you
change a threshold or persona number, do it in `constants.ts` and the tests in
`engine.test.ts` document the expected behaviour.

### Units convention

- The **engine works entirely in inches.** Conversion to metric happens only at
  the UI boundary (`ui/units.ts`).
- The **3D scene works in feet** (`scene/scale.ts`, `f()`), to keep Three.js
  magnitudes and camera near/far sane.

### Personas

Adult (50th %ile), child (~7 yr), and a seated wheelchair user — each with eye
height, reach band, and arm-length touch distance in `constants.ts`. These are
sensible defaults, **not gospel**; they're centralized so they're easy to tune.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # run the engine unit tests once
npm run test:watch
npm run build    # production static build -> dist/
```

## Verify behaviour by hand

1. Default loads a 65" screen in touch mode → verdict should already flag the
   visual-angle and reach problems.
2. Switch **viewer** (adult / child / wheelchair) → avatar, reach arm, and verdict
   update live.
3. Toggle **"View from their eyes"** → the screen should visibly overflow the
   frame when it's too big for the distance.
4. **Upload an image** → it appears on the screen and auto-fills the horizontal
   resolution for the pixel-pitch math.
5. Flip **units** → all readouts convert.
6. Try the **12 ft LED wall** preset in touch mode → verdict goes red with the
   angle, unreachable %, and pixel-pitch reasons.

## Status / ideas not yet built

- Device preset library is small; could grow (specific LED products, tablets).
- Deferred: save/share configs, PDF client export, multi-persona side-by-side,
  full anthropometric percentile sliders, obstructed-reach (kiosk depth) ADA case.
