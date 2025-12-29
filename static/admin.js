// Admin Panel JavaScript

document.addEventListener('DOMContentLoaded', () => {
    // API Key configuration
    const apiConfigForm = document.getElementById('api-config-form');
    const apiKeyInput = document.getElementById('api-key');
    const toggleApiKey = document.getElementById('toggle-api-key');
    const testApiBtn = document.getElementById('test-api');
    const apiMessage = document.getElementById('api-message');
    
    // Toggle API key visibility
    if (toggleApiKey) {
        toggleApiKey.addEventListener('click', () => {
            apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
        });
    }
    
    // Save API key
    if (apiConfigForm) {
        apiConfigForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const apiKey = apiKeyInput.value;
            
            if (!apiKey) {
                showMessage(apiMessage, 'Veuillez entrer une clé API', 'error');
                return;
            }
            
            try {
                const formData = new FormData();
                formData.append('api_key', apiKey);
                
                const response = await fetch('/api/config/apikey', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showMessage(apiMessage, '✓ Clé API enregistrée', 'success');
                    document.getElementById('api-status-badge').className = 'badge badge-success';
                    document.getElementById('api-status-badge').textContent = 'API OK';
                } else {
                    showMessage(apiMessage, '✗ ' + result.message, 'error');
                }
            } catch (err) {
                showMessage(apiMessage, 'Erreur de connexion', 'error');
            }
        });
    }
    
    // Test API
    if (testApiBtn) {
        testApiBtn.addEventListener('click', async () => {
            showMessage(apiMessage, 'Test en cours...', 'info');
            
            try {
                const response = await fetch('/api/config/test');
                const result = await response.json();
                
                if (result.success) {
                    showMessage(apiMessage, '✓ ' + result.message, 'success');
                } else {
                    showMessage(apiMessage, '✗ ' + result.message, 'error');
                }
            } catch (err) {
                showMessage(apiMessage, 'Erreur de connexion', 'error');
            }
        });
    }
    
    // Display settings
    const displayForm = document.getElementById('display-config-form');
    if (displayForm) {
        displayForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const interval = document.getElementById('refresh-interval').value;
            
            try {
                const formData = new FormData();
                formData.append('interval', interval);
                
                const response = await fetch('/api/config/refresh_interval', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                if (result.success) {
                    alert('Paramètres enregistrés');
                }
            } catch (err) {
                alert('Erreur de sauvegarde');
            }
        });
    }
    
    // Stop search
    const stopSearch = document.getElementById('stop-search');
    const searchBtn = document.getElementById('search-btn');
    const transportFilter = document.getElementById('transport-filter');
    const searchResults = document.getElementById('search-results');
    const directionModal = document.getElementById('direction-modal');
    const directionsList = document.getElementById('directions-list');
    
    if (searchBtn) {
        searchBtn.addEventListener('click', performSearch);
        stopSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch();
        });
    }
    
    async function performSearch() {
        const query = stopSearch.value.trim();
        if (!query) return;
        
        const transport = transportFilter.value;
        searchResults.innerHTML = '<div class="search-result-item">Recherche...</div>';
        
        try {
            let url = `/api/search/stops?q=${encodeURIComponent(query)}`;
            if (transport) url += `&transport_type=${transport}`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.error) {
                searchResults.innerHTML = `<div class="search-result-item">${data.error}</div>`;
                return;
            }
            
            const results = data.results || [];
            
            if (results.length === 0) {
                searchResults.innerHTML = '<div class="search-result-item">Aucun résultat</div>';
                return;
            }
            
            // Deduplicate
            const seen = new Set();
            const unique = results.filter(r => {
                const key = `${r.stop_id}-${r.line_name}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            
            searchResults.innerHTML = unique.slice(0, 15).map(r => `
                <div class="search-result-item"
                     data-stop-id="${r.stop_id}"
                     data-stop-name="${r.stop_name}"
                     data-line="${r.line_name}"
                     data-line-id="${r.line_id || ''}"
                     data-transport="${r.transport_type || 'bus'}">
                    <div class="result-info">
                        <span class="transport-icon">${getTransportIcon(r.transport_type)}</span>
                        <div class="result-details">
                            <strong>${r.line_name}</strong> - ${r.stop_name}
                        </div>
                    </div>
                    <button class="btn btn-primary btn-small select-btn">+</button>
                </div>
            `).join('');
            
            // Add handlers
            document.querySelectorAll('.select-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const item = e.target.closest('.search-result-item');
                    showDirections(item.dataset);
                });
            });
            
        } catch (err) {
            searchResults.innerHTML = '<div class="search-result-item">Erreur</div>';
        }
    }
    
    async function showDirections(data) {
        directionModal.style.display = 'flex';
        directionsList.innerHTML = '<div>Chargement...</div>';
        
        try {
            const url = `/api/stop/directions?stop_id=${encodeURIComponent(data.stopId)}`;
            const response = await fetch(url);
            const result = await response.json();
            
            const directions = result.directions || [];
            
            if (directions.length === 0) {
                directionsList.innerHTML = `
                    <p>Aucune direction disponible</p>
                    <button class="btn btn-primary add-direct"
                            data-stop-id="${data.stopId}"
                            data-stop-name="${data.stopName}"
                            data-line="${data.line}"
                            data-line-id="${data.lineId}"
                            data-transport="${data.transport}">
                        Ajouter quand même
                    </button>
                `;
                
                document.querySelector('.add-direct')?.addEventListener('click', (e) => {
                    addStop(e.target.dataset, '', '');
                });
                return;
            }
            
            directionsList.innerHTML = directions.map(d => `
                <div class="direction-item"
                     data-stop-id="${data.stopId}"
                     data-stop-name="${data.stopName}"
                     data-line="${d.line_name || data.line}"
                     data-line-id="${d.line_id || data.lineId}"
                     data-direction="${d.direction}"
                     data-direction-id="${d.direction_id || ''}"
                     data-transport="${data.transport}">
                    <span>→ ${d.direction}</span>
                    <button class="btn btn-success btn-small">Ajouter</button>
                </div>
            `).join('');
            
            document.querySelectorAll('.direction-item').forEach(item => {
                item.addEventListener('click', () => {
                    addStop(item.dataset, item.dataset.direction, item.dataset.directionId);
                });
            });
            
        } catch (err) {
            directionsList.innerHTML = '<div>Erreur</div>';
        }
    }
    
    async function addStop(data, direction, directionId) {
        try {
            const formData = new FormData();
            formData.append('stop_id', data.stopId);
            formData.append('stop_name', data.stopName);
            formData.append('line', data.line);
            formData.append('line_id', data.lineId || '');
            formData.append('direction', direction || '');
            formData.append('direction_id', directionId || '');
            formData.append('transport_type', data.transport || 'bus');
            
            const response = await fetch('/api/stops/add', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                window.location.reload();
            } else {
                alert(result.message);
            }
        } catch (err) {
            alert('Erreur');
        }
    }
    
    // Close modal
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            directionModal.style.display = 'none';
        });
    });
    
    // Click outside modal to close
    if (directionModal) {
        directionModal.addEventListener('click', (e) => {
            if (e.target === directionModal) {
                directionModal.style.display = 'none';
            }
        });
    }
    
    // Remove stop handlers
    document.querySelectorAll('.remove-stop').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            
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
                    btn.closest('.stop-item').remove();
                }
            } catch (err) {
                alert('Erreur');
            }
        });
    });
    
    // Drag and drop for reordering
    const stopsList = document.getElementById('stops-list');
    if (stopsList) {
        let draggedItem = null;
        
        stopsList.addEventListener('dragstart', (e) => {
            draggedItem = e.target.closest('.stop-item');
            e.dataTransfer.effectAllowed = 'move';
            draggedItem.style.opacity = '0.5';
        });
        
        stopsList.addEventListener('dragend', (e) => {
            if (draggedItem) {
                draggedItem.style.opacity = '1';
                draggedItem = null;
                saveOrder();
            }
        });
        
        stopsList.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = getDragAfterElement(stopsList, e.clientY);
            if (afterElement == null) {
                stopsList.appendChild(draggedItem);
            } else {
                stopsList.insertBefore(draggedItem, afterElement);
            }
        });
    }
    
    function getDragAfterElement(container, y) {
        const elements = [...container.querySelectorAll('.stop-item:not(.dragging)')];
        return elements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset, element: child };
            }
            return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
    
    async function saveOrder() {
        const items = document.querySelectorAll('.stop-item');
        const order = [...items].map((item, index) => index);
        
        try {
            await fetch('/api/stops/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(order)
            });
        } catch (err) {
            console.error('Reorder error:', err);
        }
    }
    
    // Quick actions
    document.getElementById('refresh-now')?.addEventListener('click', () => {
        window.location.reload();
    });
    
    document.getElementById('export-config')?.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/config');
            const config = await response.json();
            
            const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'transit-config.json';
            a.click();
        } catch (err) {
            alert('Erreur export');
        }
    });
});

// Utilities
function showMessage(element, message, type) {
    if (!element) return;
    element.textContent = message;
    element.className = `message ${type}`;
}

function getTransportIcon(type) {
    const icons = {
        'bus': '🚌', 'metro': '🚇', 'rer': '🚆',
        'train': '🚄', 'tram': '🚊'
    };
    return icons[type] || '🚏';
}
