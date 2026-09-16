import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Flight simulator state
const flightState = {
  AHRSPitch: 0,
  AHRSRoll: 0,
  AHRSGyroHeading: 90,
  AHRSMagHeading: 90,
  GPSLatitude: 25.7953,
  GPSLongitude: -80.28294911654234,
  GPSTrueCourse: 90,
  GPSGroundSpeed: 45,
  GPSGeometricAltitude: 3000,
  GPSHeightAboveEllipsoid: 3000,
  GPSAltitudeMSL: 3000,
  BaroVerticalSpeed: 0,
  AHRSSlipSkid: 0,
  GPSFixQuality: 4,
  SimulationPhase: 'LEG',
  SimulationComplete: false,
  SimulationElapsedSeconds: 0,
  isSimulating: false,
  selectedArea: null
};

let simulationInterval = null;
let startTime = null;

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('Client connected. Total clients:', wss.clients.size);
  
  // Send initial state in Stratux format
  const initialState = { ...flightState };
  
  ws.send(JSON.stringify(initialState));
  
  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      handleClientMessage(parsed, ws);
    } catch (err) {
      console.error('Error parsing message:', err);
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected. Remaining clients:', wss.clients.size);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

function handleClientMessage(message, ws) {
  switch (message.type) {
    case 'START_SIMULATION':
      startSimulation(message.data);
      break;
    case 'STOP_SIMULATION':
      stopSimulation();
      break;
    case 'SET_AREA':
      flightState.selectedArea = message.data;
      broadcastState();
      break;
    case 'UPDATE_TARGET':
      updateFlightTarget(message.data);
      break;
    case 'REQUEST_STATE':
      const stateToSend = { ...flightState };
      ws.send(JSON.stringify(stateToSend));
      break;
  }
}

function startSimulation(params) {
  if (flightState.isSimulating) return;
  
  console.log('Starting simulation with params:', params);
  flightState.isSimulating = true;
  flightState.SimulationPhase = 'LEG';
  flightState.SimulationComplete = false;
  flightState.SimulationElapsedSeconds = 0;
  flightState.GPSFixQuality = 4;
  startTime = Date.now();
  
  // Simulation loop - 30 Hz (matches Stratux 100ms but we do 33ms)
  simulationInterval = setInterval(() => {
    updateFlightState(params);
    broadcastState();
  }, 33); // ~30 Hz
}

function stopSimulation() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
  flightState.isSimulating = false;
  flightState.SimulationPhase = 'COMPLETE';
  flightState.SimulationComplete = true;
  flightState.GPSFixQuality = 0;
  broadcastState();
}

function updateFlightState(params) {
  if (!startTime) return;
  
  const elapsed = (Date.now() - startTime) / 1000;
  flightState.SimulationElapsedSeconds = elapsed;
  
  const { waypoints, cruiseAltitude, speed } = params;
  
  if (!waypoints || waypoints.length === 0) {
    stopSimulation();
    return;
  }
  
  // Calculate progress through waypoints
  const totalDistance = calculateTotalDistance(waypoints);
  const speedMps = (speed || 45) / 1.94384; // Convert knots to m/s
  const distanceTraveled = speedMps * elapsed;
  const progress = Math.min(distanceTraveled / totalDistance, 1);
  
  if (progress >= 1) {
    flightState.SimulationComplete = true;
    flightState.SimulationPhase = 'COMPLETE';
    stopSimulation();
    return;
  }
  
  // Interpolate position along path
  const position = interpolatePosition(waypoints, progress);
  
  flightState.GPSLatitude = position.lat;
  flightState.GPSLongitude = position.lon;
  flightState.GPSGeometricAltitude = cruiseAltitude || 3000;
  flightState.GPSHeightAboveEllipsoid = cruiseAltitude || 3000;
  flightState.GPSAltitudeMSL = cruiseAltitude || 3000;
  flightState.GPSGroundSpeed = speed || 45;
  flightState.GPSTrueCourse = position.heading;
  flightState.AHRSGyroHeading = position.heading;
  flightState.AHRSMagHeading = position.heading;
  flightState.BaroVerticalSpeed = 0;
  
  // Simulate pitch/roll based on heading changes
  flightState.AHRSRoll = Math.sin(position.heading * Math.PI / 180) * 5;
  flightState.AHRSPitch = 0;
  
  // Slip/skid defaults to 0 (straight and level flight)
  flightState.AHRSSlipSkid = 0;
  
  // GPS Fix Quality: 4 = GPS fix
  flightState.GPSFixQuality = 4;
}

function calculateTotalDistance(waypoints) {
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    total += haversineDistance(
      waypoints[i].lat,
      waypoints[i].lon,
      waypoints[i + 1].lat,
      waypoints[i + 1].lon
    );
  }
  return total;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function interpolatePosition(waypoints, progress) {
  let distanceToProgress = calculateTotalDistance(waypoints) * progress;
  let currentPoint = waypoints[0];
  let nextPoint = waypoints[1];
  let currentDistance = 0;
  
  for (let i = 0; i < waypoints.length - 1; i++) {
    const segmentDistance = haversineDistance(
      waypoints[i].lat,
      waypoints[i].lon,
      waypoints[i + 1].lat,
      waypoints[i + 1].lon
    );
    
    if (currentDistance + segmentDistance >= distanceToProgress) {
      currentPoint = waypoints[i];
      nextPoint = waypoints[i + 1];
      const segmentProgress = (distanceToProgress - currentDistance) / segmentDistance;
      
      const heading = calculateBearing(
        currentPoint.lat,
        currentPoint.lon,
        nextPoint.lat,
        nextPoint.lon
      );
      
      return {
        lat: currentPoint.lat + (nextPoint.lat - currentPoint.lat) * segmentProgress,
        lon: currentPoint.lon + (nextPoint.lon - currentPoint.lon) * segmentProgress,
        heading: heading
      };
    }
    
    currentDistance += segmentDistance;
  }
  
  return {
    lat: waypoints[waypoints.length - 1].lat,
    lon: waypoints[waypoints.length - 1].lon,
    heading: 0
  };
}

function calculateBearing(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

function updateFlightTarget(data) {
  // Handle target updates from client
  if (data.altitude) {
    flightState.GPSGeometricAltitude = data.altitude;
    flightState.GPSHeightAboveEllipsoid = data.altitude;
    flightState.GPSAltitudeMSL = data.altitude;
  }
  if (data.heading) {
    flightState.AHRSGyroHeading = data.heading;
    flightState.AHRSMagHeading = data.heading;
  }
  broadcastState();
}

function broadcastState() {
  // Send state in Stratux-compatible format
  const stateToSend = { ...flightState };
  
  const message = JSON.stringify(stateToSend);
  
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // 1 = OPEN
      client.send(message);
    }
  });
}

// REST API endpoints
app.get('/api/state', (req, res) => {
  res.json(flightState);
});

app.post('/api/simulation/start', (req, res) => {
  startSimulation(req.body);
  res.json({ success: true, state: flightState });
});

app.post('/api/simulation/stop', (req, res) => {
  stopSimulation();
  res.json({ success: true, state: flightState });
});

app.post('/api/area/set', (req, res) => {
  flightState.selectedArea = req.body;
  res.json({ success: true, area: flightState.selectedArea });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

server.listen(PORT, () => {
  console.log(`Flight Simulator Server running on http://localhost:${PORT}`);
  console.log(`WebSocket server ready for Stratux-compatible connections`);
});
