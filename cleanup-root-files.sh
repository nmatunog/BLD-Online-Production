#!/bin/bash

# Script to archive or remove problematic files from root directory
# Usage: ./cleanup-root-files.sh [archive|delete]
# Default: archive

ACTION="${1:-archive}"
ROOT_HOME="/Users/nmatunog2"
ARCHIVE_DIR="$ROOT_HOME/Archive/RootFiles-$(date +%Y%m%d-%H%M%S)"

echo "🔍 Root Directory File Cleanup Script"
echo "======================================"
echo ""

# List files that will be affected
echo "Files in root directory that may interfere:"
echo "---------------------------------------------"
[ -f "$ROOT_HOME/package.json" ] && echo "  ✓ package.json"
[ -f "$ROOT_HOME/package-lock.json" ] && echo "  ✓ package-lock.json"
[ -d "$ROOT_HOME/node_modules" ] && echo "  ✓ node_modules/ (directory)"
[ -f "$ROOT_HOME/firebase.json" ] && echo "  ✓ firebase.json"
[ -f "$ROOT_HOME/create_form.py" ] && echo "  ✓ create_form.py"
[ -f "$ROOT_HOME/wsgi.py" ] && echo "  ✓ wsgi.py"
[ -f "$ROOT_HOME/requirements.txt" ] && echo "  ✓ requirements.txt"
[ -f "$ROOT_HOME/runtime.txt" ] && echo "  ✓ runtime.txt"
[ -d "$ROOT_HOME/dist" ] && echo "  ✓ dist/ (directory)"
echo ""

if [ "$ACTION" = "archive" ]; then
    echo "📦 Archiving files to: $ARCHIVE_DIR"
    echo ""
    
    # Create archive directory
    mkdir -p "$ARCHIVE_DIR"
    
    # Archive package files
    [ -f "$ROOT_HOME/package.json" ] && mv "$ROOT_HOME/package.json" "$ARCHIVE_DIR/" && echo "  ✓ Archived package.json"
    [ -f "$ROOT_HOME/package-lock.json" ] && mv "$ROOT_HOME/package-lock.json" "$ARCHIVE_DIR/" && echo "  ✓ Archived package-lock.json"
    
    # Archive node_modules (ask first as it might be large)
    if [ -d "$ROOT_HOME/node_modules" ]; then
        echo ""
        read -p "Archive node_modules/ directory? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            mv "$ROOT_HOME/node_modules" "$ARCHIVE_DIR/" && echo "  ✓ Archived node_modules/"
        else
            echo "  ⊘ Skipped node_modules/"
        fi
    fi
    
    # Archive firebase.json
    [ -f "$ROOT_HOME/firebase.json" ] && mv "$ROOT_HOME/firebase.json" "$ARCHIVE_DIR/" && echo "  ✓ Archived firebase.json"
    
    # Archive Python files (optional)
    [ -f "$ROOT_HOME/create_form.py" ] && mv "$ROOT_HOME/create_form.py" "$ARCHIVE_DIR/" && echo "  ✓ Archived create_form.py"
    [ -f "$ROOT_HOME/wsgi.py" ] && mv "$ROOT_HOME/wsgi.py" "$ARCHIVE_DIR/" && echo "  ✓ Archived wsgi.py"
    [ -f "$ROOT_HOME/requirements.txt" ] && mv "$ROOT_HOME/requirements.txt" "$ARCHIVE_DIR/" && echo "  ✓ Archived requirements.txt"
    [ -f "$ROOT_HOME/runtime.txt" ] && mv "$ROOT_HOME/runtime.txt" "$ARCHIVE_DIR/" && echo "  ✓ Archived runtime.txt"
    
    # Archive dist directory
    if [ -d "$ROOT_HOME/dist" ]; then
        echo ""
        read -p "Archive dist/ directory? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            mv "$ROOT_HOME/dist" "$ARCHIVE_DIR/" && echo "  ✓ Archived dist/"
        else
            echo "  ⊘ Skipped dist/"
        fi
    fi
    
    echo ""
    echo "✅ Files archived to: $ARCHIVE_DIR"
    echo "   You can restore them later if needed."
    
elif [ "$ACTION" = "delete" ]; then
    echo "⚠️  WARNING: This will DELETE files from your root directory!"
    echo "   Make sure these files are not needed for other projects."
    echo ""
    read -p "Are you sure you want to DELETE these files? (yes/no): " -r
    echo
    if [ "$REPLY" != "yes" ]; then
        echo "❌ Cancelled. No files were deleted."
        exit 0
    fi
    
    echo "🗑️  Deleting files..."
    echo ""
    
    # Delete package files
    [ -f "$ROOT_HOME/package.json" ] && rm "$ROOT_HOME/package.json" && echo "  ✓ Deleted package.json"
    [ -f "$ROOT_HOME/package-lock.json" ] && rm "$ROOT_HOME/package-lock.json" && echo "  ✓ Deleted package-lock.json"
    
    # Delete node_modules (ask first)
    if [ -d "$ROOT_HOME/node_modules" ]; then
        read -p "Delete node_modules/ directory? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$ROOT_HOME/node_modules" && echo "  ✓ Deleted node_modules/"
        else
            echo "  ⊘ Skipped node_modules/"
        fi
    fi
    
    # Delete firebase.json
    [ -f "$ROOT_HOME/firebase.json" ] && rm "$ROOT_HOME/firebase.json" && echo "  ✓ Deleted firebase.json"
    
    echo ""
    echo "✅ Files deleted."
    
else
    echo "❌ Invalid action: $ACTION"
    echo "Usage: $0 [archive|delete]"
    exit 1
fi

echo ""
echo "🔍 Verification:"
echo "-----------------"
echo "Checking project structure..."
cd "$ROOT_HOME/BLDCebu-Online-Portal" || exit 1

if [ -f "backend/package.json" ] && [ -f "frontend/package.json" ]; then
    echo "  ✓ Project package.json files are in correct locations"
else
    echo "  ✗ Project package.json files missing!"
fi

if [ -f "firebase.json" ]; then
    echo "  ✓ Project firebase.json is in correct location"
else
    echo "  ⊘ Project firebase.json not found (may not be needed)"
fi

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "💡 Tip: Always run commands from ~/BLDCebu-Online-Portal/ or use the provided scripts:"
echo "   ./run-backend.sh"
echo "   ./run-frontend.sh"
echo "   ./start-dev.sh"
