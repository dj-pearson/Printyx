#!/usr/bin/env bash
#
# frame-screenshots.sh - Add text overlays and promotional formatting
#
# Takes raw screenshots and creates store-ready promotional images with:
#   - App headline text overlay at the top
#   - Screenshot centered below the text
#   - Branded background color
#   - Proper export dimensions for each platform
#
# Prerequisites:
#   brew install imagemagick
#
# Usage:
#   ./scripts/frame-screenshots.sh              # Process all
#   ./scripts/frame-screenshots.sh --ios        # iOS only
#   ./scripts/frame-screenshots.sh --android    # Android only
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SCREENSHOTS_DIR="$PROJECT_DIR/screenshots"
FRAMED_DIR="$PROJECT_DIR/screenshots/framed"

# Printyx brand colors
BG_COLOR="#f0f5ff"       # Light blue background
TEXT_COLOR="#1e3a8a"     # Dark blue text
ACCENT_COLOR="#3b82f6"   # Primary blue

# ─────────────────────────────────────────────────────────────────────────────
# Screen descriptions for text overlays
# ─────────────────────────────────────────────────────────────────────────────

declare -A SCREEN_HEADLINES=(
  ["01-login"]="Secure Login"
  ["02-signup"]="Get Started in Minutes"
  ["03-dashboard"]="Your Business at a Glance"
  ["04-crm-hub"]="Complete CRM Hub"
  ["05-leads-list"]="Manage Leads Effortlessly"
  ["06-customers"]="Customer Management"
  ["07-contacts"]="All Contacts, One Tap"
  ["08-deals-pipeline"]="Visual Deal Pipeline"
  ["09-service-hub"]="Service Command Center"
  ["10-service-tickets"]="Track Every Ticket"
  ["11-service-dispatch"]="Smart Dispatch Routing"
  ["12-field-service"]="Field Service, Anywhere"
  ["13-equipment-list"]="Equipment at Your Fingertips"
  ["14-reports"]="Powerful Analytics"
  ["15-settings"]="Full Control"
)

declare -A SCREEN_SUBTITLES=(
  ["01-login"]="Biometric & password authentication"
  ["02-signup"]="Create your account and start managing"
  ["03-dashboard"]="Real-time KPIs and quick actions"
  ["04-crm-hub"]="Leads, customers, contacts & deals"
  ["05-leads-list"]="Search, filter, and qualify leads"
  ["06-customers"]="Active accounts with full history"
  ["07-contacts"]="Call, email, or text directly"
  ["08-deals-pipeline"]="Track progress from prospect to close"
  ["09-service-hub"]="Tickets, dispatch & field ops"
  ["10-service-tickets"]="Filter by status, priority & tech"
  ["11-service-dispatch"]="Assign and route technicians"
  ["12-field-service"]="Time tracking & service completion"
  ["13-equipment-list"]="Barcode scan and device lookup"
  ["14-reports"]="Sales, service & financial insights"
  ["15-settings"]="Profile, notifications & security"
)

# ─────────────────────────────────────────────────────────────────────────────
# Framing Functions
# ─────────────────────────────────────────────────────────────────────────────

check_imagemagick() {
  if ! command -v magick &>/dev/null && ! command -v convert &>/dev/null; then
    echo "Error: ImageMagick is required. Install with: brew install imagemagick"
    exit 1
  fi
}

get_convert_cmd() {
  if command -v magick &>/dev/null; then
    echo "magick"
  else
    echo "convert"
  fi
}

frame_screenshot() {
  local input_file="$1"
  local output_file="$2"
  local canvas_width="$3"
  local canvas_height="$4"
  local headline="$5"
  local subtitle="$6"

  local convert_cmd
  convert_cmd=$(get_convert_cmd)

  # Calculate layout
  local text_area_height=$(( canvas_height * 20 / 100 ))  # 20% for text
  local screenshot_area_height=$(( canvas_height - text_area_height - 40 ))  # 40px padding
  local screenshot_width=$(( canvas_width * 80 / 100 ))  # 80% width
  local headline_size=$(( canvas_width / 20 ))
  local subtitle_size=$(( canvas_width / 32 ))

  # Get input dimensions
  local input_dims
  input_dims=$($convert_cmd "$input_file" -format "%wx%h" info:)
  local input_w="${input_dims%x*}"
  local input_h="${input_dims#*x}"

  # Calculate scaled screenshot size (fit within area, maintain aspect ratio)
  local scale_w=$(( screenshot_width ))
  local scale_h=$(( screenshot_area_height ))
  local ratio_w=$(( scale_w * 1000 / input_w ))
  local ratio_h=$(( scale_h * 1000 / input_h ))
  local ratio=$ratio_w
  if (( ratio_h < ratio_w )); then
    ratio=$ratio_h
  fi
  local final_w=$(( input_w * ratio / 1000 ))
  local final_h=$(( input_h * ratio / 1000 ))

  # Create framed image
  $convert_cmd \
    -size "${canvas_width}x${canvas_height}" "xc:${BG_COLOR}" \
    \( "$input_file" -resize "${final_w}x${final_h}" \
       -background none \
       \( +clone -shadow 40x12+0+8 \) +swap -layers merge \
       -bordercolor none -border 4 \
    \) \
    -gravity south -geometry "+0+20" -composite \
    -gravity north \
    -fill "$TEXT_COLOR" \
    -font "Helvetica-Bold" -pointsize "$headline_size" \
    -annotate "+0+$(( text_area_height * 25 / 100 ))" "$headline" \
    -fill "${TEXT_COLOR}99" \
    -font "Helvetica" -pointsize "$subtitle_size" \
    -annotate "+0+$(( text_area_height * 25 / 100 + headline_size + 10 ))" "$subtitle" \
    -quality 95 \
    "$output_file"
}

process_directory() {
  local platform="$1"     # ios or android
  local device_key="$2"   # e.g., iphone-6.9, phone
  local canvas_width="$3"
  local canvas_height="$4"

  local source_dir="$SCREENSHOTS_DIR/$platform/store/$device_key"
  local target_dir="$FRAMED_DIR/$platform/$device_key"

  if ! ls "$source_dir"/*.png &>/dev/null 2>&1; then
    echo "  No screenshots found in $source_dir. Skipping."
    return 0
  fi

  mkdir -p "$target_dir"

  local count=0
  for img in "$source_dir"/*.png; do
    local basename
    basename=$(basename "$img" .png)

    local headline="${SCREEN_HEADLINES[$basename]:-Printyx}"
    local subtitle="${SCREEN_SUBTITLES[$basename]:-AI-Powered Copier Dealer Management}"

    echo "  Framing: $basename -> ${canvas_width}x${canvas_height}"
    frame_screenshot "$img" "$target_dir/${basename}-framed.png" "$canvas_width" "$canvas_height" "$headline" "$subtitle"
    (( count++ )) || true
  done

  echo "  -> $count framed screenshots in $target_dir/"
}

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

main() {
  local RUN_IOS=true
  local RUN_ANDROID=true

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --ios) RUN_IOS=true; RUN_ANDROID=false ;;
      --android) RUN_IOS=false; RUN_ANDROID=true ;;
      --help|-h)
        echo "Usage: $0 [--ios|--android]"
        echo "Adds text overlays and branding to raw screenshots."
        exit 0
        ;;
    esac
    shift
  done

  check_imagemagick

  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "  PRINTYX SCREENSHOT FRAMING"
  echo "═══════════════════════════════════════════════════════════"
  echo ""

  mkdir -p "$FRAMED_DIR"

  if [[ "$RUN_IOS" == true ]]; then
    echo "Processing iOS screenshots..."
    echo ""
    # iPhone 16 Pro Max (6.9") - REQUIRED
    process_directory "ios" "iphone-6.9" 1320 2868
    # iPad Pro 13" - REQUIRED
    process_directory "ios" "ipad-13" 2064 2752
    # iPhone 15 Pro Max (6.7") - Optional
    process_directory "ios" "iphone-6.7" 1290 2796
    # iPhone 14 Plus (6.5") - Optional
    process_directory "ios" "iphone-6.5" 1284 2778
    echo ""
  fi

  if [[ "$RUN_ANDROID" == true ]]; then
    echo "Processing Android screenshots..."
    echo ""
    # Phone (9:16)
    process_directory "android" "phone" 1080 1920
    # 7" Tablet
    process_directory "android" "tablet-7" 1200 1920
    # 10" Tablet
    process_directory "android" "tablet-10" 1600 2560
    echo ""
  fi

  echo "═══════════════════════════════════════════════════════════"
  echo "  DONE"
  echo "═══════════════════════════════════════════════════════════"
  echo ""
  echo "Framed screenshots: $FRAMED_DIR/"
  echo ""
  echo "Upload to:"
  echo "  Apple:  App Store Connect -> App Information -> Screenshots"
  echo "  Google: Play Console -> Store Listing -> Graphic Assets"
  echo ""
}

main "$@"
