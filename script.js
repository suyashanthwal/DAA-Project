// Add map overlay
const mapOverlay = document.createElement('div');
mapOverlay.className = 'map-overlay';
document.querySelector('.container').appendChild(mapOverlay);

// Initialize map and other variables
let map = L.map('map').setView([40.7128, -74.0060], 13); 
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

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

function calculateBoundingBox(lat1, lon1, lat2, lon2, padding = 0.003) {
    const minLat = Math.min(lat1, lat2) - padding;
    const maxLat = Math.max(lat1, lat2) + padding;
    const minLon = Math.min(lon1, lon2) - padding;
    const maxLon = Math.max(lon1, lon2) + padding;
    return `${minLat},${minLon},${maxLat},${maxLon}`;
}

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

async function loadTrafficLightsForBoundingBox(sourceCoords, destCoords) {
    try {
        const padding = 0.002;
        const bbox = calculateBoundingBox(sourceCoords[0], sourceCoords[1], destCoords[0], destCoords[1], padding);

        const trafficLights = await getTrafficLights(bbox);

        const { graphEdges } = constructGraph(trafficLights);
        return { trafficLights, graphEdges };
    } catch (error) {
        return { trafficLights: [], graphEdges: [] };
    }
}

function constructGraph(trafficLights) {
    const MAX_DISTANCE = 0.15;
    const graphEdges = [];

    for (let i = 0; i < trafficLights.length; i++) {
        for (let j = i + 1; j < trafficLights.length; j++) {
            const lightA = trafficLights[i];
            const lightB = trafficLights[j];

            const distance = calculateDistance(lightA.lat, lightA.lon, lightB.lat, lightB.lon);

            if (distance <= MAX_DISTANCE) {
                graphEdges.push([lightA.id, lightB.id, Math.round(distance * 1000)]);
                graphEdges.push([lightB.id, lightA.id, Math.round(distance * 1000)]);
            }
        }
    }

    return { trafficLights, graphEdges };
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function findClosestNode(lat, lon, trafficLights) {
    let closestNode = null;
    let minDistance = Infinity;

    trafficLights.forEach((light, index) => {
        const distance = calculateDistance(lat, lon, light.lat, light.lon);
        if (distance < minDistance) {
            minDistance = distance;
            closestNode = index;
        }
    });

    return closestNode;
}

function findShortestPath(trafficLights, graphEdges) {
    const sourceCoords = sourceInput.value.split(',').map(Number);
    const destCoords = destInput.value.split(',').map(Number);

    const sourceNode = findClosestNode(sourceCoords[0], sourceCoords[1], trafficLights);
    const destNode = findClosestNode(destCoords[0], destCoords[1], trafficLights);

    if (sourceNode === null || destNode === null) {
        console.log('Path not found: Could not find closest traffic lights');
        return;
    }

    const graph = {};
    trafficLights.forEach(light => {
        graph[light.id] = [];
    });
    graphEdges.forEach(([from, to, weight]) => {
        graph[from].push({ to, weight });
    });

    const dist = {};
    const prev = {};
    const visited = new Set();

    trafficLights.forEach(light => {
        dist[light.id] = Infinity;
        prev[light.id] = null;
    });
    dist[sourceNode] = 0;

    while (visited.size < trafficLights.length) {
        let currentNode = null;
        let currentDist = Infinity;

        for (const node in dist) {
            if (!visited.has(Number(node)) && dist[node] < currentDist) {
                currentNode = Number(node);
                currentDist = dist[node];
            }
        }

        if (currentNode === null) break;
        visited.add(currentNode);

        for (const { to, weight } of graph[currentNode]) {
            const alt = dist[currentNode] + weight;
            if (alt < dist[to]) {
                dist[to] = alt;
                prev[to] = currentNode;
            }
        }
    }

    const path = [];
    for (let at = destNode; at !== null; at = prev[at]) {
        path.push(at);
    }
    path.reverse();

    if (path[0] !== sourceNode) {
        console.log('Path not found');
        return;
    }

    console.log('Path found');
    displayShortestPath(path, trafficLights);
}

function connectToMultipleNodes(lat, lon, trafficLights, graphEdges, nodeId) {
    const CONNECT_TO_COUNT = 3;
    const distances = trafficLights.map((light, index) => ({
        index,
        distance: calculateDistance(lat, lon, light.lat, light.lon)
    }));

    distances.sort((a, b) => a.distance - b.distance);

    for (let i = 0; i < Math.min(CONNECT_TO_COUNT, distances.length); i++) {
        const closestNode = distances[i].index;
        const distance = distances[i].distance;

        graphEdges.push([nodeId, closestNode, Math.round(distance * 1000)]);
        graphEdges.push([closestNode, nodeId, Math.round(distance * 1000)]);
    }
}


function displayShortestPath(path, trafficLights) {

    path.forEach(nodeId => {
        const light = trafficLights[nodeId];
        light.marker = L.marker([light.lat, light.lon], {
            icon: L.icon({
                iconUrl: 'scr/traffic.png',
                iconSize: [25, 25],
                iconAnchor: [10, 32]
            })
        }).addTo(map).bindPopup('Traffic Light');
    });

    animatePath(path, trafficLights);
}

function animatePath(path, trafficLights) {
    const pathCoordinates = path.map(nodeId => {
        const light = trafficLights[nodeId];
        return [light.lat, light.lon];
    });

    let index = 0;
    const polyline = L.polyline([], { color: 'blue', weight: 4 }).addTo(map);

    function drawNextSegment() {
        if (index < pathCoordinates.length) {
            polyline.addLatLng(pathCoordinates[index]);
            index++;
            setTimeout(drawNextSegment, 300);
        }
    }

    drawNextSegment();
}

routeBtn.addEventListener('click', async (event) => {
    event.preventDefault();

    const sourceCoords = sourceInput.value.split(',').map(Number);
    const destCoords = destInput.value.split(',').map(Number);

    if (!sourceCoords || !destCoords || sourceCoords.length !== 2 || destCoords.length !== 2) {
        return;
    }

    const { trafficLights, graphEdges } = await loadTrafficLightsForBoundingBox(sourceCoords, destCoords);

    if (trafficLights.length === 0 || graphEdges.length === 0) {
        return;
    }

    const sourceNode = trafficLights.length; 
    const destNode = trafficLights.length + 1; 

    trafficLights.push({ id: sourceNode, lat: sourceCoords[0], lon: sourceCoords[1] });
    trafficLights.push({ id: destNode, lat: destCoords[0], lon: destCoords[1] });

    connectToMultipleNodes(sourceCoords[0], sourceCoords[1], trafficLights, graphEdges, sourceNode);
    connectToMultipleNodes(destCoords[0], destCoords[1], trafficLights, graphEdges, destNode);

    findShortestPath(trafficLights, graphEdges);
});

map.on('click', (e) => {
    const { lat, lng } = e.latlng;
    destInput.value = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    addMarker(lat, lng, 'destination');
    validateInputs();
});

// Menu Toggle Functionality
document.getElementById('menuToggle').addEventListener('click', function() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('active');
    mapOverlay.style.display = sidebar.classList.contains('active') ? 'block' : 'none';
});

// Close sidebar when clicking outside
document.addEventListener('click', function(event) {
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');
    
    if (!sidebar.contains(event.target) && !menuToggle.contains(event.target)) {
        sidebar.classList.remove('active');
        mapOverlay.style.display = 'none';
    }
});

// Update the location button functionality
showLocationBtn.addEventListener('click', function() {
    if (navigator.geolocation) {
        showLocationBtn.disabled = true;
        showLocationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting Location...';

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                sourceInput.value = `${lat},${lng}`;
                addMarker(lat, lng, 'source');
                validateInputs();
                showLocationBtn.disabled = false;
                showLocationBtn.innerHTML = '<i class="fas fa-location-dot"></i> Show Location';
            },
            (error) => {
                sourceError.textContent = 'Could not get your location. Please enter coordinates manually.';
                sourceError.style.display = 'block';
                showLocationBtn.disabled = false;
                showLocationBtn.innerHTML = '<i class="fas fa-location-dot"></i> Show Location';
            }
        );
    } else {
        sourceError.textContent = 'Geolocation is not supported by your browser';
        sourceError.style.display = 'block';
    }
});