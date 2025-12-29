# 🚇 Paris Transit Dashboard

Real-time transit dashboard for Paris Île-de-France with Docker support. Track your bus, métro, RER, tram, and train departures with live updates.

![Dashboard Preview](https://via.placeholder.com/800x400.png?text=Paris+Transit+Dashboard)

## ✨ Features

- 🔍 **Smart Search** - Find stops by address or name
- 🗺️ **Interactive Map** - Click anywhere to find nearby stops
- 📍 **Geolocation** - Find stops near your current location
- ⏱️ **Real-Time Data** - Live departure times from IDFM
- 🐳 **Docker Ready** - One-command deployment
- 🌐 **Cloudflare Support** - Easy remote access
- 📱 **Mobile Friendly** - Responsive design
- 🔄 **Auto-Refresh** - Updates every 30 seconds

## 🚀 Quick Start

### One-Line Install

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR-USERNAME/paris-transit-dashboard/main/remote-install.sh | bash
```

### Manual Install

```bash
# Clone repository
git clone https://github.com/YOUR-USERNAME/paris-transit-dashboard.git
cd paris-transit-dashboard

# Start with Docker Compose
docker compose up -d

# Access at http://localhost:8080
```

### Using Docker Compose Web Interface

Paste this URL:
```
https://raw.githubusercontent.com/YOUR-USERNAME/paris-transit-dashboard/main/docker-compose.yml
```

## 📋 Requirements

- Docker & Docker Compose
- IDFM API Key (free from [prim.iledefrance-mobilites.fr](https://prim.iledefrance-mobilites.fr))

## 🔧 Configuration

1. **Start the dashboard**: `docker compose up -d`
2. **Open setup page**: http://localhost:8080/setup
3. **Enter API key**: Get yours at https://prim.iledefrance-mobilites.fr
4. **Add stops**: Use smart search or map interface
5. **View dashboard**: http://localhost:8080

## 🗺️ How to Use

### Smart Search
- Type an address: "Rue du Maréchal Leclerc, Joinville-le-Pont"
- Or search by stop name: "Écoles de Gravelle"
- Map shows nearby stops with pins
- Click a stop to see all lines
- Select line → choose direction → add!

### Map Interface
- Click anywhere on the map
- See stops within 500m radius
- Click pins to view available lines
- Add stops directly from map popups

### Direct Search
- Search by line number (Bus 111, RER A, Metro 1)
- Browse stops and directions
- Quick add to your dashboard

## 🌐 Remote Access (Optional)

Add Cloudflare Tunnel for secure remote access:

```bash
# Get your tunnel token from Cloudflare dashboard
# Edit docker-compose.yml and add:

services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: transit-tunnel
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      - TUNNEL_TOKEN=your_token_here
```

Then restart:
```bash
docker compose up -d
```

## 🛠️ Management

```bash
# View logs
docker compose logs -f

# Restart services
docker compose restart

# Stop services
docker compose down

# Update to latest version
git pull
docker compose build --no-cache
docker compose up -d

# Backup configuration
docker run --rm \
  -v transit-data:/data \
  -v $(pwd):/backup \
  ubuntu tar czf /backup/transit-backup.tar.gz -C /data .
```

## 📱 Supported Transport

- 🚌 Bus
- 🚇 Métro
- 🚆 RER
- 🚊 Tramway
- 🚄 Train (Transilien)

## 🐛 Troubleshooting

**Container won't start:**
```bash
docker compose logs transit-dashboard
```

**Can't access dashboard:**
```bash
# Check if running
docker compose ps

# Check port availability
sudo netstat -tulpn | grep 8080
```

**Configuration lost:**
```bash
# Check volume exists
docker volume ls | grep transit

# Inspect volume
docker volume inspect transit-data
```

## 🔐 Security

- Use Cloudflare Tunnel for remote access (don't expose port 8080 directly)
- Keep Docker updated: `docker compose pull`
- Backup your configuration regularly
- Use strong API keys

## 📊 Performance

- **Memory**: ~256MB RAM
- **CPU**: 0.5 cores
- **Disk**: ~100MB
- **Startup**: ~3 seconds

Tested on:
- ✅ Ubuntu Server 22.04
- ✅ Raspberry Pi 4
- ✅ macOS (Docker Desktop)
- ✅ Windows (WSL2)

## 🤝 Contributing

Contributions welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

## 📜 License

MIT License - see LICENSE file for details

## 🙏 Credits

- **IDFM/PRIM** - Real-time transit data
- **French Government Address API** - Geocoding
- **Leaflet.js** - Map interface
- **OpenStreetMap** - Map tiles
- **FastAPI** - Backend framework

## 📞 Support

- 📖 [Full Documentation](./DOCKER.md)
- 🚀 [Quick Start Guide](./QUICKSTART-DOCKER.md)
- 🐛 [Report Issues](https://github.com/YOUR-USERNAME/paris-transit-dashboard/issues)

---

**Made with ❤️ for Paris transit enthusiasts**

Access your dashboard at **http://localhost:8080** after installation.
