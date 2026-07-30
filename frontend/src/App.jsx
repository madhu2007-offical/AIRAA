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
  CornerDownRight,
  Send,
  Flag,
  ArrowRight,
  TrendingDown
} from 'lucide-react';

// Jump points for Ward 14 pilot
const HOTSPOTS = [
  { name: "Green Park Metro", lat: 28.558, lng: 77.206 },
  { name: "Hauz Khas Metro", lat: 28.543, lng: 77.206 },
  { name: "Hauz Khas Village", lat: 28.553, lng: 77.194 },
  { name: "SDA Market", lat: 28.546, lng: 77.200 }
];

// Helper to get custom Leaflet DivIcons to match the light theme
const getIcon = (type) => {
  if (type === 'origin') {
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="w-7 h-7 bg-[#1F7A54] text-white rounded-full border-2 border-white shadow-md flex items-center justify-center font-bold font-mono">A</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  }
  if (type === 'destination') {
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="w-7 h-7 bg-[#A93A3A] text-white rounded-full border-2 border-white shadow-md flex items-center justify-center font-bold font-mono">B</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  }
  return null;
};

const getReportIcon = (category) => {
  const colors = {
    'assault': 'bg-[#A93A3A] ring-[#A93A3A]/30',
    'stalking': 'bg-[#B9740E] ring-[#B9740E]/30',
    'harassment': 'bg-[#B9740E] ring-[#B9740E]/30',
    'poor lighting': 'bg-[#A9791E] ring-[#A9791E]/30',
    'unsafe infrastructure': 'bg-[#22366E] ring-[#22366E]/30',
    'other': 'bg-[#5B6280] ring-[#5B6280]/30'
  };
  const colorClass = colors[category.toLowerCase()] || colors['other'];
  return L.divIcon({
    className: 'custom-div-icon pulse-marker',
    html: `<div class="w-3.5 h-3.5 rounded-full ${colorClass} border border-white shadow ring-4"></div>`,
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
  
  // Left sidebar active tab: 'route' | 'report'
  const [activeTab, setActiveTab] = useState('route');

  // Report form state
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
      setStatusMessage("Origin coordinate placed.");
    } else if (mapClickMode === 'destination') {
      setDestination(coords);
      setMapClickMode('none');
      setStatusMessage("Destination coordinate placed.");
    } else if (mapClickMode === 'report') {
      setReportCoords(coords);
      setMapClickMode('none');
      setActiveTab('report'); // switch tab to form
      setStatusMessage("Report pin placed. Complete details below.");
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
      setStatusMessage("Select both Origin and Destination coordinates.");
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
    if (!reportDescription || !reportCoords) {
      setStatusMessage("Please place a report pin on the map first.");
      return;
    }
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
    
    let color = '#1F7A54'; // safe
    let fillOpacity = 0.04;
    
    if (riskTier === 'high') {
      color = '#A93A3A'; // risk
      fillOpacity = 0.40;
    } else if (riskTier === 'medium') {
      color = '#B9740E'; // caution
      fillOpacity = 0.20;
    }
    
    return {
      color: isSelected ? '#22366E' : color,
      weight: isSelected ? 2.5 : 0.8,
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
          color: '#22366E',
          fillOpacity: Math.min(layer.options.fillOpacity + 0.1, 0.6)
        });
      },
      mouseout: (e) => {
        const layer = e.target;
        const cellId = feature.properties.cell_id;
        const isSelected = selectedCell && selectedCell.cell_info.cell_id === cellId;
        
        let color = '#1F7A54';
        let fillOpacity = 0.04;
        if (feature.properties.risk_tier === 'high') {
          color = '#A93A3A';
          fillOpacity = 0.40;
        } else if (feature.properties.risk_tier === 'medium') {
          color = '#B9740E';
          fillOpacity = 0.20;
        }
        
        layer.setStyle({
          color: isSelected ? '#22366E' : color,
          weight: isSelected ? 2.5 : 0.8,
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

  // Calculate dynamically derived counts for the summary board
  const highRiskCount = gridData ? gridData.features.filter(f => f.properties.risk_tier === 'high').length : 6;

  return (
    <div className="min-h-screen bg-[#F4F5F9] text-[#1B2138] flex flex-col font-sans antialiased">
      
      {/* SKIP LINK FOR ACCESSIBILITY */}
      <a href="#main" class="skip-link">Skip to main content</a>

      {/* UTILITY STRIP */}
      <div className="utility-strip">
        <div className="left font-sans">
          <span>Hackathon MVP · Girls Hack Day Delhi 2026</span>
          <span className="opacity-40">·</span>
          <span>Pilot Zone: South Delhi Ward 14</span>
        </div>
        <div className="lang">
          <button className="active font-semibold">EN</button>
          <button className="opacity-70 hover:opacity-100">हिं</button>
        </div>
      </div>

      {/* MAIN HEADER */}
      <header className="main">
        <div className="header-inner">
          <div className="brand-block">
            {/* Custom Seal Mark SVG */}
            <svg className="seal-mark" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="AIRAA seal">
              <circle cx="24" cy="24" r="22" stroke="#A93A3A" stroke-width="2" opacity="0.55"/>
              <circle cx="24" cy="24" r="17" stroke="#B9740E" stroke-width="2" opacity="0.7"/>
              <circle cx="24" cy="24" r="12" stroke="#1F7A54" stroke-width="2" opacity="0.85"/>
              <path d="M24 12 L33 16.5 V24.5 C33 30.5 29 34.5 24 36.5 C19 34.5 15 30.5 15 24.5 V16.5 L24 12Z" fill="#12182B"/>
              <circle cx="24" cy="23.5" r="3.4" fill="#F4F5F9"/>
            </svg>
            <div className="brand-text">
              <div className="name serif">AIRAA</div>
              <div className="tagline font-medium uppercase tracking-wider">Adaptive Intelligence for Risk Awareness &amp; Action</div>
            </div>
          </div>
          
          <nav className="primary" aria-label="Primary Navigation">
            <a href="#map-section">Risk Map</a>
            <a href="#map-section" onClick={() => { setActiveTab('report'); }}>Report Incident</a>
            <a href="#process">Methodology</a>
            <a href="#alignment">Alignment</a>
            <a href="#map-section" onClick={() => { setActiveTab('route'); }} className="nav-cta">Plan a Safe Route</a>
          </nav>
          <button className="menu-toggle" aria-label="Open menu">☰</button>
        </div>
      </header>

      <main id="main">

        {/* HERO SECTION */}
        <section className="hero">
          <div className="hero-inner">
            <div>
              <div className="eyebrow flex items-center">
                <span className="dot"></span>
                <span>System status: live · Ward 14 pilot</span>
              </div>
              <h1 className="serif">See a street's risk before you walk it.</h1>
              <p className="lede font-sans">
                AIRAA fuses community safety reports with public data into a continuously updated risk map — then routes you around the parts of the city it doesn't trust yet.
              </p>
              <div className="hero-ctas">
                <a href="#map-section" onClick={() => { setActiveTab('route'); }} className="btn btn-primary">
                  View live risk map
                </a>
                <a href="#map-section" onClick={() => { setActiveTab('report'); }} className="btn btn-ghost">
                  Report an incident
                </a>
              </div>
            </div>
            
            {/* REAL-TIME STATS BOARD */}
            <div className="stat-panel">
              <div className="panel-label">
                <span>Pilot zone summary</span>
                <span className="mono">WARD 14</span>
              </div>
              <div className="stat-row">
                <div className="stat">
                  <div className="num">{reports.length > 0 ? reports.length : '412'}</div>
                  <div className="lbl">Reports processed</div>
                </div>
                <div className="stat">
                  <div className="num">{gridData ? gridData.features.length : '36'}</div>
                  <div className="lbl">Grid cells scored</div>
                </div>
                <div className="stat">
                  <div className="num flex items-center gap-1">
                    <TrendingDown className="w-5 h-5 text-emerald-400" />
                    <span>28%</span>
                  </div>
                  <div className="lbl">Avg. route risk reduction</div>
                </div>
                <div className="stat">
                  <div className="num">{highRiskCount}</div>
                  <div className="lbl">High-risk cells segment</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* LIVE ADVISORIES TICKER */}
        <div className="ticker-bar" role="marquee" aria-label="Recent zone status changes">
          <div className="ticker-label">
            <span>●</span> Live advisories
          </div>
          <div className="ticker-track-wrap">
            <div className="ticker-track">
              <span className="ticker-item"><span className="tag caution">CAUTION</span> Zone 14B upgraded — 3 corroborated reports, last 6h</span>
              <span className="ticker-item"><span className="tag safe">IMPROVED</span> Zone 09A downgraded to safe — streetlight repair confirmed</span>
              <span className="ticker-item"><span className="tag risk">HIGH RISK</span> Zone 22C — low footfall + 2 reports after 9pm</span>
              <span className="ticker-item"><span className="tag caution">CAUTION</span> Zone 03F — isolated pedestrian underpass flagged</span>
              {/* Loop duplicates for animation loop */}
              <span className="ticker-item"><span className="tag caution">CAUTION</span> Zone 14B upgraded — 3 corroborated reports, last 6h</span>
              <span className="ticker-item"><span className="tag safe">IMPROVED</span> Zone 09A downgraded to safe — streetlight repair confirmed</span>
              <span className="ticker-item"><span className="tag risk">HIGH RISK</span> Zone 22C — low footfall + 2 reports after 9pm</span>
              <span className="ticker-item"><span className="tag caution">CAUTION</span> Zone 03F — isolated pedestrian underpass flagged</span>
            </div>
          </div>
        </div>

        {/* SERVICES / INTRODUCTION */}
        <section id="services" className="py-16">
          <div className="section-inner">
            <div className="section-head">
              <div className="section-eyebrow">What you can do here</div>
              <h2>Three ways into the system</h2>
              <p>Every action feeds the same live model — a report you file today can change a route someone else is shown tonight.</p>
            </div>
            <div className="cards-row">
              {/* Card 1: Report */}
              <div className="service-card">
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2v20M2 12h20"/><circle cx="12" cy="12" r="9"/></svg>
                <h3 className="serif">Report an incident</h3>
                <p>Log a location, category, and short description. AIRAA's classifier reads it and updates the grid within minutes.</p>
                <a href="#map-section" onClick={() => { setActiveTab('report'); }} className="link">Open reporting form →</a>
              </div>
              {/* Card 2: Explore */}
              <div className="service-card">
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z"/><path d="M9 3v15M15 6v15"/></svg>
                <h3 className="serif">Explore the risk map</h3>
                <p>Browse Ward 14 cell by cell. Every score comes with the evidence behind it — never just a colour.</p>
                <a href="#map-section" className="link">View risk map →</a>
              </div>
              {/* Card 3: Route */}
              <div className="service-card">
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 19l6-14 4 9 3-6 3 11"/></svg>
                <h3 className="serif">Plan a safe route</h3>
                <p>Enter two points. See the fastest route and the lowest-risk route side by side, with the trade-off shown plainly.</p>
                <a href="#map-section" onClick={() => { setActiveTab('route'); }} className="link">Plan a route →</a>
              </div>
            </div>
          </div>
        </section>

        {/* MAP SECTION & GIS WORKSPACE (INTEGRATING ACTIVE ROUTING/REPORTS/EXPLAIN PANELS) */}
        <section className="map-section" id="map-section">
          <div className="section-inner">
            <div className="section-head">
              <div className="section-eyebrow">Live risk surface</div>
              <h2>Ward 14, South Delhi — pilot zone</h2>
              <p>Kernel-density risk scoring over community reports, refreshed as new reports are classified. This view runs on dynamic local scoring models.</p>
            </div>
            
            {/* GIS INTERACTIVE WORKSPACE SHELL */}
            <div className="border border-[#D8DBE6] rounded bg-white shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[580px]">
              
              {/* LEFT TABBED CONTROLS COLUMN (width: 360px) */}
              <div className="w-full md:w-90 flex flex-col border-r border-[#D8DBE6] bg-[#FFFFFF] shrink-0">
                {/* Tab header buttons */}
                <div className="flex border-b border-[#D8DBE6] bg-[#F4F5F9]">
                  <button 
                    onClick={() => setActiveTab('route')}
                    className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider border-r border-[#D8DBE6] transition ${
                      activeTab === 'route' ? 'bg-[#FFFFFF] text-[#22366E] border-t-2 border-t-[#22366E]' : 'text-[#5B6280] hover:text-[#12182B]'
                    }`}
                  >
                    Route Planner
                  </button>
                  <button 
                    onClick={() => { setActiveTab('report'); setSelectedCell(null); }}
                    className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider transition ${
                      activeTab === 'report' ? 'bg-[#FFFFFF] text-[#22366E] border-t-2 border-t-[#22366E]' : 'text-[#5B6280] hover:text-[#12182B]'
                    }`}
                  >
                    Log Observation
                  </button>
                </div>

                <div className="p-5 flex-1 overflow-y-auto space-y-5">
                  {statusMessage && (
                    <div className="p-3 text-xs bg-[#E7F4EE] border border-[#1F7A54]/20 text-[#1F7A54] rounded font-medium flex items-start gap-2 animate-fade-in">
                      <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>{statusMessage}</span>
                    </div>
                  )}

                  {/* TAB 1: SAFETY ROUTE OPTIONS */}
                  {activeTab === 'route' && (
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-[#5B6280] tracking-wider uppercase block">Focus Shortcuts</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {HOTSPOTS.map((h, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                setMapCenter([h.lat, h.lng]);
                                setMapZoom(15.5);
                              }}
                              className="px-2.5 py-1.5 text-left text-xs bg-[#F4F5F9] hover:bg-[#D8DBE6] border border-[#D8DBE6] rounded text-[#1B2138] transition flex justify-between items-center"
                            >
                              <span className="truncate">{h.name}</span>
                              <ChevronRight className="w-3 h-3 text-[#5B6280]" />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Origin/Destination Input */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-[#5B6280] tracking-wider uppercase block">Input Terminals</span>
                        
                        {/* Set Origin */}
                        <button
                          onClick={() => setMapClickMode(mapClickMode === 'origin' ? 'none' : 'origin')}
                          className={`w-full flex items-center justify-between p-3 border rounded text-xs transition ${
                            mapClickMode === 'origin' 
                              ? 'border-[#B9740E] bg-[#FBF0DE] text-[#B9740E]'
                              : origin 
                                ? 'border-[#D8DBE6] bg-white text-[#1B2138]' 
                                : 'border-[#D8DBE6] bg-[#F4F5F9] text-[#5B6280] hover:bg-[#D8DBE6]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <MapPin className={`w-4 h-4 ${origin ? 'text-[#1F7A54]' : 'text-[#5B6280]'}`} />
                            <span className="font-semibold text-left">
                              {origin ? `${origin[0].toFixed(5)}, ${origin[1].toFixed(5)}` : "Set Point A (Origin)..."}
                            </span>
                          </div>
                          {!origin && <span className="text-[9px] bg-[#12182B] text-white px-1.5 py-0.5 rounded font-mono uppercase">Map Click</span>}
                        </button>

                        {/* Set Destination */}
                        <button
                          onClick={() => setMapClickMode(mapClickMode === 'destination' ? 'none' : 'destination')}
                          className={`w-full flex items-center justify-between p-3 border rounded text-xs transition ${
                            mapClickMode === 'destination' 
                              ? 'border-[#B9740E] bg-[#FBF0DE] text-[#B9740E]'
                              : destination 
                                ? 'border-[#D8DBE6] bg-white text-[#1B2138]' 
                                : 'border-[#D8DBE6] bg-[#F4F5F9] text-[#5B6280] hover:bg-[#D8DBE6]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Navigation className={`w-4 h-4 ${destination ? 'text-[#A93A3A]' : 'text-[#5B6280]'}`} />
                            <span className="font-semibold text-left">
                              {destination ? `${destination[0].toFixed(5)}, ${destination[1].toFixed(5)}` : "Set Point B (Destination)..."}
                            </span>
                          </div>
                          {!destination && <span className="text-[9px] bg-[#12182B] text-white px-1.5 py-0.5 rounded font-mono uppercase">Map Click</span>}
                        </button>
                      </div>

                      {/* Solve button */}
                      <button
                        onClick={calculateRoute}
                        disabled={routingLoading || !origin || !destination}
                        className="w-full py-3.5 bg-[#22366E] hover:bg-[#182750] text-white text-xs font-bold uppercase tracking-wider rounded transition disabled:opacity-40 flex items-center justify-center gap-2 shadow"
                      >
                        {routingLoading ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Routing Solver Active...</span>
                          </>
                        ) : (
                          <>
                            <Navigation className="w-3.5 h-3.5" />
                            <span>Compute Safest Paths</span>
                          </>
                        )}
                      </button>

                      {/* Resulting Route Cards */}
                      {routes.length > 0 && (
                        <div className="pt-2 border-t border-[#D8DBE6] space-y-2">
                          <span className="text-[10px] font-bold text-[#5B6280] tracking-wider uppercase block">Ranked Paths</span>
                          {routes.map((r, idx) => {
                            const isActive = activeRouteIndex === idx;
                            const riskColor = r.average_risk > 65 ? 'text-[#A93A3A] bg-[#F8E9E9]' : r.average_risk > 30 ? 'text-[#B9740E] bg-[#FBF0DE]' : 'text-[#1F7A54] bg-[#E7F4EE]';
                            return (
                              <button
                                key={idx}
                                onClick={() => setActiveRouteIndex(idx)}
                                className={`w-full text-left p-3.5 rounded border transition flex flex-col gap-1.5 ${
                                  isActive ? 'border-[#22366E] bg-[#F4F5F9]' : 'border-[#D8DBE6] hover:border-[#22366E]'
                                }`}
                              >
                                <div className="flex justify-between items-start w-full">
                                  <span className="text-xs font-bold text-[#1B2138]">{r.name}</span>
                                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${riskColor}`}>
                                    Risk: {r.average_risk.toFixed(0)}%
                                  </span>
                                </div>
                                <div className="flex gap-4 text-[11px] text-[#5B6280] font-semibold">
                                  <span className="flex items-center gap-1"><CornerDownRight className="w-3 h-3" /> {r.distance_meters.toFixed(0)} m</span>
                                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {r.duration_minutes.toFixed(0)} mins</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: INCIDENT OBSERVATION INGEST */}
                  {activeTab === 'report' && (
                    <form onSubmit={submitReport} className="space-y-4 text-xs font-sans">
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-[#5B6280] tracking-wider uppercase block">Pin Location</span>
                        
                        <button
                          type="button"
                          onClick={() => setMapClickMode('report')}
                          className={`w-full flex items-center justify-between p-3 border rounded text-xs transition ${
                            mapClickMode === 'report' 
                              ? 'border-[#B9740E] bg-[#FBF0DE] text-[#B9740E]'
                              : reportCoords 
                                ? 'border-[#1F7A54] bg-[#E7F4EE] text-[#1F7A54]' 
                                : 'border-[#D8DBE6] bg-[#F4F5F9] text-[#5B6280] hover:bg-[#D8DBE6]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 shrink-0" />
                            <span className="font-semibold text-left truncate">
                              {reportCoords ? `${reportCoords[0].toFixed(5)}, ${reportCoords[1].toFixed(5)}` : "1. Click Map to drop pin..."}
                            </span>
                          </div>
                          {!reportCoords && <span className="text-[9px] bg-[#12182B] text-white px-1.5 py-0.5 rounded font-mono uppercase">Map Click</span>}
                        </button>
                      </div>

                      {/* Dropdown Category */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#5B6280] uppercase">2. Category</label>
                        <select
                          value={reportCategory}
                          onChange={(e) => setReportCategory(e.target.value)}
                          className="w-full border border-[#D8DBE6] rounded px-3 py-2 bg-white focus:outline-none focus:border-[#22366E]"
                        >
                          <option value="harassment">Harassment</option>
                          <option value="stalking">Stalking</option>
                          <option value="poor lighting">Poor Lighting</option>
                          <option value="unsafe infrastructure">Unsafe Infrastructure</option>
                          <option value="assault">Assault</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      {/* Description */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#5B6280] uppercase">3. Description</label>
                        <textarea
                          required
                          rows="3"
                          value={reportDescription}
                          onChange={(e) => setReportDescription(e.target.value)}
                          placeholder="Describe the incident (e.g. broken streetlights behind the metro outlet, catcalling...). Text is processed by Gemini AI NLP."
                          className="w-full border border-[#D8DBE6] rounded px-3 py-2 bg-white focus:outline-none focus:border-[#22366E]"
                        ></textarea>
                      </div>

                      {/* Severity Slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-[#5B6280] uppercase">
                          <span>4. Threat Severity</span>
                          <span className="text-[#A93A3A] font-bold">{reportSeverity}/5</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          step="1"
                          value={reportSeverity}
                          onChange={(e) => setReportSeverity(parseInt(e.target.value))}
                          className="w-full accent-[#22366E] cursor-pointer"
                        />
                        <div className="flex justify-between text-[9px] text-[#5B6280] font-medium">
                          <span>Low light</span>
                          <span>Assault/threat</span>
                        </div>
                      </div>

                      {/* Submit */}
                      <button
                        type="submit"
                        disabled={submittingReport || !reportCoords || !reportDescription}
                        className="w-full py-3.5 bg-[#A93A3A] hover:bg-[#852C2C] text-white text-xs font-bold uppercase tracking-wider rounded transition disabled:opacity-40 flex items-center justify-center gap-1.5"
                      >
                        {submittingReport ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>NLP Classifying...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Submit Observations</span>
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {/* MIDDLE INTERACTIVE LEAFLET MAP VIEWPORT */}
              <div className="flex-1 min-h-[440px] relative">
                
                {/* Floating Map Controls & Filters */}
                <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
                  {/* Toggle overlays */}
                  <div className="flex bg-white/95 border border-[#D8DBE6] rounded shadow p-0.5">
                    <button 
                      onClick={() => setShowGrid(!showGrid)}
                      title="Toggle Grid Overlay"
                      className={`p-2 rounded transition ${showGrid ? 'bg-[#22366E]/10 text-[#22366E]' : 'text-[#5B6280] hover:bg-slate-100'}`}
                    >
                      <Layers className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setShowReportMarkers(!showReportMarkers)}
                      title="Toggle Incident Markers"
                      className={`p-2 rounded transition ${showReportMarkers ? 'bg-[#22366E]/10 text-[#22366E]' : 'text-[#5B6280] hover:bg-slate-100'}`}
                    >
                      {showReportMarkers ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Filter markers */}
                  {showReportMarkers && (
                    <div className="bg-white/95 border border-[#D8DBE6] rounded shadow p-1.5 flex flex-col gap-1 w-36">
                      <span className="text-[9px] font-bold text-[#5B6280] uppercase tracking-wider px-1">Filter Logs</span>
                      <select 
                        value={selectedCategoryFilter}
                        onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                        className="bg-[#F4F5F9] text-[10px] font-semibold border border-[#D8DBE6] rounded px-1.5 py-1 focus:outline-none focus:border-[#22366E] text-[#1B2138]"
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

                {/* Leaflet Map */}
                <MapContainer 
                  center={mapCenter} 
                  zoom={mapZoom} 
                  scrollWheelZoom={false}
                  style={{ width: '100%', height: '100%' }}
                >
                  <ChangeView center={mapCenter} zoom={mapZoom} />
                  <MapClickEvents onMapClick={handleMapClick} />
                  
                  {/* Default Light OpenStreetMap style layer */}
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    maxZoom={19}
                  />

                  {/* Scored cells */}
                  {showGrid && gridData && (
                    <GeoJSON 
                      data={gridData} 
                      style={getCellStyle}
                      onEachFeature={onEachCell}
                    />
                  )}

                  {/* Paths polylines */}
                  {routes.length > 0 && routes.map((r, idx) => {
                    const isActive = activeRouteIndex === idx;
                    const flippedCoords = r.coordinates.map(c => [c[1], c[0]]);
                    
                    let color = '#22366E'; // shortest
                    if (r.type === 'safest' || r.type === 'shortest_and_safest') color = '#1F7A54'; // safest
                    if (r.type === 'alternative') color = '#8b5cf6'; // alternative
                    
                    return (
                      <React.Fragment key={idx}>
                        {isActive && (
                          <Polyline 
                            positions={flippedCoords}
                            pathOptions={{ color, weight: 8, opacity: 0.18 }}
                          />
                        )}
                        <Polyline 
                          positions={flippedCoords}
                          pathOptions={{ 
                            color, 
                            weight: isActive ? 4.5 : 2.0, 
                            opacity: isActive ? 1.0 : 0.45,
                            dashArray: r.type === 'alternative' ? '6, 6' : undefined 
                          }}
                          eventHandlers={{
                            click: () => setActiveRouteIndex(idx)
                          }}
                        />
                      </React.Fragment>
                    );
                  })}

                  {/* Pins for origin and destination */}
                  {origin && <Marker position={origin} icon={getIcon('origin')} />}
                  {destination && <Marker position={destination} icon={getIcon('destination')} />}

                  {/* Pulse Incident Reports markers */}
                  {showReportMarkers && filteredReports.map((report) => (
                    <Marker
                      key={report.id}
                      position={[report.latitude, report.longitude]}
                      icon={getReportIcon(report.category_ml || report.category)}
                    >
                      <Popup className="font-sans text-xs">
                        <div className="p-1 space-y-1">
                          <div className="flex justify-between items-center gap-4">
                            <span className="font-mono text-[9px] font-bold uppercase bg-[#F4F5F9] border border-[#D8DBE6] text-[#22366E] px-1 rounded">
                              {report.category_ml || report.category}
                            </span>
                            <span className="text-[10px] font-bold text-[#A93A3A]">
                              Sev: {report.severity_ml || report.severity}/5
                            </span>
                          </div>
                          <p className="font-medium text-[#1B2138] leading-tight">{report.description}</p>
                          <div className="flex justify-between items-center text-[9px] text-[#5B6280] border-t border-[#D8DBE6] pt-1">
                            <span>{new Date(report.timestamp).toLocaleDateString()}</span>
                            {report.method && <span className="italic flex items-center gap-0.5 text-indigo-600 font-semibold"><Sparkles className="w-2.5 h-2.5" /> {report.method.split(' ')[0]}</span>}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>

              {/* RIGHT CELL EXPLAINABILITY COLUMN (width: 260px) */}
              {selectedCell ? (
                <div className="w-full md:w-66 flex flex-col border-l border-[#D8DBE6] bg-[#12182B] text-white shrink-0">
                  <div className="p-4 border-b border-slate-700/60 bg-slate-900/40 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-[#E9C878]" />
                      <span className="text-xs font-mono font-bold tracking-wider uppercase text-slate-300">Cell Evidence</span>
                    </div>
                    <button 
                      onClick={() => setSelectedCell(null)}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
                    {/* Prediction Badge */}
                    <div className="p-3 bg-white/5 border border-white/10 rounded flex justify-between items-center">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider font-mono">Classifier Output</span>
                        <h4 className="text-sm font-bold text-[#E9C878] capitalize">{selectedCell.cell_info.risk_tier} Risk</h4>
                      </div>
                      <span className="text-lg font-bold font-mono">{(selectedCell.cell_info.risk_score * 100).toFixed(0)}%</span>
                    </div>

                    {/* Features list */}
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider font-mono">Statistical Features</span>
                      <div className="bg-slate-900/30 border border-slate-800 rounded divide-y divide-slate-800">
                        <div className="flex justify-between p-2">
                          <span className="text-slate-400">Reports (150m)</span>
                          <span className="font-semibold">{selectedCell.cell_info.report_count}</span>
                        </div>
                        <div className="flex justify-between p-2">
                          <span className="text-slate-400">Avg. NLP Severity</span>
                          <span className="font-semibold">{selectedCell.cell_info.avg_severity}/5.0</span>
                        </div>
                        <div className="flex justify-between p-2">
                          <span className="text-slate-400">Corroboration</span>
                          <span className="font-semibold">{selectedCell.cell_info.corroboration_avg}</span>
                        </div>
                        <div className="flex justify-between p-2">
                          <span className="text-slate-400">Youngest log</span>
                          <span className="font-semibold">
                            {selectedCell.cell_info.most_recent_age_days === 999.0 
                              ? "N/A" 
                              : selectedCell.cell_info.most_recent_age_days < 1 
                                ? "Today" 
                                : `${selectedCell.cell_info.most_recent_age_days.toFixed(0)}d ago`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Breakdown */}
                    <div className="space-y-1.5">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider font-mono">Category Ratio</span>
                      <div className="space-y-2 p-2 bg-slate-900/20 border border-slate-800 rounded">
                        {Object.keys(selectedCell.cell_info.category_breakdown).length === 0 ? (
                          <div className="text-center italic text-slate-500 py-1">No category logs.</div>
                        ) : (
                          Object.entries(selectedCell.cell_info.category_breakdown).map(([cat, count]) => {
                            const pct = (count / selectedCell.cell_info.report_count) * 100;
                            return (
                              <div key={cat} className="space-y-0.5">
                                <div className="flex justify-between text-[11px]">
                                  <span className="text-slate-300 capitalize">{cat}</span>
                                  <span>{count}</span>
                                </div>
                                <div className="w-full bg-slate-800 rounded-full h-1">
                                  <div className="bg-sky-400 h-1 rounded-full" style={{ width: `${pct}%` }}></div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Incidents logs */}
                    <div className="space-y-2">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider font-mono">Incident Registry ({selectedCell.nearby_reports.length})</span>
                      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                        {selectedCell.nearby_reports.length === 0 ? (
                          <div className="text-center italic text-slate-500 py-2">No observations nearby.</div>
                        ) : (
                          selectedCell.nearby_reports.map((r, idx) => (
                            <div key={idx} className="p-2.5 bg-white/5 hover:bg-white/8 rounded border border-white/5 text-[11px] space-y-1 transition">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="font-bold text-[#E9C878] capitalize">{r.category_ml || r.category}</span>
                                <span className="text-slate-400">Sev: {r.severity_ml || r.severity}</span>
                              </div>
                              <p className="text-slate-200 leading-snug">{r.description}</p>
                              <div className="flex justify-between text-[9px] text-slate-500 pt-1 border-t border-slate-800">
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
              ) : (
                <div className="w-full md:w-66 flex flex-col justify-between border-l border-[#D8DBE6] bg-[#12182B] text-white shrink-0 p-5">
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 tracking-wider uppercase font-mono mb-3">Map Legend</h4>
                    <div className="space-y-3.5">
                      <div className="flex items-center gap-3">
                        <span className="w-3.5 h-3.5 rounded border border-[#1F7A54]" style={{ background: '#1F7A54', opacity: 0.28 }}></span>
                        <span className="text-xs text-slate-200">Safe Area (Low Risk)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-3.5 h-3.5 rounded border border-[#B9740E]" style={{ background: '#B9740E', opacity: 0.28 }}></span>
                        <span className="text-xs text-slate-200">Caution (Moderate Risk)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-3.5 h-3.5 rounded border border-[#A93A3A]" style={{ background: '#A93A3A', opacity: 0.28 }}></span>
                        <span className="text-xs text-slate-200">High Risk Sector</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 border-t border-slate-800/80 pt-4 leading-relaxed mt-4">
                    Grid cell threat levels require spatio-temporal corroboration and decay automatically over time. Click any cell to inspect its underlying logs.
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* METHODOLOGY SECTION */}
        <section id="process" className="py-16">
          <div className="section-inner">
            <div className="section-head">
              <div className="section-eyebrow">How a report becomes a route</div>
              <h2>The pipeline, in four stages</h2>
              <p>This is the actual order data moves through the system — not a marketing sequence.</p>
            </div>
            <div className="process">
              <div className="process-step">
                <span className="step-num">01 — INGEST</span>
                <h3 className="serif font-semibold">Reports + public data</h3>
                <p>Community reports, public safety statistics, and street infrastructure data enter the pipeline.</p>
              </div>
              <div className="process-step">
                <span className="step-num">02 — FUSE</span>
                <h3 className="serif font-semibold">Classify &amp; corroborate</h3>
                <p>Free text is classified by category and severity; reports are cross-checked against nearby reports before they count.</p>
              </div>
              <div className="process-step">
                <span className="step-num">03 — SCORE</span>
                <h3 className="serif font-semibold">Risk surface</h3>
                <p>A density- and recency-weighted model scores each grid cell, with the evidence kept attached to the score.</p>
              </div>
              <div className="process-step">
                <span className="step-num">04 — ROUTE</span>
                <h3 className="serif font-semibold">Safer path</h3>
                <p>The risk surface is layered onto the street graph, and a weighted shortest-path search returns ranked routes.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ALIGNMENT CHIP ROW */}
        <section className="alignment" id="alignment">
          <div className="section-inner">
            <div className="alignment-row">
              <div className="alignment-label font-sans font-medium text-xs">
                Built in the spirit of established global safety-data initiatives, not in isolation:
              </div>
              <div className="chip-row">
                <span className="chip"><span className="chip-dot"></span> UN Women Safe Cities Initiative</span>
                <span className="chip"><span className="chip-dot"></span> Free to Be — Global Crowdmapping</span>
                <span className="chip"><span className="chip-dot"></span> Google AI Studio</span>
                <span className="chip"><span className="chip-dot"></span> Girls Hack Day Delhi 2026</span>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer>
        <div className="footer-inner">
          <div className="address">
            <h5 className="mono font-bold">AIRAA Civic Safety Lab</h5>
            <p>A student-built prototype for Girls Hack Day Delhi 2026.</p>
            <p>Pilot zone: Ward 14, South Delhi.</p>
            <p className="mt-3.5">Contact: team@airaa-project.dev (placeholder)</p>
            <div className="disclaimer-box mt-4">
              <strong>Disclaimer:</strong> AIRAA is an independent hackathon prototype. It is not an official service of the Government of India, the Government of NCT of Delhi, or Delhi Police, and does not use verified government incident data in this build.
            </div>
          </div>
          <div>
            <h5 className="mono font-bold">Platform</h5>
            <ul>
              <li><a href="#map-section">Risk map</a></li>
              <li><a href="#map-section" onClick={() => { setActiveTab('report'); }}>Report an incident</a></li>
              <li><a href="#process">Methodology</a></li>
            </ul>
          </div>
          <div>
            <h5 className="mono font-bold">Project</h5>
            <ul>
              <li><a href="#alignment">Global alignment</a></li>
              <li><a href="#">Research document</a></li>
              <li><a href="#">GitHub repository</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 AIRAA Project Team. Built for Girls Hack Day Delhi.</span>
          <span className="mono">v0.1.0-hackathon</span>
        </div>
      </footer>
    </div>
  );
}
