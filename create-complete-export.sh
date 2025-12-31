#!/bin/bash
# Create a complete database export with schema + data
# This creates a single file that can be imported in one command

set -e

echo "Creating complete database export..."

# Load .env if it exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)
fi

# Create combined export
OUTPUT_FILE="database-exports/complete-with-schema.sql"

echo "Combining schema.sql and all-data.sql into $OUTPUT_FILE"

# Start with schema
cat database-exports/schema.sql > "$OUTPUT_FILE"

# Add separator
echo "" >> "$OUTPUT_FILE"
echo "-- ================================================" >> "$OUTPUT_FILE"
echo "-- DATA IMPORT SECTION" >> "$OUTPUT_FILE"
echo "-- ================================================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Append data (skip the header if it has one)
tail -n +18 database-exports/all-data.sql >> "$OUTPUT_FILE"

SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
echo "Complete export created: $OUTPUT_FILE ($SIZE)"
echo "You can now import this single file to restore everything."






