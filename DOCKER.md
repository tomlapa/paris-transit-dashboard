# 🐳 Docker Deployment Guide

Run your Paris Transit Dashboard in a Docker container for easy deployment and management.

## 🚀 Quick Start

### Option 1: Using Docker Compose (Recommended)

```bash
# Build and start
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

Access at: **http://localhost:8080**

### Option 2: Using Docker Run

```bash
# Build the image
docker build -t transit-dashboard .

# Run the container
docker run -d \
  --name transit-dashboard \
  -p 8080:8080 \
  -v transit-data:/app/data \
  -e TZ=Europe/Paris \
  --restart unless-stopped \
  transit-dashboard

# View logs
docker logs -f transit-dashboard
```

## 📋 Initial Setup

1. **Start the container** (see Quick Start above)
2. **Open browser**: http://localhost:8080/setup
3. **Enter your IDFM API key** (get free at https://prim.iledefrance-mobilites.fr)
4. **Add your stops** using the smart search interface
5. **View your dashboard** at http://localhost:8080

## 🔧 Configuration

### Environment Variables

```yaml
environment:
  - TZ=Europe/Paris              # Your timezone
  - API_KEY=your_key_here        # Optional: pre-configure API key
```

### Volumes

- **transit-data**: Stores your configuration and settings (persists across restarts)
- **config.yaml** (optional): Mount a pre-configured config file

### Ports

- **8080**: Web interface (change as needed, e.g., `3001:8080`)

## 🌐 Remote Access with Cloudflare

### docker-compose-with-cloudflare.yml

```yaml
version: '3.8'

services:
  transit-dashboard:
    build: .
    container_name: transit-dashboard
    ports:
      - "8080:8080"
    volumes:
      - transit-data:/app/data
    environment:
      - TZ=Europe/Paris
    restart: unless-stopped

  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: transit-tunnel
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      - TUNNEL_TOKEN=your_tunnel_token_here

volumes:
  transit-data:
```

**Deploy with:**
```bash
docker compose -f docker-compose-with-cloudflare.yml up -d
```

## 🛠️ Management Commands

```bash
# View logs
docker compose logs -f transit-dashboard

# Restart
docker compose restart transit-dashboard

# Stop
docker compose down

# Update and rebuild
docker compose down
docker compose build --no-cache
docker compose up -d

# Check resource usage
docker stats transit-dashboard

# Access container shell
docker exec -it transit-dashboard bash
```

## 💾 Backup & Restore

### Backup Configuration

```bash
# Backup the data volume
docker run --rm \
  -v transit-data:/data \
  -v $(pwd):/backup \
  ubuntu tar czf /backup/transit-backup-$(date +%Y%m%d).tar.gz -C /data .
```

### Restore Configuration

```bash
# Restore from backup
docker run --rm \
  -v transit-data:/data \
  -v $(pwd):/backup \
  ubuntu tar xzf /backup/transit-backup-20241229.tar.gz -C /data
```

## 📱 Raspberry Pi Deployment

Works perfectly on Raspberry Pi! Use the same commands:

```bash
# On Raspberry Pi (ARM)
docker compose up -d
```

For kiosk mode, add this to your Pi's autostart:
```bash
@chromium-browser --kiosk --noerrdialogs --disable-infobars http://localhost:8080
```

## 🐛 Troubleshooting

### Container won't start
```bash
# Check logs
docker compose logs transit-dashboard

# Check if port is available
sudo netstat -tulpn | grep 8080
```

### Can't access dashboard
```bash
# Check container is running
docker compose ps

# Check container health
docker inspect transit-dashboard | grep -A 10 Health
```

### Configuration lost after restart
- Ensure the volume is properly mounted
- Check volume exists: `docker volume ls`
- Inspect volume: `docker volume inspect transit-data`

### Performance issues
```bash
# Check resource usage
docker stats transit-dashboard

# Increase memory limit (in docker-compose.yml)
services:
  transit-dashboard:
    mem_limit: 512m
    cpus: 1.0
```

## 🔐 Security Best Practices

1. **Don't expose directly to internet** - Use Cloudflare tunnel or reverse proxy
2. **Keep updated**: `docker compose pull && docker compose up -d`
3. **Monitor logs**: `docker compose logs -f`
4. **Backup regularly**: Use the backup commands above

## 🌟 Advanced Usage

### Custom Port

```yaml
ports:
  - "3001:8080"  # Access at http://localhost:3001
```

### Multiple Instances

```yaml
services:
  transit-dashboard-home:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - transit-home:/app/data
  
  transit-dashboard-work:
    build: .
    ports:
      - "8081:8080"
    volumes:
      - transit-work:/app/data
```

### Behind Nginx Reverse Proxy

```nginx
location /transit {
    proxy_pass http://localhost:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

## 📊 Resource Requirements

- **CPU**: 0.5 cores minimum
- **RAM**: 256MB minimum, 512MB recommended
- **Disk**: ~100MB for image + your data
- **Network**: Requires internet for IDFM API calls

## 🆘 Getting Help

1. Check logs: `docker compose logs -f`
2. Visit setup page: http://localhost:8080/setup
3. Visit admin page: http://localhost:8080/admin
4. Check Docker status: `docker compose ps`

---

**Made with ❤️ for containerized Paris transit tracking**
