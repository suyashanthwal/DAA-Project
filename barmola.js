
function calculateRouteStats(path, trafficLights) {
    let totalDistance = 0;
    
    // Calculate total distance along the path
    for (let i = 0; i < path.length - 1; i++) {
        const currentLight = trafficLights[path[i]];
        const nextLight = trafficLights[path[i + 1]];
        totalDistance += calculateDistance(currentLight.lat, currentLight.lon, nextLight.lat, nextLight.lon);
    }

    // Round distance to 2 decimal places
    totalDistance = Math.round(totalDistance * 100) / 100;

    // Estimate time: Assuming average speed of 40 km/h in city with traffic lights
    // Adding 30 seconds for each traffic light stop
    const averageSpeed = 40; // km/h
    const timeInHours = totalDistance / averageSpeed;
    const trafficLightDelay = (path.length - 2) * 0.5; // 30 seconds = 0.5 minutes per light
    const totalTimeInMinutes = Math.round((timeInHours * 60) + trafficLightDelay);

    return {
        distance: totalDistance,
        time: totalTimeInMinutes
    };
}

function findShortestPath(trafficLights, graphEdges) {
    const sourceCoords = sourceInput.value.split(',').map(Number);
    const destCoords = destInput.value.split(',').map(Number);

    const sourceNode = findClosestNode(sourceCoords[0], sourceCoords[1], trafficLights);
    const destNode = findClosestNode(destCoords[0], destCoords[1], trafficLights);

    if (sourceNode === null || destNode === null) {
        statusElement.textContent = 'Could not find traffic lights near source or destination. Try different coordinates.';
        console.log('Path not found: Could not find closest traffic lights');
        // Reset stats when no path is found
        distanceElement.textContent = '--';
        timeElement.textContent = '--';
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
        statusElement.textContent = 'No valid path found between source and destination. Try coordinates with better traffic light coverage.';
        console.log('Path not found');
        // Reset stats when no path is found
        distanceElement.textContent = '--';
        timeElement.textContent = '--';
        return;
    }

    // Calculate and display route statistics
    const stats = calculateRouteStats(path, trafficLights);
    distanceElement.textContent = stats.distance;
    timeElement.textContent = stats.time;

    statusElement.textContent = 'Route found successfully!';
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