import json
import logging
import re
from typing import Any

logger = logging.getLogger("skyler")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(message)s")

_SECRET_KEYS = re.compile(r"(secret|token|password|api[_-]?key|authorization|cookie)", re.IGNORECASE)


def safe_log(event: str, **fields: Any) -> None:
    cleaned = {key: "[REDACTED]" if _SECRET_KEYS.search(key) else value for key, value in fields.items()}
    logger.info(json.dumps({"event": event, **cleaned}, default=str, ensure_ascii=True))

