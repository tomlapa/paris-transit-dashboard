# 🚇 Transit Dashboard - Docker Deployment

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Clone/extract the files
cd transit-dashboard-v3-docker

# Start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

Access at: **http://localhost:8080**

### Using Docker directly

```bash
# Build
docker build -t transit-dashboard .

# Run
docker run -d \
  --name transit-dashboard \
  -p 8080:8080 \
  -v $(pwd)/data:/data \
  -e TZ=Europe/Paris \
  --restart unless-stopped \
  transit-dashboard

# View logs
docker logs -f transit-dashboard

# Stop
docker stop transit-dashboard && docker rm transit-dashboard
```

## Data Persistence

Configuration is stored in `./data/transit_config.json` which is mounted as a volume.

This means:
- ✅ Your stops and API key persist across container restarts
- ✅ You can backup `./data/` directory
- ✅ You can edit config directly if needed

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TZ` | `Europe/Paris` | Timezone for departures |
| `CONFIG_PATH` | `/data/transit_config.json` | Config file location |

## Updating

```bash
# Pull latest image/rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

Your configuration in `./data/` will be preserved!

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs

# Check if port 8080 is already in use
sudo netstat -tulpn | grep 8080

# Use different port
# Edit docker-compose.yml: "8081:8080"
```

### Config not persisting
```bash
# Check data directory permissions
ls -la ./data/

# Should be writable
chmod 777 ./data/
```

### Can't access from other devices
```bash
# Make sure you're using the server's IP, not localhost
# Example: http://192.168.1.100:8080

# Check firewall
sudo ufw allow 8080
```

## Remote Server Deployment

### On your server:

```bash
# Install Docker if needed
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Logout and login again

# Create directory
mkdir -p ~/transit-dashboard
cd ~/transit-dashboard

# Upload files (from your local machine)
scp -r transit-dashboard-v3-docker/* user@server:~/transit-dashboard/

# On server: Start
cd ~/transit-dashboard
docker-compose up -d
```

### With Cloudflare Tunnel (Free Remote Access)

```bash
# On server: Install cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Start tunnel
cloudflared tunnel --url http://localhost:8080

# You'll get: https://random-name.trycloudflare.com
# Access from anywhere!
```

### Make tunnel persistent:

```bash
# Create docker-compose override
cat > docker-compose.override.yml << 'EOF'
version: '3.8'
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    command: tunnel --no-autoupdate --url http://transit-dashboard:8080
    depends_on:
      - transit-dashboard
    restart: unless-stopped
EOF

# Restart
docker-compose up -d
```

## Docker on Raspberry Pi

Works on:
- ✅ Raspberry Pi 4
- ✅ Raspberry Pi 3 B+
- ⚠️  Raspberry Pi 3 (slower)
- ❌ Raspberry Pi 2 or older (not recommended)

```bash
# Install Docker on Raspberry Pi
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Use same docker-compose.yml as above
docker-compose up -d
```

## System Requirements

- **CPU**: 1 core minimum
- **RAM**: 256MB minimum (512MB recommended)
- **Disk**: 200MB
- **Network**: Internet access for IDFM API

## Architecture Support

- ✅ **linux/amd64** (x86_64 servers)
- ✅ **linux/arm64** (Raspberry Pi 4, Apple Silicon)
- ✅ **linux/arm/v7** (Raspberry Pi 3)

## Configuration

After starting the container, visit **http://localhost:8080** and:

1. Enter your IDFM API key
2. Add stops using the step-by-step wizard
3. View real-time departures!

## Backup & Restore

### Backup
```bash
# Backup config
cp data/transit_config.json transit_config.backup.json
```

### Restore
```bash
# Restore config
cp transit_config.backup.json data/transit_config.json

# Restart container
docker-compose restart
```

## Production Tips

1. **Use a reverse proxy** (Nginx/Traefik) for HTTPS
2. **Set resource limits** in docker-compose.yml:
   ```yaml
   deploy:
     resources:
       limits:
         memory: 512M
   ```
3. **Monitor with Portainer** for easy management
4. **Auto-update** with Watchtower

## Support

- Check logs: `docker-compose logs -f`
- Restart: `docker-compose restart`
- Rebuild: `docker-compose build --no-cache`

---

**Made with ❤️ for Paris transit enthusiasts**
