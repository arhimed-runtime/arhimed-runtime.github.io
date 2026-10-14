# Cross-origin runtime preparation

This is a local feasibility check, not the required GitHub Pages acceptance run. The parent runs at `http://127.0.0.1:4184` and the runtime at `http://127.0.0.1:4185`, therefore their origins differ by port. The production pair will use different HTTPS hosts: the existing Studio/lab owner and the separately provided GitHub Pages organization.

## Verified locally on 2026-10-14

Chrome 155.0.8059.40 and Edge 155.0.4283.45, Windows 11 build 26100, RTX 3070:

- The runtime iframe uses `sandbox="allow-scripts allow-same-origin"`; the parent and runtime have different origins.
- A Blob module Worker starts in the runtime. This resolves the incompatibility of the opaque-origin configuration.
- A MessageChannel is established only after a parent-origin allowlist check, `WindowProxy` identity check, session UUID, and protocol version check. Every command and event carries a monotonic revision and request ID. Scene source is capped at 16 KiB.
- The runtime cannot read synthetic parent DOM, localStorage, IndexedDB, or OpenRouter-key values. No value is put in a URL or MessageChannel command.
- The runtime CSP blocks direct external and localhost fetches. A malformed or out-of-session command is ignored.
- With a temporary discovery-only allowance for `pypi.org`, real ManimGX 0.1.1 loaded Pyodide, requested WebGPU, rendered the simple Python scene, then rendered `ValueTracker` + `always_redraw`, stopped, and restarted. Chrome first frame was 10.458 s; Edge was 9.501 s. The reactive and restart scenes were 54–103 ms.

## Current blocking condition

The final CSP intentionally removes `pypi.org`. In that configuration ManimGX stops while `micropip` resolves the declared `isosurfaces` dependency. The upstream 0.1.1 director performs automatic dependency resolution, so it is not suitable as a final untrusted-scene loader unchanged.

The deployment runtime must therefore:

1. host fixed Pyodide files, the GX wheel and required wheels on the runtime origin;
2. use a documented derivative of the 0.1.1 loader that installs only that locked list with dependency resolution disabled;
3. retain a CSP with `connect-src 'self'` after the assets are local;
4. reject imports and dynamic import mechanisms outside the fixed API profile.

The fixed wheel candidates identified so far are `manimgx 0.1.1`, `manimgx-fonts 2026.9.26.post1`, `isosurfaces 0.1.2`, and `svgelements 1.9.6`. Pyodide itself supplied Pillow, NumPy and typing extensions in the discovery run. Each runtime artifact will be recorded with a source URL, SHA-256, license, size and build manifest before publication.

The `--disable-webgpu` browser flag did not remove `navigator.gpu` on this Windows build, so it is not treated as a valid disabled-WebGPU test. A deliberately unavailable adapter did produce ManimGX's explicit `no GPU adapter` failure. The final Pages run will record a genuine browser-level no-WebGPU scenario separately.

Meta CSP cannot reliably set `frame-ancestors` on GitHub Pages because it needs an HTTP response header. The runtime instead protects its command channel with the fixed parent-origin allowlist and does not carry parent secrets; the deployment report will record this hosting limitation.
