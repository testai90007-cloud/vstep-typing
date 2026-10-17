#!/usr/bin/env python3
"""Push local files to GitHub via the Muse GitHub App (no PAT, no secrets).

Usage:
    python3 scripts/gh_push.py "<commit message>" <path1> [<path2> ...]

- One push_files call per invocation (one commit). Call this script once per
  group, SEQUENTIALLY — parallel pushes to main race and 409.
- Keep each call's total content well under ~128 KB (the MCP arg limit):
  group small files together, push large files one per call.
- Repo paths equal the local paths relative to the repo root.
"""
import json
import subprocess
import sys
from pathlib import Path

OWNER = "testai90007-cloud"
REPO = "vstep-typing"
BRANCH = "main"


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    message, paths = sys.argv[1], sys.argv[2:]
    files = []
    total = 0
    for p in paths:
        content = Path(p).read_text(encoding="utf-8")
        files.append({"path": p, "content": content})
        total += len(content.encode())
    print(f"pushing {len(files)} file(s), {total} bytes: {', '.join(paths)}")
    payload = {
        "owner": OWNER,
        "repo": REPO,
        "branch": BRANCH,
        "files": files,
        "message": message,
    }
    out = subprocess.run(
        ["/opt/hatch/bin/github", "call-tool", "--name", "push_files",
         "--arguments-json", json.dumps(payload)],
        capture_output=True, text=True,
    )
    print(out.stdout[:3000])
    if out.stderr:
        print(out.stderr[:1000], file=sys.stderr)
    return out.returncode


if __name__ == "__main__":
    sys.exit(main())
