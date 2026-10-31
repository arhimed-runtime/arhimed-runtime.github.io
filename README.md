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
