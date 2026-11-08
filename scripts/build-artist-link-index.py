"""Build the small client-side identity index from restored artist profiles."""
import json
import unicodedata
from pathlib import Path
from urllib.parse import quote
root = Path(__file__).resolve().parents[1]
profiles = json.loads((root / "src/data/artist-profiles.json").read_text())["profiles"]
def normalize(value):
    return unicodedata.normalize("NFKC", value).strip().lower()
aliases = {}
for p in profiles:
    for alias in [p["username"], *p["aliases"]]:
        if alias:
            aliases.setdefault(normalize(alias), set()).add(p["address"])
records = {x["id"]: x for x in json.loads((root / "src/data/archive-index.json").read_text())["records"]}
entries = []
for p in profiles:
    slug = p["username"] if p["username"] and len(aliases[normalize(p["username"])]) == 1 else p["address"]
    historical_names = [records[w["recordId"]]["artist"] for w in p["works"] if w["basis"] == "archive-credit" and w["recordId"] in records]
    entries.append({"address":p["address"], "href":"/artists/"+quote(slug,safe=""), "names":list(dict.fromkeys(x for x in [p["name"],p["username"],*p["aliases"],*historical_names] if x))})
(root / "src/data/artist-link-index.json").write_text(json.dumps(entries, ensure_ascii=False, indent=2)+"\n")
print(f"Indexed {len(entries)} restored artist identities")
