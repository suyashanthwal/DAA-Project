// Initialize map
let map = L.map('map').setView([40.7128, -74.0060], 13); // Updated coordinates for New York City
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// UI Elements
const routeBtn = document.getElementById('routeBtn');
const sourceInput = document.getElementById('source');
const destInput = document.getElementById('destination');
const sourceError = document.getElementById('source-error');
const destError = document.getElementById('dest-error');

// Add live location button
const liveLocationBtn = document.createElement('button');
liveLocationBtn.textContent = 'Use My Location';
liveLocationBtn.className = 'live-location-btn';
sourceInput.parentNode.insertBefore(liveLocationBtn, sourceInput.nextSibling);

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
        errorElement.textContent = 'Coordinate is required';
        errorElement.style.display = 'block';
        return false;
    }
    const parts = value.split(',').map(part => part.trim()); // Trim whitespace around coordinates
    if (parts.length !== 2) {
        errorElement.textContent = 'Invalid coordinates format. Use "lat,lng".';
        errorElement.style.display = 'block';
        return false;
    }
    const [lat, lng] = parts.map(Number);
    if (isNaN(lat) || isNaN(lng)) {
        errorElement.textContent = 'Coordinates must be numbers.';
        errorElement.style.display = 'block';
        return false;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        errorElement.textContent = 'Coordinates out of range.';
        errorElement.style.display = 'block';
        return false;
    }

    errorElement.textContent = '';
    errorElement.style.display = 'none';
    return true;
}

function validateInputs() {
    const sourceValid = validateCoordinate(sourceInput, sourceError);
    const destValid = validateCoordinate(destInput, destError);
    routeBtn.disabled = !(sourceValid && destValid);
}

function addMarker(lat, lng, type) {
    if (markers[type]) {
        map.removeLayer(markers[type]);
    }
    markers[type] = L.marker([lat, lng], { icon: icons[type] })
        .addTo(map)
        .bindPopup(`${type.charAt(0).toUpperCase() + type.slice(1)} Location`);
}

// Function to get live location
function getLiveLocation() {
    if (navigator.geolocation) {
        liveLocationBtn.textContent = 'Getting Location...';
        liveLocationBtn.disabled = true;
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                sourceInput.value = `${lat},${lng}`;
                addMarker(lat, lng, 'source');
                validateInputs();
                liveLocationBtn.textContent = 'Use My Location';
                liveLocationBtn.disabled = false;
            },
            (error) => {
                console.error('Error getting location:', error);
                sourceError.textContent = 'Could not get your location. Please enter coordinates manually.';
                sourceError.style.display = 'block';
                liveLocationBtn.textContent = 'Use My Location';
                liveLocationBtn.disabled = false;
            }
        );
    } else {
        sourceError.textContent = 'Geolocation is not supported by your browser';
        sourceError.style.display = 'block';
    }
}

// Add click event listener for live location button
liveLocationBtn.addEventListener('click', getLiveLocation);

// Event listeners
sourceInput.addEventListener('input', () => {
    if (validateCoordinate(sourceInput, sourceError)) {
        const [lat, lng] = sourceInput.value.split(',').map(Number);
        addMarker(lat, lng, 'source');
    }
});

destInput.addEventListener('input', () => {
    if (validateCoordinate(destInput, destError)) {
        const [lat, lng] = destInput.value.split(',').map(Number);
        addMarker(lat, lng, 'destination');
    }
});

routeBtn.addEventListener('click', () => {
    console.log('Route button clicked'); // Placeholder for your C++ implementation
});
// Add map click handler
map.on('click', (e) => {
    const { lat, lng } = e.latlng;
    destInput.value = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    addMarker(lat, lng, 'destination');
    validateInputs();
});

