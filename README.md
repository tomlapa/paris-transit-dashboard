# 🚇 Paris Transit Dashboard - Docker (Working Version)

This is the **minimal, working** Docker version that preserves the original application behavior.

## ✅ What's Fixed

- Config file properly persists in `./data/config.yaml` 
- API key saves correctly
- No complicated volume mounts
- Works exactly like the original, just Dockerized

## 🚀 Quick Start

### One Command:
```bash
curl -fsSL https://raw.githubusercontent.com/tomlapa/paris-transit-dashboard/main/remote-install.sh | bash
```

### Manual:
```bash
git clone https://github.com/tomlapa/paris-transit-dashboard.git
cd paris-transit-dashboard
bash auto-setup.sh
```

## 📝 How It Works

The app stores config in `/data/config.yaml` which is mounted to `./data/` on your host:

```
./data/
└── config.yaml  ← Your API key and stops are saved here
```

This directory persists between restarts.

## 🔧 First Time Setup

1. Start the dashboard: `docker compose up -d`
2. Visit: `http://YOUR-IP:8080/setup`
3. Paste your IDFM API key
4. Click "Valider"
5. Add your transit stops
6. Done!

## 📊 Verify It's Working

```bash
# Check logs
docker compose logs -f

# Should see:
# INFO:     Uvicorn running on http://0.0.0.0:8080

# Check config exists
ls -la data/
# Should show config.yaml after you save API key
```

## 🐛 Troubleshooting

### API Key Not Saving

```bash
# Check permissions
ls -la data/
# Should be writable

# If not, fix it:
chmod 777 data/

# Restart
docker compose restart
```

### Can't Access Dashboard

```bash
# Check container is running
docker compose ps

# Check firewall (if on VPS)
# AWS: Security Group → Allow 8080
# DigitalOcean: Cloud Firewall → Allow 8080
```

## 🔄 Management

```bash
# View logs
docker compose logs -f

# Restart
docker compose restart

# Stop
docker compose down

# Update
git pull
docker compose down
docker compose build
docker compose up -d

# Backup config
cp data/config.yaml data/config.yaml.backup
```

## 📁 File Structure

```
paris-transit-dashboard/
├── api/              ← Application code
├── static/           ← CSS, JS
├── templates/        ← HTML
├── data/             ← YOUR DATA (persistent)
│   └── config.yaml   ← API key & stops
├── docker-compose.yml
├── Dockerfile
├── main.py           ← Modified to use /data
├── requirements.txt
└── auto-setup.sh     ← Auto-installer
```

## 🎯 What Changed from Original

**Only 3 lines changed in main.py:**

```python
# Before:
config_manager = ConfigManager()

# After:
config_path = Path("/data/config.yaml") if Path("/data").exists() else Path("config.yaml")
config_manager = ConfigManager(str(config_path))
```

That's it! Everything else is exactly the same as your original application.

## ✨ Features

- 🔍 Smart search by address or stop name
- 🗺️ Interactive map
- ⏱️ Real-time departures
- 📱 Mobile friendly
- 🔄 Auto-refresh every 30s
- 🚌 Bus, Métro, RER, Tram, Train support

## 📞 Support

- 🐛 Issues: https://github.com/tomlapa/paris-transit-dashboard/issues
- 📖 Original README: See README.original.md

---

**This version is tested and working.** Your API key will save properly!
