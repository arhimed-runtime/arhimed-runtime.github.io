# Fixed runtime dependencies

The lab runs the real browser build of ManimGX `0.1.1`, installed from npm with its lockfile integrity:

- npm package: `manimgx@0.1.1`
- npm SRI: `sha512-Js3BxW1issUDISJWgQImD6zLQ36hTRaOYcu1GCIwivIZ0178gUr4rH7HQPTWE9Vwp0bXmQxX8MEfa1855BQadQ==`
- upstream source commit: `0507708dc5d731478786de2f46ca8a1660d514d6` (`v0.1.1`)
- Pyodide: `v314.0.7`
- browser wheel: `manimgx-0.1.1-cp313-abi3-pyemscripten_2026_0_wasm32.whl`
- wheel SHA-256: `ef8255890eeaa7281f15afe40c727b5df94199020003f5b698bf18aae94f92ae`

The wheel is selected explicitly through `settings.manimgx`. The worker parses each scene with Python `ast`, accepts all ordinary Python syntax, and permits documented `manimgx` import forms plus the fixed mathematical modules `numpy`, `math`, `cmath`, `statistics`, `random`, `fractions`, `decimal`, `dataclasses`, `functools`, `itertools`, `collections`, and `operator`. Its execution import hook enforces the same allowlist; neither it nor the locked director resolves or installs a package at scene-run time.

The cross-origin prototype has shown that the stock 0.1.1 director still resolves dependencies declared by its wheel through PyPI. Its final deployment must use a locked, runtime-origin wheel set and a narrowly modified loader; see `docs/cross-origin-progress.md`.
