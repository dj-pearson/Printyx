#!/bin/bash
set -e

# Ralph - Autonomous AI agent loop
# Runs Claude Code repeatedly until all PRD items are complete

TOOL="claude"
MAX_ITERATIONS=10
CURRENT_ITERATION=0
PROGRESS_FILE="progress.txt"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --tool)
      TOOL="$2"
      shift 2
      ;;
    *)
      if [[ $1 =~ ^[0-9]+$ ]]; then
        MAX_ITERATIONS=$1
      fi
      shift
      ;;
  esac
done

echo "🤖 Ralph starting with $TOOL (max $MAX_ITERATIONS iterations)"

# Check for required files
if [ ! -f "prd.json" ]; then
  echo "❌ Error: prd.json not found"
  echo "Create a PRD first using the prd skill"
  exit 1
fi

# Get branch name from prd.json
BRANCH_NAME=$(jq -r '.branchName // "ralph-feature"' prd.json)
CURRENT_BRANCH=$(git branch --show-current)

# Create feature branch if not already on it
if [ "$CURRENT_BRANCH" != "$BRANCH_NAME" ]; then
  echo "📝 Creating/switching to branch: $BRANCH_NAME"
  git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
fi

# Archive previous run if prd.json changed significantly
if [ -f "$PROGRESS_FILE" ] && [ "$(git diff HEAD -- prd.json | wc -l)" -gt 10 ]; then
  ARCHIVE_DIR="archive/$(date +%Y-%m-%d)-$BRANCH_NAME"
  mkdir -p "$ARCHIVE_DIR"
  [ -f "$PROGRESS_FILE" ] && mv "$PROGRESS_FILE" "$ARCHIVE_DIR/"
  [ -f "prd.json.previous" ] && mv prd.json.previous "$ARCHIVE_DIR/"
  echo "📦 Archived previous run to $ARCHIVE_DIR"
fi

# Initialize progress.txt if it doesn't exist
if [ ! -f "$PROGRESS_FILE" ]; then
  echo "Ralph Progress Log - $(date)" > "$PROGRESS_FILE"
  echo "Branch: $BRANCH_NAME" >> "$PROGRESS_FILE"
  echo "" >> "$PROGRESS_FILE"
fi

# Main loop
while [ $CURRENT_ITERATION -lt $MAX_ITERATIONS ]; do
  CURRENT_ITERATION=$((CURRENT_ITERATION + 1))
  echo ""
  echo "🔄 Iteration $CURRENT_ITERATION/$MAX_ITERATIONS"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  # Find next incomplete story
  NEXT_STORY=$(jq -r '.userStories[] | select(.passes == false) | .id' prd.json | head -n1)
  
  if [ -z "$NEXT_STORY" ]; then
    echo "✅ All stories complete!"
    echo "<promise>COMPLETE</promise>"
    exit 0
  fi
  
  echo "📋 Next story: $NEXT_STORY"
  
  # Run AI tool with prompt
  if [ "$TOOL" = "claude" ]; then
    PROMPT_FILE="scripts/ralph/CLAUDE.md"
    if [ ! -f "$PROMPT_FILE" ]; then
      PROMPT_FILE="CLAUDE.md"
    fi
    
    if [ ! -f "$PROMPT_FILE" ]; then
      echo "❌ Error: CLAUDE.md not found"
      exit 1
    fi
    
    echo "🧠 Running Claude Code..."
    claude-code "$(cat $PROMPT_FILE)"
  else
    PROMPT_FILE="scripts/ralph/prompt.md"
    if [ ! -f "$PROMPT_FILE" ]; then
      PROMPT_FILE="prompt.md"
    fi
    
    if [ ! -f "$PROMPT_FILE" ]; then
      echo "❌ Error: prompt.md not found"
      exit 1
    fi
    
    echo "🧠 Running Amp..."
    amp "$(cat $PROMPT_FILE)"
  fi
  
  # Check if story is now complete
  STORY_COMPLETE=$(jq -r ".userStories[] | select(.id == \"$NEXT_STORY\") | .passes" prd.json)
  
  if [ "$STORY_COMPLETE" = "true" ]; then
    echo "✅ Story $NEXT_STORY completed"
  else
    echo "⚠️  Story $NEXT_STORY not marked complete - may need manual review"
  fi
  
  # Add iteration summary to progress.txt
  echo "" >> "$PROGRESS_FILE"
  echo "Iteration $CURRENT_ITERATION ($(date)): Story $NEXT_STORY" >> "$PROGRESS_FILE"
  echo "Status: $([ "$STORY_COMPLETE" = "true" ] && echo "Complete" || echo "Needs Review")" >> "$PROGRESS_FILE"
  
  # Short pause between iterations
  sleep 2
done

echo ""
echo "⏸️  Max iterations ($MAX_ITERATIONS) reached"
echo "Check prd.json for remaining stories"

# Show remaining stories
REMAINING=$(jq -r '.userStories[] | select(.passes == false) | .id' prd.json | wc -l)
echo "📊 $REMAINING stories remaining"
