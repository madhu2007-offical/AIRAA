import React, { useState, useEffect } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  Marker, 
  Popup, 
  Polyline, 
  GeoJSON, 
  useMap, 
  useMapEvents 
} from 'react-leaflet';
import L from 'leaflet';
import { 
  Shield, 
  MapPin, 
  Navigation, 
  AlertTriangle, 
  Clock, 
  Activity, 
  Info, 
  X, 
  Layers, 
  ChevronRight, 
  Check, 
  Plus, 
  Sparkles, 
  RefreshCw, 
  Eye, 
  EyeOff,
  Filter
} from 'lucide-react';

// Hotspot centers for fast map jumps/shortcuts
const HOTSPOTS = [
  { name: "Green Park Metro", lat: 28.558, lng: 77.206 },
  { name: "Hauz Khas Metro", lat: 28.543, lng: 77.206 },
  { name: "Hauz Khas Village", lat: 28.553, lng: 77.194 },
  { name: "SDA Market", lat: 28.546, lng: 77.200 }
];

// Helper to get custom Leaflet DivIcons to avoid the Vite image asset issue
const getIcon = (type, label) => {
  if (type === 'origin') {
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="w-8 h-8 bg-emerald-500 rounded-full border-2 border-white shadow-2xl flex items-center justify-center text-white text-sm font-extrabold ring-4 ring-emerald-500/25">A</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  }
  if (type === 'destination') {
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="w-8 h-8 bg-rose-500 rounded-full border-2 border-white shadow-2xl flex items-center justify-center text-white text-sm font-extrabold ring-4 ring-rose-500/25">B</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  }
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="w-5 h-5 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold">${label || ''}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
};

const getReportIcon = (category) => {
  const colors = {
    'assault': 'bg-red-500 ring-red-500/40',
    'stalking': 'bg-amber-600 ring-amber-600/40',
    'harassment': 'bg-orange-500 ring-orange-500/40',
    'poor lighting': 'bg-yellow-400 ring-yellow-400/40',
    'unsafe infrastructure': 'bg-cyan-500 ring-cyan-500/40',
    'other': 'bg-gray-400 ring-gray-400/40'
  };
  const colorClass = colors[category.toLowerCase()] || colors['other'];
  return L.divIcon({
    className: 'custom-div-icon pulse-marker',
    html: `<div class="w-3.5 h-3.5 rounded-full ${colorClass} border border-white/80 shadow-md ring-4 pulse-marker"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
};

// Map fly-to helper
function ChangeView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom(), { animate: true, duration: 1.0 });
    }
  }, [center, zoom]);
  return null;
}

// Map Click Listener
function MapClickEvents({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    }
  });
  return null;
}

export default function App() {
  const [reports, setReports] = useState([]);
  const [gridData, setGridData] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  
  // Routing state
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [routingLoading, setRoutingLoading] = useState(false);
  
  // Selection mode for map clicks
  const [mapClickMode, setMapClickMode] = useState('none'); // 'none' | 'origin' | 'destination' | 'report'
  
  // Report form state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportCoords, setReportCoords] = useState(null);
  const [reportCategory, setReportCategory] = useState('harassment');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSeverity, setReportSeverity] = useState(3);
  const [submittingReport, setSubmittingReport] = useState(false);
  
  // UI layer visibility controls
  const [showGrid, setShowGrid] = useState(true);
  const [showReportMarkers, setShowReportMarkers] = useState(true);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [mapCenter, setMapCenter] = useState([28.5525, 77.205]);
  const [mapZoom, setMapZoom] = useState(14);
  const [statusMessage, setStatusMessage] = useState('');

  // Fetch initial maps and reports on component load
  useEffect(() => {
    fetchReports();
    fetchGrid();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();
      setReports(data);
    } catch (err) {
      console.error("Failed to load reports:", err);
      setStatusMessage("Error loading crowdsourced reports database.");
    }
  };

  const fetchGrid = async (refresh = false) => {
    try {
      const url = refresh ? '/api/risk-grid?refresh=true' : '/api/risk-grid';
      const res = await fetch(url);
      const data = await res.json();
      setGridData(data);
    } catch (err) {
      console.error("Failed to load risk grid:", err);
      setStatusMessage("Error loading risk grid layers.");
    }
  };

  const handleMapClick = (latlng) => {
    const coords = [latlng.lat, latlng.lng];
    if (mapClickMode === 'origin') {
      setOrigin(coords);
      setMapClickMode('none');
      setStatusMessage("Origin set successfully.");
    } else if (mapClickMode === 'destination') {
      setDestination(coords);
      setMapClickMode('none');
      setStatusMessage("Destination set successfully.");
    } else if (mapClickMode === 'report') {
      setReportCoords(coords);
      setShowReportModal(true);
      setMapClickMode('none');
      setStatusMessage("");
    }
  };

  const handleCellClick = async (cellId) => {
    try {
      const res = await fetch(`/api/risk-grid/${cellId}/explain`);
      const data = await res.json();
      setSelectedCell(data);
    } catch (err) {
      console.error("Failed to explain cell:", err);
    }
  };

  const calculateRoute = async () => {
    if (!origin || !destination) {
      setStatusMessage("Please select both Origin and Destination coordinates.");
      return;
    }
    setRoutingLoading(true);
    setStatusMessage("");
    try {
      const res = await fetch('/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin, destination })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to calculate route");
      }
      const data = await res.json();
      setRoutes(data);
      setActiveRouteIndex(0);
      setStatusMessage(`Found ${data.length} safety-weighted paths.`);
    } catch (err) {
      console.error(err);
      setStatusMessage(err.message || "Failed to solve path. Confirm points are in pilot zone.");
    } finally {
      setRoutingLoading(false);
    }
  };

  const submitReport = async (e) => {
    e.preventDefault();
    if (!reportDescription || !reportCoords) return;
    setSubmittingReport(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: reportCategory,
          description: reportDescription,
          latitude: reportCoords[0],
          longitude: reportCoords[1],
          severity: reportSeverity
        })
      });
      
      if (!res.ok) throw new Error("Submitting report failed.");
      
      // Reset form
      setReportDescription('');
      setShowReportModal(false);
      setReportCoords(null);
      
      // Refresh DB and retrain scoring model
      await fetchReports();
      await fetchGrid(true);
      
      setStatusMessage("Incident reported. Risk Map scoring updated dynamically!");
    } catch (err) {
      console.error(err);
      setStatusMessage("Failed to submit report. Please try again.");
    } finally {
      setSubmittingReport(false);
    }
  };

  // GeoJSON style builder for risk grid cells
  const getCellStyle = (feature) => {
    const riskTier = feature.properties.risk_tier;
    const cellId = feature.properties.cell_id;
    const isSelected = selectedCell && selectedCell.cell_info.cell_id === cellId;
    
    let color = '#10b981'; // low
    let fillOpacity = 0.05;
    
    if (riskTier === 'high') {
      color = '#ef4444';
      fillOpacity = 0.45;
    } else if (riskTier === 'medium') {
      color = '#f59e0b';
      fillOpacity = 0.22;
    }
    
    return {
      color: isSelected ? '#38bdf8' : color,
      weight: isSelected ? 2.5 : 0.7,
      fillColor: color,
      fillOpacity: fillOpacity,
      dashArray: isSelected ? '0' : '2',
    };
  };

  const onEachCell = (feature, layer) => {
    layer.on({
      click: () => handleCellClick(feature.properties.cell_id),
      mouseover: (e) => {
        const layer = e.target;
        layer.setStyle({
          weight: 2,
          color: '#38bdf8',
          fillOpacity: Math.min(layer.options.fillOpacity + 0.1, 0.7)
        });
      },
      mouseout: (e) => {
        const layer = e.target;
        const cellId = feature.properties.cell_id;
        const isSelected = selectedCell && selectedCell.cell_info.cell_id === cellId;
        
        let color = '#10b981';
        let fillOpacity = 0.05;
        if (feature.properties.risk_tier === 'high') {
          color = '#ef4444';
          fillOpacity = 0.45;
        } else if (feature.properties.risk_tier === 'medium') {
          color = '#f59e0b';
          fillOpacity = 0.22;
        }
        
        layer.setStyle({
          color: isSelected ? '#38bdf8' : color,
          weight: isSelected ? 2.5 : 0.7,
          fillColor: color,
          fillOpacity: fillOpacity
        });
      }
    });
  };

  // Filter reports displayed
  const filteredReports = reports.filter(r => {
    if (selectedCategoryFilter === 'all') return true;
    const cat = r.category_ml || r.category;
    return cat.toLowerCase() === selectedCategoryFilter.toLowerCase();
  });

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#090d16]">
      {/* LEFT PANEL */}
      <div className="w-105 glass-panel flex flex-col h-full z-10 shadow-2xl border-r border-slate-800/80">
        
        {/* HEADER */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Shield className="w-5.5 h-5.5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                AIRAA
                <span className="text-[10px] uppercase font-bold tracking-widest bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1.5 py-0.5 rounded">Pilot</span>
              </h1>
              <p className="text-xs text-slate-400">Risk Awareness & Safety Routing</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => { fetchReports(); fetchGrid(true); }}
              title="Refresh Scoring Database"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* CONTROLS SCROLL AREA */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Status Message Alerts */}
          {statusMessage && (
            <div className="p-3.5 text-sm rounded-xl border bg-slate-900/60 border-slate-700 text-sky-300 flex items-start gap-2.5 shadow-inner">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Jump Shortcuts */}
          <div className="space-y-2">
            <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Map Focus Shortcuts</span>
            <div className="grid grid-cols-2 gap-2">
              {HOTSPOTS.map((h, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setMapCenter([h.lat, h.lng]);
                    setMapZoom(15.5);
                  }}
                  className="px-3 py-2 text-left text-xs bg-slate-950/45 hover:bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 text-slate-300 hover:text-white transition flex items-center justify-between"
                >
                  <span>{h.name}</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                </button>
              ))}
            </div>
          </div>

          {/* ROUTING INTERFACE */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Safety Route Planner</span>
              {(origin || destination) && (
                <button 
                  onClick={() => { setOrigin(null); setDestination(null); setRoutes([]); }}
                  className="text-xs text-rose-400 hover:text-rose-300 transition"
                >
                  Clear Points
                </button>
              )}
            </div>

            <div className="space-y-2">
              {/* Origin Selection */}
              <div className="flex gap-2">
                <button
                  onClick={() => setMapClickMode(mapClickMode === 'origin' ? 'none' : 'origin')}
                  className={`flex-1 flex items-center justify-between px-3.5 py-3 rounded-xl border text-sm transition ${
                    mapClickMode === 'origin' 
                      ? 'border-emerald-500/80 bg-emerald-500/10 text-emerald-300 ring-2 ring-emerald-500/10'
                      : origin 
                        ? 'border-slate-800 bg-slate-900/40 text-white' 
                        : 'border-slate-800/80 bg-slate-950/20 text-slate-400 hover:bg-slate-900/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <MapPin className={`w-4 h-4 ${origin ? 'text-emerald-500' : 'text-slate-500'}`} />
                    <span className="text-left font-medium">
                      {origin ? `${origin[0].toFixed(5)}, ${origin[1].toFixed(5)}` : "Select Origin Node..."}
                    </span>
                  </div>
                  {origin ? (
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-bold uppercase">Click Map</span>
                  )}
                </button>
              </div>

              {/* Destination Selection */}
              <div className="flex gap-2">
                <button
                  onClick={() => setMapClickMode(mapClickMode === 'destination' ? 'none' : 'destination')}
                  className={`flex-1 flex items-center justify-between px-3.5 py-3 rounded-xl border text-sm transition ${
                    mapClickMode === 'destination' 
                      ? 'border-rose-500/80 bg-rose-500/10 text-rose-300 ring-2 ring-rose-500/10'
                      : destination 
                        ? 'border-slate-800 bg-slate-900/40 text-white' 
                        : 'border-slate-800/80 bg-slate-950/20 text-slate-400 hover:bg-slate-900/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Navigation className={`w-4 h-4 ${destination ? 'text-rose-500' : 'text-slate-500'}`} />
                    <span className="text-left font-medium">
                      {destination ? `${destination[0].toFixed(5)}, ${destination[1].toFixed(5)}` : "Select Destination Node..."}
                    </span>
                  </div>
                  {destination ? (
                    <Check className="w-4 h-4 text-rose-500 shrink-0" />
                  ) : (
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-bold uppercase">Click Map</span>
                  )}
                </button>
              </div>
            </div>

            {/* Calculate Button */}
            <button
              onClick={calculateRoute}
              disabled={routingLoading || !origin || !destination}
              className="w-full py-3.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white rounded-xl font-semibold shadow-lg shadow-sky-500/20 disabled:opacity-40 disabled:pointer-events-none transition flex items-center justify-center gap-2"
            >
              {routingLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Computing Safety Weighted Routes...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4" />
                  <span>Find Safest Path</span>
                </>
              )}
            </button>
          </div>

          {/* ROUTE LIST OPTIONS */}
          {routes.length > 0 && (
            <div className="space-y-3">
              <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Available Route Options</span>
              <div className="space-y-2">
                {routes.map((r, index) => {
                  const isActive = activeRouteIndex === index;
                  // Color coding risk levels: safe < 30 (green), caution 30-65 (orange), unsafe > 65 (red)
                  const riskColor = r.average_risk > 65 
                    ? 'text-rose-400 border-rose-500/20 bg-rose-500/5' 
                    : r.average_risk > 30 
                      ? 'text-amber-400 border-amber-500/20 bg-amber-500/5' 
                      : 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
                      
                  return (
                    <button
                      key={index}
                      onClick={() => setActiveRouteIndex(index)}
                      className={`w-full text-left p-4 rounded-xl border transition flex flex-col gap-2 ${
                        isActive 
                          ? 'border-sky-500 bg-sky-500/5 ring-1 ring-sky-500/30' 
                          : 'border-slate-800 hover:border-slate-700 bg-slate-900/20'
                      }`}
                    >
                      <div className="flex justify-between items-start w-full">
                        <span className="text-sm font-semibold text-white">{r.name}</span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full border ${riskColor} font-bold flex items-center gap-1`}>
                          <Shield className="w-3 h-3" />
                          Risk: {r.average_risk.toFixed(0)}%
                        </span>
                      </div>
                      
                      <div className="flex gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Activity className="w-3.5 h-3.5" />
                          {r.distance_meters > 1000 ? `${(r.distance_meters/1000).toFixed(2)} km` : `${r.distance_meters.toFixed(0)} m`}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {r.duration_minutes.toFixed(0)} mins walk
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* REPORT SAFETY INCIDENT SECTION */}
          <div className="pt-4 border-t border-slate-800/80 space-y-4">
            <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Crowdsource Incident Registry</span>
            <p className="text-xs text-slate-400 leading-relaxed">
              Help make your community safer. Click the button below, then click any location on the map to log a safety observation.
            </p>
            <button
              onClick={() => {
                setMapClickMode(mapClickMode === 'report' ? 'none' : 'report');
                setSelectedCell(null); // Close explanation panel
              }}
              className={`w-full py-3.5 rounded-xl border font-semibold flex items-center justify-center gap-2 transition ${
                mapClickMode === 'report' 
                  ? 'border-amber-500/80 bg-amber-500/10 text-amber-300 ring-2 ring-amber-500/10'
                  : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-300 hover:text-white'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>{mapClickMode === 'report' ? "Click Map to Log Point..." : "Report Safety Incident"}</span>
            </button>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-slate-900/80 bg-slate-950/80 text-[10px] text-slate-500 leading-relaxed text-center">
          <p className="font-semibold text-slate-400 mb-1">Girls Hack Day Delhi 2026 — PS-12</p>
          <p>Disclaimer: Contains simulated safety databases (~400 logs) to demonstrate model risk scoring. Do not use for real-life path routing.</p>
        </div>
      </div>

      {/* MAP VIEWPORT */}
      <div className="flex-1 h-full relative">
        
        {/* Floating Map Controls */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          
          {/* Layer visibility buttons */}
          <div className="flex flex-col bg-slate-950/80 backdrop-blur border border-slate-800 rounded-xl p-1 shadow-2xl">
            <button 
              onClick={() => setShowGrid(!showGrid)}
              title={showGrid ? "Hide Risk Grid Overlay" : "Show Risk Grid Overlay"}
              className={`p-2 rounded-lg transition ${showGrid ? 'bg-sky-500/20 text-sky-400' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <Layers className="w-4.5 h-4.5" />
            </button>
            <button 
              onClick={() => setShowReportMarkers(!showReportMarkers)}
              title={showReportMarkers ? "Hide Incident Points" : "Show Incident Points"}
              className={`p-2 rounded-lg mt-1 transition ${showReportMarkers ? 'bg-sky-500/20 text-sky-400' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              {showReportMarkers ? <Eye className="w-4.5 h-4.5" /> : <EyeOff className="w-4.5 h-4.5" />}
            </button>
          </div>
          
          {/* Category Filter Controls */}
          {showReportMarkers && (
            <div className="bg-slate-950/80 backdrop-blur border border-slate-800 rounded-xl p-2 shadow-2xl max-w-44 flex flex-col gap-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider px-1">Filter Logs</span>
              <select 
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="bg-slate-900 text-xs text-slate-200 border border-slate-800 rounded px-1.5 py-1 focus:outline-none focus:border-sky-500"
              >
                <option value="all">All Incidents</option>
                <option value="harassment">Harassment</option>
                <option value="stalking">Stalking</option>
                <option value="poor lighting">Poor Lighting</option>
                <option value="unsafe infrastructure">Infrastructure</option>
                <option value="assault">Assault</option>
                <option value="other">Other</option>
              </select>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-10 bg-slate-950/80 backdrop-blur border border-slate-800/80 rounded-xl p-3.5 shadow-2xl flex flex-col gap-2">
          <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">Scored Risk Tiers</span>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500/70 border border-red-500 rounded-sm"></div>
              <span className="text-xs text-slate-300">High Risk Area</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-amber-500/50 border border-amber-500 rounded-sm"></div>
              <span className="text-xs text-slate-300">Medium Risk Area</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-emerald-500/10 border border-emerald-500 rounded-sm"></div>
              <span className="text-xs text-slate-300">Low Risk Area</span>
            </div>
          </div>
        </div>

        {/* Map Container */}
        <MapContainer 
          center={mapCenter} 
          zoom={mapZoom} 
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%' }}
        >
          <ChangeView center={mapCenter} zoom={mapZoom} />
          <MapClickEvents onMapClick={handleMapClick} />
          
          {/* Custom dark theme CartoDB basemap */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            maxZoom={20}
          />

          {/* Scored cells overlay */}
          {showGrid && gridData && (
            <GeoJSON 
              data={gridData} 
              style={getCellStyle}
              onEachFeature={onEachCell}
            />
          )}

          {/* Routing lines */}
          {routes.length > 0 && routes.map((r, index) => {
            const isActive = activeRouteIndex === index;
            // Draw matching routing path lines
            // Flip coordinates because Leaflet Polyline expects [lat, lng] while geojson is [lng, lat]
            const flippedCoords = r.coordinates.map(c => [c[1], c[0]]);
            
            // Path styling
            let color = '#3b82f6'; // shortest (blue)
            if (r.type === 'safest' || r.type === 'shortest_and_safest') color = '#10b981'; // safest (green)
            if (r.type === 'alternative') color = '#8b5cf6'; // alternative (purple)
            
            return (
              <React.Fragment key={index}>
                {/* Glowing underlay polyline */}
                {isActive && (
                  <Polyline
                    positions={flippedCoords}
                    pathOptions={{ color, weight: 10, opacity: 0.25, lineCap: 'round' }}
                  />
                )}
                {/* Main route polyline */}
                <Polyline
                  positions={flippedCoords}
                  pathOptions={{ 
                    color, 
                    weight: isActive ? 5.0 : 2.5, 
                    opacity: isActive ? 1.0 : 0.45,
                    dashArray: r.type === 'alternative' ? '8, 8' : undefined,
                    lineCap: 'round'
                  }}
                  eventHandlers={{
                    click: () => setActiveRouteIndex(index)
                  }}
                />
              </React.Fragment>
            );
          })}

          {/* Origin & Destination Markers */}
          {origin && (
            <Marker position={origin} icon={getIcon('origin')} />
          )}
          {destination && (
            <Marker position={destination} icon={getIcon('destination')} />
          )}

          {/* Crowdsourced incidents markers */}
          {showReportMarkers && filteredReports.map((report) => (
            <Marker 
              key={report.id}
              position={[report.latitude, report.longitude]}
              icon={getReportIcon(report.category_ml || report.category)}
            >
              <Popup className="bg-slate-900 border border-slate-800 text-slate-100 rounded-lg">
                <div className="p-1 space-y-1.5 max-w-64">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-sky-400">
                      {report.category_ml || report.category}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      Severity: {report.severity_ml || report.severity}/5
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-200 font-medium">{report.description}</p>
                  <div className="flex justify-between items-center text-[9px] text-slate-400 border-t border-slate-800 pt-1">
                    <span>{new Date(report.timestamp).toLocaleDateString()}</span>
                    {report.method && <span className="italic flex items-center gap-0.5"><Sparkles className="w-2 h-2 text-sky-400" /> {report.method.split(' ')[0]}</span>}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* RIGHT PANEL - EXPLAINABILITY PANEL */}
      {selectedCell && (
        <div className="w-96 border-l border-slate-800/80 flex flex-col h-full bg-slate-950/90 backdrop-blur z-10 shadow-2xl">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/20">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-sky-400 animate-pulse" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Cell Explainability Data</h2>
            </div>
            <button 
              onClick={() => setSelectedCell(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Metric Details */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Risk Tier Card */}
            <div className="p-4 bg-slate-900/40 border border-slate-800/60 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">RandomForest Prediction</span>
                <h3 className="text-lg font-bold text-white capitalize">{selectedCell.cell_info.risk_tier} Risk</h3>
              </div>
              <div className={`w-14 h-14 rounded-full flex items-center justify-center border font-extrabold text-sm ${
                selectedCell.cell_info.risk_tier === 'high' 
                  ? 'border-red-500/20 bg-red-500/10 text-red-400' 
                  : selectedCell.cell_info.risk_tier === 'medium' 
                    ? 'border-amber-500/20 bg-amber-500/10 text-amber-400' 
                    : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
              }`}>
                {(selectedCell.cell_info.risk_score * 100).toFixed(0)}%
              </div>
            </div>

            {/* Cell Features Table */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Scoring Metrics</span>
              <div className="bg-slate-900/20 border border-slate-800/80 rounded-xl divide-y divide-slate-900/60">
                <div className="flex justify-between p-3 text-xs">
                  <span className="text-slate-400">Total reports (150m)</span>
                  <span className="font-semibold text-slate-200">{selectedCell.cell_info.report_count}</span>
                </div>
                <div className="flex justify-between p-3 text-xs">
                  <span className="text-slate-400">Average NLP severity</span>
                  <span className="font-semibold text-slate-200">{selectedCell.cell_info.avg_severity}/5.0</span>
                </div>
                <div className="flex justify-between p-3 text-xs">
                  <span className="text-slate-400">Corroboration density</span>
                  <span className="font-semibold text-slate-200">{selectedCell.cell_info.corroboration_avg} reports</span>
                </div>
                <div className="flex justify-between p-3 text-xs">
                  <span className="text-slate-400">Most recent incident</span>
                  <span className="font-semibold text-slate-200">
                    {selectedCell.cell_info.most_recent_age_days === 999.0 
                      ? "N/A" 
                      : selectedCell.cell_info.most_recent_age_days < 1 
                        ? "Today" 
                        : `${selectedCell.cell_info.most_recent_age_days.toFixed(0)} days ago`}
                  </span>
                </div>
              </div>
            </div>

            {/* Category Distribution */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Category Breakdown</span>
              <div className="bg-slate-900/20 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5">
                {Object.keys(selectedCell.cell_info.category_breakdown).length === 0 ? (
                  <p className="text-xs text-slate-500 text-center italic py-2">No category data recorded.</p>
                ) : (
                  Object.entries(selectedCell.cell_info.category_breakdown).map(([cat, count]) => {
                    const pct = (count / selectedCell.cell_info.report_count) * 100;
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-slate-300 capitalize">{cat}</span>
                          <span className="text-slate-400">{count} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-1.5">
                          <div className="bg-sky-500 h-1.5 rounded-full" style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Nearby Incident Reports list */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Evidence Logs ({selectedCell.nearby_reports.length})</span>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {selectedCell.nearby_reports.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center italic py-4">No nearby reports found.</p>
                ) : (
                  selectedCell.nearby_reports.map((r, idx) => (
                    <div key={idx} className="p-3 bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/60 rounded-xl text-xs space-y-2 transition">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sky-400 capitalize bg-slate-850 px-2 py-0.5 border border-slate-700 rounded text-[9px]">
                          {r.category_ml || r.category}
                        </span>
                        <span className="text-slate-400 font-bold">Sev: {r.severity_ml || r.severity}/5</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed font-medium">{r.description}</p>
                      <div className="flex justify-between text-[10px] text-slate-500 border-t border-slate-850/50 pt-1.5">
                        <span>{new Date(r.timestamp).toLocaleDateString()}</span>
                        <span>{r.distance_meters.toFixed(0)}m away</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REPORT MODAL */}
      {showReportModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span>Submit Safety Observation</span>
              </h2>
              <button 
                onClick={() => { setShowReportModal(false); setReportCoords(null); }}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={submitReport} className="p-6 space-y-5">
              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">Observation Category</label>
                <select
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value)}
                  className="w-full bg-slate-950 text-slate-200 border border-slate-850 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                >
                  <option value="harassment">Harassment</option>
                  <option value="stalking">Stalking</option>
                  <option value="poor lighting">Poor Lighting</option>
                  <option value="unsafe infrastructure">Unsafe Infrastructure</option>
                  <option value="assault">Assault</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Coordinates display */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-950 p-3 rounded-xl border border-slate-850/60 text-slate-400">
                <div>
                  <span className="block text-[9px] uppercase font-bold text-slate-500">Latitude</span>
                  <span className="font-semibold text-slate-300">{reportCoords ? reportCoords[0].toFixed(6) : ''}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-bold text-slate-500">Longitude</span>
                  <span className="font-semibold text-slate-300">{reportCoords ? reportCoords[1].toFixed(6) : ''}</span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">Description (Free Text)</label>
                <textarea
                  required
                  rows="3"
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Describe what occurred, any identifiers, lighting status, or local infrastructure details. Your text will be analyzed via Gemini NLP model..."
                  className="w-full bg-slate-950 text-slate-200 border border-slate-850 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                ></textarea>
              </div>

              {/* Severity Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-400 uppercase">
                  <span>Your Severity Rating</span>
                  <span className="text-sky-400 font-bold">{reportSeverity}/5</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={reportSeverity}
                  onChange={(e) => setReportSeverity(parseInt(e.target.value))}
                  className="w-full accent-sky-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>1 (Minor lighting issue)</span>
                  <span>5 (Severe physical threat)</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => { setShowReportModal(false); setReportCoords(null); }}
                  className="px-5 py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReport || !reportDescription}
                  className="px-6 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold disabled:opacity-40 transition flex items-center gap-1.5"
                >
                  {submittingReport ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Classifying & Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Submit Observation</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
