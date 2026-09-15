# Setup Instructions

## Quick Start

### 1. Prerequisites
```bash
# Ensure you have Node.js 16+ installed
node --version
npm --version
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start the Server
```bash
npm start
```

Output:
```
Flight Simulator Server running on http://localhost:3000
WebSocket server ready for connections
```

### 4. Open in Browser
Navigate to `http://localhost:3000` in your web browser.

## Development Mode

```bash
npm run dev
```

## Project Structure

```
openstreeemap-drone-flight-simulator/
├── server.js              # Node.js/Express server with WebSocket
├── package.json           # Project dependencies
├── public/
│   ├── index.html         # Main HTML interface
│   ├── app.js             # Client-side JavaScript logic
│   └── styles.css         # UI styling
└── README.md              # Documentation
```

## Core Components

### server.js
- Express HTTP server on port 3000
- WebSocket server for real-time telemetry
- Flight simulation engine with physics calculations
- REST API endpoints for flight control

### public/index.html
- Leaflet.js map integration
- Leaflet Draw for area selection
- Telemetry display panels
- Flight control interface

### public/app.js
- WebSocket client connection management
- Map initialization and drawing handlers
- Telemetry data visualization
- Flight path tracking and updates

### public/styles.css
- Responsive layout (map + telemetry panels)
- Control panel styling
- Telemetry display formatting
- Leaflet customization

## Configuration

### Default Starting Position
Edit `server.js` line 15 to change the default GPS coordinates:
```javascript
GPSLatitude: 25.7953,      // Latitude
GPSLongitude: -80.28294911654234,  // Longitude
```

### Simulation Update Rate
Edit `server.js` line 105 to change update frequency:
```javascript
simulationInterval = setInterval(() => {
  updateFlightState(params);
  broadcastState();
}, 33); // Currently 30 Hz (33ms)
```

### Server Port
Edit `server.js` line 9 or set environment variable:
```bash
PORT=5000 npm start
```

## Environment Variables

```bash
# Set custom port
export PORT=3000

# Start server
npm start
```

## Connecting Multiple Clients

The server supports multiple simultaneous WebSocket connections:

1. Open the application in multiple browser windows/tabs
2. Each client receives real-time state updates
3. Drawing areas on one client doesn't affect others
4. Simulations are shared across all connected clients

## Testing the API

### Using curl

**Get current state:**
```bash
curl http://localhost:3000/api/state
```

**Start a simulation:**
```bash
curl -X POST http://localhost:3000/api/simulation/start \
  -H "Content-Type: application/json" \
  -d '{
    "waypoints": [
      {"lat": 25.7953, "lon": -80.2829},
      {"lat": 25.8050, "lon": -80.2700},
      {"lat": 25.7900, "lon": -80.2800}
    ],
    "cruiseAltitude": 3000,
    "speed": 50
  }'
```

**Stop simulation:**
```bash
curl -X POST http://localhost:3000/api/simulation/stop
```

### Using JavaScript

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => {
  // Start simulation
  ws.send(JSON.stringify({
    type: 'START_SIMULATION',
    data: {
      waypoints: [
        {lat: 25.7953, lon: -80.2829},
        {lat: 25.8050, lon: -80.2700}
      ],
      cruiseAltitude: 3000,
      speed: 50
    }
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('State update:', message.data);
};
```

## Deployment

### Heroku

```bash
# Create Procfile
echo "web: node server.js" > Procfile

# Deploy
heroku create
git push heroku main
```

### Docker

Create `Dockerfile`:
```dockerfile
FROM node:16
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

Build and run:
```bash
docker build -t drone-simulator .
docker run -p 3000:3000 drone-simulator
```

### PM2 (Production)

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start server.js --name "drone-simulator"

# Save startup config
pm2 save
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use different port
PORT=5000 npm start
```

### Module Not Found

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### WebSocket Connection Issues

1. Check server is running
2. Verify firewall allows connections
3. Check browser console for errors (F12)
4. Ensure correct server URL in `app.js`

## Performance Tips

- The flight path history is limited to 1,000 points to manage memory
- Update rate is 30 Hz - adjust based on your needs
- For many simultaneous clients, consider using clustering or a message queue

## Next Steps

1. Explore the web interface at `http://localhost:3000`
2. Draw a flight area on the map
3. Adjust altitude and speed settings
4. Click "Start Flight" to begin simulation
5. Monitor real-time telemetry in the right panel

Enjoy your drone flight simulator! ✈️
