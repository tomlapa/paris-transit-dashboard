// Simple Setup Logic - No Address Search, Only Stop/Line Search
let wizardState = {
    selectedStop: null,
    selectedLine: null,
    selectedDirection: null,
    searchResults: []
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadApiKey();
});

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
    const apiKey = document.getElementById('api-key').value.trim();
    
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

// Main Search Function
async function searchStops() {
    const query = document.getElementById('search-input').value.trim();
    
    if (!query) {
        showError('Veuillez entrer un terme de recherche');
        return;
    }
    
    const container = document.getElementById('search-results');
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
        
        // Store results
        wizardState.searchResults = results;
        
        container.innerHTML = `
            <div class="info-message" style="margin-bottom: 15px;">
                ✓ ${results.length} résultat(s) trouvé(s). Cliquez pour ajouter.
            </div>
            <div class="selection-list">
                ${results.map((result, index) => `
                    <div class="selection-item" onclick="selectResult(${index})">
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
        console.error('Search error:', error);
        container.innerHTML = '<div class="error-message">Erreur lors de la recherche. Vérifiez votre connexion.</div>';
    }
}

async function selectResult(index) {
    const result = wizardState.searchResults[index];
    
    if (!result) {
        showError('Résultat introuvable');
        return;
    }
    
    // Store selection
    wizardState.selectedStop = {
        stop_id: result.stop_id,
        stop_id_raw: result.stop_id_raw,
        stop_name: result.stop_name,
        town: result.town || ''
    };
    
    wizardState.selectedLine = {
        route_id: result.line_id_raw,
        line_name: result.line_name,
        route_name: result.line_name,
        mode: result.transport_type || 'Bus',
        operator: 'IDFM'
    };
    
    // Show info
    document.getElementById('selected-stop-info').innerHTML = `
        <div class="info-message">
            <strong>Arrêt:</strong> ${escapeHtml(result.stop_name)}<br>
            <strong>Ligne:</strong> ${escapeHtml(result.line_name)}
        </div>
    `;
    
    // Load directions
    document.getElementById('direction-selection-container').style.display = 'block';
    const container = document.getElementById('directions-container');
    showLoading(container);
    
    // Scroll to directions
    document.getElementById('direction-selection-container').scrollIntoView({ behavior: 'smooth' });
    
    await loadDirections();
}

async function loadDirections() {
    const container = document.getElementById('directions-container');
    
    try {
        const response = await fetch(
            `/api/stop/directions?stop_id=${encodeURIComponent(wizardState.selectedStop.stop_id_raw)}&line_id=${encodeURIComponent(wizardState.selectedLine.route_id)}`
        );
        const data = await response.json();
        const directions = data.directions || [];
        
        if (directions.length > 0) {
            container.innerHTML = `
                <div class="direction-group">
                    <div class="direction-group-title">${escapeHtml(wizardState.selectedLine.line_name)}</div>
                    ${directions.map((dir, idx) => `
                        <div class="direction-option" onclick="selectDirection('${escapeHtml(dir.direction)}', this)">
                            <input type="radio" name="direction" value="${idx}">
                            <span>→ ${escapeHtml(dir.direction)}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            // No directions available - use line name as direction
            wizardState.selectedDirection = wizardState.selectedLine.route_name;
            container.innerHTML = `
                <div class="info-message">
                    Aucune direction en temps réel disponible.<br>
                    La ligne sera ajoutée avec la direction par défaut: <strong>${escapeHtml(wizardState.selectedLine.route_name)}</strong>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error loading directions:', error);
        container.innerHTML = '<div class="error-message">Erreur lors du chargement des directions</div>';
    }
}

function selectDirection(direction, element) {
    // Update UI
    const parent = element.closest('.direction-group');
    parent.querySelectorAll('.direction-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    element.classList.add('selected');
    element.querySelector('input').checked = true;
    
    // Save selection
    wizardState.selectedDirection = direction;
}

async function addToConfig() {
    if (!wizardState.selectedDirection) {
        showError('Veuillez sélectionner une direction');
        return;
    }
    
    try {
        // Build stop to add
        const stopToAdd = {
            stop_id: wizardState.selectedStop.stop_id,
            stop_name: wizardState.selectedStop.stop_name,
            line: wizardState.selectedLine.line_name,
            direction: wizardState.selectedDirection,
            route_id: wizardState.selectedLine.route_id
        };
        
        // Get current config
        const getResponse = await fetch('/api/config');
        const config = await getResponse.json();
        
        // Add to existing stops
        const allStops = [...(config.stops || []), stopToAdd];
        
        // Save
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                api_key: config.api_key,
                stops: allStops
            })
        });
        
        if (response.ok) {
            showSuccess('Ligne ajoutée avec succès!');
            
            setTimeout(() => {
                if (confirm('Ligne ajoutée! Voulez-vous en ajouter une autre?')) {
                    backToSearch();
                } else {
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

function backToSearch() {
    // Reset state
    wizardState.selectedStop = null;
    wizardState.selectedLine = null;
    wizardState.selectedDirection = null;
    
    // Hide direction selection
    document.getElementById('direction-selection-container').style.display = 'none';
    
    // Clear search input and results
    document.getElementById('search-input').value = '';
    document.getElementById('search-results').innerHTML = '';
    
    // Scroll back to search
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
