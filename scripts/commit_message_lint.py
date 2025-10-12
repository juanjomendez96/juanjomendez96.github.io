#!/usr/bin/env python3
"""Validate commit messages follow Conventional Commit style."""

from __future__ import annotations

import re
import sys
from pathlib import Path
from textwrap import dedent

ALLOWED_TYPES = (
    "build",
    "chore",
    "ci",
    "docs",
    "feat",
    "fix",
    "perf",
    "refactor",
    "revert",
    "style",
    "test",
)

TYPE_PATTERN = "|".join(ALLOWED_TYPES)
SUBJECT_REGEX = re.compile(rf"^({TYPE_PATTERN})(?:\([a-z0-9\-]+\))?!?: [^\s].+$")
SUBJECT_MAX_LENGTH = 72


def main() -> int:
    if len(sys.argv) < 2:
        print("commit_message_lint: no commit message file provided.", file=sys.stderr)
        return 1

    message_path = Path(sys.argv[1])
    if not message_path.exists():
        print(f"commit_message_lint: file '{message_path}' not found.", file=sys.stderr)
        return 1

    content = message_path.read_text(encoding="utf-8").strip("\n")
    subject = content.splitlines()[0].strip() if content else ""

    errors: list[str] = []
    if not subject:
        errors.append("Commit message must include a subject line.")
    else:
        if len(subject) > SUBJECT_MAX_LENGTH:
            errors.append(f"Subject must be <= {SUBJECT_MAX_LENGTH} chars (got {len(subject)}).")
        if not SUBJECT_REGEX.match(subject):
            allowed = ", ".join(ALLOWED_TYPES)
            errors.append(
                dedent(
                    f"""\
                    Subject must follow Conventional Commits:
                    <type>(<optional-scope>): <imperative message>
                    Allowed types: {allowed}
                    Example: feat(data-pipeline): add workflow triggers"""
                ).strip()
            )

    if errors:
        print("Commit message check failed:\n", file=sys.stderr)
        for issue in errors:
            print(f"  - {issue}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
