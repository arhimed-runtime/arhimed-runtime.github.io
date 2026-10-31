# Arhimed ManimGX Runtime

Public, non-production runtime for the Stage 1 ArhimedStudio isolation experiment. It is hosted on a dedicated GitHub Pages origin, separate from the Studio and its test parent.

```sh
npm ci
npm run verify:locked-runtime-assets
npm run build
npm test
```

The runtime hosts fixed Pyodide and ManimGX assets in `public/runtime-assets`, validates their SHA-256 values in CI, and accepts commands only through a versioned, authenticated `MessageChannel` from `https://resarytrew.github.io`. It never receives Studio credentials, projects, or author settings. [Third-party notices](THIRD_PARTY_NOTICES.md) record the licence review, including the Noto font wheel (`OFL-1.1`).

The opaque-origin negative result remains documented in [the experiment report](docs/experiment-report.md). The dedicated origin acceptance evidence is recorded separately after the public browser run.

## MP4 export verification

After `npm ci` and `npm run build`, start two preview servers in separate terminals:
`npm run preview -- --port 4184 --strictPort` and
`npm run preview -- --port 4185 --strictPort`. Then run `npm run test:mp4`.
The test requires installed Chrome with WebGPU and WebCodecs H.264 support.
It renders a real Python scene through the authenticated cross-origin channel,
exports MP4, decodes two frames and checks the square's movement and video timing.
The resulting video is saved to `test-results/manimgx-real-export.mp4`.
Set `ARHIMED_MP4_RUNTIME_URL` to test the published runtime instead, or
`ARHIMED_MP4_BROWSER=msedge` to test Edge.

Frame capture runs in the same animation frame as ManimGX's queued draw, before
the WebGPU canvas is presented and cleared. Waiting an extra frame captures black
pixels from this player's non-preserved drawing buffer.

Known export limits: video only, up to 180 seconds. The native ManimGX player
draws its playback controls into the same canvas, so those controls also appear
in the exported video.

## Scientific Python libraries

The fixed runtime includes SymPy 1.14.0, SciPy 1.18.0, Schemdraw 0.23,
Biopython 1.87, PeriodicTable 2.1.0 and Matplotlib 3.10.8, plus their pinned
dependencies. Scientific Pyodide packages load on the first scene that imports
them; ordinary scenes do not initialize the entire scientific stack.
Every package is hosted on this runtime's origin and checked against the asset
manifest before publication. Scene-triggered package installation and external
package requests remain disabled.

Use `from arhimed_science import figure_to_mobject, drawing_to_mobject` to embed
Matplotlib figures and Schemdraw drawings without files or GUI windows. Figures
are snapshots with their text preserved, fitted within the frame. The adapter
closes figures after capture; native GX geometry can animate computed results.

Six complete lessons live in `examples/science`. With the two preview servers
above running, execute `npm run test:science` to render all six through the real
authenticated cross-origin Python/WebGPU runtime. Screenshots are saved under
`test-results/science`. Set `ARHIMED_SCIENCE_BROWSER=msedge` for Edge or
`ARHIMED_SCIENCE_RUNTIME_URL` to the published runtime URL for deployment checks.
The test also rejects external package requests. It requires a WebGPU adapter.

To refresh the fixed assets, run `node scripts/fetch-scientific-assets.mjs`, then
`python scripts/collect-scientific-notices.py`, integrity verification and build.
Python is needed only for this optional notice-refresh step, never for viewing
or building the application with already committed assets.

## Rendering lifecycle

Python completion and bounded stdout/stderr now pass from the director to the
exact native player. `rendered` requires completed Python construction plus a
usable GPU canvas; a first partial animation is insufficient. Exceptions carry
their traceback to Studio. `cancel-export` aborts encoding and restores preview
state, acknowledged with `export-cancelled`. Studio owns wall-clock deadlines
and destroys the iframe for unresponsive Python/encoder tasks.

Run `npm run test:lifecycle` with the same two preview servers to verify real
completion, logs, failures, export cancellation and restart after an infinite
Python loop. `ARHIMED_LIFECYCLE_RUNTIME_URL` selects the deployed runtime and
`ARHIMED_LIFECYCLE_BROWSER=msedge` selects Edge. The browser does not expose
per-process RAM measurements; Studio records memory telemetry as unavailable.
