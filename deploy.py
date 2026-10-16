#!/usr/bin/env python3
"""Deploy vstep-typing via Vercel MCP: parallel upload, then create deployment."""
import base64, hashlib, json, os, subprocess, sys, time
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

def upload_ok(output):
    # the CLI can exit 0 while the API payload carries an error (e.g. 429)
    return '"error"' not in output

def upload(item, retries=4):
    p, rel = item
    raw = open(p, "rb").read()
    sha = hashlib.sha1(raw).hexdigest()
    b64 = base64.b64encode(raw).decode()
    if len(b64) > 125000:
        return ("skip", rel, sha, len(raw))
    args = json.dumps({"requestBody": b64, "contentLength": len(raw), "xVercelDigest": sha})
    for attempt in range(retries):
        r = subprocess.run(["vercel", "call-tool", "--name", "upload_file",
                            "--arguments-json", args], capture_output=True, text=True)
        if r.returncode == 0 and upload_ok(r.stdout):
            return ("ok", rel, sha, len(raw))
        err = (r.stderr or r.stdout)[:200]
        if "rate_limited" in (r.stdout + r.stderr) and attempt < retries - 1:
            time.sleep(15 * (attempt + 1))
            continue
        return ("fail", rel, err, len(raw))
    return ("fail", rel, "retries exhausted", len(raw))

open(LOG, "w").write("")
files = walk()
log(f"{len(files)} files, checking against last deploy manifest...")

# Smart upload: Vercel's blob store is content-addressed by sha1.
# Re-uploading unchanged files burns the free-tier upload quota (429s),
# so we keep a manifest of {path: sha} from the last successful deploy
# and only upload files whose content actually changed.
import hashlib as _hl
def _sha(p):
    return _hl.sha1(open(p, "rb").read()).hexdigest()
MANIFEST = os.path.expanduser("~/.cache/vstep-deploy-manifest.json")
try:
    manifest = json.load(open(MANIFEST))
except Exception:
    manifest = {}
refs, fails, reused, to_upload, new_manifest = [], [], 0, [], {}
for p, rel in files:
    sha = _sha(p)
    new_manifest[rel] = sha
    if manifest.get(rel) == sha:
        refs.append({"file": rel, "sha": sha, "size": os.path.getsize(p)})
        reused += 1
    else:
        to_upload.append((p, rel))
log(f"reusing {reused} unchanged files, uploading {len(to_upload)} changed files")
fails = []
done = [0]
def one(item):
    st, rel, sha, size = upload(item)
    done[0] += 1
    if st == "ok":
        refs.append({"file": rel, "sha": sha, "size": size})
    elif st == "fail":
        fails.append((rel, sha))
    elif st == "skip":
        # An oversized file must FAIL LOUDLY, never silently vanish from the
        # deployment: a missing file (e.g. a data chunk) breaks the app at
        # runtime with no trace in the deploy log. Split the file or host
        # the asset elsewhere (Vercel Blob / public CDN) instead.
        err = f"file too large ({size} bytes, base64 over 125000) — split it or host it elsewhere"
        fails.append((rel, err))
        log(f"ERROR {rel}: {err}")
    if done[0] % 40 == 0:
        log(f"  {done[0]}/{len(to_upload)}")

with ThreadPoolExecutor(max_workers=4) as ex:
    list(ex.map(one, to_upload))
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
# record the manifest only when the deployment was actually created
if r.returncode == 0 and '"error"' not in r.stdout and "missing_files" not in r.stdout:
    os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)
    json.dump(new_manifest, open(MANIFEST, "w"))
    log(f"manifest saved: {len(new_manifest)} files")
