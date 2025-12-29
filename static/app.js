// Paris Transit Dashboard - Main Application
// All times are in Paris timezone

const clockEl = document.getElementById('clock');
const statusEl = document.getElementById('status');
const statusTextEl = document.getElementById('status-text');
const container = document.getElementById('departures-container');
const cachedIndicator = document.getElementById('cached-indicator');

let eventSource = null;
let isOnline = true;
let parisTimeOffset = null;

// Initialize Paris time offset
async function initParisTime() {
    try {
        const response = await fetch('/api/departures');
        const data = await response.json();
        if (data.paris_time) {
            // Calculate offset between server Paris time and local time
            const serverParts = data.paris_time.split(':').map(Number);
            const serverSeconds = serverParts[0] * 3600 + serverParts[1] * 60 + serverParts[2];
            const now = new Date();
            const localSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
            parisTimeOffset = serverSeconds - localSeconds;
        }
    } catch (e) {
        console.error('Failed to sync Paris time:', e);
    }
}

// Get Paris time
function getParisTime() {
    const now = new Date();
    if (parisTimeOffset !== null) {
        now.setSeconds(now.getSeconds() + parisTimeOffset);
    }
    return now;
}

// Update clock with Paris time
function updateClock() {
    const paris = getParisTime();
    clockEl.textContent = paris.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Europe/Paris'
    });
}

// Format time for display
function formatTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Paris'
    });
}

// Calculate minutes until departure (using Paris time)
function getMinutesUntil(dateStr) {
    const now = getParisTime();
    const departure = new Date(dateStr);
    const diff = Math.floor((departure - now) / 1000 / 60);
    return diff;
}

// Get transport icon
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

// Render all departures
function renderDepartures(data) {
    if (!data.stops || data.stops.length === 0) {
        container.innerHTML = '<div class="loading">Aucune donnée disponible</div>';
        return;
    }
    
    // Set column count
    const numCols = data.num_columns || Math.min(4, data.stops.length);
    container.className = `departures-container cols-${numCols}`;
    
    let anyCached = false;
    let anyError = false;
    
    const html = data.stops.map(stop => {
        if (stop.is_cached) anyCached = true;
        if (stop.error) anyError = true;
        
        return renderStop(stop);
    }).join('');
    
    container.innerHTML = html;
    
    // Show/hide cached indicator
    cachedIndicator.style.display = anyCached ? 'block' : 'none';
}

// Render a single stop card
function renderStop(stop) {
    const transportClass = stop.transport_type || 'bus';
    const departuresHtml = renderDeparturesList(stop.departures, stop.error);
    
    return `
        <div class="stop">
            <div class="stop-header">
                <div class="line-badge ${transportClass}">${stop.line}</div>
                <span class="stop-name">${stop.name}</span>
                ${stop.direction ? `<span class="stop-direction">→ ${stop.direction}</span>` : ''}
            </div>
            <div class="departures-list">
                ${departuresHtml}
            </div>
        </div>
    `;
}

// Render departures list
function renderDeparturesList(departures, error) {
    if (error) {
        return `<div class="error-message">${error}</div>`;
    }
    
    if (!departures || departures.length === 0) {
        return '<div class="no-departures">Aucun départ prévu</div>';
    }
    
    return departures.map(dep => {
        const minutes = getMinutesUntil(dep.expected);
        
        // Determine time display class
        let timeClass = '';
        if (dep.delay_minutes > 2) timeClass = 'delayed';
        else if (dep.delay_minutes < -1) timeClass = 'early';
        if (minutes <= 0) timeClass += ' at-stop';
        
        // Format time display
        let minutesText;
        if (minutes <= 0) {
            minutesText = 'À QUAI';
        } else if (minutes === 1) {
            minutesText = '1 min';
        } else {
            minutesText = `${minutes} min`;
        }
        
        // Delay info
        let delayHtml = '';
        if (dep.delay_minutes > 2) {
            delayHtml = `<div class="delay-info">+${dep.delay_minutes} min</div>`;
        } else if (dep.delay_minutes < -1) {
            delayHtml = `<div class="delay-info" style="color: var(--early-color);">${dep.delay_minutes} min</div>`;
        }
        
        // Realtime indicator
        const realtimeBadge = dep.is_realtime 
            ? '<span class="realtime-badge">●</span>' 
            : '<span class="theoretical-badge">○</span>';
        
        return `
            <div class="departure">
                <div class="departure-direction">${dep.direction}</div>
                <div class="time-info">
                    <div class="time ${timeClass}">${minutesText}${realtimeBadge}</div>
                    ${delayHtml}
                    <div class="scheduled-time">${formatTime(dep.scheduled)}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Update online/offline status
function setOnlineStatus(online) {
    isOnline = online;
    
    if (online) {
        statusEl.className = 'status-dot';
        statusTextEl.className = 'status-text';
        statusTextEl.textContent = 'EN DIRECT';
    } else {
        statusEl.className = 'status-dot offline';
        statusTextEl.className = 'status-text offline';
        statusTextEl.textContent = 'HORS LIGNE';
    }
}

// Connect to Server-Sent Events
function connectSSE() {
    if (eventSource) {
        eventSource.close();
    }
    
    eventSource = new EventSource('/events');
    
    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            renderDepartures(data);
            setOnlineStatus(true);
        } catch (err) {
            console.error('Error parsing SSE data:', err);
        }
    };
    
    eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        setOnlineStatus(false);
        
        // Try to reconnect after 5 seconds
        setTimeout(() => {
            console.log('Attempting to reconnect...');
            connectSSE();
        }, 5000);
    };
    
    eventSource.onopen = () => {
        console.log('SSE connection established');
        setOnlineStatus(true);
    };
}

// Initial data fetch
async function fetchInitialData() {
    try {
        const response = await fetch('/api/departures');
        const data = await response.json();
        renderDepartures(data);
        setOnlineStatus(true);
    } catch (err) {
        console.error('Error fetching initial data:', err);
        setOnlineStatus(false);
        container.innerHTML = '<div class="loading">Erreur de connexion</div>';
    }
}

// Initialize
async function init() {
    await initParisTime();
    updateClock();
    setInterval(updateClock, 1000);
    
    await fetchInitialData();
    connectSSE();
}

init();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (eventSource) {
        eventSource.close();
    }
});
