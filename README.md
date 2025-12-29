# 🚇 Paris Transit Dashboard - VPS Edition

Real-time transit dashboard for Paris Île-de-France with **automatic VPS setup**. One command installs everything and makes it accessible online.

## ✨ Features

- 🔍 **Smart Search** - Find stops by address or name
- 🗺️ **Interactive Map** - Click anywhere to find nearby stops  
- 📍 **Geolocation** - Find stops near your current location
- ⏱️ **Real-Time Data** - Live departure times from IDFM
- 🐳 **Docker Ready** - Containerized deployment
- 🌐 **Auto Online** - Automatically configured for public access
- 🔓 **Auto Firewall** - Opens required ports automatically
- 📱 **Mobile Friendly** - Responsive design
- 🔄 **Auto-Refresh** - Updates every 30 seconds

## 🚀 One-Command Install (VPS)

```bash
curl -fsSL https://raw.githubusercontent.com/tomlapa/paris-transit-dashboard/main/remote-install.sh | bash
```

**That's it!** The script will:
- ✅ Detect your public IP
- ✅ Detect your cloud provider (AWS, DigitalOcean, GCP, Azure, etc.)
- ✅ Install Docker if needed
- ✅ Configure firewall automatically (UFW, firewalld, iptables)
- ✅ Start the dashboard
- ✅ Give you the public URL to access it

### What You'll See

```
╔════════════════════════════════════════════════════════╗
║        Paris Transit Dashboard - Auto Setup            ║
╚════════════════════════════════════════════════════════╝

🔍 Detecting public IP address...
✓ Public IP detected: 123.45.67.89

🔍 Detecting cloud provider...
✓ Cloud provider detected: DigitalOcean

🔍 Checking if port 8080 is accessible...
✓ Port 8080 is available

🔍 Checking firewall configuration...
✓ Port 8080 opened in UFW

🚀 Starting Paris Transit Dashboard...
✓ Application is running!

╔════════════════════════════════════════════════════════╗
║              🎉 Setup Complete! 🎉                     ║
╚════════════════════════════════════════════════════════╝

📍 YOUR DASHBOARD IS NOW ONLINE!

Access it at:
  http://123.45.67.89:8080

Setup page:
  http://123.45.67.89:8080/setup
```

## 📋 Requirements

- **VPS/Cloud Server** (AWS, DigitalOcean, Linode, Vultr, etc.)
- **Ubuntu/Debian** based system
- **Root or sudo access**
- **IDFM API Key** (free from [prim.iledefrance-mobilites.fr](https://prim.iledefrance-mobilites.fr))

## 🔧 Manual Installation

If you prefer to do it step by step:

```bash
# Clone repository
git clone https://github.com/tomlapa/paris-transit-dashboard.git
cd paris-transit-dashboard

# Run auto-setup
bash auto-setup.sh
```

## 🗺️ Initial Configuration

After installation, visit your dashboard's setup page:

1. **Go to**: `http://YOUR-IP:8080/setup`
2. **Enter API Key**: Get yours at https://prim.iledefrance-mobilites.fr
3. **Add Stops**: Use smart search or map interface
4. **View Dashboard**: `http://YOUR-IP:8080`

### Smart Search
- Type an address: "Rue du Maréchal Leclerc, Joinville-le-Pont"
- Or search by stop name: "Écoles de Gravelle"
- Map shows nearby stops with pins
- Click a stop → see all lines → add to dashboard

### Map Interface
- Click anywhere on the map
- See stops within 500m radius
- Click pins to view available lines
- Add stops directly from map popups

## 🛠️ Management

All access information is saved in `ACCESS-INFO.txt` in your installation directory.

```bash
# View logs
docker compose logs -f

# Restart
docker compose restart

# Stop
docker compose down

# Update to latest version
git pull
docker compose up -d --build

# Check status
docker compose ps
```

## 📱 Supported Transport

- 🚌 Bus
- 🚇 Métro
- 🚆 RER
- 🚊 Tramway
- 🚄 Train (Transilien)

## 🔐 Security Notes

Your dashboard is **publicly accessible** by default (no authentication).

### For Production Use:

**Option 1: Add Basic Auth with Nginx**
```bash
sudo apt install nginx apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd username
```

**Option 2: Cloudflare Tunnel (HTTPS + Optional Auth)**
```bash
# Add to docker-compose.yml
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      - TUNNEL_TOKEN=your_token_here
```

**Option 3: Restrict by IP (Cloud Firewall)**
- AWS: Security Groups
- DigitalOcean: Cloud Firewall
- GCP: Firewall Rules
- Azure: Network Security Groups

## 🐛 Troubleshooting

### Can't access dashboard from internet

**Check cloud provider firewall:**

- **AWS**: EC2 → Security Groups → Allow port 8080
- **DigitalOcean**: Networking → Firewalls → Add port 8080
- **GCP**: VPC → Firewall Rules → Allow tcp:8080
- **Azure**: Network Security Group → Add inbound rule for 8080

**Check container is running:**
```bash
docker compose ps
docker compose logs
```

**Check port is open locally:**
```bash
curl http://localhost:8080
```

### Port 8080 already in use

```bash
# Find what's using it
sudo netstat -tulpn | grep 8080

# Change port in docker-compose.yml
ports:
  - "3000:8080"  # Use 3000 instead
```

### Firewall issues

```bash
# UFW
sudo ufw status
sudo ufw allow 8080/tcp

# firewalld
sudo firewall-cmd --list-ports
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload

# iptables
sudo iptables -L -n | grep 8080
sudo iptables -I INPUT -p tcp --dport 8080 -j ACCEPT
```

## 📊 Performance

- **Memory**: ~256MB RAM
- **CPU**: 0.5 cores
- **Disk**: ~100MB
- **Startup**: ~3 seconds

Tested on:
- ✅ AWS EC2 (t2.micro and up)
- ✅ DigitalOcean Droplets ($4/mo and up)
- ✅ Linode Nanodes
- ✅ Vultr Cloud Compute
- ✅ Google Cloud Compute Engine
- ✅ Azure Virtual Machines

## 🌐 Cloud Provider Notes

### AWS
- Use Amazon Linux 2 or Ubuntu
- Remember to configure Security Group for port 8080

### DigitalOcean
- Use Ubuntu 22.04 droplet
- $4/month droplet is sufficient
- Configure Cloud Firewall if enabled

### Google Cloud
- Use Ubuntu image
- Add firewall rule for tcp:8080
- May need to enable external IP

### Azure
- Use Ubuntu VM
- Configure Network Security Group
- Add inbound rule for port 8080

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

- 📖 [Docker Documentation](./DOCKER.md)
- 🚀 [Quick Start Guide](./QUICKSTART-DOCKER.md)
- 🐛 [Report Issues](https://github.com/tomlapa/paris-transit-dashboard/issues)

---

**Made with ❤️ for Paris transit enthusiasts**

One command. Automatically online. No configuration needed.
