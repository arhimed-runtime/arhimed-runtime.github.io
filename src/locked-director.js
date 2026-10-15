/*
 * ManimGX 0.1.1 browser director, derived from
 * https://github.com/academa-labs/manimgx/tree/v0.1.1/browser/src/director.ts
 * under its MIT license.
 *
 * This laboratory derivative removes `loadPackagesFromImports` and the
 * upstream "install the missing module" loop. It installs only the files
 * named below, from paths derived from the runtime page's own Pyodide URL.
 * The static asset manifest verifies the bytes before this file is deployed.
 */

function message(error) {
  return String(typeof error === "object" && error !== null && "message" in error ? error.message ?? error : error);
}

const queue = new Map();
let booted;
let busy = false;
let failed = false;

function send(data, transfer = []) {
  postMessage(data, transfer);
}

onmessage = ({ data }) => {
  if ("boot" in data) {
    booted = boot(data.boot).catch((error) => {
      failed = true;
      queue.clear();
      send({ failure: `ManimGX could not start: ${message(error)}` });
      return null;
    });
    return;
  }
  if (!failed) {
    queue.set(data.film, "run" in data ? data.run : null);
    void drain();
  }
};

async function boot({ pyodide }) {
  send({ status: "Loading Python…" });
  const { loadPyodide } = await import(`${pyodide}pyodide.mjs`);
  const py = await loadPyodide({ indexURL: pyodide });

  send({ status: "Loading locked Python packages…" });
  await py.loadPackage(["micropip", "numpy", "Pillow", "typing-extensions"]);
  const micropip = py.pyimport("micropip");
  const wheels = [
    "manimgx-0.1.1-cp313-abi3-pyemscripten_2026_0_wasm32.whl",
    "manimgx_fonts-2026.9.26.post1-py3-none-any.whl",
    "isosurfaces-0.1.2-py3-none-any.whl",
    "svgelements-1.9.6-py2.py3-none-any.whl",
  ].map((name) => new URL(`../wheels/${name}`, pyodide).href);
  await micropip.install(wheels, { deps: false });

  const built = py.runPython(`
from manimgx import _engine
from manimgx.drawing.typesetting import FONTS
(*_engine.web(), _engine.face_fonts(list(FONTS)))`);
  const [js, wasm, fonts] = built.toJs();
  built.destroy();
  send({ engine: { js, wasm, fonts } }, [wasm.buffer, ...fonts.map((font) => font.buffer)]);
  const runner = py.runPython(RUNNER);
  const note = py.runPython("lambda text: to_js(_engine.note(text))");
  const drop = py.runPython("drop");
  return { runner, note, drop };
}

async function drain() {
  const python = await booted;
  if (!python || busy) return;
  busy = true;
  try {
    for (const [film, run] of queue) {
      queue.delete(film);
      const feed = (bytes) => send({ film, feed: bytes.buffer }, [bytes.buffer]);
      try {
        if (run === null) {
          python.drop(film);
          continue;
        }
        const { source, scene } = run;
        // A missing import is an ordinary scene error. This runtime never resolves it.
        python.runner(film, source, scene ?? null, feed);
      } catch (error) {
        feed(python.note(JSON.stringify({ error: { message: message(error), type: "Error" } })));
      }
      await new Promise((resolve) => setTimeout(resolve));
    }
  } finally {
    busy = false;
    if (queue.size) void drain();
  }
}

const RUNNER = `
import dataclasses, importlib.util, json, linecache, shutil, sys, traceback
from pathlib import Path
from pyodide.ffi import to_js
from manimgx import _engine
from manimgx.config import Config, config
from manimgx.scene import Scene

FILMS = Path("/home/pyodide/films")

def run(film, source, name, send):
    out = lambda data: send(to_js(data))
    path = FILMS / str(film) / "scene.py"
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(source, encoding="utf-8")
        linecache.cache.pop(str(path), None)
        defaults = Config()
        for field in dataclasses.fields(Config):
            setattr(config, field.name, getattr(defaults, field.name))
        spec = importlib.util.spec_from_file_location("scene", path)
        module = importlib.util.module_from_spec(spec)
        sys.modules["scene"] = module
        exec(compile(source, str(path), "exec"), module.__dict__)
        scenes = [v for v in vars(module).values() if isinstance(v, type) and issubclass(v, Scene) and v.__module__ == "scene"]
        names = [s.__name__ for s in scenes]
        if not scenes:
            raise ValueError("the source defines no scene (a subclass of manimgx.Scene)")
        kind = scenes[names.index(name)] if name in names else scenes[0]
        out(_engine.note(json.dumps({"scenes": names, "scene": kind.__name__})))
        kind().render(take=out)
    except Exception as error:
        report(out, path, error)

def drop(film):
    path = FILMS / str(film) / "scene.py"
    module = sys.modules.get("scene")
    if getattr(module, "__file__", None) == str(path):
        del sys.modules["scene"]
    for filename in list(linecache.cache):
        if Path(filename).is_relative_to(path.parent):
            del linecache.cache[filename]
    if path.parent.exists():
        shutil.rmtree(path.parent)

def report(out, path, error):
    frames = [f for f in traceback.extract_tb(error.__traceback__) if f.filename == str(path)]
    trace = "".join(traceback.format_list(frames) + traceback.format_exception_only(error))
    line = frames[-1].lineno if frames else getattr(error, "lineno", None)
    out(_engine.note(json.dumps({"error": {"message": str(error), "type": type(error).__name__, "trace": trace, "line": line}})))

run
`;
