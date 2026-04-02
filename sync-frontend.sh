#!/bin/bash
# Syncs src/ from Desktop/wis/wis-frontend to frontend/src/
# Excludes layout.tsx to preserve meta tags, fonts and SEO config.

SRC=~/Desktop/wis/wis-frontend/src
DEST=~/wis-agency/frontend/src
PROTECTED="$DEST/app/layout.tsx"

# Backup layout.tsx
TMP=$(mktemp)
cp "$PROTECTED" "$TMP"

# Copy everything
cp -r "$SRC/." "$DEST/"

# Restore layout.tsx
cp "$TMP" "$PROTECTED"
rm "$TMP"

echo "Sync done. layout.tsx preserved."
