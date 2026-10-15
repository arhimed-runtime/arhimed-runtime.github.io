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
