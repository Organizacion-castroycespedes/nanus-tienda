#!/usr/bin/env python3
"""Read migration dotenv values as data and emit a safe base64 transport."""

from __future__ import annotations

import base64
import re
import sys
from pathlib import Path


KEY_RE = re.compile(r"^[A-Za-z0-9_.-]+$")
ASSIGNMENT_RE = re.compile(r"^\s*(?:export\s+)?([A-Za-z0-9_.-]+)\s*=\s*(.*)$")
ALLOWED_KEYS = {
    "DB_HOST",
    "DB_PORT",
    "DB_NAME",
    "DB_SCHEMA",
    "DB_USER",
    "DB_PASSWORD",
    "DB_DATABASE",
    "DB_USERNAME",
    "DB_ADMIN_USER",
    "DB_ADMIN_PASSWORD",
    "ENVIRONMENT",
    "MIGRATION_TARGET_ENV",
    "MIGRATION_PROD_APPROVED",
    "MIGRATION_DRY_RUN",
    "MIGRATION_GOVERNANCE_ERA",
    "GOVERNANCE_CUTOVER_APPROVED",
    "MIGRATION_EXPECTED_PREDECESSOR_KIND",
    "MIGRATION_EXPECTED_PREDECESSOR_VERSION",
    "MIGRATION_EXPECTED_PREDECESSOR_CHECKSUM",
    "MIGRATION_EXPECTED_CHECKSUM",
    "MIGRATION_EXECUTION_BINDING",
}


class DotenvFormatError(ValueError):
    def __init__(self, line_number: int) -> None:
        super().__init__(f"Malformed dotenv configuration at line {line_number}.")
        self.line_number = line_number


def parse_dotenv(text: str) -> dict[str, str]:
    """Parse common dotenv assignments without evaluating shell syntax."""
    values: dict[str, str] = {}
    lines = text.lstrip("\ufeff").splitlines()
    index = 0
    while index < len(lines):
        line_number = index + 1
        line = lines[index]
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            index += 1
            continue

        match = ASSIGNMENT_RE.match(line)
        if not match:
            raise DotenvFormatError(line_number)
        key, remainder = match.groups()
        if not KEY_RE.fullmatch(key):
            raise DotenvFormatError(line_number)
        remainder = remainder.lstrip()
        if not remainder or remainder.startswith("#"):
            value = ""
        elif remainder[0] in "\"'`":
            quote = remainder[0]
            content = remainder[1:]
            segments: list[str] = []
            closed = False
            while True:
                segment: list[str] = []
                position = 0
                while position < len(content):
                    character = content[position]
                    if character == quote:
                        closed = True
                        break
                    if (
                        quote == '"'
                        and character == "\\"
                        and position + 1 < len(content)
                        and content[position + 1] in ('"', "\\")
                    ):
                        segment.append(content[position + 1])
                        position += 2
                        continue
                    segment.append(character)
                    position += 1
                segments.append("".join(segment))
                if closed:
                    trailing = content[position + 1 :].strip()
                    if trailing and not trailing.startswith("#"):
                        raise DotenvFormatError(line_number)
                    break
                index += 1
                if index >= len(lines):
                    break
                content = lines[index]
            if not closed:
                raise DotenvFormatError(line_number)
            value = "\n".join(segments)
            if quote == '"':
                value = value.replace(r"\n", "\n").replace(r"\r", "\r")
        else:
            value = re.sub(r"\s+#.*$", "", remainder).rstrip()
            if "\n" in value or "\r" in value:
                raise DotenvFormatError(line_number)

        values[key] = value
        index += 1
    return values


def encode_values(values: dict[str, str]) -> str:
    runner_values = dict(values)
    if not runner_values.get("DB_NAME") and runner_values.get("DB_DATABASE"):
        runner_values["DB_NAME"] = runner_values["DB_DATABASE"]
    if not runner_values.get("DB_USER") and runner_values.get("DB_USERNAME"):
        runner_values["DB_USER"] = runner_values["DB_USERNAME"]
    rows = []
    for key, value in runner_values.items():
        if key not in ALLOWED_KEYS or key in {"DB_DATABASE", "DB_USERNAME"}:
            continue
        encoded = base64.b64encode(value.encode("utf-8")).decode("ascii")
        rows.append(f"{key}\t{encoded}")
    return "\n".join(rows)


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: load_migration_env.py <dotenv-file>", file=sys.stderr)
        return 2
    path = Path(sys.argv[1])
    try:
        text = path.read_text(encoding="utf-8-sig")
        values = parse_dotenv(text)
    except (OSError, UnicodeError):
        print("Unable to read environment configuration.", file=sys.stderr)
        return 1
    except DotenvFormatError as error:
        print(str(error), file=sys.stderr)
        return 1
    sys.stdout.buffer.write(encode_values(values).encode("ascii"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
