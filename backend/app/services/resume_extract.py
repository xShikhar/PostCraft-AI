"""Bounded child process for untrusted document extraction (no persistent files)."""
import sys


def main():
    try:
        if sys.platform != "win32":
            import resource
            resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
            resource.setrlimit(resource.RLIMIT_CPU, (10, 10))
        from app.services.resume import extract_text
        data = sys.stdin.buffer.read(5 * 1024 * 1024 + 1)
        result = extract_text(data, sys.argv[2], sys.argv[1])
        sys.stdout.buffer.write(result.encode("utf-8"))
    except Exception:
        sys.stderr.write("Resume extraction failed")
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
