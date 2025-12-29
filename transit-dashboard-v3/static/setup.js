// Setup Wizard JavaScript with Unified Search + Leaflet Map

// Global state
let map = null;
let currentCircle = null;
let markersLayer = null;
let selectedStop = null;
let selectedLine = null;

// Paris coordinates
const PARIS_CENTER = [48.8566, 2.3522];
const PARIS_ZOOM = 12;
const NEIGHBORHOOD_ZOOM = 15;

// Address keywords for smart detection
const ADDRESS_KEYWORDS = ['rue', 'avenue', 'boulevard', 'place', 'quai', 'impasse', 'allée', 'chemin', 'route', 'voie'];

// Transport type colors
const TRANSPORT_COLORS = {
    'metro': '#0088ce',  // Blue
    'rer': '#00a950',    // Green
    'bus': '#ffbe00',    // Yellow
    'tram': '#ff5a00',   // Orange
    'train': '#8b5ea3'   // Purple
};

document.addEventListener('DOMContentLoaded', () => {
    initializePage();
});

function initializePage() {
    // Initialize map
    initMap();
    
    // Tab switching
    initTabs();
    
    // API Key form
    initApiKeyForm();
    
    // Unified search (Tab 1)
    initUnifiedSearch();
    
    // Direct search (Tab 2)
    initDirectSearch();
    
    // Remove stop handlers
    initRemoveButtons();
    
    // Modal controls
    initModal();
}

// ==================== MAP INITIALIZATION ====================

function initMap() {
    // Initialize Leaflet map
    map = L.map('map').setView(PARIS_CENTER, PARIS_ZOOM);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    // Create markers layer
    markersLayer = L.layerGroup().addTo(map);
    
    // Map click handler - search nearby stops
    map.on('click', handleMapClick);
    
    // Zoom handler - show stops when zoomed in
    map.on('zoomend', handleMapZoom);
    
    // Locate me button
    document.getElementById('locate-me').addEventListener('click', locateUser);
    
    // Recenter button
    document.getElementById('recenter-map').addEventListener('click', () => {
        map.setView(PARIS_CENTER, PARIS_ZOOM);
        clearMapMarkers();
    });
}

async function handleMapClick(e) {
    const { lat, lng } = e.latlng;
    await searchNearbyStops(lat, lng, true);
}

function handleMapZoom() {
    const zoom = map.getZoom();
    // Only auto-load stops when zoomed to neighborhood level
    if (zoom >= NEIGHBORHOOD_ZOOM) {
        const center = map.getCenter();
        // Don't auto-search, wait for user interaction
    }
}

function locateUser() {
    if ('geolocation' in navigator) {
        showStatus('info', '📍 Localisation en cours...');
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                map.setView([latitude, longitude], NEIGHBORHOOD_ZOOM);
                await searchNearbyStops(latitude, longitude, true);
                hideStatus();
            },
            (error) => {
                showStatus('error', '❌ Impossible de vous localiser');
            }
        );
    } else {
        showStatus('error', '❌ Géolocalisation non disponible');
    }
}

// ==================== TAB MANAGEMENT ====================

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            
            // Update button states
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update tab content
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`${targetTab}-tab`).classList.add('active');
        });
    });
}

// ==================== API KEY FORM ====================

function initApiKeyForm() {
    const form = document.getElementById('api-key-form');
    const statusEl = document.getElementById('api-status');
    
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const apiKey = document.getElementById('api-key').value;
            
            if (!apiKey || apiKey === '••••••••') {
                showStatus('error', 'Veuillez entrer une clé API');
                return;
            }
            
            statusEl.textContent = 'Validation en cours...';
            statusEl.className = 'status-message info';
            statusEl.classList.remove('hidden');
            
            try {
                const formData = new FormData();
                formData.append('api_key', apiKey);
                
                const response = await fetch('/api/config/apikey', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.success) {
                    statusEl.textContent = '✓ ' + result.message;
                    statusEl.className = 'status-message success';
                    document.getElementById('step-2').style.opacity = '1';
                    document.getElementById('step-2').style.pointerEvents = 'auto';
                } else {
                    statusEl.textContent = '✗ ' + result.message;
                    statusEl.className = 'status-message error';
                }
            } catch (err) {
                statusEl.textContent = 'Erreur de connexion';
                statusEl.className = 'status-message error';
            }
        });
    }
}

// ==================== UNIFIED SEARCH (SMART) ====================

function initUnifiedSearch() {
    const searchInput = document.getElementById('unified-search-input');
    const searchBtn = document.getElementById('unified-search-btn');
    
    searchBtn.addEventListener('click', performUnifiedSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performUnifiedSearch();
    });
}

async function performUnifiedSearch() {
    const query = document.getElementById('unified-search-input').value.trim();
    if (!query) return;
    
    const resultsEl = document.getElementById('unified-results');
    resultsEl.innerHTML = '<div class="loading">Recherche en cours...</div>';
    
    // Smart detection: check for address keywords
    const lowerQuery = query.toLowerCase();
    const isAddress = ADDRESS_KEYWORDS.some(keyword => lowerQuery.includes(keyword));
    
    try {
        if (isAddress) {
            // Try address search first
            showStatus('info', '🗺️ Recherche d\'adresse...');
            const addresses = await searchAddress(query);
            
            if (addresses.length > 0) {
                const addr = addresses[0];
                showStatus('success', `📍 Adresse trouvée: ${addr.label}`);
                map.setView([addr.lat, addr.lon], NEIGHBORHOOD_ZOOM);
                await searchNearbyStops(addr.lat, addr.lon, true);
            } else {
                // Fallback to stop search
                showStatus('info', '🚏 Recherche d\'arrêts par nom...');
                await searchStopsByName(query);
            }
        } else {
            // Search stops by name
            showStatus('info', '🚏 Recherche d\'arrêts...');
            await searchStopsByName(query);
        }
    } catch (err) {
        console.error('Search error:', err);
        resultsEl.innerHTML = '<div class="info-message">Erreur de recherche</div>';
        showStatus('error', '❌ Erreur de recherche');
    }
}

async function searchAddress(query) {
    const response = await fetch(`/api/search/address?q=${encodeURIComponent(query)}`);
    const data = await response.json();
    return data.results || [];
}

async function searchStopsByName(query) {
    const response = await fetch(`/api/search/stops?q=${encodeURIComponent(query)}`);
    const data = await response.json();
    const stops = data.results || [];
    
    displayStopResults(stops);
    
    // If we have results, show them on map
    if (stops.length > 0) {
        // This is a simplified view - stops don't have coordinates in this search
        // So we won't show them on map unless we do a followup nearby search
        hideStatus();
    }
}

async function searchNearbyStops(lat, lon, showCircle = false) {
    const radius = 500; // Fixed 500m
    
    try {
        // Add timeout wrapper (15 seconds max)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(
            `/api/stops/nearby?lat=${lat}&lon=${lon}&radius=${radius}`,
            { signal: controller.signal }
        );
        clearTimeout(timeoutId);
        
        const data = await response.json();
        const stops = data.results || [];
        
        if (stops.length === 0) {
            document.getElementById('unified-results').innerHTML = 
                '<div class="info-message">Aucun arrêt trouvé dans un rayon de 500m. Essayez la recherche directe.</div>';
            hideStatus();
            return;
        }
        
        // Show radius circle on map
        if (showCircle) {
            clearMapMarkers();
            currentCircle = L.circle([lat, lon], {
                color: '#f68b1e',
                fillColor: '#f68b1e',
                fillOpacity: 0.1,
                radius: radius
            }).addTo(map);
        }
        
        // Display results in list
        displayNearbyResults(stops);
        
        // Show stops on map as pins
        displayStopsOnMap(stops);
        
        hideStatus();
        
    } catch (err) {
        console.error('Nearby search error:', err);
        document.getElementById('unified-results').innerHTML = 
            '<div class="info-message">❌ Erreur de recherche. Utilisez la recherche directe par nom d\'arrêt.</div>';
        showStatus('error', '❌ Recherche échouée - Utilisez la recherche directe');
    }
}

function displayStopResults(stops) {
    const resultsEl = document.getElementById('unified-results');
    
    if (stops.length === 0) {
        resultsEl.innerHTML = '<div class="info-message">Aucun arrêt trouvé</div>';
        return;
    }
    
    resultsEl.innerHTML = stops.slice(0, 15).map(stop => `
        <div class="result-item" data-stop-id="${stop.stop_id}" data-stop-name="${stop.stop_name}">
            <div class="result-info">
                <span class="transport-icon">${getTransportIcon(stop.transport_type)}</span>
                <div class="result-details">
                    <div class="result-name">${stop.stop_name}</div>
                    <div class="result-meta">${stop.line_name} ${stop.town ? '· ' + stop.town : ''}</div>
                </div>
            </div>
        </div>
    `).join('');
    
    // Add click handlers - but this won't show on map since we don't have coords
    resultsEl.querySelectorAll('.result-item').forEach(item => {
        item.addEventListener('click', () => {
            // For stop name search, we can't show on map, just proceed to select
            alert('Utilisez la carte pour voir la position exacte de cet arrêt, ou cherchez par adresse');
        });
    });
}

function displayNearbyResults(stops) {
    const resultsEl = document.getElementById('unified-results');
    
    resultsEl.innerHTML = `
        <div style="padding: 15px; background: #3a3a5c; color: #f68b1e; border-bottom: 1px solid #1a1a2e;">
            ${stops.length} arrêt(s) trouvé(s) dans un rayon de 500m
        </div>
        ${stops.map(stop => `
            <div class="result-item" data-stop-id="${stop.stop_id}" data-stop-id-raw="${stop.stop_id_raw}">
                <div class="result-info">
                    <span class="transport-icon">🚏</span>
                    <div class="result-details">
                        <div class="result-name">${stop.stop_name}</div>
                        <div class="result-meta">${stop.town || ''}</div>
                    </div>
                </div>
                <span class="distance-badge">${stop.distance}m</span>
            </div>
        `).join('')}
    `;
    
    // Add click handlers
    resultsEl.querySelectorAll('.result-item').forEach(item => {
        item.addEventListener('click', async () => {
            const stopIdRaw = item.dataset.stopIdRaw;
            const stopId = item.dataset.stopId;
            const stopName = item.querySelector('.result-name').textContent;
            
            await showLinesAtStop(stopId, stopIdRaw, stopName);
        });
    });
}

function displayStopsOnMap(stops) {
    // Clear previous markers
    markersLayer.clearLayers();
    
    stops.forEach(stop => {
        // We'll need to determine transport type - for now use generic pin
        // In production, you'd fetch lines at each stop to determine primary type
        const marker = L.marker([stop.lat, stop.lon], {
            icon: createCustomIcon('bus') // Default to bus for now
        }).addTo(markersLayer);
        
        // Fetch lines for popup
        marker.on('click', async () => {
            const lines = await fetchLinesAtStop(stop.stop_id_raw);
            showStopPopup(marker, stop, lines);
        });
    });
}

async function fetchLinesAtStop(stopIdRaw) {
    try {
        const response = await fetch(`/api/stop/lines?stop_id=${encodeURIComponent(stopIdRaw)}`);
        const data = await response.json();
        return data.results || [];
    } catch (err) {
        console.error('Error fetching lines:', err);
        return [];
    }
}

function showStopPopup(marker, stop, lines) {
    const popupContent = `
        <div class="popup-stop-name">${stop.stop_name}</div>
        ${lines.length > 0 ? lines.map(line => `
            <div class="popup-line" data-stop-id="${stop.stop_id}" data-stop-id-raw="${stop.stop_id_raw}" 
                 data-stop-name="${stop.stop_name}" data-line-id="${line.line_id}" 
                 data-line-name="${line.line_name}" data-transport="${line.transport_type}">
                <span class="transport-icon">${getTransportIcon(line.transport_type)}</span>
                <span class="popup-line-badge">${line.line_name}</span>
                <span style="flex: 1; color: #888;">${line.mode}</span>
            </div>
        `).join('') : '<div style="color: #888;">Chargement des lignes...</div>'}
    `;
    
    const popup = L.popup()
        .setLatLng([stop.lat, stop.lon])
        .setContent(popupContent)
        .openOn(map);
    
    // After popup opens, add click handlers
    setTimeout(() => {
        document.querySelectorAll('.popup-line').forEach(lineEl => {
            lineEl.addEventListener('click', () => {
                selectedStop = {
                    id: lineEl.dataset.stopId,
                    idRaw: lineEl.dataset.stopIdRaw,
                    name: lineEl.dataset.stopName
                };
                selectedLine = {
                    id: lineEl.dataset.lineId,
                    name: lineEl.dataset.lineName,
                    transport: lineEl.dataset.transport
                };
                map.closePopup();
                showDirectionsModal();
            });
        });
    }, 100);
}

async function showLinesAtStop(stopId, stopIdRaw, stopName) {
    selectedStop = { id: stopId, idRaw: stopIdRaw, name: stopName };
    
    const modal = document.getElementById('direction-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalInfo = document.getElementById('modal-stop-info');
    const directionsList = document.getElementById('directions-list');
    
    modalTitle.textContent = 'Choisir une ligne';
    modalInfo.textContent = `Arrêt: ${stopName}`;
    directionsList.innerHTML = '<div class="loading">Chargement des lignes...</div>';
    
    modal.style.display = 'flex';
    
    try {
        const response = await fetch(`/api/stop/lines?stop_id=${encodeURIComponent(stopIdRaw)}`);
        const data = await response.json();
        const lines = data.results || [];
        
        if (lines.length === 0) {
            directionsList.innerHTML = '<div class="info-message">Aucune ligne trouvée</div>';
            return;
        }
        
        directionsList.innerHTML = lines.map(line => `
            <div class="direction-item" data-line-id="${line.line_id}" 
                 data-line-name="${line.line_name}" data-transport="${line.transport_type}">
                <div class="result-info">
                    <span class="transport-icon">${getTransportIcon(line.transport_type)}</span>
                    <span style="background: #f68b1e; color: #000; padding: 2px 8px; border-radius: 4px; font-weight: bold;">
                        ${line.line_name}
                    </span>
                    <span style="margin-left: 10px; color: #888;">${line.mode}</span>
                </div>
            </div>
        `).join('');
        
        // Add click handlers
        directionsList.querySelectorAll('.direction-item').forEach(item => {
            item.addEventListener('click', () => {
                selectedLine = {
                    id: item.dataset.lineId,
                    name: item.dataset.lineName,
                    transport: item.dataset.transport
                };
                showDirectionsModal();
            });
        });
    } catch (err) {
        console.error('Error loading lines:', err);
        directionsList.innerHTML = '<div class="info-message">Erreur de chargement</div>';
    }
}

async function showDirectionsModal() {
    const modal = document.getElementById('direction-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalInfo = document.getElementById('modal-stop-info');
    const directionsList = document.getElementById('directions-list');
    
    modalTitle.textContent = 'Choisir une direction';
    modalInfo.textContent = `${selectedStop.name} - ${selectedLine.name}`;
    directionsList.innerHTML = '<div class="loading">Chargement des directions...</div>';
    
    modal.style.display = 'flex';
    
    try {
        const response = await fetch(
            `/api/stop/directions?stop_id=${encodeURIComponent(selectedStop.id)}&line_id=${encodeURIComponent(selectedLine.id)}`
        );
        const data = await response.json();
        const directions = data.directions || [];
        
        if (directions.length === 0) {
            directionsList.innerHTML = `
                <p style="color: #888;">Aucune direction disponible en temps réel.</p>
                <button class="btn btn-primary" id="add-without-direction">Ajouter quand même</button>
            `;
            document.getElementById('add-without-direction').addEventListener('click', () => {
                addStop(null, null);
            });
            return;
        }
        
        directionsList.innerHTML = directions.map(dir => `
            <div class="direction-item" data-direction="${dir.direction}" data-direction-id="${dir.direction_id || ''}">
                <span>→ ${dir.direction}</span>
            </div>
        `).join('');
        
        // Add click handlers
        directionsList.querySelectorAll('.direction-item').forEach(item => {
            item.addEventListener('click', () => {
                addStop(item.dataset.direction, item.dataset.directionId);
            });
        });
    } catch (err) {
        console.error('Error loading directions:', err);
        directionsList.innerHTML = '<div class="info-message">Erreur de chargement</div>';
    }
}

async function addStop(direction, directionId) {
    try {
        const formData = new FormData();
        formData.append('stop_id', selectedStop.id);
        formData.append('stop_name', selectedStop.name);
        formData.append('line', selectedLine.name);
        formData.append('line_id', selectedLine.id || '');
        formData.append('direction', direction || '');
        formData.append('direction_id', directionId || '');
        formData.append('transport_type', selectedLine.transport || 'bus');
        
        const response = await fetch('/api/stops/add', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            window.location.reload();
        } else {
            alert(result.message || 'Erreur lors de l\'ajout');
        }
    } catch (err) {
        console.error('Add stop error:', err);
        alert('Erreur de connexion');
    }
}

// ==================== DIRECT SEARCH (LEGACY) ====================

function initDirectSearch() {
    const searchInput = document.getElementById('direct-search-input');
    const searchBtn = document.getElementById('direct-search-btn');
    
    searchBtn.addEventListener('click', performDirectSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performDirectSearch();
    });
}

async function performDirectSearch() {
    const query = document.getElementById('direct-search-input').value.trim();
    if (!query) return;
    
    const resultsEl = document.getElementById('direct-results');
    resultsEl.innerHTML = '<div class="loading">Recherche...</div>';
    
    try {
        const response = await fetch(`/api/search/stops?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        const stops = data.results || [];
        
        if (stops.length === 0) {
            resultsEl.innerHTML = '<div class="info-message">Aucun résultat trouvé</div>';
            return;
        }
        
        // Deduplicate
        const seen = new Set();
        const uniqueStops = stops.filter(s => {
            const key = `${s.stop_id}-${s.line_name}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        
        resultsEl.innerHTML = uniqueStops.slice(0, 20).map(stop => `
            <div class="result-item" data-stop-id="${stop.stop_id}" data-stop-name="${stop.stop_name}"
                 data-line="${stop.line_name}" data-line-id="${stop.line_id}" data-transport="${stop.transport_type}">
                <div class="result-info">
                    <span class="transport-icon">${getTransportIcon(stop.transport_type)}</span>
                    <div class="result-details">
                        <div class="result-name">${stop.line_name} - ${stop.stop_name}</div>
                        <div class="result-meta">${stop.town || ''}</div>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Add click handlers
        resultsEl.querySelectorAll('.result-item').forEach(item => {
            item.addEventListener('click', () => {
                selectedStop = {
                    id: item.dataset.stopId,
                    idRaw: item.dataset.stopId,
                    name: item.dataset.stopName
                };
                selectedLine = {
                    id: item.dataset.lineId,
                    name: item.dataset.line,
                    transport: item.dataset.transport
                };
                showDirectionsModal();
            });
        });
    } catch (err) {
        console.error('Direct search error:', err);
        resultsEl.innerHTML = '<div class="info-message">Erreur de recherche</div>';
    }
}

// ==================== MODAL & HELPERS ====================

function initModal() {
    const modal = document.getElementById('direction-modal');
    const closeBtn = modal.querySelector('.close-modal');
    
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

function initRemoveButtons() {
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Supprimer cet arrêt ?')) return;
            
            try {
                const formData = new FormData();
                formData.append('stop_id', btn.dataset.id);
                formData.append('direction', btn.dataset.direction || '');
                
                const response = await fetch('/api/stops/remove', {
                    method: 'POST',
                    body: formData
                });
                
                if ((await response.json()).success) {
                    btn.closest('.stop-card').remove();
                }
            } catch (err) {
                console.error(err);
            }
        });
    });
}

function clearMapMarkers() {
    markersLayer.clearLayers();
    if (currentCircle) {
        map.removeLayer(currentCircle);
        currentCircle = null;
    }
}

function createCustomIcon(transportType) {
    const color = TRANSPORT_COLORS[transportType] || '#f68b1e';
    
    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="
            background-color: ${color};
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
}

function getTransportIcon(type) {
    const icons = {
        'bus': '🚌',
        'metro': '🚇',
        'rer': '🚆',
        'train': '🚄',
        'tram': '🚊'
    };
    return icons[type] || '🚏';
}

function showStatus(type, message) {
    const statusEl = document.getElementById('search-status');
    statusEl.textContent = message;
    statusEl.className = `search-status ${type}`;
    statusEl.style.display = 'block';
}

function hideStatus() {
    const statusEl = document.getElementById('search-status');
    statusEl.style.display = 'none';
}
