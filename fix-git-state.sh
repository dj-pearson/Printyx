#!/bin/bash
# Script to fix the Git merge state
echo "Cleaning up Git merge state..."

# Remove merge state files
rm -f .git/MERGE_HEAD .git/MERGE_MODE .git/MERGE_MSG .git/AUTO_MERGE .git/index.lock

# Stage the resolved file
git add server/routes.ts

# Create a simple commit
git commit -m "Resolve merge conflicts and integrate enhanced task management"

echo "Git state cleaned up successfully!"