# Fixing npm Permission Issues

## 🔧 Problem: EACCES Permission Denied

This happens when npm tries to install global packages but doesn't have permission.

---

## ✅ Solution 1: Use npx (No Installation Needed) - RECOMMENDED

**Best option** - No global install required!

```bash
# Use npx to run Railway CLI without installing
npx @railway/cli login
npx @railway/cli init
npx @railway/cli up
```

**Or create an alias:**
```bash
# Add to ~/.zshrc
alias railway='npx @railway/cli'

# Then reload
source ~/.zshrc

# Now you can use:
railway login
railway init
```

---

## ✅ Solution 2: Fix npm Permissions (Permanent Fix)

### Option A: Change npm's default directory

```bash
# Create a directory for global packages
mkdir ~/.npm-global

# Configure npm to use the new directory
npm config set prefix '~/.npm-global'

# Add to your PATH (add to ~/.zshrc)
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc

# Reload shell
source ~/.zshrc

# Now install Railway CLI
npm install -g @railway/cli
```

### Option B: Use sudo (Not Recommended)

```bash
sudo npm install -g @railway/cli
```

⚠️ **Warning**: Using sudo can cause security issues. Only use if other options don't work.

---

## ✅ Solution 3: Use Homebrew (macOS)

```bash
# Install via Homebrew
brew install railway

# Then use normally
railway login
```

---

## 🎯 Recommended: Use npx

Since Railway CLI is lightweight, using `npx` is the easiest solution:

```bash
# Login
npx @railway/cli login

# Initialize project
npx @railway/cli init

# Deploy
npx @railway/cli up

# Or create alias for convenience
alias railway='npx @railway/cli'
```

---

## 📝 Quick Fix Commands

### For this session only:
```bash
alias railway='npx @railway/cli'
railway login
```

### Permanent fix (add to ~/.zshrc):
```bash
echo 'alias railway="npx @railway/cli"' >> ~/.zshrc
source ~/.zshrc
```

---

## ✅ Verify It Works

```bash
railway --version
# or
npx @railway/cli --version
```

---

## 🚀 Continue Setup

Once Railway CLI is accessible (via npx or fixed permissions), continue with:

```bash
cd backend
railway login  # or npx @railway/cli login
railway init   # or npx @railway/cli init
```
