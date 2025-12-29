# ✅ GitHub Upload Checklist

Follow these steps to get your transit dashboard on GitHub and installable via URL.

## Prerequisites
- [ ] GitHub account created
- [ ] Git installed on your computer (`git --version` to check)
- [ ] Docker installed (`docker --version` to check)

---

## Part 1: Create Repository on GitHub

1. [ ] Go to https://github.com
2. [ ] Click the **"+"** icon (top right corner)
3. [ ] Click **"New repository"**
4. [ ] Fill in:
   - **Repository name**: `paris-transit-dashboard`
   - **Description**: `Real-time Paris transit dashboard with Docker support`
   - **Public** (must be public for URL access)
   - **✅ Add a README file**
5. [ ] Click **"Create repository"**
6. [ ] Copy the repository URL (it will be like: `https://github.com/YOUR-USERNAME/paris-transit-dashboard.git`)

---

## Part 2: Prepare Files Locally

Open terminal on your computer/server:

```bash
# Extract the Docker-ready archive
tar -xzf transit-dashboard-v3-docker.tar.gz
cd transit-dashboard-v3

# Initialize git
git init

# Set your name and email (first time only)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Add remote (REPLACE WITH YOUR ACTUAL URL)
git remote add origin https://github.com/YOUR-USERNAME/paris-transit-dashboard.git

# Create .gitignore
cat > .gitignore << 'EOF'
__pycache__/
*.py[cod]
.Python
venv/
data/
config.yaml
*.backup
.DS_Store
.env
docker-compose.override.yml
EOF
```

---

## Part 3: Update Files

Before uploading, update these files with YOUR GitHub username:

### 1. Update remote-install.sh

```bash
# Edit the file
nano remote-install.sh

# Change this line:
REPO_URL="https://github.com/YOUR-USERNAME/paris-transit-dashboard.git"

# To YOUR actual username:
REPO_URL="https://github.com/antonio/paris-transit-dashboard.git"

# Save: Ctrl+X, then Y, then Enter
```

### 2. Update README.md

```bash
# Replace README with the GitHub version
cp README-github.md README.md

# Edit it
nano README.md

# Find and replace all instances of:
YOUR-USERNAME
# with your actual GitHub username

# Save: Ctrl+X, then Y, then Enter
```

---

## Part 4: Upload to GitHub

```bash
# Check what files will be uploaded
git status

# Add all files
git add .

# Commit with a message
git commit -m "Initial commit: Docker-ready Paris transit dashboard"

# Rename branch to main
git branch -M main

# Push to GitHub (first time)
git push -u origin main
```

**Authentication:**
- **Username**: Your GitHub username
- **Password**: Use a **Personal Access Token** (NOT your password)

### Creating a Personal Access Token:
1. [ ] Go to GitHub → Settings (your profile, not repo)
2. [ ] Scroll down to **Developer settings**
3. [ ] Click **Personal access tokens** → **Tokens (classic)**
4. [ ] Click **Generate new token** → **Generate new token (classic)**
5. [ ] Give it a name: "Transit Dashboard Upload"
6. [ ] Select scope: **✅ repo** (check the box)
7. [ ] Click **Generate token**
8. [ ] **COPY THE TOKEN** (you won't see it again!)
9. [ ] Use this token as your password when git asks

---

## Part 5: Verify Upload

1. [ ] Go to `https://github.com/YOUR-USERNAME/paris-transit-dashboard`
2. [ ] Verify you see all files:
   - [ ] Dockerfile
   - [ ] docker-compose.yml
   - [ ] main.py
   - [ ] requirements.txt
   - [ ] api/ folder
   - [ ] static/ folder
   - [ ] templates/ folder
   - [ ] README.md
   - [ ] remote-install.sh
   - [ ] Other documentation files

---

## Part 6: Test the Installation URLs

Now test that people can install from your repo:

### Test 1: Clone and Run
```bash
cd /tmp
git clone https://github.com/YOUR-USERNAME/paris-transit-dashboard.git
cd paris-transit-dashboard
docker compose up -d
```

If it works:
```bash
docker compose down
cd ..
rm -rf paris-transit-dashboard
```

### Test 2: One-Line Install
```bash
curl -fsSL https://raw.githubusercontent.com/YOUR-USERNAME/paris-transit-dashboard/main/remote-install.sh | bash
```

### Test 3: Direct Compose File
```bash
curl -fsSL https://raw.githubusercontent.com/YOUR-USERNAME/paris-transit-dashboard/main/docker-compose.yml -o docker-compose.yml
docker compose up -d
```

---

## Part 7: URLs to Share

Once uploaded, you can share these URLs:

### Repository URL
```
https://github.com/YOUR-USERNAME/paris-transit-dashboard
```

### One-Line Install
```bash
curl -fsSL https://raw.githubusercontent.com/YOUR-USERNAME/paris-transit-dashboard/main/remote-install.sh | bash
```

### Docker Compose URL (for web interfaces)
```
https://raw.githubusercontent.com/YOUR-USERNAME/paris-transit-dashboard/main/docker-compose.yml
```

### Manual Clone
```bash
git clone https://github.com/YOUR-USERNAME/paris-transit-dashboard.git
cd paris-transit-dashboard
docker compose up -d
```

---

## Part 8: Update Your Web Compose Interface

In that web interface you showed:

**URL field:**
```
https://raw.githubusercontent.com/YOUR-USERNAME/paris-transit-dashboard/main/docker-compose.yml
```

**Project name:**
```
transit-dashboard
```

Click **Implantar**!

---

## Future Updates

When you make changes:

```bash
cd transit-dashboard-v3

# Make your changes

# Stage changes
git add .

# Commit
git commit -m "Description of what you changed"

# Push
git push
```

Users can update with:
```bash
cd paris-transit-dashboard
git pull
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## Troubleshooting

### "Permission denied (publickey)"
- Use HTTPS, not SSH: `https://github.com/...` not `git@github.com:...`
- Or set up SSH keys: https://docs.github.com/en/authentication/connecting-to-github-with-ssh

### "Authentication failed"
- Make sure you're using a Personal Access Token, not your password
- Token must have 'repo' scope checked

### "Remote already exists"
- Remove and re-add: `git remote remove origin`
- Then: `git remote add origin https://github.com/...`

### Files missing on GitHub
- Check .gitignore isn't excluding them
- Use `git status` to see what's staged
- Use `git add -f filename` to force-add if needed

---

## ✅ Completion Checklist

- [ ] Repository created on GitHub
- [ ] Files uploaded successfully
- [ ] README.md updated with correct username
- [ ] remote-install.sh updated with correct URL
- [ ] Tested clone and run
- [ ] Tested one-line install
- [ ] URLs documented for sharing
- [ ] Web compose interface tested (optional)

---

**You're done!** 🎉

Now anyone can install your transit dashboard with a single command!
