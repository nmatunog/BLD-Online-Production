# Root Directory File Cleanup Guide

## Issue
Files in the root directory (`/Users/nmatunog2/`) may interfere with terminal commands and project operations.

## Problematic Files in Root Directory

The following files in `/Users/nmatunog2/` are NOT part of the BLDCebu-Online-Portal project and may cause conflicts:

### 1. Package Management Files
- `package.json` - Contains dependencies from another project
- `package-lock.json` - Lock file for root package.json
- `node_modules/` - Dependencies installed for root package.json

**Impact:** When running `npm` commands from the root directory, they may use the root `package.json` instead of the project's package.json files.

### 2. Firebase Configuration
- `firebase.json` - Different configuration from the project's firebase.json

**Impact:** Firebase CLI commands may use the wrong configuration.

### 3. Python Project Files
- `create_form.py`
- `create_form.py.save`
- `wsgi.py`
- `requirements.txt`
- `runtime.txt`

**Impact:** These are from a different Python project and won't affect this project, but can cause confusion.

### 4. Build Output
- `dist/` - Build output directory (likely from another project)

## Recommended Actions

### Option 1: Archive Root Files (Recommended)
Move these files to an archive directory:

```bash
# Create archive directory
mkdir -p ~/Archive/RootFiles-$(date +%Y%m%d)

# Move package files
mv ~/package.json ~/Archive/RootFiles-$(date +%Y%m%d)/
mv ~/package-lock.json ~/Archive/RootFiles-$(date +%Y%m%d)/ 2>/dev/null || true

# Move node_modules (if exists and you're sure it's not needed)
# mv ~/node_modules ~/Archive/RootFiles-$(date +%Y%m%d)/ 2>/dev/null || true

# Move firebase.json
mv ~/firebase.json ~/Archive/RootFiles-$(date +%Y%m%d)/ 2>/dev/null || true

# Move Python files (if not needed)
# mv ~/create_form.py ~/Archive/RootFiles-$(date +%Y%m%d)/ 2>/dev/null || true
# mv ~/wsgi.py ~/Archive/RootFiles-$(date +%Y%m%d)/ 2>/dev/null || true
# mv ~/requirements.txt ~/Archive/RootFiles-$(date +%Y%m%d)/ 2>/dev/null || true
# mv ~/runtime.txt ~/Archive/RootFiles-$(date +%Y%m%d)/ 2>/dev/null || true
```

### Option 2: Delete Root Files (Use with Caution)
Only if you're certain these files are not needed:

```bash
# Delete package files
rm ~/package.json
rm ~/package-lock.json 2>/dev/null || true

# Delete node_modules (be careful - this can be large)
# rm -rf ~/node_modules 2>/dev/null || true

# Delete firebase.json
rm ~/firebase.json 2>/dev/null || true
```

## Verification

After cleanup, verify the project structure:

```bash
cd ~/BLDCebu-Online-Portal

# Check that scripts work
./run-backend.sh --help
./run-frontend.sh --help

# Verify package.json locations
ls -la backend/package.json
ls -la frontend/package.json

# Verify no root package.json interference
cd ~
npm list 2>&1 | head -5  # Should show error or empty, not project dependencies
```

## Project Structure (Correct)

The BLDCebu-Online-Portal project should have this structure:

```
~/BLDCebu-Online-Portal/
├── backend/
│   ├── package.json          ✅ Correct location
│   ├── package-lock.json     ✅ Correct location
│   └── node_modules/         ✅ Correct location
├── frontend/
│   ├── package.json          ✅ Correct location
│   ├── package-lock.json     ✅ Correct location
│   └── node_modules/        ✅ Correct location
├── firebase.json              ✅ Correct location (project-specific)
└── [other project files]
```

## Notes

- The root `package.json` appears to be from a different project (has Firebase, Next.js, etc. but not organized like this project)
- The root `firebase.json` has different configuration than the project's firebase.json
- Always run commands from within the project directory (`~/BLDCebu-Online-Portal/`) or use the provided scripts
