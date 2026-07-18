#!/usr/bin/env python3
from __future__ import annotations
import argparse
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.telegram_client import TelegramClient

def main() -> int:
    parser = argparse.ArgumentParser(description="Register Skyler's Telegram webhook")
    parser.add_argument("app_url", help="Production HTTPS base URL, e.g. https://skyler.vercel.app")
    args = parser.parse_args(); url = args.app_url.rstrip("/") + "/api/telegram/webhook"
    result = TelegramClient().set_webhook(url)
    print("Webhook registered." if result.get("ok") else f"Telegram rejected the webhook: {result.get('description', 'unknown error')}")
    return 0 if result.get("ok") else 1

if __name__ == "__main__": raise SystemExit(main())

