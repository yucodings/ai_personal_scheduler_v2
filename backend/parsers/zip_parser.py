from __future__ import annotations
import re
import zipfile
from io import BytesIO
from pathlib import PurePosixPath

TEXT_EXTENSIONS = {".txt", ".md", ".rst", ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".kt", ".dart", ".go", ".rs", ".c", ".h", ".cpp", ".cs", ".sql", ".html", ".css", ".scss", ".sh", ".ps1"}
IGNORED_PARTS = {"node_modules", ".git", "dist", "build", ".next", "vendor", "__pycache__", ".venv", "venv", "coverage"}
SECRET_PATTERNS = [re.compile(r"(?i)(api[_-]?key|secret|token|password)\s*[:=]\s*['\"]?[^\s'\"]{8,}"), re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"), re.compile(r"\b(?:sk|tp)-[A-Za-z0-9_-]{16,}\b")]

def inspect_zip(content: bytes, max_files: int = 200, max_uncompressed_mb: int = 50, max_compressed_mb: int = 25) -> str:
    if len(content) > max_compressed_mb * 1024 * 1024: raise ValueError("ZIP compressed size exceeds the configured limit")
    try: archive = zipfile.ZipFile(BytesIO(content))
    except zipfile.BadZipFile as exc: raise ValueError("Invalid ZIP archive") from exc
    infos = archive.infolist()
    if len(infos) > max_files: raise ValueError("ZIP contains too many files")
    if sum(info.file_size for info in infos) > max_uncompressed_mb * 1024 * 1024: raise ValueError("ZIP uncompressed size exceeds the configured limit")
    safe_files = []
    for info in infos:
        path = PurePosixPath(info.filename.replace("\\", "/"))
        if path.is_absolute() or ".." in path.parts: raise ValueError("ZIP path traversal detected")
        if not info.is_dir() and not any(part in IGNORED_PARTS for part in path.parts) and path.suffix.lower() in TEXT_EXTENSIONS: safe_files.append((info, path))
    stack = detect_stack([str(path) for _, path in safe_files]); output = ["[Safe ZIP inspection]", f"Files in archive: {len(infos)}", f"Readable source/text files: {len(safe_files)}", f"Detected stack: {', '.join(stack) if stack else 'Unknown'}", "", "[File tree]"]
    output.extend(str(path) for _, path in safe_files); output.append("\n[Important file contents]")
    important = sorted(safe_files, key=lambda pair: (0 if pair[1].name.lower().startswith(("readme", "package.json", "pyproject", "requirements")) else 1, pair[0].file_size))[:40]
    for info, path in important:
        if info.file_size <= 512_000: output.append(f"\n--- {path} ---\n{redact_secrets(archive.read(info).decode('utf-8', errors='replace').replace(chr(0), '')[:20000])}")
    archive.close(); return "\n".join(output)

def redact_secrets(text: str) -> str:
    for pattern in SECRET_PATTERNS: text = pattern.sub("[REDACTED POTENTIAL SECRET]", text)
    return text

def detect_stack(paths: list[str]) -> list[str]:
    joined = "\n".join(paths).lower(); stack = []
    for marker, name in [("package.json", "Node.js/JavaScript"), ("next.config", "Next.js"), ("requirements.txt", "Python"), ("pyproject.toml", "Python"), ("pubspec.yaml", "Flutter/Dart"), ("cargo.toml", "Rust"), ("go.mod", "Go"), ("pom.xml", "Java/Maven")]:
        if marker in joined: stack.append(name)
    return list(dict.fromkeys(stack))

