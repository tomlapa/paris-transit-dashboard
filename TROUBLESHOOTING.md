# 🔍 Testing & Troubleshooting Guide

## Quick Test Checklist

After deploying, test these features in order:

### ✅ 1. API Key Validation
1. Go to http://localhost:8080
2. Paste your API key (should be visible)
3. Click "Valider la clé"
4. Should show: "✓ Clé valide et sauvegardée"

**If it fails:**
- Check key is correct from prim.iledefrance-mobilites.fr
- Look at browser console (F12) for errors
- Check Docker logs: `docker-compose logs -f`

### ✅ 2. Advanced Search (EASIEST TEST)
1. Click "🚀 Recherche Avancée" tab
2. Search for: `Écoles de Gravelle`
3. Should find multiple results (Bus 111, 281, etc.)
4. Click one result
5. Should switch to wizard and show directions

**If it fails:**
- Check API key is valid
- Verify container has internet access: `docker exec transit-dashboard curl -I https://data.iledefrance-mobilites.fr`

### ✅ 3. Address Search (Step-by-Step Wizard)
1. Click "🧭 Assistant Étape par Étape" tab
2. Try these searches:

**Good examples:**
- `Saint-Maurice 94410` ✓
- `10 Rue de Rivoli, Paris` ✓
- `Gare de Lyon` ✓

**What happens:**
1. Address found → Shows on map
2. Finds nearby stops → Lists them
3. Auto-advances to Step 2

**If no stops found:**
- Map should still show the address
- Error will suggest using Advanced Search
- Try a different address closer to transit

### ✅ 4. Complete Flow
1. Start with address search or advanced search
2. Select stop → Select lines → Select directions
3. Click "Ajouter au Dashboard"
4. Go to http://localhost:8080/ to see live departures

## Common Issues & Fixes

### Issue: "Erreur lors de la recherche"

**Causes:**
1. API timeout (IDFM is slow sometimes)
2. No API key configured
3. Network issue

**Fixes:**
```bash
# Check logs
docker-compose logs --tail=50

# Restart container
docker-compose restart

# Check API key in config
cat data/transit_config.json
```

### Issue: Address search finds nothing

**Causes:**
1. Address too vague (e.g., just "Saint-Maurice")
2. Address outside Île-de-France
3. French geocoding API slow

**Fixes:**
- Add postal code: `Saint-Maurice 94410`
- Use full address: `260 Rue du Maréchal Leclerc, Saint-Maurice`
- Try Advanced Search instead (searches by stop name)

### Issue: Advanced search works, wizard doesn't

**Likely cause:** Timeout on `/api/stops/nearby`

**Fix:**
The nearby stops endpoint uses a fallback strategy with timeouts. If it's timing out:

```bash
# Check if API is responding slowly
docker-compose logs | grep "timeout"

# Increase timeout (edit main.py)
# Change timeout=15 to timeout=30 in find_stops_near()
```

### Issue: Clicked advanced search result, nothing happens

**This should be fixed now.** The result should:
1. Switch to wizard tab
2. Jump to directions (Step 4)
3. Show direction options

If still not working:
- Open browser console (F12)
- Look for JavaScript errors
- Report exact error message

## Manual API Tests

Test endpoints directly:

```bash
# 1. Test French address API (should work without container)
curl "https://api-adresse.data.gouv.fr/search/?q=Saint-Maurice%2094410"

# 2. Test your app's search (container must be running)
curl "http://localhost:8080/api/search/stops?q=Écoles"

# 3. Test nearby stops (replace YOUR_KEY)
# First get coordinates for address
curl "https://api-adresse.data.gouv.fr/search/?q=Saint-Maurice%2094410" | jq '.features[0].geometry.coordinates'

# Then search nearby (use lat/lon from above, swapped)
curl "http://localhost:8080/api/stops/nearby?lat=48.8179&lon=2.4589&radius=500"
```

## Logs Analysis

```bash
# Real-time logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Search for errors
docker-compose logs | grep -i error

# Search for API calls
docker-compose logs | grep -i "GET /api"
```

## Network Debugging

```bash
# Check if container can reach IDFM API
docker exec transit-dashboard curl -I https://data.iledefrance-mobilites.fr
docker exec transit-dashboard curl -I https://prim.iledefrance-mobilites.fr

# Check DNS
docker exec transit-dashboard nslookup data.iledefrance-mobilites.fr
```

## Performance Issues

If searches are very slow:

1. **Check IDFM API status:**
   - Visit https://prim.iledefrance-mobilites.fr
   - Check if there are service announcements

2. **Increase timeouts:**
   Edit `api/client.py` and increase timeout values

3. **Check your network:**
   ```bash
   ping data.iledefrance-mobilites.fr
   ```

## Configuration Reset

If everything is broken:

```bash
# Stop container
docker-compose down

# Backup config
cp data/transit_config.json data/transit_config.json.backup

# Delete config (will create fresh one)
rm data/transit_config.json

# Restart
docker-compose up -d

# Re-enter API key and configure stops
```

## Still Not Working?

1. **Check browser console (F12)**
   - Look for red errors
   - Check Network tab for failed requests

2. **Check Docker logs**
   ```bash
   docker-compose logs --tail=200
   ```

3. **Verify setup:**
   - API key is valid ✓
   - Container is running ✓
   - Can access http://localhost:8080 ✓
   - Port 8080 not blocked by firewall ✓

4. **Test with curl:**
   ```bash
   # Should return HTML
   curl http://localhost:8080
   
   # Should return JSON
   curl http://localhost:8080/api/config
   ```

## Report Issues

If you're still stuck, provide:
1. Browser console errors (F12)
2. Docker logs: `docker-compose logs --tail=100`
3. What you searched for
4. Screenshot of error
5. Output of: `curl http://localhost:8080/api/config`

---

**Remember:** Advanced Search is the most reliable way to add stops. Use it if address search gives problems!
