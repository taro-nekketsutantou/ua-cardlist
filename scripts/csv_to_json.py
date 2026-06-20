import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IN_CSV = ROOT / "data" / "cards.csv"
OUT_JSON = ROOT / "cards.json"
IMAGE_BASE = "https://www.unionarena-tcg.com/jp/images/cardlist/card/"

COLOR_LETTER_MAP = {
    "B": "Blue",
    "R": "Red",
    "Y": "Yellow",
    "G": "Green",
    "P": "Purple",
    "W": "White",
    "K": "Black",
}

INT_FIELDS = {"energy_required", "ap", "bp", "energy_count"}
BOOL_FIELDS = {"energy_has_plus"}
NULL_STRINGS = {"", "null", "None", "NULL", "-"}


def clean(value):
    if value is None:
        return None
    value = str(value).strip()
    if value in NULL_STRINGS:
        return None
    return value


def parse_int(value):
    value = clean(value)
    if value is None:
        return None
    return int(float(value))


def parse_bool(value):
    value = clean(value)
    if value is None:
        return None
    return value.lower() in {"true", "yes", "y", "1"}


def parse_energy(raw):
    raw = clean(raw) or ""
    s = raw.upper()
    has_plus = "+" in s
    letters = [ch for ch in s.replace("+", "") if ch.isalpha()]
    colors = []
    for ch in letters:
        color = COLOR_LETTER_MAP.get(ch, ch)
        if color not in colors:
            colors.append(color)
    return {
        "energy_generated_raw": raw or None,
        "energy_colors": colors,
        "energy_count": len(letters),
        "energy_has_plus": has_plus,
    }


def convert_row(row):
    out = {}
    for key, value in row.items():
        key = key.strip()
        if not key:
            continue
        if key in INT_FIELDS:
            out[key] = parse_int(value)
        elif key in BOOL_FIELDS:
            out[key] = parse_bool(value)
        else:
            out[key] = clean(value)

    out["id"] = out.get("id") or f'{out["series"]}_{out["card_number"]}'
    out["image_url"] = out.get("image_url") or f'{IMAGE_BASE}{out["id"]}.png'

    parsed_energy = parse_energy(out.get("energy_generated_raw"))
    # Derived values override blank manual fields, but preserve explicit nonblank values.
    out["energy_generated_raw"] = out.get("energy_generated_raw") or parsed_energy["energy_generated_raw"]
    out["energy_colors"] = parsed_energy["energy_colors"]
    out["energy_count"] = out.get("energy_count") if out.get("energy_count") is not None else parsed_energy["energy_count"]
    out["energy_has_plus"] = out.get("energy_has_plus") if out.get("energy_has_plus") is not None else parsed_energy["energy_has_plus"]
    return out


def main():
    with IN_CSV.open("r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    cards = [convert_row(row) for row in rows]
    ids = [c["id"] for c in cards]
    duplicates = sorted({x for x in ids if ids.count(x) > 1})
    if duplicates:
        raise SystemExit(f"Duplicate card IDs: {duplicates[:10]}")

    OUT_JSON.write_text(json.dumps(cards, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(cards)} cards to {OUT_JSON}")


if __name__ == "__main__":
    main()
