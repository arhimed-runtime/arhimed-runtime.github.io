# Arhimed Runtime Lab

Public, non-production experiment for the browser isolation required before any ManimGX adapter can enter ArhimedStudio.

```sh
npm ci
npm run build
npm test
```

The current conclusion is negative for an opaque-origin iframe: ManimGX 0.1.1 requires a Blob module Worker that cannot start in this boundary. See [the experiment report](docs/experiment-report.md) and [fixed dependencies](docs/dependencies.md).

The prepared cross-origin protocol and local feasibility results are documented in [cross-origin-progress.md](docs/cross-origin-progress.md). It is not a Stage 1 acceptance result until it is deployed to a separately owned HTTPS origin.
