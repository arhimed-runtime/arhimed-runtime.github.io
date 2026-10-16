# Stage 1 acceptance — dedicated HTTPS ManimGX runtime

**Decision: accepted for the narrowly defined browser ManimGX profile.** The Stage 2 implementation may begin with `EngineAdapterV1`; this result does not add an adapter to ArhimedStudio and does not alter the Canvas engine.

## Deployment identity

- Runtime repository: `arhimed-runtime/arhimed-runtime.github.io`
- Runtime origin: <https://arhimed-runtime.github.io/>
- Published runtime revision: [`2f634dc`](https://github.com/arhimed-runtime/arhimed-runtime.github.io/commit/7d52bfe60750bed6f944ff75ba30fbb329543cf5)
- Runtime deployment: [GitHub Actions run 38728010203](https://github.com/arhimed-runtime/arhimed-runtime.github.io/actions/runs/38728010203)
- Test parent: <https://resarytrew.github.io/arhimed-runtime-lab/cross-origin-parent.html>
- Parent acceptance revision: [`8acafec`](https://github.com/resarytrew/arhimed-runtime-lab/commit/8acafec5f4954c9a72a7f5ea05c7f6e6542d1085)

The two hosts are distinct HTTPS origins. A different directory below `resarytrew.github.io` was not used as the runtime origin.

## Fixed runtime and reproducibility

The runtime executes the real ManimGX `0.1.1` Python wheel in Pyodide `v314.0.7`. `runtime-assets.manifest.json` lists every published asset, its source, version, SHA-256 and licence. The GitHub Actions build runs `npm run verify:locked-runtime-assets`, builds the site, and rejects a Pages package above the size limits.

The published asset verification on 2026-10-15 fetched all 13 files from `https://arhimed-runtime.github.io/runtime-assets/` and matched every manifest SHA-256. The Python loader is a documented MIT-licensed derivative of ManimGX `v0.1.1`: it loads only the locked local wheels and has neither `loadPackagesFromImports` nor the upstream missing-module installation loop.

The final package contains 27 files and is **39,964,132 bytes**. Its largest file is the ManimGX wheel at **18,544,406 bytes**. It is below GitHub Pages' 1 GiB published-site limit and GitHub's 100 MiB per-file repository limit.

## Security configuration and results

The parent embeds the runtime with `sandbox="allow-scripts allow-same-origin"` and `allow="webgpu"`. `allow-same-origin` is necessary for a Blob module Worker; cross-origin separation protects the parent because the runtime is hosted on `arhimed-runtime.github.io`, not on the parent's origin.

The runtime CSP is:

```text
default-src 'none'; script-src 'self' blob: 'wasm-unsafe-eval';
worker-src blob:; connect-src 'self'; style-src 'self' 'unsafe-inline';
img-src data: blob:; font-src data: blob:; media-src 'none'; object-src 'none';
base-uri 'none'; form-action 'none'
```

The protocol uses one `MessageChannel`, an exact parent-origin allowlist (`https://resarytrew.github.io`), `WindowProxy` identity, session UUID, protocol version, monotonic revision, request ID, and a 256 KiB source limit. Commands with a wrong session, wrong protocol, stale revision or missing transferred port do not control the runtime. The worker parses Python with `ast` and enforces a fixed import allowlist again while executing; it does not resolve or install packages from a scene.

The parent deliberately contains synthetic DOM, localStorage, IndexedDB and OpenRouter-key controls. In both browsers the runtime reported all of them blocked. No control value is placed in the URL or the MessageChannel. Runtime page fetches, Worker fetches, localhost fetches and an unapproved external origin were blocked. A real Blob module Worker started successfully.

## Browser evidence

Environment: Windows 11 Pro build 26100, RTX 3070 (driver 32.0.15.9186), Chrome `155.0.8059.40`, Edge `155.0.4283.45`.

Fresh Playwright browser contexts loaded the separate HTTPS parent and runtime with no browser HTTP cache from a prior test context. Both browsers completed, in order:

1. authenticated MessageChannel and isolation probes;
2. Pyodide and locked ManimGX `0.1.1` load;
3. simple Python scene with a real WebGPU canvas;
4. `ValueTracker` and `always_redraw` scene;
5. controlled stop and a new simple-scene run.

| Measurement | Chrome | Edge |
| --- | ---: | ---: |
| Cold first actual frame | 10,967 ms | 8,560 ms |
| First reactive frame | 57 ms | 62 ms |
| First restart frame | 62 ms | 55 ms |
| Warm simple-scene p95, 20 actual frames | 113 ms | 64 ms |

The warmed p95 target of at most one second passes. Cold time includes network retrieval, Pyodide creation, locked Python package installation and the first scene; it is recorded separately and is not represented as a warm metric.

`--disable-gpu` was tested against the public runtime in Chrome and Edge. Both returned a controlled ManimGX `no GPU adapter` failure while parent DOM and the synthetic OpenRouter key remained inaccessible. The additional `simulateNoWebGpu=1` test checks the absence-of-API branch. The earlier `--disable-webgpu` flag alone did not remove `navigator.gpu` on this Windows setup and is not used as evidence.

The unavailable-runtime URL also produces the explicit MessageChannel load timeout without relaxing sandboxing.

## Licence review

[Third-party notices](../THIRD_PARTY_NOTICES.md) captures licences and evidence for every artifact. In particular, `manimgx-fonts 2026.9.26.post1` includes Noto font metadata and licence text declaring `OFL-1.1`; it is cleared for this experiment. The ManimGX wheel carries its full composite licence expression and bundled notices inside the wheel; the report does not reduce that expression to the MIT licence of the browser wrapper.

## Boundaries and remaining limits

- Only Chrome and Edge on the recorded Windows machine are accepted. Other browsers remain unverified.
- Browser isolation does not provide a hard global RAM or GPU-memory ceiling. The stop mechanism terminates the worker/context boundary, but cannot prove an absolute process-memory limit.
- GitHub Pages serves this static runtime without a configurable `frame-ancestors` response header. The runtime therefore relies on separate origins, the iframe sandbox, strict CSP and the authenticated MessageChannel; being framed does not grant a caller a valid command port.
- The accepted scene profile permits all documented import styles for `manimgx`, pinned NumPy, and a fixed list of pure-Python mathematical/utility modules. It rejects arbitrary Python imports, package installation and dynamic import mechanisms. The public integration test covers `MathTex`, `Axes`, groups, `math`, `numpy`, `ValueTracker`, and `always_redraw` through playback completion.

## Stage 2 handoff: EngineAdapterV1

Stage 2 begins in ArhimedStudio only after preserving the Stage 0 Canvas regression suite. The first increment should:

1. add `EngineAdapterV1` types and capability/status/diagnostic events without replacing Canvas internals;
2. wrap the existing Canvas engine as `arhimed-canvas` with dialect `arhimed-manimx-v1`, preserving `arhimed.projects.v1` and original sources;
3. add a disabled-by-default `manimgx-browser` adapter that can create this accepted cross-origin session, exposes only verified capabilities, and reports `unsupported` elsewhere;
4. persist engine ID, adapter/runtime versions, source language/dialect, entry point, immutable revisions and resources without source conversion;
5. add compatibility tests for legacy Canvas projects and adapter protocol tests using this dedicated runtime URL;
6. keep the adapter behind a feature flag until the old preview, timeline, PNG/WebM export and home-page demonstration pass their regression suite.

Manim Community and ManimGL are not part of this increment. They remain independent local-Python extensions for a later stage.
