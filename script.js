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
        const padding = 0.002;
        const bbox = calculateBoundingBox(sourceCoords[0], sourceCoords[1], destCoords[0], destCoords[1], padding);
        console.log('Fetching traffic lights for bounding box:', bbox);

        const trafficLights = await getTrafficLights(bbox);

        trafficLights.forEach(light => {
            L.marker([light.lat, light.lon], {
                icon: L.icon({
                    iconUrl: 'scr/traffic.png',
                    iconSize: [25, 25],
                    iconAnchor: [10, 32]
                })
            }).addTo(map).bindPopup('Traffic Light');
        });

        console.log(`${trafficLights.length} traffic lights loaded.`);

        const { graphEdges } = constructGraph(trafficLights);
        return { trafficLights, graphEdges };
    } catch (error) {
        console.error('Error loading traffic lights:', error);
        return { trafficLights: [], graphEdges: [] };
    }
}

// Function to construct the graph with traffic lights
function constructGraph(trafficLights) {
    const MAX_DISTANCE = 1;
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

    console.log('Graph Nodes:', trafficLights);
    console.log('Graph Edges:', graphEdges);
    return { trafficLights, graphEdges };
}

// Haversine formula to calculate distance between two lat/lng points
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

// Function to find the closest traffic light node to a given latitude and longitude
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

// Function to calculate the shortest path using Dijkstra's algorithm in JavaScript
function findShortestPath(trafficLights, graphEdges) {
    const sourceCoords = sourceInput.value.split(',').map(Number);
    const destCoords = destInput.value.split(',').map(Number);

    // Find the closest traffic lights to the source and destination
    const sourceNode = trafficLights.length; // Temporary node for source
    const destNode = trafficLights.length + 1; // Temporary node for destination

    // Add source and destination as temporary nodes
    trafficLights.push({ id: sourceNode, lat: sourceCoords[0], lon: sourceCoords[1] });
    trafficLights.push({ id: destNode, lat: destCoords[0], lon: destCoords[1] });

    // Connect source and destination to their closest traffic lights
    const sourceClosest = findClosestNode(sourceCoords[0], sourceCoords[1], trafficLights.slice(0, -2));
    const destClosest = findClosestNode(destCoords[0], destCoords[1], trafficLights.slice(0, -2));

    if (sourceClosest === null || destClosest === null) {
        console.error('Could not find closest traffic lights');
        return;
    }

    graphEdges.push([sourceNode, sourceClosest, Math.round(calculateDistance(
        sourceCoords[0], sourceCoords[1],
        trafficLights[sourceClosest].lat, trafficLights[sourceClosest].lon
    ) * 1000)]);

    graphEdges.push([destNode, destClosest, Math.round(calculateDistance(
        destCoords[0], destCoords[1],
        trafficLights[destClosest].lat, trafficLights[destClosest].lon
    ) * 1000)]);

    console.log(`Source Node: ${sourceNode}, Destination Node: ${destNode}`);

    // Build the graph as an adjacency list
    const graph = {};
    trafficLights.forEach(light => {
        graph[light.id] = [];
    });
    graphEdges.forEach(([from, to, weight]) => {
        graph[from].push({ to, weight });
    });

    // Initialize distances and previous nodes
    const dist = {};
    const prev = {};
    const visited = new Set();

    trafficLights.forEach(light => {
        dist[light.id] = Infinity;
        prev[light.id] = null;
    });
    dist[sourceNode] = 0;

    // Dijkstra's algorithm without a priority queue
    while (visited.size < trafficLights.length) {
        // Find the unvisited node with the smallest distance
        let currentNode = null;
        let currentDist = Infinity;

        for (const node in dist) {
            if (!visited.has(node) && dist[node] < currentDist) {
                currentNode = node;
                currentDist = dist[node];
            }
        }

        if (currentNode === null) break; // No reachable nodes remain
        visited.add(currentNode);

        // Update distances to neighbors
        for (const { to, weight } of graph[currentNode]) {
            const alt = dist[currentNode] + weight;
            if (alt < dist[to]) {
                dist[to] = alt;
                prev[to] = currentNode;
            }
        }
    }

    // Reconstruct the shortest path
    const path = [];
    for (let at = destNode; at !== null; at = prev[at]) {
        path.push(at);
    }
    path.reverse();

    if (path[0] !== sourceNode) {
        console.error('No path found');
        return;
    }

    console.log('Shortest Path:', path);

    // Display the shortest path
    displayShortestPath(path, trafficLights);
}

// Function to display only the traffic lights on the shortest path
function displayShortestPath(path, trafficLights) {
    trafficLights.forEach(light => {
        if (light.marker) {
            map.removeLayer(light.marker);
        }
    });

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

// Function to animate the shortest path
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
        } else {
            console.log('Animation complete');
        }
    }

    drawNextSegment();
}

// Update the route button to dynamically load traffic lights and find the shortest path
routeBtn.addEventListener('click', async (event) => {
    event.preventDefault();

    const sourceCoords = sourceInput.value.split(',').map(Number);
    const destCoords = destInput.value.split(',').map(Number);

    if (!sourceCoords || !destCoords || sourceCoords.length !== 2 || destCoords.length !== 2) {
        console.error('Invalid source or destination coordinates');
        return;
    }

    const { trafficLights, graphEdges } = await loadTrafficLightsForBoundingBox(sourceCoords, destCoords);

    if (trafficLights.length === 0 || graphEdges.length === 0) {
        console.error('No traffic lights or graph edges found in the bounding box');
        return;
    }

    console.log('Traffic Lights:', trafficLights);
    console.log('Graph Edges:', graphEdges);

    findShortestPath(trafficLights, graphEdges);
});

// Add map click handler
map.on('click', (e) => {
    const { lat, lng } = e.latlng;
    destInput.value = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    addMarker(lat, lng, 'destination');
    validateInputs();
});