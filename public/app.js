let map;
let ws;
let drawnItems;
let flightPathPolyline;
let aircraftMarker;
let selectedArea = null;
let isSimulating = false;

// Initialize map
function initMap() {
  map = L.map('map').setView([25.7953, -80.28294911654234], 13);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);
  
  // Initialize draw features
  drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);
  
  const drawControl = new L.Control.Draw({
    position: 'topleft',
    draw: {
      polygon: true,
      polyline: false,
      rectangle: true,
      circle: false,
      marker: false
    },
    edit: {
      featureGroup: drawnItems
    }
  });
  
  map.addControl(drawControl);
  
  // Handle draw events
  map.on('draw:created', onDrawCreated);
  map.on('draw:edited', onDrawEdited);
  map.on('draw:deleted', onDrawDeleted);
}

function onDrawCreated(e) {
  const layer = e.layer;
  drawnItems.addLayer(layer);
  extractArea();
}

function onDrawEdited(e) {
  extractArea();
}

function onDrawDeleted(e) {
  extractArea();
}

function extractArea() {
  const features = drawnItems.toGeoJSON();
  
  if (features.features.length > 0) {
    const feature = features.features[0];
    const coords = feature.geometry.coordinates[0] || [];
    
    selectedArea = {
      type: feature.geometry.type,
      coordinates: coords.map(coord => ({
        lon: coord[0],
        lat: coord[1]
      }))
    };
    
    document.getElementById('startBtn').disabled = false;
    
    // Send area to server
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'SET_AREA',
        data: selectedArea
      }));
    }
    
    console.log('Selected area:', selectedArea);
  } else {
    selectedArea = null;
    document.getElementById('startBtn').disabled = true;
  }
}

// Initialize WebSocket connection
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
    updateStatus('Connected');
  };
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    if (message.type === 'STATE') {
      updateTelemetry(message.data);
    }
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected');
    updateStatus('Disconnected');
    // Attempt to reconnect after 3 seconds
    setTimeout(initWebSocket, 3000);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    updateStatus('Error');
  };
}

function startSimulation() {
  if (!selectedArea || selectedArea.coordinates.length < 2) {
    alert('Please draw a flight area first');
    return;
  }
  
  const altitude = parseFloat(document.getElementById('altitude').value) || 3000;
  const speed = parseFloat(document.getElementById('speed').value) || 45;
  
  const waypoints = selectedArea.coordinates;
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'START_SIMULATION',
      data: {
        waypoints,
        cruiseAltitude: altitude,
        speed: speed
      }
    }));
    
    isSimulating = true;
    document.getElementById('startBtn').disabled = true;
    document.getElementById('stopBtn').disabled = false;
    
    // Initialize flight path
    flightPathPolyline = L.polyline([], {
      color: '#007bff',
      weight: 2,
      opacity: 0.7,
      className: 'flight-path'
    }).addTo(map);
  } else {
    alert('WebSocket connection not ready');
  }
}

function stopSimulation() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'STOP_SIMULATION'
    }));
  }
  
  isSimulating = false;
  document.getElementById('startBtn').disabled = false;
  document.getElementById('stopBtn').disabled = true;
}

function clearPath() {
  if (flightPathPolyline) {
    map.removeLayer(flightPathPolyline);
    flightPathPolyline = null;
  }
}

function updateTelemetry(state) {
  // Position
  document.getElementById('lat').textContent = state.GPSLatitude.toFixed(6);
  document.getElementById('lon').textContent = state.GPSLongitude.toFixed(6);
  document.getElementById('alt').textContent = Math.round(state.GPSGeometricAltitude).toLocaleString();
  
  // Navigation
  document.getElementById('heading').textContent = Math.round(state.GPSTrueCourse || 0);
  document.getElementById('speed-display').textContent = Math.round(state.GPSGroundSpeed || 0);
  document.getElementById('vspeed').textContent = Math.round((state.BaroVerticalSpeed || 0) * 100) / 100;
  
  // Attitude
  document.getElementById('pitch').textContent = (state.AHRSPitch || 0).toFixed(1);
  document.getElementById('roll').textContent = (state.AHRSRoll || 0).toFixed(1);
  document.getElementById('gyro-heading').textContent = Math.round(state.AHRSGyroHeading || 0);
  
  // Simulation
  document.getElementById('phase').textContent = state.SimulationPhase || 'N/A';
  document.getElementById('elapsed').textContent = formatTime(state.SimulationElapsedSeconds || 0);
  
  // Update aircraft marker
  if (aircraftMarker) {
    map.removeLayer(aircraftMarker);
  }
  
  aircraftMarker = L.marker(
    [state.GPSLatitude, state.GPSLongitude],
    {
      icon: L.icon({
        iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIgZmlsbD0iI2RjMzU0NSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9zdmc+',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      }),
      title: `Aircraft - Alt: ${Math.round(state.GPSGeometricAltitude)} ft`
    }
  ).addTo(map);
  
  // Update flight path
  if (isSimulating && state.flightPath && state.flightPath.length > 0) {
    const latLngs = state.flightPath.map(point => [point.lat, point.lon]);
    
    if (flightPathPolyline) {
      flightPathPolyline.setLatLngs(latLngs);
    } else {
      flightPathPolyline = L.polyline(latLngs, {
        color: '#007bff',
        weight: 2,
        opacity: 0.7
      }).addTo(map);
    }
    
    // Pan map to aircraft
    map.panTo([state.GPSLatitude, state.GPSLongitude]);
  }
  
  // Update simulation status
  if (state.SimulationComplete && isSimulating) {
    isSimulating = false;
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    alert('Flight simulation complete');
  }
}

function updateStatus(status) {
  document.getElementById('status').textContent = status;
}

function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  initMap();
  initWebSocket();
});
