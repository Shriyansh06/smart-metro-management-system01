"""Run the API and the included React build from one local server."""

import argparse
import os
from pathlib import Path
import subprocess


def main():
    root = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description="Run Smart Metro")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    executable = (
        root
        / "backend"
        / ".venv"
        / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    )
    if not executable.exists():
        raise SystemExit("Run python setup.py first.")
    if not (root / "frontend" / "dist" / "index.html").exists():
        raise SystemExit("Frontend build is missing. Run python setup.py --rebuild.")
    print(
        f"Opening Smart Metro at http://127.0.0.1:{args.port}. Press Ctrl+C to stop.",
        flush=True,
    )
    try:
        subprocess.run(
            [
                str(executable),
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(args.port),
            ],
            cwd=root / "backend",
            check=True,
        )
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
