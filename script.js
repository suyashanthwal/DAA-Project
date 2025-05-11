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

// Function to calculate the bounding box between two coordinates with reduced padding
function calculateBoundingBox(lat1, lon1, lat2, lon2, padding = 0.003) {
    const minLat = Math.min(lat1, lat2) - padding;
    const maxLat = Math.max(lat1, lat2) + padding;
    const minLon = Math.min(lon1, lon2) - padding;
    const maxLon = Math.max(lon1, lon2) + padding;
    return `${minLat},${minLon},${maxLat},${maxLon}`;
}

// Function to fetch traffic lights using Overpass API
async function getTrafficLights(bbox) {
    const overpassQuery = `[out:json];
        node[highway=traffic_signals](${bbox});
        out;`;

    const response = await fetch(
        `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`
    );

    if (!response.ok) {
        throw new Error('Failed to fetch traffic light data');
    }

    const data = await response.json();
    return data.elements.map((node, index) => ({
        id: index,
        lat: node.lat,
        lon: node.lon
    }));
}

// Function to load traffic lights dynamically based on the bounding box
async function loadTrafficLightsForBoundingBox(sourceCoords, destCoords) {
    try {
        const padding = 0.002; // Reduce the bounding box padding to 0.003 degrees (~0.33 km)
        const bbox = calculateBoundingBox(sourceCoords[0], sourceCoords[1], destCoords[0], destCoords[1], padding);
        console.log('Fetching traffic lights for bounding box:', bbox);

        const trafficLights = await getTrafficLights(bbox);

        // Add traffic lights as markers on the map
        trafficLights.forEach(light => {
            L.marker([light.lat, light.lon], {
                icon: L.icon({
                    iconUrl: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                    iconSize: [24, 24],
                    iconAnchor: [12, 24]
                })
            }).addTo(map).bindPopup('Traffic Light');
        });

        console.log(`${trafficLights.length} traffic lights loaded.`);

        // Construct the graph using traffic lights
        const { graphEdges } = constructGraph(trafficLights);
        return { trafficLights, graphEdges };
    } catch (error) {
        console.error('Error loading traffic lights:', error);
        return { trafficLights: [], graphEdges: [] };
    }
}

// Function to construct the graph with traffic lights
function constructGraph(trafficLights) {
    const MAX_DISTANCE = 1; // Maximum distance in km to connect two traffic lights
    const graphEdges = [];

    // Create edges only between nearby traffic lights
    for (let i = 0; i < trafficLights.length; i++) {
        for (let j = i + 1; j < trafficLights.length; j++) {
            const lightA = trafficLights[i];
            const lightB = trafficLights[j];

            // Calculate distance between two traffic lights
            const distance = calculateDistance(lightA.lat, lightA.lon, lightB.lat, lightB.lon);

            // Add edge only if the distance is within the limit
            if (distance <= MAX_DISTANCE) {
                graphEdges.push([lightA.id, lightB.id, Math.round(distance * 1000)]); // Convert to meters
                graphEdges.push([lightB.id, lightA.id, Math.round(distance * 1000)]); // Convert to meters

                // Visualize the edge on the map
                L.polyline(
                    [
                        [lightA.lat, lightA.lon],
                        [lightB.lat, lightB.lon]
                    ],
                    { color: 'orange', weight: 1, opacity: 0.7 }
                ).addTo(map);
            }
        }
    }

    console.log('Graph Nodes:', trafficLights);
    console.log('Graph Edges:', graphEdges);
    return { trafficLights, graphEdges };
}

// Update the route button to dynamically load traffic lights and find the shortest path
routeBtn.addEventListener('click', async () => {
    const sourceCoords = sourceInput.value.split(',').map(Number);
    const destCoords = destInput.value.split(',').map(Number);

    if (!sourceCoords || !destCoords || sourceCoords.length !== 2 || destCoords.length !== 2) {
        console.error('Invalid source or destination coordinates');
        return;
    }

    // Load traffic lights for the bounding box
    const { trafficLights, graphEdges } = await loadTrafficLightsForBoundingBox(sourceCoords, destCoords);

    if (trafficLights.length === 0 || graphEdges.length === 0) {
        console.error('No traffic lights or graph edges found in the bounding box');
        return;
    }

    // Log the graph for debugging
    console.log('Traffic Lights:', trafficLights);
    console.log('Graph Edges:', graphEdges);

    // Find the shortest path using the loaded traffic lights and graph
    findShortestPath(trafficLights, graphEdges);
});

// Add map click handler
map.on('click', (e) => {
    const { lat, lng } = e.latlng;
    destInput.value = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    addMarker(lat, lng, 'destination');
    validateInputs();
});