# Third-party notices — locked Stage 1 runtime

This file covers the exact artifacts in `runtime-assets.manifest.json`. The CI integrity step verifies their SHA-256 values before publishing. The complete licence texts and notices distributed by ManimGX and the font bundle remain inside the respective wheels.

| Component | Version | Licence checked | Evidence |
| --- | --- | --- | --- |
| ManimGX browser npm wrapper | 0.1.1 | MIT | `node_modules/manimgx/LICENSE`; SRI is in `package-lock.json` |
| ManimGX Python wheel | 0.1.1 | Composite expression from wheel metadata | `manimgx-0.1.1.dist-info/METADATA`, `LICENSE`, `LICENSE-THIRD-PARTY`, `LICENSE-LAVAPIPE`, `LICENSE-DXC` inside the wheel |
| ManimGX Noto fonts | 2026.9.26.post1 | SIL Open Font License 1.1 | `manimgx_fonts-2026.9.26.post1.dist-info/METADATA` and `licenses/LICENSE` inside the wheel |
| Pyodide loader and micropip | browser distribution v314.0.7 / 0.11.1 | MPL-2.0 | Pyodide distribution and package metadata |
| Python standard library | 3.14.2 | PSF-2.0 | `python_stdlib.zip` from the locked Pyodide distribution |
| NumPy | 2.4.6 | BSD-3-Clause | locked Pyodide package metadata |
| Pillow | 12.2.0 | HPND | locked Pyodide package metadata |
| typing-extensions | 4.15.0 | PSF-2.0 | locked Pyodide package metadata |
| isosurfaces | 0.1.2 | MIT | PyPI metadata and wheel |
| svgelements | 1.9.6 | MIT | PyPI metadata and wheel |

The ManimGX wheel's `License-Expression` is intentionally not simplified: it includes the engine and its bundled third-party components. A release that changes any artifact, hash, or licence evidence requires review before publication.
