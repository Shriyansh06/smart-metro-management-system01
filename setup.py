"""Install this project's dependencies into its own virtual environment."""

import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys
import venv

ROOT = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description="Set up Smart Metro")
    parser.add_argument(
        "--rebuild",
        action="store_true",
        help="Install frontend dependencies and rebuild the included web bundle",
    )
    args = parser.parse_args()
    if sys.version_info < (3, 10):
        raise SystemExit("Python 3.10 or newer is required.")
    environment = ROOT / "backend" / ".venv"
    executable = environment / (
        "Scripts/python.exe" if os.name == "nt" else "bin/python"
    )
    if not executable.exists():
        print("Creating a project-local Python environment…", flush=True)
        venv.EnvBuilder(with_pip=True).create(environment)
    subprocess.run(
        [
            str(executable),
            "-m",
            "pip",
            "install",
            "-r",
            str(ROOT / "backend" / "requirements.txt"),
        ],
        check=True,
    )
    if args.rebuild or not (ROOT / "frontend" / "dist" / "index.html").exists():
        npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
        if not npm:
            raise SystemExit(
                "Install Node.js 22.12+ (22 LTS) or 24+ (24 LTS) for frontend development."
            )
        subprocess.run([npm, "ci"], cwd=ROOT / "frontend", check=True)
        subprocess.run([npm, "run", "build"], cwd=ROOT / "frontend", check=True)
    print("\nReady. Run: python run.py\nOpen http://127.0.0.1:8000")


if __name__ == "__main__":
    main()
