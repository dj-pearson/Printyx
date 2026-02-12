#!/usr/bin/env bash
#
# screenshots.sh - Automated App Store & Google Play Screenshot Capture
#
# Captures all required screenshots for Apple App Store and Google Play Store
# submissions using Maestro UI automation across all required device sizes.
#
# Prerequisites:
#   - macOS (required for iOS simulators)
#   - Xcode 16+ with simulators installed
#   - Android Studio with emulators configured
#   - Maestro CLI: curl -Ls "https://get.maestro.mobile.dev" | bash
#   - Expo dev build installed on simulators/emulators
#   - ImageMagick (optional, for post-processing): brew install imagemagick
#
# Usage:
#   ./scripts/screenshots.sh              # Capture all (iOS + Android)
#   ./scripts/screenshots.sh --ios        # iOS only
#   ./scripts/screenshots.sh --android    # Android only
#   ./scripts/screenshots.sh --clean      # Delete previous screenshots
#   ./scripts/screenshots.sh --frames     # Add device frames after capture
#
# Environment Variables:
#   TEST_EMAIL       - Login email for screenshot account (default: screenshots@printyx.net)
#   TEST_PASSWORD    - Login password (default: Screenshots2024!)
#   SKIP_FRAMES      - Set to 1 to skip device framing step
#

set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
FLOWS_DIR="$SCRIPT_DIR/maestro/flows"
OUTPUT_BASE="$PROJECT_DIR/screenshots"

# Test account credentials
export TEST_EMAIL="${TEST_EMAIL:-screenshots@printyx.net}"
export TEST_PASSWORD="${TEST_PASSWORD:-Screenshots2024!}"

APP_ID="com.printyx.app"

# ─────────────────────────────────────────────────────────────────────────────
# Screenshot Size Definitions
#
# Apple App Store (2025-2026):
#   Required: 6.9" iPhone (1320x2868) + 13" iPad (2064x2752)
#   Optional: 6.7" (1290x2796), 6.5" (1284x2778), 5.5" (1242x2208)
#
# Google Play Store:
#   Phone: 1080x1920 (9:16 portrait)
#   7" Tablet: 1200x1920
#   10" Tablet: 1600x2560
# ─────────────────────────────────────────────────────────────────────────────

# iOS Simulators - device name as it appears in `xcrun simctl list devices`
declare -A IOS_DEVICES=(
  ["iphone-6.9"]="iPhone 16 Pro Max"
  ["iphone-6.7"]="iPhone 15 Pro Max"
  ["iphone-6.5"]="iPhone 14 Plus"
  ["ipad-13"]="iPad Pro 13-inch (M4)"
)

# Expected screenshot dimensions per iOS device
declare -A IOS_DIMENSIONS=(
  ["iphone-6.9"]="1320x2868"
  ["iphone-6.7"]="1290x2796"
  ["iphone-6.5"]="1284x2778"
  ["ipad-13"]="2064x2752"
)

# Android Emulators - AVD name as listed by `emulator -list-avds`
declare -A ANDROID_DEVICES=(
  ["phone"]="Pixel_8_Pro_API_35"
  ["tablet-7"]="Nexus_7_API_35"
  ["tablet-10"]="Pixel_Tablet_API_35"
)

# Expected screenshot dimensions per Android device
declare -A ANDROID_DIMENSIONS=(
  ["phone"]="1080x2340"
  ["tablet-7"]="1200x1920"
  ["tablet-10"]="1600x2560"
)

# Google Play requires exact aspect ratios - we resize if needed
GOOGLE_PHONE_TARGET="1080x1920"
GOOGLE_TABLET7_TARGET="1200x1920"
GOOGLE_TABLET10_TARGET="1600x2560"

# Screens to capture (flow files, in order)
SCREEN_FLOWS=(
  "01-auth-login"
  "02-auth-signup"
  "03-login-and-dashboard"
  "04-crm-hub"
  "05-crm-leads"
  "06-crm-customers"
  "07-crm-contacts"
  "08-crm-deals"
  "09-service-hub"
  "10-service-tickets"
  "11-service-dispatch"
  "12-field-service"
  "13-equipment"
  "14-reports"
  "15-settings"
)

# Screens recommended for store listing (subset of above)
# These are the key screens that best represent the app
STORE_LISTING_SCREENS=(
  "03-dashboard"
  "05-leads-list"
  "10-service-tickets"
  "12-field-service"
  "13-equipment-list"
  "14-reports"
  "08-deals-pipeline"
  "15-settings"
)

# ─────────────────────────────────────────────────────────────────────────────
# Colors & Logging
# ─────────────────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log()   { echo -e "${BLUE}[screenshots]${NC} $*"; }
info()  { echo -e "${CYAN}[info]${NC} $*"; }
ok()    { echo -e "${GREEN}[ok]${NC} $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC} $*"; }
err()   { echo -e "${RED}[error]${NC} $*" >&2; }
header(){ echo -e "\n${BOLD}═══════════════════════════════════════════════════════════${NC}"; echo -e "${BOLD}  $*${NC}"; echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}\n"; }

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

check_dependencies() {
  local missing=()

  if ! command -v maestro &>/dev/null; then
    missing+=("maestro (install: curl -Ls 'https://get.maestro.mobile.dev' | bash)")
  fi

  if [[ "$RUN_IOS" == true ]]; then
    if ! command -v xcrun &>/dev/null; then
      missing+=("Xcode CLI tools (install: xcode-select --install)")
    fi
  fi

  if [[ "$RUN_ANDROID" == true ]]; then
    if ! command -v emulator &>/dev/null; then
      missing+=("Android emulator (install via Android Studio)")
    fi
  fi

  if (( ${#missing[@]} > 0 )); then
    err "Missing required tools:"
    for tool in "${missing[@]}"; do
      err "  - $tool"
    done
    exit 1
  fi

  ok "All dependencies found"
}

ensure_output_dirs() {
  mkdir -p "$OUTPUT_BASE"/{ios,android}/{raw,store}
  mkdir -p "$OUTPUT_BASE"/ios/store/{iphone-6.9,iphone-6.7,iphone-6.5,ipad-13}
  mkdir -p "$OUTPUT_BASE"/android/store/{phone,tablet-7,tablet-10}
  ok "Output directories created at $OUTPUT_BASE/"
}

clean_screenshots() {
  if [[ -d "$OUTPUT_BASE" ]]; then
    rm -rf "$OUTPUT_BASE"
    ok "Cleaned previous screenshots"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# iOS Screenshot Capture
# ─────────────────────────────────────────────────────────────────────────────

boot_ios_simulator() {
  local device_name="$1"
  local device_udid

  # Find the device UDID
  device_udid=$(xcrun simctl list devices available -j | \
    python3 -c "
import sys, json
data = json.load(sys.stdin)
for runtime, devices in data.get('devices', {}).items():
    for d in devices:
        if d['name'] == '$device_name' and d['isAvailable']:
            print(d['udid'])
            sys.exit(0)
sys.exit(1)
" 2>/dev/null) || true

  if [[ -z "$device_udid" ]]; then
    warn "Simulator '$device_name' not found or not available. Skipping."
    return 1
  fi

  # Boot if not already booted
  local state
  state=$(xcrun simctl list devices -j | python3 -c "
import sys, json
data = json.load(sys.stdin)
for runtime, devices in data.get('devices', {}).items():
    for d in devices:
        if d['udid'] == '$device_udid':
            print(d['state'])
            sys.exit(0)
" 2>/dev/null)

  if [[ "$state" != "Booted" ]]; then
    log "Booting simulator: $device_name ($device_udid)"
    xcrun simctl boot "$device_udid" 2>/dev/null || true
    sleep 5
  else
    log "Simulator already booted: $device_name"
  fi

  # Set status bar to clean state for screenshots
  xcrun simctl status_bar "$device_udid" override \
    --time "9:41" \
    --batteryState charged \
    --batteryLevel 100 \
    --wifiBars 3 \
    --cellularBars 4 \
    --cellularMode active 2>/dev/null || true

  echo "$device_udid"
}

capture_ios_screenshots() {
  local device_key="$1"
  local device_name="${IOS_DEVICES[$device_key]}"
  local expected_dims="${IOS_DIMENSIONS[$device_key]}"
  local output_dir="$OUTPUT_BASE/ios/raw/$device_key"

  mkdir -p "$output_dir"

  header "iOS: $device_name ($device_key) - $expected_dims"

  local device_udid
  device_udid=$(boot_ios_simulator "$device_name") || return 0

  # Run all Maestro flows sequentially against this device
  log "Running Maestro flows against $device_name..."

  export MAESTRO_DEVICE_ID="$device_udid"

  for flow in "${SCREEN_FLOWS[@]}"; do
    local flow_file="$FLOWS_DIR/${flow}.yaml"
    if [[ -f "$flow_file" ]]; then
      log "  Capturing: $flow"
      maestro --device "$device_udid" test \
        --env "TEST_EMAIL=$TEST_EMAIL" \
        --env "TEST_PASSWORD=$TEST_PASSWORD" \
        --output "$output_dir" \
        "$flow_file" 2>/dev/null || warn "  Flow $flow had issues, continuing..."
    fi
  done

  # Move screenshots to store-ready directory
  local store_dir="$OUTPUT_BASE/ios/store/$device_key"
  if ls "$output_dir"/*.png &>/dev/null; then
    cp "$output_dir"/*.png "$store_dir/"
    local count
    count=$(ls -1 "$store_dir"/*.png 2>/dev/null | wc -l)
    ok "Captured $count screenshots for $device_key"
  else
    warn "No screenshots captured for $device_key"
  fi

  # Clean up status bar override
  xcrun simctl status_bar "$device_udid" clear 2>/dev/null || true
}

run_ios_screenshots() {
  header "APPLE APP STORE SCREENSHOTS"

  info "Required devices:"
  info "  - iPhone 16 Pro Max (6.9\"): 1320 x 2868 px"
  info "  - iPad Pro 13\" (M4):        2064 x 2752 px"
  info "Optional devices (auto-scaled by Apple, but good to have):"
  info "  - iPhone 15 Pro Max (6.7\"): 1290 x 2796 px"
  info "  - iPhone 14 Plus (6.5\"):    1284 x 2778 px"
  echo ""

  # Capture on each iOS device (required first, then optional)
  for device_key in "iphone-6.9" "ipad-13" "iphone-6.7" "iphone-6.5"; do
    capture_ios_screenshots "$device_key"
  done
}

# ─────────────────────────────────────────────────────────────────────────────
# Android Screenshot Capture
# ─────────────────────────────────────────────────────────────────────────────

boot_android_emulator() {
  local avd_name="$1"

  # Check if emulator is already running
  local running_device
  running_device=$(adb devices 2>/dev/null | grep "emulator-" | head -1 | awk '{print $1}') || true

  if [[ -n "$running_device" ]]; then
    log "Emulator already running: $running_device"
    echo "$running_device"
    return 0
  fi

  # Check if AVD exists
  if ! emulator -list-avds 2>/dev/null | grep -q "^${avd_name}$"; then
    warn "AVD '$avd_name' not found. Available AVDs:"
    emulator -list-avds 2>/dev/null | while read -r avd; do
      warn "  - $avd"
    done
    return 1
  fi

  log "Starting emulator: $avd_name"
  emulator -avd "$avd_name" -no-audio -no-boot-anim -no-window &
  local emu_pid=$!

  # Wait for boot
  log "Waiting for emulator to boot..."
  adb wait-for-device 2>/dev/null
  local boot_complete=""
  for i in $(seq 1 60); do
    boot_complete=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r') || true
    if [[ "$boot_complete" == "1" ]]; then
      break
    fi
    sleep 2
  done

  if [[ "$boot_complete" != "1" ]]; then
    err "Emulator failed to boot within 120 seconds"
    kill $emu_pid 2>/dev/null || true
    return 1
  fi

  sleep 3

  # Set demo mode for clean status bar
  adb shell settings put global sysui_demo_allowed 1 2>/dev/null || true
  adb shell am broadcast -a com.android.systemui.demo -e command enter 2>/dev/null || true
  adb shell am broadcast -a com.android.systemui.demo -e command clock -e hh 10 -e mm 00 2>/dev/null || true
  adb shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false 2>/dev/null || true
  adb shell am broadcast -a com.android.systemui.demo -e command network -e wifi show -e level 4 2>/dev/null || true
  adb shell am broadcast -a com.android.systemui.demo -e command network -e mobile show -e datatype none -e level 4 2>/dev/null || true
  adb shell am broadcast -a com.android.systemui.demo -e command notifications -e visible false 2>/dev/null || true

  running_device=$(adb devices 2>/dev/null | grep "emulator-" | head -1 | awk '{print $1}') || true
  echo "$running_device"
}

capture_android_screenshots() {
  local device_key="$1"
  local avd_name="${ANDROID_DEVICES[$device_key]}"
  local output_dir="$OUTPUT_BASE/android/raw/$device_key"

  mkdir -p "$output_dir"

  header "Android: $avd_name ($device_key)"

  local device_id
  device_id=$(boot_android_emulator "$avd_name") || return 0

  if [[ -z "$device_id" ]]; then
    warn "Could not start emulator for $device_key. Skipping."
    return 0
  fi

  # Run Maestro flows
  log "Running Maestro flows against $avd_name..."

  for flow in "${SCREEN_FLOWS[@]}"; do
    local flow_file="$FLOWS_DIR/${flow}.yaml"
    if [[ -f "$flow_file" ]]; then
      log "  Capturing: $flow"
      maestro --device "$device_id" test \
        --env "TEST_EMAIL=$TEST_EMAIL" \
        --env "TEST_PASSWORD=$TEST_PASSWORD" \
        --output "$output_dir" \
        "$flow_file" 2>/dev/null || warn "  Flow $flow had issues, continuing..."
    fi
  done

  # Post-process: ensure correct aspect ratio for Google Play
  local store_dir="$OUTPUT_BASE/android/store/$device_key"
  post_process_android "$device_key" "$output_dir" "$store_dir"

  # Exit demo mode
  adb shell am broadcast -a com.android.systemui.demo -e command exit 2>/dev/null || true
}

post_process_android() {
  local device_key="$1"
  local source_dir="$2"
  local target_dir="$3"
  local target_dims

  case "$device_key" in
    phone)     target_dims="$GOOGLE_PHONE_TARGET" ;;
    tablet-7)  target_dims="$GOOGLE_TABLET7_TARGET" ;;
    tablet-10) target_dims="$GOOGLE_TABLET10_TARGET" ;;
  esac

  if ! ls "$source_dir"/*.png &>/dev/null; then
    warn "No screenshots found in $source_dir"
    return 0
  fi

  # If ImageMagick is available, resize to exact Google Play dimensions
  if command -v magick &>/dev/null || command -v convert &>/dev/null; then
    local convert_cmd="convert"
    command -v magick &>/dev/null && convert_cmd="magick"

    log "Resizing screenshots for Google Play ($target_dims)..."
    for img in "$source_dir"/*.png; do
      local basename
      basename=$(basename "$img")
      $convert_cmd "$img" \
        -resize "${target_dims}!" \
        -gravity center \
        -extent "${target_dims}" \
        -quality 95 \
        "$target_dir/$basename"
    done
  else
    # Just copy as-is
    cp "$source_dir"/*.png "$target_dir/"
    warn "ImageMagick not found. Screenshots copied without resizing."
    warn "Install with: brew install imagemagick"
  fi

  local count
  count=$(ls -1 "$target_dir"/*.png 2>/dev/null | wc -l)
  ok "Processed $count screenshots for $device_key (${target_dims})"
}

run_android_screenshots() {
  header "GOOGLE PLAY STORE SCREENSHOTS"

  info "Required devices:"
  info "  - Phone:      1080 x 1920 px (9:16)"
  info "  - 7\" Tablet:  1200 x 1920 px"
  info "  - 10\" Tablet: 1600 x 2560 px"
  echo ""

  for device_key in "phone" "tablet-7" "tablet-10"; do
    capture_android_screenshots "$device_key"

    # Shutdown emulator between runs if switching devices
    if [[ "$device_key" != "tablet-10" ]]; then
      adb emu kill 2>/dev/null || true
      sleep 3
    fi
  done

  # Final cleanup
  adb emu kill 2>/dev/null || true
}

# ─────────────────────────────────────────────────────────────────────────────
# Device Frame Overlay (optional post-processing)
# ─────────────────────────────────────────────────────────────────────────────

add_device_frames() {
  header "ADDING DEVICE FRAMES"

  if ! command -v magick &>/dev/null && ! command -v convert &>/dev/null; then
    warn "ImageMagick not found. Cannot add device frames."
    warn "Install with: brew install imagemagick"
    return 0
  fi

  info "To add professional device frames, use one of these tools:"
  info "  1. fastlane frameit:  fastlane frameit --path screenshots/"
  info "  2. Screenshots Pro:   https://screenshots.pro"
  info "  3. AppMockUp:         https://app-mockup.com"
  info "  4. Previewed:         https://previewed.app"
  echo ""
  info "Or use the framing script: ./scripts/frame-screenshots.sh"

  ok "Raw screenshots are ready in $OUTPUT_BASE/"
}

# ─────────────────────────────────────────────────────────────────────────────
# Summary & Validation
# ─────────────────────────────────────────────────────────────────────────────

print_summary() {
  header "SCREENSHOT CAPTURE SUMMARY"

  echo ""
  echo "Output directory: $OUTPUT_BASE/"
  echo ""

  if [[ "$RUN_IOS" == true ]]; then
    echo "┌─────────────────────────────────────────────────────────┐"
    echo "│  APPLE APP STORE                                        │"
    echo "├──────────────────┬──────────────┬───────────────────────┤"
    echo "│  Device          │  Dimensions  │  Screenshots          │"
    echo "├──────────────────┼──────────────┼───────────────────────┤"
    for device_key in "iphone-6.9" "ipad-13" "iphone-6.7" "iphone-6.5"; do
      local dir="$OUTPUT_BASE/ios/store/$device_key"
      local count=0
      if ls "$dir"/*.png &>/dev/null 2>&1; then
        count=$(ls -1 "$dir"/*.png | wc -l)
      fi
      local dims="${IOS_DIMENSIONS[$device_key]}"
      local name="${IOS_DEVICES[$device_key]}"
      local status="$count found"
      if [[ "$device_key" == "iphone-6.9" || "$device_key" == "ipad-13" ]]; then
        name="$name *"
      fi
      printf "│  %-16s │  %-12s │  %-21s │\n" "$name" "$dims" "$status"
    done
    echo "└──────────────────┴──────────────┴───────────────────────┘"
    echo "  * = Required by Apple (others auto-scaled)"
    echo ""
  fi

  if [[ "$RUN_ANDROID" == true ]]; then
    echo "┌─────────────────────────────────────────────────────────┐"
    echo "│  GOOGLE PLAY STORE                                      │"
    echo "├──────────────────┬──────────────┬───────────────────────┤"
    echo "│  Device          │  Dimensions  │  Screenshots          │"
    echo "├──────────────────┼──────────────┼───────────────────────┤"
    for device_key in "phone" "tablet-7" "tablet-10"; do
      local dir="$OUTPUT_BASE/android/store/$device_key"
      local count=0
      if ls "$dir"/*.png &>/dev/null 2>&1; then
        count=$(ls -1 "$dir"/*.png | wc -l)
      fi
      local dims
      case "$device_key" in
        phone)     dims="$GOOGLE_PHONE_TARGET" ;;
        tablet-7)  dims="$GOOGLE_TABLET7_TARGET" ;;
        tablet-10) dims="$GOOGLE_TABLET10_TARGET" ;;
      esac
      printf "│  %-16s │  %-12s │  %-21s │\n" "$device_key" "$dims" "$count found"
    done
    echo "└──────────────────┴──────────────┴───────────────────────┘"
    echo ""
  fi

  echo "Recommended store listing screens (up to 8):"
  for screen in "${STORE_LISTING_SCREENS[@]}"; do
    echo "  - $screen"
  done
  echo ""

  info "Requirements reminder:"
  info "  Apple: Min 1, Max 10 per device class. JPEG/PNG, no alpha, RGB."
  info "  Google: Min 2 (phone), Min 4 (tablet). PNG 24-bit / JPEG. Max 8MB."
  info "  Google: Aspect ratio must be exactly 9:16 (phone) or 16:9."
}

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

main() {
  local RUN_IOS=true
  local RUN_ANDROID=true
  local DO_CLEAN=false
  local DO_FRAMES=false

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --ios)
        RUN_IOS=true
        RUN_ANDROID=false
        ;;
      --android)
        RUN_IOS=false
        RUN_ANDROID=true
        ;;
      --clean)
        DO_CLEAN=true
        ;;
      --frames)
        DO_FRAMES=true
        ;;
      --help|-h)
        echo "Usage: $0 [--ios|--android] [--clean] [--frames]"
        echo ""
        echo "Options:"
        echo "  --ios       Capture iOS screenshots only"
        echo "  --android   Capture Android screenshots only"
        echo "  --clean     Remove previous screenshots before capturing"
        echo "  --frames    Add device frames after capturing"
        echo "  --help      Show this help message"
        exit 0
        ;;
      *)
        err "Unknown option: $1"
        exit 1
        ;;
    esac
    shift
  done

  # Export for use in functions
  export RUN_IOS RUN_ANDROID

  header "PRINTYX APP STORE SCREENSHOT AUTOMATION"

  log "Project: $PROJECT_DIR"
  log "Output:  $OUTPUT_BASE/"
  log "iOS:     $RUN_IOS"
  log "Android: $RUN_ANDROID"
  echo ""

  # Dependency check
  check_dependencies

  # Clean if requested
  if [[ "$DO_CLEAN" == true ]]; then
    clean_screenshots
  fi

  # Create output directories
  ensure_output_dirs

  # Capture iOS screenshots
  if [[ "$RUN_IOS" == true ]]; then
    run_ios_screenshots
  fi

  # Capture Android screenshots
  if [[ "$RUN_ANDROID" == true ]]; then
    run_android_screenshots
  fi

  # Add device frames if requested
  if [[ "$DO_FRAMES" == true ]]; then
    add_device_frames
  fi

  # Print summary
  print_summary
}

main "$@"
