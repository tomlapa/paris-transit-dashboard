#!/bin/bash

echo "=== Testing Transit Dashboard API Endpoints ==="
echo ""

BASE_URL="http://localhost:8080"

echo "1. Testing geocoding (French Address API)..."
curl -s "https://api-adresse.data.gouv.fr/search/?q=Saint-Maurice%2094410" | jq -r '.features[0].properties.label' || echo "FAILED"
echo ""

echo "2. Testing search stops (requires running app)..."
curl -s "${BASE_URL}/api/search/stops?q=Écoles" | jq '.results | length' || echo "NOT RUNNING"
echo ""

echo "3. Testing nearby stops..."
# Coordinates for Saint-Maurice
curl -s "${BASE_URL}/api/stops/nearby?lat=48.8179&lon=2.4589&radius=500" | jq '.results | length' || echo "NOT RUNNING"
echo ""

echo "Done!"
