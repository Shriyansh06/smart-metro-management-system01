"""Run checks and browser workflows against a disposable, freshly seeded database."""

import os
import argparse
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.request


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--skip-install', action='store_true', help='Reuse installed Node dependencies')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    python = (
        root
        / "backend"
        / ".venv"
        / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    )
    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    if not python.exists() or not npm:
        raise SystemExit("Run setup.py and install Node.js first.")
    subprocess.run(
        [str(python), "-m", "pytest", "-q"], cwd=root / "backend", check=True
    )
    if not args.skip_install:
        subprocess.run([npm, "ci", "--no-audit", "--no-fund"], cwd=root / "frontend", check=True)
    subprocess.run([npm, "test"], cwd=root / "frontend", check=True)
    subprocess.run([npm, "run", "build"], cwd=root / "frontend", check=True)
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    with tempfile.TemporaryDirectory(prefix="smart-metro-test-") as temporary:
        environment = os.environ.copy()
        environment["METRO_DB"] = str(Path(temporary) / "test.sqlite3")
        environment["METRO_URL"] = f"http://127.0.0.1:{port}"
        server = subprocess.Popen(
            [
                str(python),
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(port),
            ],
            cwd=root / "backend",
            env=environment,
        )
        try:
            for attempt in range(60):
                try:
                    with urllib.request.urlopen(
                        environment["METRO_URL"] + "/api/health", timeout=1
                    ):
                        break
                except OSError:
                    if server.poll() is not None:
                        raise RuntimeError("Server exited before becoming ready.")
                    time.sleep(0.25)
            else:
                raise RuntimeError("Server did not become ready.")
            subprocess.run(
                [npm, "run", "test:e2e"],
                cwd=root / "frontend",
                env=environment,
                check=True,
            )
        finally:
            server.terminate()
            server.wait(timeout=10)
    print("All checks passed. The test database was removed.")


if __name__ == "__main__":
    main()
