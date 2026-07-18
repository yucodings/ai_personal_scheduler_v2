#!/usr/bin/env python3
from __future__ import annotations
import argparse
import os
import sys
from pathlib import Path
import requests

def main() -> int:
    parser = argparse.ArgumentParser(description="Print or apply the optional Skyler demo seed")
    parser.add_argument("--apply", action="store_true", help="Apply using SUPABASE_DB_URL via psql")
    args = parser.parse_args(); root = Path(__file__).resolve().parents[1]; seed = root / "supabase" / "seed.sql"
    if not args.apply: print(seed.read_text(encoding="utf-8")); return 0
    database_url = os.getenv("SUPABASE_DB_URL")
    if not database_url: print("SUPABASE_DB_URL is required for --apply", file=sys.stderr); return 1
    import subprocess
    return subprocess.run(["psql", database_url, "-v", "ON_ERROR_STOP=1", "-f", str(seed)], check=False).returncode

if __name__ == "__main__": raise SystemExit(main())

