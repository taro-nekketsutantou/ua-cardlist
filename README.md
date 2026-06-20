# Union Arena Translation Cardlist

Static GitHub Pages starter for a Union Arena cardlist translation site.

## What it includes

- Left sidebar filters
- Middle virtualized card-image grid for large datasets
- Right details panel for selected card
- External official image URL generation
- CSV -> JSON converter script

## Quick start

Open `index.html` locally, or push these files to a GitHub Pages repository.

The app loads `cards.json` from the same folder as `index.html`.

## Data workflow

Edit `data/cards.csv`, then run:

```bash
python3 scripts/csv_to_json.py
```

This regenerates `cards.json`.

## Image URL rule

Images are generated as:

```text
https://www.unionarena-tcg.com/jp/images/cardlist/card/{series}_{card_number}.png
```

Example:

```text
UA54BT + MST-1-001 -> https://www.unionarena-tcg.com/jp/images/cardlist/card/UA54BT_MST-1-001.png
```

## Suggested GitHub Pages setup

For the simplest setup, put `index.html`, `app.js`, `styles.css`, and `cards.json` at the root of your repo.

Then go to:

```text
Repo Settings -> Pages -> Deploy from branch -> main -> /root
```
