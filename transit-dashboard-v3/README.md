# 🚇 Paris Transit Dashboard v3 - Smart Search with Interactive Map

Real-time transit dashboard for Paris Île-de-France region with unified smart search and interactive map interface.

## ✨ What's New in v3

### 🔍 **Unified Smart Search**
- **Intelligent address detection** - automatically detects if you're searching for an address or stop name
- Search "Rue du Maréchal Leclerc" → finds address → shows nearby stops within 500m
- Search "Écoles de Gravelle" → directly searches stop names
- Keywords like `rue`, `avenue`, `boulevard` trigger address search

### 🗺️ **Interactive Leaflet Map**
- **Side-by-side view** - map and results list together (stacks vertically on mobile)
- **Click on map** → finds stops within 500m radius with visual circle
- **Color-coded pins** - Blue (Metro), Green (RER), Yellow (Bus), Orange (Tram), Purple (Train)
- **Click pins** → see all lines at that stop → select line → choose direction → add!
- **"Locate me" button** - use browser geolocation
- **"Recenter" button** - back to Paris overview
- Zoom in to neighborhood level to see stops automatically

### 🎯 **Streamlined Workflow**
1. Type address or stop name
2. Map zooms to location + shows nearby stops
3. Click stop (on map or in list)
4. See all lines at that stop
5. Select line → choose direction → done!

### 📱 **Raspberry Pi Ready**
- Lightweight Leaflet.js (no Google Maps API key needed)
- Works great on ARM processors
- Kiosk mode for dedicated display
- Runs on Ubuntu Server, Debian, Raspberry Pi OS

## 🚀 Quick Install (One Command)

```bash
# Extract and install
tar -xzf transit-dashboard-v3.tar.gz
cd transit-dashboard-v3
sudo bash install.sh
```

## 📋 Requirements

- **OS**: Ubuntu 20.04+, Debian 11+, Raspberry Pi OS
- **Python**: 3.8+
- **API Key**: Free from [prim.iledefrance-mobilites.fr](https://prim.iledefrance-mobilites.fr)

## 🔧 Installation Options

### System-Wide Install (Recommended)
```bash
sudo bash install.sh
```
- Installs to `/opt/transit-dashboard`
- Creates systemd service
- Available at boot
- Global `transit-config` command

### User Install (No sudo)
```bash
bash install.sh
```
- Installs to `~/transit-dashboard`
- User systemd service
- Run `~/transit-dashboard/transit-config`

### Raspberry Pi Kiosk Mode
The installer will offer kiosk mode setup:
- Full-screen browser on boot
- No mouse cursor
- Perfect for dedicated transit display

## 📍 How to Use

### Step 1: Get API Key
1. Visit [prim.iledefrance-mobilites.fr](https://prim.iledefrance-mobilites.fr)
2. Create account
3. Generate API key (free)

### Step 2: Add Stops

**Option A: Smart Search (Recommended)**
1. Go to "🔍 Recherche intelligente" tab
2. Type address: `Rue du Maréchal Leclerc, Joinville-le-Pont`
   - Map zooms to location
   - Shows stops within 500m
   - Click stop → see all lines
3. Or type stop name: `Écoles de Gravelle`
   - Searches stops by name
4. Click line → choose direction → add!

**Option B: Map Click**
1. Click anywhere on the map
2. See nearby stops with 500m radius circle
3. Click pin → popup shows lines
4. Click line → choose direction → add!

**Option C: Direct Search**
1. Go to "🚏 Recherche directe" tab
2. Search by stop/line name
3. Works like the old version

### Step 3: View Dashboard
Access at `http://localhost:8080` or `http://YOUR-IP:8080`

## 🛠️ Management

### Service Commands
```bash
# Check status
sudo systemctl status transit-dashboard

# Restart
sudo systemctl restart transit-dashboard

# View logs
sudo journalctl -u transit-dashboard -f

# Stop
sudo systemctl stop transit-dashboard
```

### Configuration
```bash
# CLI tool
transit-config

# Or visit
http://localhost:8080/setup
http://localhost:8080/admin
```

## 🌐 Remote Access (Cloudflare Tunnel)

```bash
# Install cloudflared
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
sudo dpkg -i cloudflared.deb

# Create tunnel
cloudflared tunnel --url http://localhost:8080
```

## 🎨 Features

### Search Intelligence
- Address keywords: `rue`, `avenue`, `boulevard`, `place`, `quai`, `impasse`, `allée`, `chemin`, `route`
- Auto-geocoding via French Government API
- Falls back to stop search if no address found
- Limited to Île-de-France region

### Map Features
- **OpenStreetMap** - free, no API key
- **500m radius circles** - visual search area
- **Zoom-based loading** - shows stops only at neighborhood level
- **Geolocation** - find stops near you
- **Custom pin colors** - by transport type
- **Popup interface** - quick line selection

### Real-Time Data
- Live departure times
- Delay information
- Service status
- Auto-refresh every 30 seconds

### Supported Transport
- 🚌 Bus
- 🚇 Métro
- 🚆 RER
- 🚊 Tramway
- 🚄 Train

## 🔍 Example Searches

### Addresses
- ✅ `Rue du Maréchal Leclerc, Joinville-le-Pont`
- ✅ `12 Avenue de Paris, Saint-Maurice`
- ✅ `Place de la République`

### Stops
- ✅ `Écoles de Gravelle`
- ✅ `Châtelet Les Halles`
- ✅ `Gare de Lyon`

### Lines
- ✅ `RER A`
- ✅ `Métro 1`
- ✅ `Bus 111`

## 🐛 Troubleshooting

### Map not loading
- Check browser console for errors
- Ensure Leaflet CDN is accessible
- Try clearing browser cache

### No stops showing on map
- Zoom in to neighborhood level (zoom 15+)
- Check that API key is valid
- Verify you're in Île-de-France region

### Service won't start
```bash
# Check logs
sudo journalctl -u transit-dashboard -n 50

# Check port availability
sudo netstat -tulpn | grep 8080

# Restart service
sudo systemctl restart transit-dashboard
```

## 💡 Tips

1. **First time setup**: Search for your address to see all nearby stops at once
2. **Add multiple stops**: Search "Écoles de Gravelle" → add Bus 111 + 281, then search "Joinville RER" → add RER A
3. **Mobile friendly**: Map stacks vertically on phones
4. **Raspberry Pi**: Use HDMI output for dedicated display
5. **Kiosk mode**: Hides browser chrome, perfect for wall-mounted displays

## 📊 Performance

- **Raspberry Pi 3+**: Smooth operation
- **Raspberry Pi 4**: Excellent performance
- **Ubuntu Server**: Very fast
- **Memory**: ~100MB RAM usage
- **Startup**: ~2 seconds

## 🙏 Credits

- **IDFM/PRIM API** - Real-time transit data
- **French Government Address API** - Geocoding
- **Leaflet.js** - Map interface
- **OpenStreetMap** - Map tiles
- **FastAPI** - Backend framework

## 📜 License

Open Database License (OdBL) - Data from IDFM
Code: MIT License

---

**Made with ❤️ for Paris transit enthusiasts**

Need help? Check `/setup` or `/admin` in your browser for guided configuration.
