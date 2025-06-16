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

        if (trafficLights.length === 0) {
            statusElement.textContent = 'No traffic lights found in the area. Try different coordinates.';
            return { trafficLights: [], graphEdges: [] };
        }

        const { graphEdges } = constructGraph(trafficLights);
        if (graphEdges.length === 0) {
            statusElement.textContent = 'Traffic lights are too far apart. Try coordinates closer together.';
            return { trafficLights: [], graphEdges: [] };
        }

        return { trafficLights, graphEdges };
    } catch (error) {
        statusElement.textContent = 'Error loading traffic lights. Please try again.';
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



function displayShortestPath(path, trafficLights) {
    // Clear any existing traffic lights first
    currentTrafficLights.forEach(light => {
        if (light.marker) {
            map.removeLayer(light.marker);
        }
    });
    currentTrafficLights = [];

    path.forEach(nodeId => {
        const light = trafficLights[nodeId];
        light.marker = L.marker([light.lat, light.lon], {
            icon: L.icon({
                iconUrl: 'scr/traffic.png',
                iconSize: [25, 25],
                iconAnchor: [10, 32]
            })
        }).addTo(map).bindPopup('Traffic Light');
        currentTrafficLights.push(light);
    });

    animatePath(path, trafficLights);
}

function animatePath(path, trafficLights) {
    const pathCoordinates = path.map(nodeId => {
        const light = trafficLights[nodeId];
        return [light.lat, light.lon];
    });

    // Remove existing polyline if it exists
    if (currentPolyline) {
        map.removeLayer(currentPolyline);
    }

    // Create the polyline with custom options
    currentPolyline = L.polyline(pathCoordinates, {
        className: 'animated-path',
        color: '#ff3b30',  // Changed to red
        weight: 4,
        opacity: 1,
        smoothFactor: 1
    }).addTo(map);

    // Fit the map bounds to show the entire route
    map.fitBounds(currentPolyline.getBounds(), {
        padding: [50, 50],
        maxZoom: 15
    });

    // Calculate timing for traffic lights to match path animation
    const totalAnimationTime = 3500; // 3.5s to match CSS animation
    const delayPerLight = totalAnimationTime / path.length;

    // Animate traffic lights sequentially
    let index = 0;
    function animateTrafficLights() {
        if (index < path.length) {
            const currentNodeId = path[index];
            const light = trafficLights[currentNodeId];

            if (light.marker) {
                light.marker.setIcon(
                    L.icon({
                        iconUrl: 'scr/icons8-traffic-light-48.png',
                        iconSize: [25, 25],
                        iconAnchor: [10, 32],
                        className: 'traffic-light-marker'
                    })
                );

                // Add a subtle pop animation to the marker
                const markerElement = light.marker.getElement();
                if (markerElement) {
                    markerElement.style.transform += ' scale(1.2)';
                    setTimeout(() => {
                        markerElement.style.transform = markerElement.style.transform.replace(' scale(1.2)', '');
                    }, 300);
                }
            }

            index++;
            setTimeout(animateTrafficLights, delayPerLight);
        }
    }

    // Start traffic light animation after a short delay
    setTimeout(animateTrafficLights, 200);
}