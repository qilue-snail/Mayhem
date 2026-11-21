#!/usr/bin/env python3
"""Refresh the CURRENT ARAM: Mayhem (KIWI) augment pool from Riot game files.

Standard library only. Intended for GitHub Actions on a scheduled basis.
No match statistics or patch-note scraping. Keeps the last good snapshot on error.
"""
from __future__ import annotations
import datetime as dt
import json
import re
import sys
import unicodedata
from pathlib import Path
from urllib.request import Request, urlopen

BASE = "https://raw.communitydragon.org/latest"
GAME = f"{BASE}/plugins/rcp-be-lol-game-data/global/default"
LISTS = f"{GAME}/v1/augment-lists.json"
CHERRY = f"{GAME}/v1/cherry-augments.json"
ARENA = f"{BASE}/cdragon/arena/en_us.json"
VERSIONS = "https://ddragon.leagueoflegends.com/api/versions.json"
ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "data" / "live-augments.json"
RARITY = {"ksilver": "silver", "kgold": "gold", "kprismatic": "prismatic"}


def fetch_json(url: str):
    req = Request(url, headers={"User-Agent": "MayhemLibraryUpdater/2.0 (scheduled personal static site)"})
    with urlopen(req, timeout=30) as r:
        if r.status != 200:
            raise ValueError(f"{url}: HTTP {r.status}")
        return json.load(r)


def key(name: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", str(name)).casefold() if c.isalnum())


def slug(name: str) -> str:
    norm = unicodedata.normalize("NFKD", str(name)).lower()
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", norm))


def clean_text(source: str) -> str:
    # Do not pretend to resolve dynamic @StatValue@ references: show descriptive text only.
    text = re.sub(r"<br\s*/?>", " ", str(source or ""), flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"@[^@]*@", "…", text)
    return " ".join(text.split())[:900]


def asset_url(path: str) -> str:
    s = str(path or "")
    if not s: return ""
    if s.lower().startswith("/lol-game-data/assets/"):
        s = s[len("/lol-game-data/assets/"):]
    elif s.lower().startswith("assets/"):
        s = s[len("assets/"):]
    return f"{GAME}/{s.lower().lstrip('/')}"


def normalize_kiwi(lists, cherry, arena=None, old=None) -> list[dict]:
    """Accept only mode KIWI; never accidentally import the larger Arena catalog."""
    if not isinstance(lists, list) or not isinstance(cherry, list):
        raise ValueError("Unexpected CommunityDragon augment-list format")
    kiwi = next((v for v in lists if str(v.get("modeName", "")).upper() == "KIWI"), None)
    if not kiwi or not isinstance(kiwi.get("augmentList"), list):
        raise ValueError("The KIWI (ARAM Mayhem) pool is missing")
    refs = kiwi["augmentList"]
    if not 150 <= len(refs) <= 550:
        raise ValueError(f"Implausible KIWI pool size: {len(refs)}")

    by_name_id = {str(v.get("augmentNameId", "")).casefold(): v for v in cherry if v.get("augmentNameId")}
    arena_desc = {}
    if isinstance(arena, dict) and isinstance(arena.get("augments"), list):
        arena_desc = {key(a.get("name", "")): a for a in arena["augments"] if a.get("name")}
    prior = {key(a.get("name", "")): a for a in (old or {}).get("augments", []) if a.get("name")}
    output = {}
    missing = []
    for ref in refs:
        name_id = str(ref).rsplit("/", 1)[-1]
        row = by_name_id.get(name_id.casefold())
        if not row:
            missing.append(name_id)
            continue
        name = str(row.get("nameTRA") or "").strip()
        rarity = RARITY.get(str(row.get("rarity", "")).casefold())
        if not name or rarity is None:
            missing.append(name_id)
            continue
        k = key(name)
        previous = prior.get(k, {})
        extra = arena_desc.get(k, {})
        entry = {
            "id": slug(name), "name": name, "rarity": rarity,
            "description": (previous.get("description") or clean_text(extra.get("desc") or extra.get("tooltip")) or ""),
            "imageUrl": asset_url(row.get("augmentSmallIconPath") or extra.get("iconSmall")),
            "source": "CommunityDragon KIWI",
        }
        if previous.get("introducedPatch"):
            entry["introducedPatch"] = previous["introducedPatch"]
        if previous.get("availableFromPatch"):
            entry["availableFromPatch"] = previous["availableFromPatch"]
        output[k] = entry
    if len(output) < 150 or len(output) < len(refs) * .85:
        raise ValueError(f"Only {len(output)}/{len(refs)} KIWI entries resolved; preserving old snapshot")
    if missing:
        print(f"Warning: skipped {len(missing)} missing KIWI identifiers", file=sys.stderr)
    return sorted(output.values(), key=lambda a: a["name"].casefold())


def patch_from_ddragon(version):
    # Riot's Data Dragon can report e.g. 16.23.1 for patch year 2026;
    # preserve the literal game version as canonical metadata.
    try:
        a, b = str(version).split(".")[:2]
        major, minor = int(a), int(b)
        if 15 <= major <= 19 and 0 <= minor <= 30:
            return f"{major + 10}.{minor:02d}"
    except (ValueError, TypeError):
        pass
    return None


def make_snapshot(lists, cherry, arena=None, old=None, version=None):
    rows = normalize_kiwi(lists, cherry, arena=arena, old=old)
    new = {
        "schemaVersion": 2,
        "source": "Riot KIWI augment pool via CommunityDragon",
        "sourceUrls": [LISTS, CHERRY],
        "augments": rows,
    }
    if version:
        new["gameVersion"] = version
        patch = patch_from_ddragon(version)
        if patch: new["patch"] = patch
    # Preserve patch when the latest Riot version endpoint is unavailable.
    elif old and old.get("patch"):
        new["patch"] = old["patch"]
    return new


def main():
    old = json.loads(TARGET.read_text(encoding="utf-8")) if TARGET.exists() else {}
    lists = fetch_json(LISTS)
    cherry = fetch_json(CHERRY)
    try:
        arena = fetch_json(ARENA)
    except Exception as exc:
        print(f"Optional Arena descriptions unavailable: {exc}", file=sys.stderr)
        arena = None
    try:
        versions = fetch_json(VERSIONS)
        version = str(versions[0]) if isinstance(versions, list) and versions else None
    except Exception:
        version = None
    new = make_snapshot(lists, cherry, arena=arena, old=old, version=version)
    # Keep generatedAt stable when nothing changed to avoid pointlessly committing twice a day.
    if {k: v for k, v in new.items() if k != "generatedAt"} == {k: v for k, v in old.items() if k != "generatedAt"}:
        print(f"Roster unchanged: {len(new['augments'])} augments")
        return
    new["generatedAt"] = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(json.dumps(new, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(new['augments'])} active KIWI augments to {TARGET}")


if __name__ == "__main__":
    main()
