#!/usr/bin/env python3
from __future__ import annotations

import getpass
import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.auth_service import hash_password


def main() -> int:
    print("Skyler secret generator — values are printed once and are not written to disk.\n")
    password = getpass.getpass("Desired login password (10+ characters): ")
    confirmation = getpass.getpass("Confirm password: ")
    if password != confirmation:
        print("Passwords do not match.", file=sys.stderr); return 1
    try: encoded = hash_password(password)
    except ValueError as exc: print(str(exc), file=sys.stderr); return 1
    print("\nCopy these values into .env.local and Vercel. Keep them private:\n")
    print(f"APP_LOGIN_PASSWORD_HASH={encoded}")
    print(f"JWT_SECRET={secrets.token_urlsafe(48)}")
    print(f"CRON_SECRET={secrets.token_urlsafe(36)}")
    print(f"TELEGRAM_WEBHOOK_SECRET={secrets.token_urlsafe(36)}")
    return 0


if __name__ == "__main__": raise SystemExit(main())

