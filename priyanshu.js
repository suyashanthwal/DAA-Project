// Menu Toggle Functionality
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');

// Prevent clicks inside sidebar from propagating
sidebar.addEventListener('click', (event) => {
    event.stopPropagation();
});

// Only toggle menu with hamburger icon
menuToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    sidebar.classList.toggle('closed');
});

// Add map overlay
const mapOverlay = document.createElement('div');
mapOverlay.className = 'map-overlay';
document.querySelector('.container').appendChild(mapOverlay);

// Initialize map and other variables
let map = L.map('map', {
    center: [40.7128, -74.0060],
    zoom: 13,
    zoomControl: true
}); 

// Add tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Add click event listener to map for setting destination
map.on('click', function(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    destInput.value = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    addMarker(lat, lng, 'destination');
    validateInputs();
    
    // Center map on clicked location
    map.setView([lat, lng], map.getZoom());
});

const routeBtn = document.getElementById('routeBtn');
const sourceInput = document.getElementById('source');
const destInput = document.getElementById('destination');
const sourceError = document.getElementById('source-error');
const destError = document.getElementById('dest-error');
const showLocationBtn = document.getElementById('showLocation');

const liveLocationBtn = document.createElement('button');
liveLocationBtn.textContent = 'Use My Location';
liveLocationBtn.className = 'live-location-btn';
sourceInput.parentNode.insertBefore(liveLocationBtn, sourceInput.nextSibling);

const distanceElement = document.getElementById('distance');
const timeElement = document.getElementById('time');

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

let currentPolyline = null;
let currentTrafficLights = [];

const statusElement = document.getElementById('status');

function validateCoordinate(input, errorElement) {
    const value = input.value.trim();
    if (!value) {
        errorElement.textContent = 'Coordinate is required';
        errorElement.style.display = 'block';
        return false;
    }
    const parts = value.split(',').map(part => part.trim());
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

function resetMapState() {
    // Clear markers
    Object.values(markers).forEach(marker => {
        if (marker) {
            map.removeLayer(marker);
        }
    });
    markers = {
        source: null,
        destination: null,
        route: null
    };

    // Clear polyline
    if (currentPolyline) {
        map.removeLayer(currentPolyline);
        currentPolyline = null;
    }

    // Clear traffic lights
    currentTrafficLights.forEach(light => {
        if (light.marker) {
            map.removeLayer(light.marker);
        }
    });
    currentTrafficLights = [];

    // Reset inputs and errors
    sourceInput.value = '';
    destInput.value = '';
    sourceError.textContent = '';
    destError.textContent = '';
    sourceError.style.display = 'none';
    destError.style.display = 'none';
    routeBtn.disabled = true;

    // Reset stats
    distanceElement.textContent = '--';
    timeElement.textContent = '--';
    statusElement.textContent = '';
}

// Route button click handler
routeBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    statusElement.textContent = 'Calculating route...';

    const sourceCoords = sourceInput.value.split(',').map(Number);
    const destCoords = destInput.value.split(',').map(Number);

    if (!sourceCoords || !destCoords || sourceCoords.length !== 2 || destCoords.length !== 2) {
        statusElement.textContent = 'Invalid coordinates format. Please use lat,lng format.';
        return;
    }

    const { trafficLights, graphEdges } = await loadTrafficLightsForBoundingBox(sourceCoords, destCoords);

    if (trafficLights.length === 0 || graphEdges.length === 0) {
        return; // Status is already set in loadTrafficLightsForBoundingBox
    }

    const sourceNode = trafficLights.length;
    const destNode = trafficLights.length + 1;

    trafficLights.push({ id: sourceNode, lat: sourceCoords[0], lon: sourceCoords[1] });
    trafficLights.push({ id: destNode, lat: destCoords[0], lon: destCoords[1] });

    connectToMultipleNodes(sourceCoords[0], sourceCoords[1], trafficLights, graphEdges, sourceNode);
    connectToMultipleNodes(destCoords[0], destCoords[1], trafficLights, graphEdges, destNode);

    findShortestPath(trafficLights, graphEdges);
});

// Update the location button functionality
showLocationBtn.addEventListener('click', function() {
    if (navigator.geolocation) {
        showLocationBtn.textContent = 'Getting Location...';
        showLocationBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                map.setView([lat, lng], 15);
                showLocationBtn.textContent = 'Show My Location';
                showLocationBtn.disabled = false;
            },
            (error) => {
                statusElement.textContent = 'Could not get your location. Please try again.';
                showLocationBtn.textContent = 'Show My Location';
                showLocationBtn.disabled = false;
            }
        );
    } else {
        statusElement.textContent = 'Geolocation is not supported by your browser';
    }
});
