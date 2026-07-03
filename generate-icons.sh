#!/usr/bin/env bash
# generate-icons.sh — Convert the SVG icon to PNG at required sizes.
# Requires: ImageMagick (convert) or rsvg-convert
# macOS:  brew install imagemagick
# Ubuntu: sudo apt install imagemagick
# Windows: choco install imagemagick

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SVG="$SCRIPT_DIR/assets/icons/icon.svg"
OUT="$SCRIPT_DIR/assets/icons"

echo "Generating PNG icons from $SVG …"

for SIZE in 16 32 48 128; do
  if command -v magick &>/dev/null; then
    # ImageMagick v7
    magick -background none "$SVG" -resize "${SIZE}x${SIZE}" "$OUT/icon${SIZE}.png"
  elif command -v convert &>/dev/null; then
    # ImageMagick v6
    convert -background none "$SVG" -resize "${SIZE}x${SIZE}" "$OUT/icon${SIZE}.png"
  elif command -v rsvg-convert &>/dev/null; then
    rsvg-convert -w "$SIZE" -h "$SIZE" -f png -o "$OUT/icon${SIZE}.png" "$SVG"
  else
    echo "ERROR: No suitable converter found. Install ImageMagick or librsvg."
    exit 1
  fi
  echo "  ✓ icon${SIZE}.png"
done

echo "Done! Icons are in $OUT/"
