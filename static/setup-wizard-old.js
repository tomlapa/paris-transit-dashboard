// Setup Wizard Logic
let map;
let mapMarkers = [];
let mapCircle = null;
let currentStep = 1;
let wizardState = {
    selectedStop: null,
    selectedLines: [],
    selectedDirections: {},
    nearbyStops: [],
    availableLines: [],
    advancedSearchResults: []
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadApiKey();
    setupStepValidation();
});

// Prevent direct step navigation
function setupStepValidation() {
    document.querySelectorAll('.progress-step').forEach(step => {
        step.style.cursor = 'not-allowed';
        step.onclick = (e) => {
            e.preventDefault();
            showError('Complétez les étapes dans l\'ordre');
        };
    });
}

// Toggle API Key Visibility
function toggleApiKeyVisibility() {
    const input = document.getElementById('api-key');
    const btn = document.getElementById('toggle-visibility-btn');
    
    if (input.type === 'text') {
        input.type = 'password';
        btn.textContent = '🔓 Afficher';
    } else {
        input.type = 'text';
        btn.textContent = '🔒 Masquer';
    }
}

// Tab Switching
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    // Find the correct tab button
    if (tabName === 'wizard') {
        document.querySelector('.tab:first-child').classList.add('active');
    } else if (tabName === 'advanced') {
        document.querySelector('.tab:last-child').classList.add('active');
    }
    
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// Map Initialization
function initMap() {
    map = L.map('map').setView([48.8566, 2.3522], 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);
}

function clearMapMarkers() {
    mapMarkers.forEach(marker => map.removeLayer(marker));
    mapMarkers = [];
    if (mapCircle) {
        map.removeLayer(mapCircle);
        mapCircle = null;
    }
}

// API Key Management
async function loadApiKey() {
    const response = await fetch('/api/config');
    const data = await response.json();
    
    if (data.api_key) {
        document.getElementById('api-key').value = data.api_key;
        document.getElementById('api-status').innerHTML = 
            '<span class="api-status valid">✓ Clé valide</span>';
    }
}

async function validateApiKey() {
    const apiKey = document.getElementById('api-key').value;
    
    if (!apiKey) {
        showError('Veuillez entrer une clé API');
        return;
    }
    
    const response = await fetch('/api/config/validate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({api_key: apiKey})
    });
    
    const result = await response.json();
    
    if (result.success) {
        document.getElementById('api-status').innerHTML = 
            '<span class="api-status valid">✓ Clé valide et sauvegardée</span>';
    } else {
        document.getElementById('api-status').innerHTML = 
            '<span class="api-status invalid">✗ Clé invalide</span>';
    }
}

// Step Navigation
function goToStep(stepNumber) {
    // Validate we can go to this step
    if (stepNumber > currentStep + 1) {
        showError('Complétez les étapes dans l\'ordre');
        return;
    }
    
    // Hide all steps
    document.querySelectorAll('.step-content').forEach(s => s.classList.remove('active'));
    
    // Show target step
    document.getElementById(`step-${stepNumber}`).classList.add('active');
    
    // Update progress indicator
    document.querySelectorAll('.progress-step').forEach((step, index) => {
        const stepNum = index + 1;
        step.classList.remove('active', 'completed');
        
        if (stepNum < stepNumber) {
            step.classList.add('completed');
        } else if (stepNum === stepNumber) {
            step.classList.add('active');
        }
    });
    
    currentStep = stepNumber;
    
    // Load data for step if needed
    if (stepNumber === 4) {
        loadDirections();
    }
}

// Step 1: Address Search
async function searchAddress() {
    const address = document.getElementById('address-search').value.trim();
    
    if (!address) {
        showError('Veuillez entrer une adresse');
        return;
    }
    
    const container = document.getElementById('nearby-stops-container');
    showLoading(container);
    
    try {
        // Clear previous markers
        clearMapMarkers();
        
        // Geocode address - add "Île-de-France" to improve Paris region results
        const geoController = new AbortController();
        const geoTimeout = setTimeout(() => geoController.abort(), 10000);
        
        const searchQuery = address.includes('Paris') || address.includes('Île-de-France') 
            ? address 
            : `${address}, Île-de-France`;
        
        const geoResponse = await fetch(
            `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(searchQuery)}`,
            { signal: geoController.signal }
        );
        clearTimeout(geoTimeout);
        
        const geoData = await geoResponse.json();
        
        if (!geoData.features || geoData.features.length === 0) {
            container.innerHTML = `
                <div class="error-message">
                    <strong>Adresse non trouvée</strong><br>
                    Essayez avec plus de détails (ex: "10 Rue de Rivoli, Paris" ou "Saint-Maurice 94410")<br><br>
                    Ou utilisez l'onglet "Recherche Avancée" pour chercher directement par nom d'arrêt.
                </div>
            `;
            return;
        }
        
        // Filter results to only show Île-de-France region (departments 75, 77, 78, 91, 92, 93, 94, 95)
        const idfDepartments = ['75', '77', '78', '91', '92', '93', '94', '95'];
        const idfResults = geoData.features.filter(feature => {
            const postcode = feature.properties.postcode || '';
            const dept = postcode.substring(0, 2);
            return idfDepartments.includes(dept);
        });
        
        // Use filtered results if available, otherwise use all results
        const results = idfResults.length > 0 ? idfResults : geoData.features;
        
        if (results.length === 0) {
            container.innerHTML = `
                <div class="error-message">
                    <strong>Aucune adresse trouvée en Île-de-France</strong><br>
                    Essayez avec le code postal (ex: "Saint-Maurice 94410")<br><br>
                    Ou utilisez l'onglet "Recherche Avancée".
                </div>
            `;
            return;
        }
        
        const coords = results[0].geometry.coordinates;
        const lat = coords[1];
        const lon = coords[0];
        const foundAddress = results[0].properties.label;
        
        // Show which address was found
        container.innerHTML = `
            <div class="info-message">
                📍 Adresse trouvée: <strong>${escapeHtml(foundAddress)}</strong>
            </div>
        `;
        
        // Update map
        map.setView([lat, lon], 16);
        mapCircle = L.circle([lat, lon], {
            color: '#f68b1e',
            fillColor: '#f68b1e',
            fillOpacity: 0.2,
            radius: 500
        }).addTo(map);
        
        // Find nearby stops
        const stopsController = new AbortController();
        const stopsTimeout = setTimeout(() => stopsController.abort(), 15000);
        
        const stopsResponse = await fetch(
            `/api/stops/nearby?lat=${lat}&lon=${lon}&radius=500`,
            { signal: stopsController.signal }
        );
        clearTimeout(stopsTimeout);
        
        const stopsData = await stopsResponse.json();
        
        wizardState.nearbyStops = stopsData.results || [];
        
        if (wizardState.nearbyStops.length === 0) {
            container.innerHTML = `
                <div class="info-message">
                    📍 Adresse trouvée: <strong>${escapeHtml(foundAddress)}</strong><br><br>
                    ⚠️ Aucun arrêt trouvé dans un rayon de 500m.<br>
                    Essayez une autre adresse ou utilisez la "Recherche Avancée" pour chercher par nom d'arrêt.
                </div>
            `;
            return;
        }
        
        // Display stops
        displayNearbyStops();
        
        // Show stops on map
        wizardState.nearbyStops.forEach(stop => {
            const marker = L.marker([stop.lat, stop.lon]).addTo(map);
            marker.bindPopup(`<b>${stop.stop_name}</b><br>${stop.town} (${stop.distance}m)`);
            mapMarkers.push(marker);
        });
        
        container.innerHTML = `
            <div class="success-message">
                ✓ ${wizardState.nearbyStops.length} arrêt(s) trouvé(s) près de: <strong>${escapeHtml(foundAddress)}</strong>
            </div>
        `;
        
        // Auto-advance to step 2
        setTimeout(() => goToStep(2), 500);
        
    } catch (error) {
        console.error('Search error:', error);
        if (error.name === 'AbortError') {
            container.innerHTML = `
                <div class="error-message">
                    <strong>Recherche expirée</strong><br>
                    Vérifiez votre connexion et réessayez.<br><br>
                    Ou utilisez l'onglet "Recherche Avancée".
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="error-message">
                    <strong>Erreur lors de la recherche</strong><br>
                    ${escapeHtml(error.message)}<br><br>
                    Essayez l'onglet "Recherche Avancée" pour chercher directement par nom d'arrêt.
                </div>
            `;
        }
    }
}

function displayNearbyStops() {
    const container = document.getElementById('stops-list');
    
    container.innerHTML = wizardState.nearbyStops.map((stop, index) => `
        <div class="selection-item" onclick="selectStop(${index})">
            <input type="radio" name="stop" id="stop-${index}">
            <div class="item-icon" style="background: #4a4a6c;">
                📍
            </div>
            <div class="item-details">
                <div class="item-name">${escapeHtml(stop.stop_name)}</div>
                <div class="item-meta">${escapeHtml(stop.town)} • ${stop.distance}m</div>
            </div>
        </div>
    `).join('');
}

// Step 2: Select Stop
function selectStop(index) {
    wizardState.selectedStop = wizardState.nearbyStops[index];
    
    // Update UI
    document.querySelectorAll('#stops-list .selection-item').forEach((item, i) => {
        item.classList.toggle('selected', i === index);
        item.querySelector('input').checked = (i === index);
    });
    
    // Enable continue button
    document.getElementById('step2-continue').disabled = false;
    
    // Preload lines for this stop
    loadLinesForStop();
}

async function loadLinesForStop() {
    if (!wizardState.selectedStop) return;
    
    const container = document.getElementById('lines-list');
    showLoading(container);
    
    try {
        const response = await fetch(
            `/api/stop/lines?stop_id=${encodeURIComponent(wizardState.selectedStop.stop_id_raw)}`
        );
        const data = await response.json();
        
        wizardState.availableLines = data.results || [];
        
        if (wizardState.availableLines.length === 0) {
            container.innerHTML = '<div class="info-message">Aucune ligne trouvée pour cet arrêt. Essayez un autre arrêt.</div>';
            return;
        }
        
        displayLines(wizardState.availableLines);
        
    } catch (error) {
        console.error('Error loading lines:', error);
        container.innerHTML = '<div class="error-message">Erreur lors du chargement des lignes</div>';
    }
}

function displayLines(lines) {
    const container = document.getElementById('lines-list');
    
    container.innerHTML = lines.map((line, index) => `
        <div class="selection-item" onclick="toggleLine(${index})">
            <input type="checkbox" id="line-${index}">
            <div class="item-icon" style="background: ${getLineColor(line.mode)};">
                ${getTransportIcon(line.mode)}
            </div>
            <div class="item-details">
                <div class="item-name">${escapeHtml(line.line_name)} - ${escapeHtml(line.route_name)}</div>
                <div class="item-meta">${escapeHtml(line.mode)} • ${escapeHtml(line.operator || 'IDFM')}</div>
            </div>
        </div>
    `).join('');
}

// Step 3: Select Lines
function toggleLine(index) {
    const checkbox = document.getElementById(`line-${index}`);
    const item = checkbox.closest('.selection-item');
    const line = wizardState.availableLines[index];
    
    checkbox.checked = !checkbox.checked;
    item.classList.toggle('selected', checkbox.checked);
    
    if (checkbox.checked) {
        // Add if not already present
        if (!wizardState.selectedLines.find(l => l.route_id === line.route_id)) {
            wizardState.selectedLines.push(line);
        }
    } else {
        // Remove
        wizardState.selectedLines = wizardState.selectedLines.filter(
            l => l.route_id !== line.route_id
        );
        // Also remove direction selection
        delete wizardState.selectedDirections[line.route_id];
    }
    
    // Enable/disable continue button
    document.getElementById('step3-continue').disabled = wizardState.selectedLines.length === 0;
}

// Step 4: Select Directions
async function loadDirections() {
    const container = document.getElementById('directions-container');
    showLoading(container);
    
    try {
        const directionsHTML = [];
        
        for (const line of wizardState.selectedLines) {
            // Call the correct endpoint with correct parameter
            const response = await fetch(
                `/api/stop/directions?stop_id=${encodeURIComponent(wizardState.selectedStop.stop_id_raw)}&line_id=${encodeURIComponent(line.route_id)}`
            );
            const data = await response.json();
            const directions = data.directions || []; // Note: response has 'directions' not 'results'
            
            if (directions.length > 0) {
                directionsHTML.push(`
                    <div class="direction-group">
                        <div class="direction-group-title">${escapeHtml(line.line_name)} - ${escapeHtml(line.route_name)}</div>
                        ${directions.map((dir, idx) => `
                            <div class="direction-option" onclick="selectDirection('${escapeHtml(line.route_id)}', '${escapeHtml(dir.direction)}', this)">
                                <input type="radio" name="dir-${line.route_id}" value="${idx}">
                                <span>→ ${escapeHtml(dir.direction)}</span>
                            </div>
                        `).join('')}
                    </div>
                `);
            } else {
                // No real-time directions available
                directionsHTML.push(`
                    <div class="direction-group">
                        <div class="direction-group-title">${escapeHtml(line.line_name)} - ${escapeHtml(line.route_name)}</div>
                        <div class="info-message">Aucune direction en temps réel disponible</div>
                        <button class="btn btn-secondary" onclick="addWithoutDirection('${escapeHtml(line.route_id)}', '${escapeHtml(line.route_name)}')">
                            Ajouter avec direction par défaut
                        </button>
                    </div>
                `);
            }
        }
        
        container.innerHTML = directionsHTML.join('');
        
    } catch (error) {
        console.error('Error loading directions:', error);
        container.innerHTML = '<div class="error-message">Erreur lors du chargement des directions</div>';
    }
}

function selectDirection(routeId, direction, element) {
    // Update UI
    const parent = element.closest('.direction-group');
    parent.querySelectorAll('.direction-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    element.classList.add('selected');
    element.querySelector('input').checked = true;
    
    // Save selection (save actual direction name, not ID)
    wizardState.selectedDirections[routeId] = direction;
}

function addWithoutDirection(routeId, routeName) {
    // Use route name as direction
    wizardState.selectedDirections[routeId] = routeName;
    
    // Highlight the button
    event.target.textContent = '✓ Direction ajoutée';
    event.target.style.background = '#4caf50';
}

// Add to Configuration
async function addToConfig() {
    // Validate all lines have directions selected
    const missingDirections = wizardState.selectedLines.filter(
        line => !(line.route_id in wizardState.selectedDirections)
    );
    
    if (missingDirections.length > 0) {
        showError('Veuillez sélectionner une direction pour toutes les lignes (ou cliquez "Ajouter avec direction par défaut")');
        return;
    }
    
    try {
        // Build stops to add
        const stopsToAdd = wizardState.selectedLines.map(line => ({
            stop_id: wizardState.selectedStop.stop_id,
            stop_name: wizardState.selectedStop.stop_name,
            line: line.line_name,
            direction: wizardState.selectedDirections[line.route_id],
            route_id: line.route_id
        }));
        
        // Get current config
        const getResponse = await fetch('/api/config');
        const config = await getResponse.json();
        
        // Merge with existing stops
        const allStops = [...(config.stops || []), ...stopsToAdd];
        
        // Save to config
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                api_key: config.api_key,
                stops: allStops
            })
        });
        
        if (response.ok) {
            showSuccess(`${stopsToAdd.length} ligne(s) ajoutée(s) avec succès!`);
            
            // Ask what to do next
            setTimeout(() => {
                if (confirm('Arrêts ajoutés! Voulez-vous ajouter d\'autres lignes depuis ce même arrêt?')) {
                    // Go back to step 3 to add more lines
                    wizardState.selectedLines = [];
                    wizardState.selectedDirections = {};
                    goToStep(3);
                } else if (confirm('Voulez-vous ajouter un autre arrêt?')) {
                    // Reset completely
                    resetWizard();
                } else {
                    // Go to dashboard
                    window.location.href = '/';
                }
            }, 1000);
        } else {
            showError('Erreur lors de l\'enregistrement');
        }
        
    } catch (error) {
        console.error('Save error:', error);
        showError('Erreur lors de l\'enregistrement');
    }
}

function resetWizard() {
    wizardState = {
        selectedStop: null,
        selectedLines: [],
        selectedDirections: {},
        nearbyStops: [],
        availableLines: []
    };
    clearMapMarkers();
    document.getElementById('address-search').value = '';
    goToStep(1);
}

// Helper Functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getTransportIcon(mode) {
    const icons = {
        'Bus': '🚌',
        'Métro': '🚇',
        'Metro': '🚇',
        'RER': '🚆',
        'Tramway': '🚊',
        'Tram': '🚊',
        'Train': '🚄'
    };
    return icons[mode] || '🚏';
}

function getLineColor(mode) {
    const colors = {
        'Bus': '#4a7c59',
        'Métro': '#3a5a7c',
        'Metro': '#3a5a7c',
        'RER': '#7c4a5a',
        'Tramway': '#7c6a3a',
        'Tram': '#7c6a3a',
        'Train': '#5a3a7c'
    };
    return colors[mode] || '#4a4a6c';
}

function showLoading(container) {
    if (typeof container === 'string') {
        container = document.getElementById(container);
    }
    container.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            Chargement...
        </div>
    `;
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '20px';
    errorDiv.style.right = '20px';
    errorDiv.style.zIndex = '10000';
    errorDiv.style.maxWidth = '400px';
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => errorDiv.remove(), 5000);
}

function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    successDiv.style.position = 'fixed';
    successDiv.style.top = '20px';
    successDiv.style.right = '20px';
    successDiv.style.zIndex = '10000';
    successDiv.style.maxWidth = '400px';
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => successDiv.remove(), 3000);
}

// Advanced Search
async function advancedSearch() {
    const query = document.getElementById('advanced-search').value.trim();
    
    if (!query) {
        showError('Veuillez entrer un terme de recherche');
        return;
    }
    
    const container = document.getElementById('advanced-results');
    showLoading(container);
    
    try {
        const response = await fetch(
            `/api/search/stops?q=${encodeURIComponent(query)}`
        );
        const data = await response.json();
        
        if (data.error) {
            container.innerHTML = `<div class="error-message">${escapeHtml(data.error)}</div>`;
            return;
        }
        
        const results = data.results || [];
        
        if (results.length === 0) {
            container.innerHTML = '<div class="info-message">Aucun résultat trouvé. Essayez avec un autre terme.</div>';
            return;
        }
        
        // Store results for selection
        wizardState.advancedSearchResults = results;
        
        container.innerHTML = `
            <div class="info-message" style="margin-bottom: 15px;">
                ✓ ${results.length} résultat(s) trouvé(s). Cliquez pour ajouter.
            </div>
            <div class="selection-list">
                ${results.map((result, index) => `
                    <div class="selection-item" onclick="selectAdvancedResult(${index})">
                        <div class="item-icon" style="background: ${getLineColor(result.transport_type)};">
                            ${getTransportIcon(result.transport_type)}
                        </div>
                        <div class="item-details">
                            <div class="item-name">${escapeHtml(result.stop_name)}</div>
                            <div class="item-meta">${escapeHtml(result.line_name)} • ${escapeHtml(result.town || '')}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
    } catch (error) {
        console.error('Advanced search error:', error);
        container.innerHTML = '<div class="error-message">Erreur lors de la recherche. Vérifiez votre connexion.</div>';
    }
}

async function selectAdvancedResult(index) {
    const result = wizardState.advancedSearchResults[index];
    
    if (!result) {
        showError('Résultat introuvable');
        return;
    }
    
    // Set this as the selected stop
    wizardState.selectedStop = {
        stop_id: result.stop_id,
        stop_id_raw: result.stop_id_raw,
        stop_name: result.stop_name,
        town: result.town || ''
    };
    
    // Pre-select this line
    wizardState.selectedLines = [{
        route_id: result.line_id_raw,
        line_name: result.line_name,
        route_name: result.line_name,
        mode: result.transport_type || 'Bus',
        operator: 'IDFM'
    }];
    
    // Reset directions
    wizardState.selectedDirections = {};
    
    // Switch to wizard tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('.tab:first-child').classList.add('active');
    document.getElementById('wizard-tab').classList.add('active');
    
    // Show loading message
    showSuccess(`Ajout de: ${result.line_name} à ${result.stop_name}`);
    
    // Jump to step 4 (directions)
    goToStep(4);
    
    // Load directions for this line
    await loadDirections();
}
