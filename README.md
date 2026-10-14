# Arhimed Runtime Lab

Public, non-production experiment for the browser isolation required before any ManimGX adapter can enter ArhimedStudio.

```sh
npm ci
npm run build
npm test
```

The current conclusion is negative for an opaque-origin iframe: ManimGX 0.1.1 requires a Blob module Worker that cannot start in this boundary. See [the experiment report](docs/experiment-report.md) and [fixed dependencies](docs/dependencies.md).
