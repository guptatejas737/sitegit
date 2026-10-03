"""Local static preview with repeatable latency and per-connection bandwidth.

    python scripts/throttled-preview.py --root dist --port 4184 \
        --kbps 1600 --latency-ms 150

1600 decimal kilobits/s is 200,000 bytes/s. This is a network-limited desktop
browser test, not CPU/GPU emulation, an aggregate network cap, or a physical phone
benchmark. No dependencies, uploads, directory listing, or remote binding.
"""

import argparse
import json
import math
import mimetypes
from pathlib import Path
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import time
from urllib.parse import unquote, urlsplit


MIME = {
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".wasm": "application/wasm",
    ".spz": "application/octet-stream",
    ".splat": "application/octet-stream",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
}


def resolve_asset(root, request_path):
    """Reject traversal, Windows drive names, NULs and escaping symlinks."""
    decoded = unquote(urlsplit(request_path).path, errors="strict")
    if "\x00" in decoded or "\\" in decoded or ":" in decoded:
        raise ValueError("Invalid asset path")
    parts = decoded.split("/")
    if any(part in (".", "..") for part in parts):
        raise ValueError("Path traversal rejected")
    path = root.joinpath(*[part for part in parts if part]).resolve()
    if path.is_dir():
        path = (path / "index.html").resolve()
    if not path.is_relative_to(root):
        raise ValueError("Asset is outside the preview root")
    return path


def byte_range(header, size):
    """One RFC-style byte range; reject invalid/multiple ranges explicitly."""
    if not header:
        return 0, size - 1, 200
    match = re.fullmatch(r"bytes=(\d*)-(\d*)", header.strip())
    if not match or not any(match.groups()) or size == 0:
        raise ValueError("Invalid range")
    left, right = match.groups()
    if not left:
        suffix = int(right)
        if suffix == 0:
            raise ValueError("Invalid suffix range")
        start, end = max(0, size - suffix), size - 1
    else:
        start, end = int(left), min(int(right), size - 1) if right else size - 1
    if start >= size or end < start:
        raise ValueError("Unsatisfiable range")
    return start, end, 206


def make_handler(root, kbps, latency_ms):
    root = Path(root).resolve(strict=True)
    if not root.is_dir():
        raise ValueError("Preview root must be a directory")
    bytes_per_second = kbps * 1000 / 8

    class ThrottledHandler(BaseHTTPRequestHandler):
        # Close after each request: one transfer is one independently capped
        # connection. Concurrent browser requests may exceed kbps in aggregate.
        protocol_version = "HTTP/1.0"
        server_version = "SiteCommitLocalPreview/1.0"

        def log_message(self, _format, *args):
            pass  # Structured transfer log below replaces the duplicate log.

        def do_GET(self):
            self.serve_asset(False)

        def do_HEAD(self):
            self.serve_asset(True)

        def serve_asset(self, head_only):
            began = time.monotonic()
            status, transferred, outcome = 500, 0, "complete"
            stream = None
            try:
                time.sleep(latency_ms / 1000)
                try:
                    path = resolve_asset(root, self.path)
                except (ValueError, UnicodeError):
                    status = 403
                    self.empty_response(status)
                    return
                if not path.is_file():
                    status = 404
                    self.empty_response(status)
                    return
                # Open first so file-permission failures occur before headers.
                stream = path.open("rb")
                size = path.stat().st_size
                try:
                    start, end, status = byte_range(self.headers.get("Range"), size)
                except ValueError:
                    status = 416
                    self.empty_response(status, {"Content-Range": f"bytes */{size}"})
                    return
                length = max(0, end - start + 1)
                content_type = MIME.get(path.suffix.lower()) or mimetypes.guess_type(path)[0] or "application/octet-stream"
                self.send_response(status)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(length))
                self.send_header("Accept-Ranges", "bytes")
                if status == 206:
                    self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
                self.finish_headers()
                if head_only:
                    return
                stream.seek(start)
                body_started = time.monotonic()
                while transferred < length:
                    chunk = stream.read(min(8192, length - transferred))
                    if not chunk:
                        outcome = "file-truncated-during-transfer"
                        break
                    # Pace before writing each chunk, including the first and
                    # final chunk; no initial full-buffer burst escapes the cap.
                    due = body_started + (transferred + len(chunk)) / bytes_per_second
                    time.sleep(max(0, due - time.monotonic()))
                    self.wfile.write(chunk)
                    self.wfile.flush()
                    transferred += len(chunk)
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                outcome = "client-disconnected"
            except OSError as error:
                outcome = type(error).__name__
                if transferred == 0 and stream is None:
                    status = 403
                    self.empty_response(status)
            finally:
                if stream:
                    stream.close()
                elapsed = time.monotonic() - began
                print(json.dumps({
                    "method": self.command,
                    "path": urlsplit(self.path).path,
                    "status": status,
                    "bytes_sent": transferred,
                    "elapsed_ms": round(elapsed * 1000, 1),
                    "effective_kbps_including_latency": round(transferred * 8 / max(elapsed, 0.000001) / 1000, 1),
                    "profile_kbps_per_connection": kbps,
                    "profile_latency_ms": latency_ms,
                    "outcome": outcome,
                }), flush=True)

        def finish_headers(self):
            self.send_header("Cache-Control", "no-store, no-cache, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()

        def empty_response(self, status, extra=None):
            self.send_response(status)
            self.send_header("Content-Length", "0")
            for name, value in (extra or {}).items():
                self.send_header(name, value)
            self.finish_headers()

    return ThrottledHandler


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--root", type=Path, default=Path("dist"))
    parser.add_argument("--port", type=int, default=4184)
    parser.add_argument("--kbps", type=float, default=1600, help="Decimal kilobits per second per connection (default: 1600)")
    parser.add_argument("--latency-ms", type=float, default=150, help="Added delay before response headers (default: 150)")
    args = parser.parse_args()
    if (not 0 <= args.port <= 65535 or not math.isfinite(args.kbps)
            or not math.isfinite(args.latency_ms) or args.kbps <= 0
            or args.latency_ms < 0):
        parser.error("Use port 0..65535, positive kbps, and non-negative latency")
    if not args.root.is_dir():
        parser.error(f"Preview root does not exist: {args.root}. Run npm run build first.")
    handler = make_handler(args.root, args.kbps, args.latency_ms)
    with ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
        print(json.dumps({"url": f"http://127.0.0.1:{server.server_port}", "root": str(args.root.resolve()), "kbps_per_connection": args.kbps, "latency_ms": args.latency_ms, "note": "Network transfer profile only; no CPU/GPU throttle or physical-phone claim."}), flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
