# Fixed runtime dependencies

The lab runs the real browser build of ManimGX `0.1.1`, installed from npm with its lockfile integrity:

- npm package: `manimgx@0.1.1`
- npm SRI: `sha512-Js3BxW1issUDISJWgQImD6zLQ36hTRaOYcu1GCIwivIZ0178gUr4rH7HQPTWE9Vwp0bXmQxX8MEfa1855BQadQ==`
- upstream source commit: `0507708dc5d731478786de2f46ca8a1660d514d6` (`v0.1.1`)
- Pyodide: `v314.0.7`
- browser wheel: `manimgx-0.1.1-cp313-abi3-pyemscripten_2026_0_wasm32.whl`
- wheel SHA-256: `ef8255890eeaa7281f15afe40c727b5df94199020003f5b698bf18aae94f92ae`

The wheel is selected explicitly through `settings.manimgx`; the lab rejects scene imports other than `import manimgx as m`. This prevents the upstream 0.1.1 loader from installing arbitrary missing Python packages during the experiment.
