# OpenStreetMap Drone Flight Simulator

A real-time aircraft flight simulator that integrates OpenStreetMap for area selection and GPS-based flight control. The application streams flight telemetry data via WebSocket using realistic aircraft parameters.

## Features

✈️ **Interactive Map-Based Flight Planning**
- Select custom flight areas using polygon or rectangle drawing tools
- Real-time OSM (OpenStreetMap) integration
- Visual flight path tracking
- Aircraft position marker with real-time updates

📡 **Real-Time Telemetry**
- WebSocket-based live data streaming
- GPS coordinates (latitude, longitude)
- Altitude control (feet)
- Ground speed and true course
- Pitch, roll, and heading (AHRS)
- Vertical speed and simulation timing

🎮 **Flight Control**
- Cruise altitude selection (0-50,000 ft)
- Ground speed adjustment (0-200 knots)
- Automatic waypoint navigation
- Distance-based flight path interpolation
- Realistic bearing calculations

📊 **Live Telemetry Display**
- Position data (lat/lon/altitude)
- Navigation parameters (heading, speed, vertical speed)
- Aircraft attitude (pitch, roll, gyro heading)
- Simulation status and elapsed time

## Architecture

### Backend
- **Node.js + Express** - HTTP server and REST API
- **WebSocket (ws)** - Real-time telemetry streaming
- **Flight Physics** - Haversine distance calculations, bearing computations, waypoint interpolation

### Frontend
- **Leaflet.js** - Interactive mapping
- **Leaflet Draw** - Area selection tools
- **OpenStreetMap Tiles** - Base mapping layer
- **Vanilla JavaScript** - Real-time WebSocket client

## Installation

### Prerequisites
- Node.js 16+
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/3dcodepilot/openstreetmap-drone-flight-simulator.git
cd openstreetmap-drone-flight-simulator

# Install dependencies
npm install

# Start the server
npm start
```

The application will be available at `http://localhost:3000`

## Usage

### Web Interface

1. **Define Flight Area**
   - Use the drawing tools in the top-left of the map
   - Select "Polygon" or "Rectangle" mode
   - Draw your desired flight area on the map

2. **Configure Flight Parameters**
   - Set **Cruise Altitude** (feet)
   - Set **Ground Speed** (knots)

3. **Start Flight**
   - Click "Start Flight" button
   - Aircraft will follow waypoints around the selected area
   - Watch real-time telemetry in the right panel

4. **Monitor Flight**
   - View live position, altitude, heading
   - Monitor attitude (pitch/roll)
   - Track elapsed time and flight phase

## WebSocket Protocol

### Client → Server Messages

**Start Simulation**
```json
{
  "type": "START_SIMULATION",
  "data": {
    "waypoints": [
      {"lat": 25.7953, "lon": -80.2829},
      {"lat": 25.8000, "lon": -80.2800}
    ],
    "cruiseAltitude": 3000,
    "speed": 45
  }
}
```

**Stop Simulation**
```json
{
  "type": "STOP_SIMULATION"
}
```

**Set Flight Area**
```json
{
  "type": "SET_AREA",
  "data": {
    "type": "Polygon",
    "coordinates": [
      {"lat": 25.7953, "lon": -80.2829},
      {"lat": 25.8000, "lon": -80.2800}
    ]
  }
}
```

### Server → Client Messages

**State Update (30 Hz)**
```json
{
  "type": "STATE",
  "data": {
    "AHRSPitch": 0,
    "AHRSRoll": 0,
    "AHRSGyroHeading": 90,
    "GPSLatitude": 25.7953,
    "GPSLongitude": -80.28294911654234,
    "GPSTrueCourse": 90,
    "GPSGroundSpeed": 45,
    "GPSGeometricAltitude": 3000,
    "BaroVerticalSpeed": 0,
    "SimulationPhase": "LEG",
    "SimulationComplete": false,
    "SimulationElapsedSeconds": 31.028904676437378,
    "isSimulating": true,
    "flightPath": [
      {"lat": 25.7953, "lon": -80.2829, "alt": 3000, "time": 0}
    ]
  }
}
```

## REST API

### Endpoints

**Get Current State**
```
GET /api/state
```

**Start Simulation**
```
POST /api/simulation/start
Content-Type: application/json

{
  "waypoints": [...],
  "cruiseAltitude": 3000,
  "speed": 45
}
```

**Stop Simulation**
```
POST /api/simulation/stop
```

**Set Flight Area**
```
POST /api/area/set
Content-Type: application/json

{
  "type": "Polygon",
  "coordinates": [...]
}
```

**Health Check**
```
GET /health
```

## Telemetry Parameters

| Parameter | Unit | Range | Description |
|-----------|------|-------|-------------|
| `AHRSPitch` | degrees | -90 to 90 | Aircraft pitch angle |
| `AHRSRoll` | degrees | -180 to 180 | Aircraft roll angle |
| `AHRSGyroHeading` | degrees | 0 to 360 | Gyroscopic heading reference |
| `GPSLatitude` | decimal | -90 to 90 | Current latitude coordinate |
| `GPSLongitude` | decimal | -180 to 180 | Current longitude coordinate |
| `GPSTrueCourse` | degrees | 0 to 360 | Direction of movement |
| `GPSGroundSpeed` | knots | 0-200 | Horizontal speed over ground |
| `GPSGeometricAltitude` | feet | 0-50000 | Height above sea level |
| `BaroVerticalSpeed` | ft/min | -5000 to 5000 | Rate of altitude change |
| `SimulationPhase` | string | LEG/COMPLETE | Current flight phase |
| `SimulationElapsedSeconds` | seconds | 0+ | Time since simulation start |

## Simulation Physics

### Distance Calculation
Uses Haversine formula for accurate great-circle distances between waypoints.

### Path Interpolation
Aircraft follows a smooth path between waypoints using linear interpolation.

### Bearing Calculation
Computes heading based on geodetic bearing between consecutive waypoints.

### Altitude Profile
Maintains constant cruise altitude throughout flight (no climb/descent phases in current version).

## Performance

- **Update Rate**: 30 Hz (33ms per frame)
- **Max Flight Path History**: 1,000 points (memory-efficient)
- **Multiple Clients**: Supports simultaneous WebSocket connections
- **Broadcast Updates**: All clients receive synchronized state updates

## Configuration

Edit `server.js` to customize:
- Default starting position (Miami coordinates)
- Simulation update frequency (currently 30 Hz)
- Flight path history limit
- WebSocket server settings

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Requires WebSocket support
- Requires modern JavaScript (ES6+)

## Future Enhancements

- [ ] Flight plan file import (GPX, KML)
- [ ] Climb/descent phase simulation
- [ ] Wind effects on flight path
- [ ] Multiple aircraft simultaneous control
- [ ] Flight log export
- [ ] 3D flight visualization
- [ ] Real-time weather integration
- [ ] Geofencing and no-fly zone detection
- [ ] Custom color schemes and themes
- [ ] Touch/mobile controls

## Troubleshooting

**WebSocket Connection Failed**
- Ensure server is running on port 3000
- Check firewall settings
- Verify browser WebSocket support

**No Telemetry Updates**
- Check browser console for WebSocket errors
- Ensure simulation is started with valid waypoints
- Verify server is broadcasting state

**Flight Path Not Visible**
- Ensure you've drawn a flight area first
- Map may need panning to aircraft position
- Check that simulation has started

## License

MIT License - feel free to use this project for your own purposes.

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## Support

For issues, questions, or feature requests, please open an issue on GitHub.
