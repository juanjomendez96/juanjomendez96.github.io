#!/usr/bin/env python3
from __future__ import annotations

import subprocess
from datetime import datetime, timezone
from pathlib import Path


def gather_git_history() -> str:
    """Return formatted git log for the current branch."""
    log_cmd = [
        "git",
        "log",
        "--date=short",
        "--pretty=format:- %ad %h %s",
    ]
    result = subprocess.check_output(log_cmd, text=True)
    lines = [line.rstrip() for line in result.splitlines() if line.strip()]
    return "\n".join(lines) if lines else "No commits found."


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    changelog_path = repo_root / "CHANGELOG.md"
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    history = gather_git_history()
    header = (
        "# Changelog\n\n"
        f"Generated automatically on {timestamp} from master branch commit history.\n\n"
    )
    changelog_path.write_text(header + history + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
