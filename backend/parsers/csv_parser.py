import csv
from io import StringIO

def parse_csv(content: bytes) -> str:
    text = content.decode("utf-8-sig", errors="replace")
    try: dialect = csv.Sniffer().sniff(text[:4096])
    except csv.Error: dialect = csv.excel
    return "\n".join(" | ".join(cell.strip() for cell in row) for row in csv.reader(StringIO(text), dialect))

