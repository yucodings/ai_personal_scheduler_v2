#!/usr/bin/env python3
from __future__ import annotations
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.config import get_settings

def main() -> int:
    settings = get_settings(); failures = 0
    for capability in ("auth", "supabase", "ai", "telegram", "cron"):
        missing = settings.missing_for(capability)
        if missing: print(f"[missing] {capability}: {', '.join(missing)}"); failures += 1
        else: print(f"[ready]   {capability}")
    print(f"[info]    timezone: {settings.app_timezone}")
    print("No secret values were printed.")
    return 1 if failures else 0

if __name__ == "__main__": raise SystemExit(main())
