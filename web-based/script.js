// Initialize map
let map = L.map('map').setView([30.3165, 78.0322], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// UI Elements
const routeBtn = document.getElementById('routeBtn');
const sourceInput = document.getElementById('source');
const destInput = document.getElementById('destination');
const sourceError = document.getElementById('source-error');
const destError = document.getElementById('dest-error');

// Marker icons
const icons = {
    source: L.icon({
        iconUrl: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32]
    }),
    destination: L.icon({
        iconUrl: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32]
    })
};

let markers = {
    source: null,
    destination: null,
    route: null
};

// Input validation
function validateCoordinate(input, errorElement) {
    const value = input.value.trim();
    if (!value) {
        errorElement.style.display = 'none';
        return false;
    }
    const [lat, lng] = value.split(',').map(Number);
    const isValid = !isNaN(lat) && !isNaN(lng) && 
                  lat >= -90 && lat <= 90 && 
                  lng >= -180 && lng <= 180;

    errorElement.textContent = isValid ? '' : 'Invalid coordinates format';
    errorElement.style.display = isValid ? 'none' : 'block';
    return isValid;
}

function validateInputs() {
    const sourceValid = validateCoordinate(sourceInput, sourceError);
    const destValid = validateCoordinate(destInput, destError);
    routeBtn.disabled = !(sourceValid && destValid);
}

// Event listeners
sourceInput.addEventListener('input', () => {
    validateInputs();
    if (markers.source) map.removeLayer(markers.source);
});

destInput.addEventListener('input', () => {
    validateInputs();
    if (markers.destination) map.removeLayer(markers.destination);
});

// Route drawing
function drawRoute() {
    const [srcLat, srcLng] = sourceInput.value.split(',').map(Number);
    const [destLat, destLng] = destInput.value.split(',').map(Number);
    
    const src = L.latLng(srcLat, srcLng);
    const dest = L.latLng(destLat, destLng);

    // Clear previous
    if (markers.route) {
        map.removeControl(markers.route);
        markers.route = null;
    }
    if (markers.source) {
        map.removeLayer(markers.source);
        markers.source = null;
    }
    if (markers.destination) {
        map.removeLayer(markers.destination);
        markers.destination = null;
    }

    // Add markers
    markers.source = L.marker(src, { icon: icons.source })
        .addTo(map)
        .bindPopup('Source Location');
    
    markers.destination = L.marker(dest, { icon: icons.destination })
        .addTo(map)
        .bindPopup('Destination');

    // Create route
    markers.route = L.Routing.control({
        waypoints: [src, dest],
        routeWhileDragging: false,
        show: false,
        addWaypoints: false,
        draggableWaypoints: false,
        createMarker: () => null
    }).on('routesfound', e => {
        const route = e.routes[0];
        map.fitBounds(route.coordinates);
        document.getElementById('distance').textContent = (route.summary.totalDistance / 1000).toFixed(2);
        document.getElementById('time').textContent = (route.summary.totalTime / 60).toFixed(1);
        document.getElementById('status').textContent = 'Route calculated';
    }).on('routingerror', () => {
        document.getElementById('status').textContent = 'Routing failed - check coordinates';
    }).addTo(map);
}
