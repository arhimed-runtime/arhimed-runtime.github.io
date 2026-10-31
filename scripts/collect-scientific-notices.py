"""Copy original license notices from the locked wheels; development-time only."""
import json
from pathlib import Path
from zipfile import ZipFile

manifest = json.loads(Path("runtime-assets.manifest.json").read_text(encoding="utf-8"))
notices = ["Original distribution license texts and notices. Packages are unmodified.\n"]
for artifact in manifest["artifacts"]:
    if not artifact["runtime"].startswith(("Pyodide package ", "Scientific package ")) or not artifact["target"].endswith(".whl"):
        continue
    with ZipFile(artifact["target"]) as wheel:
        for name in wheel.namelist():
            if ".dist-info/" in name and any(word in name.rsplit("/", 1)[-1].lower() for word in ("license", "licence", "copying", "notice")):
                notices.append("\n" + "=" * 72 + "\n" + artifact["runtime"] + "\n" + name + "\nSource: " + artifact["source"] + "\n" + "=" * 72 + "\n" + wheel.read(name).decode("utf-8", errors="replace"))
Path("public/licenses/scientific-python-NOTICES.txt").write_text("".join(notices), encoding="utf-8")
print(f"Copied {len(notices) - 1} original license files.")
