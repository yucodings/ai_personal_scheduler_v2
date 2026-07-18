import json

def parse_text(content: bytes, extension: str = ".txt") -> str:
    text = content.decode("utf-8-sig", errors="replace").replace("\x00", "")
    if extension == ".json":
        try: return json.dumps(json.loads(text), indent=2, ensure_ascii=False)
        except json.JSONDecodeError as exc: raise ValueError("Invalid JSON document") from exc
    return text

