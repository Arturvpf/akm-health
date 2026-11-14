"""Run the repository's lint, tests and TypeScript checks locally."""

from pathlib import Path
from shutil import which
import subprocess
import sys


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    npm = which("npm.cmd" if sys.platform == "win32" else "npm")
    if npm is None:
        print("npm is required. Install Node.js and add npm to PATH.", file=sys.stderr)
        return 1

    for label, command in (
        ("Backend lint", [sys.executable, "-m", "ruff", "check", "backend"]),
        ("Backend tests", [sys.executable, "-m", "pytest", "-q", "backend"]),
        ("Frontend typecheck", [npm, "--prefix", "frontend", "run", "typecheck"]),
    ):
        print(f"\n{label}", flush=True)
        result = subprocess.run(command, cwd=root)
        if result.returncode:
            return result.returncode
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
