#!/usr/bin/env python3
"""Deploy vstep-typing via Vercel MCP: parallel upload, then create deployment."""
import base64, hashlib, json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

SRC = os.path.expanduser("~/workspace/vstep-typing")
SKIP_DIRS = {"node_modules", ".next", ".git"}
SKIP_FILES = {"tsconfig.tsbuildinfo", ".gitignore"}
PROJECT_ID = "prj_kjqdESeG8D3UN7d3WqPce4ha6lR4"
LOG = os.path.join(SRC, "deploy.log")

target = sys.argv[1] if len(sys.argv) > 1 else "staging"
assert target in ("staging", "production")

def log(msg):
    with open(LOG, "a") as f:
        f.write(msg + "\n")
    print(msg, flush=True)

def walk():
    out = []
    for root, dirs, files in os.walk(SRC):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            if f in SKIP_FILES or f == "deploy.log":
                continue
            p = os.path.join(root, f)
            out.append((p, os.path.relpath(p, SRC)))
    return sorted(out)

def upload(item):
    p, rel = item
    raw = open(p, "rb").read()
    sha = hashlib.sha1(raw).hexdigest()
    b64 = base64.b64encode(raw).decode()
    if len(b64) > 125000:
        return ("skip", rel, sha, len(raw))
    args = json.dumps({"requestBody": b64, "contentLength": len(raw), "xVercelDigest": sha})
    r = subprocess.run(["vercel", "call-tool", "--name", "upload_file",
                        "--arguments-json", args], capture_output=True, text=True)
    if r.returncode != 0:
        return ("fail", rel, r.stderr[:200], len(raw))
    return ("ok", rel, sha, len(raw))

open(LOG, "w").write("")
files = walk()
log(f"{len(files)} files, uploading with 8 workers...")
refs, fails = [], []
done = [0]
def one(item):
    st, rel, sha, size = upload(item)
    done[0] += 1
    if st == "ok":
        refs.append({"file": rel, "sha": sha, "size": size})
    elif st == "fail":
        fails.append((rel, sha))
    if done[0] % 40 == 0:
        log(f"  {done[0]}/{len(files)}")

with ThreadPoolExecutor(max_workers=8) as ex:
    list(ex.map(one, files))
log(f"done: {len(refs)} ok, {len(fails)} failed")
for rel, err in fails[:10]:
    log(f"FAIL {rel}: {err}")
if fails:
    sys.exit(1)

log(f"creating {target} deployment...")
body = {"name": "vstep-typing", "project": PROJECT_ID, "target": target, "files": refs}
r = subprocess.run(["vercel", "call-tool", "--name", "create_deployment",
                    "--arguments-json", json.dumps({"requestBody": body})],
                   capture_output=True, text=True)
log("create_deployment exit=" + str(r.returncode))
log(r.stdout[:2000])
log(r.stderr[:500])
