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
// Every dependency is copied locally and SHA-256 checked before deployment.
// Load only libraries explicitly imported by the scene, keeping ordinary GX fast.
const SCIENTIFIC_PACKAGES = {
  sympy: ["sympy"], scipy: ["scipy"], matplotlib: ["matplotlib"],
  Bio: ["biopython"], periodictable: ["pyparsing"],
  schemdraw: ["matplotlib"], arhimed_science: ["matplotlib"],
};
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
    "schemdraw-0.23-py3-none-any.whl",
    "periodictable-2.1.0-py3-none-any.whl",
  ].map((name) => new URL(`../wheels/${name}`, pyodide).href);
  await micropip.install(wheels, { deps: false });

  const helperResponse = await fetch(new URL("../python/arhimed_science.py", pyodide));
  if (!helperResponse.ok) throw new Error("Scientific drawing helper is unavailable.");
  const sitePackages = py.runPython("__import__('sysconfig').get_path('purelib')");
  py.FS.writeFile(`${sitePackages}/arhimed_science.py`, await helperResponse.text());

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
  const imports = py.runPython("scene_import_roots");
  const loaded = new Set();
  async function prepare(source) {
    const proxy = imports(source);
    const roots = proxy.toJs();
    proxy.destroy();
    const packages = [...new Set(roots.flatMap(root => SCIENTIFIC_PACKAGES[root] ?? []))].filter(name => !loaded.has(name));
    if (!packages.length) return;
    send({ status: `Loading scientific libraries: ${packages.join(', ')}…` });
    await py.loadPackage(packages);
    // Matplotlib must never try to open a GUI or load a browser backend.
    if (packages.includes("matplotlib")) py.runPython("import matplotlib; matplotlib.use('Agg', force=True)");
    packages.forEach(name => loaded.add(name));
  }
  return { runner, note, drop, prepare };
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
        await python.prepare(source);
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
import ast, builtins, dataclasses, importlib.util, json, linecache, shutil, sys, traceback
from pathlib import Path
from pyodide.ffi import to_js
from manimgx import _engine
from manimgx.config import Config, config
from manimgx.scene import Scene

FILMS = Path("/home/pyodide/films")

# Parsing belongs to Python, not a JavaScript regular expression: valid syntax such
# as decorators, comprehensions, triple-quoted strings and arbitrary whitespace is
# therefore preserved. This approves only modules present in the immutable runtime.
_USER_IMPORT_ROOTS = frozenset((
    "manimgx", "numpy", "math", "cmath", "statistics", "random", "fractions",
    "decimal", "dataclasses", "functools", "itertools", "collections", "operator",
    "sympy", "scipy", "matplotlib", "schemdraw", "Bio", "periodictable", "arhimed_science",
))
_ORIGINAL_IMPORT = builtins.__import__

def _import_root(name):
    return name.split(".", 1)[0]

def scene_import_roots(source):
    try:
        tree = ast.parse(source, filename="<scene>", mode="exec")
    except SyntaxError:
        # Let run() preserve its normal line-numbered syntax diagnostic.
        return []
    return sorted({_import_root(name) for node in ast.walk(tree)
        for name in ([alias.name for alias in node.names] if isinstance(node, ast.Import)
                     else [node.module] if isinstance(node, ast.ImportFrom) else [])})

def _validate_source(source, path):
    tree = ast.parse(source, filename=str(path), mode="exec")
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names = (alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            if node.level or not node.module:
                raise ImportError(f"line {node.lineno}: relative imports are unavailable in the browser runtime")
            names = (node.module,)
        else:
            continue
        for name in names:
            if _import_root(name) not in _USER_IMPORT_ROOTS:
                raise ImportError(f"line {node.lineno}: import {name!r} is not part of the fixed browser runtime")
    return tree

def _scene_import(name, globals=None, locals=None, fromlist=(), level=0):
    # Runtime packages keep their ordinary internal imports. Imports issued by the
    # user scene are restricted even if the code calls __import__ directly.
    if globals and globals.get("__name__") == "scene" and (level or _import_root(name) not in _USER_IMPORT_ROOTS):
        raise ImportError(f"import {name!r} is not available to browser scenes")
    return _ORIGINAL_IMPORT(name, globals, locals, fromlist, level)

def _scene_builtins():
    allowed = vars(builtins).copy()
    allowed["__import__"] = _scene_import
    for name in ("open", "input", "breakpoint", "help", "eval", "exec", "compile"):
        allowed.pop(name, None)
    return allowed

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
        tree = _validate_source(source, path)
        module.__dict__["__builtins__"] = _scene_builtins()
        exec(compile(tree, str(path), "exec"), module.__dict__)
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
