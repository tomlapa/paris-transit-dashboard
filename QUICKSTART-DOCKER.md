# 🚀 Quick Start - Docker Version

## Absolute Fastest Way (One Command)

```bash
curl -fsSL https://your-url.com/docker-install.sh | bash
```

## Manual Method (3 Steps)

### 1. Extract
```bash
tar -xzf transit-dashboard-v3-docker.tar.gz
cd transit-dashboard-v3
```

### 2. Build & Run
```bash
docker compose up -d
```

### 3. Configure
Open: http://localhost:8080/setup

---

## For That Web Interface You Showed

**Paste this into the URL field:**

(Upload the `docker-compose.yml` file to GitHub or paste the content)

```yaml
version: '3.8'

services:
  transit-dashboard:
    build:
      context: https://github.com/your-username/transit-dashboard.git
    container_name: transit-dashboard
    ports:
      - "8080:8080"
    volumes:
      - transit-data:/app/data
    environment:
      - TZ=Europe/Paris
    restart: unless-stopped

volumes:
  transit-data:
```

**Or with pre-built image (if you publish to Docker Hub):**

```yaml
version: '3.8'

services:
  transit-dashboard:
    image: yourusername/transit-dashboard:latest
    container_name: transit-dashboard
    ports:
      - "8080:8080"
    volumes:
      - transit-data:/app/data
    environment:
      - TZ=Europe/Paris
    restart: unless-stopped

volumes:
  transit-data:
```

---

## With Cloudflare Tunnel

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
      - TUNNEL_TOKEN=your_token_here

volumes:
  transit-data:
```

---

## Management

```bash
# View logs
docker compose logs -f

# Restart
docker compose restart

# Stop
docker compose down

# Update
docker compose pull && docker compose up -d
```

---

## Access Points

- **Setup**: http://localhost:8080/setup
- **Dashboard**: http://localhost:8080
- **Admin**: http://localhost:8080/admin

---

## What's Different from Normal Install?

| Feature | Normal Install | Docker |
|---------|---------------|--------|
| Installation | systemd service | Container |
| Updates | `git pull` | `docker compose pull` |
| Isolation | System-wide | Containerized |
| Portability | Server-specific | Run anywhere |
| Cleanup | Manual uninstall | `docker compose down -v` |

---

## Why Use Docker?

✅ **Easier to test** - Delete and recreate instantly
✅ **Portable** - Works on any Docker host
✅ **Isolated** - Doesn't affect your system
✅ **Reproducible** - Same environment everywhere
✅ **Easy cleanup** - Remove everything with one command

---

## First Time Setup

1. **Start container**: `docker compose up -d`
2. **Get API key**: https://prim.iledefrance-mobilites.fr
3. **Configure**: http://localhost:8080/setup
4. **Add stops**: Use smart search
5. **View**: http://localhost:8080

Done! 🎉
