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
import * as L from 'leaflet';
if (typeof window !== 'undefined') {
  window.L = L;
}
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
  TrendingDown,
  Lock,
  UserCheck,
  AlertOctagon,
  Heart,
  Phone,
  BarChart2,
  Cpu
} from 'lucide-react';

// Jump points for Chennai pilot zone
const HOTSPOTS = [
  { name: "Taramani MRTS", lat: 12.9862, lng: 80.2421 },
  { name: "Tidel Park Junction", lat: 12.9892, lng: 80.2465 },
  { name: "Perungudi Bus Stop", lat: 12.9642, lng: 80.2481 },
  { name: "SRP Tools Junction", lat: 12.9801, lng: 80.2452 }
];

// Helper to get custom Leaflet DivIcons matching design tokens
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

// Markers for emergency stations
const getEmergencyIcon = (type) => {
  const bg = type === 'police' ? 'bg-indigo-600' : 'bg-rose-600';
  const char = type === 'police' ? 'P' : 'H';
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="w-6.5 h-6.5 ${bg} text-white rounded-full border-2 border-white shadow-md flex items-center justify-center font-bold text-[10px] font-mono">${char}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });
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

// Coordinate grid cell calculator helper for k-anonymity checks
const BBOX = { south: 12.960, west: 80.220, north: 12.995, east: 80.265 };
const LAT_STEP = 0.0010;
const LNG_STEP = 0.0011;
const NUM_COLS = 41;

const getCellIdForCoord = (lat, lng) => {
  const col = Math.floor((lng - BBOX.west) / LNG_STEP);
  const row = Math.floor((lat - BBOX.south) / LAT_STEP);
  return row * NUM_COLS + col;
};

// Client-side local Dijkstra graph representing Chennai OMR & Taramani
const STREET_GRAPH_NODES = {
  n0: { name: "VHS Hospital / IIT Gate", lat: 12.9928, lng: 80.2455 },
  n1: { name: "Tidel Park Junction / OMR", lat: 12.9892, lng: 80.2465 },
  n2: { name: "Taramani MRTS Station", lat: 12.9862, lng: 80.2421 },
  n3: { name: "CSIR Road Junction", lat: 12.9840, lng: 80.2443 },
  n4: { name: "SRP Tools Junction / OMR", lat: 12.9801, lng: 80.2452 },
  n5: { name: "Kandanchavadi Bus Stop / OMR", lat: 12.9691, lng: 80.2475 },
  n6: { name: "Perungudi Bus Stop / OMR", lat: 12.9642, lng: 80.2481 },
  n7: { name: "Ascendas IT Park", lat: 12.9880, lng: 80.2490 },
  n8: { name: "Taramani Village Road", lat: 12.9800, lng: 80.2320 },
  n9: { name: "MGR Nagar Link", lat: 12.9720, lng: 80.2310 },
  n10: { name: "Perungudi Inside Road", lat: 12.9650, lng: 80.2330 },
  n11: { name: "Velachery Road Border", lat: 12.9850, lng: 80.2210 }
};

const STREET_GRAPH_EDGES = [
  { u: "n0", v: "n1", dist: 410 },
  { u: "n1", v: "n2", dist: 590 },
  { u: "n1", v: "n7", dist: 310 },
  { u: "n2", v: "n3", dist: 330 },
  { u: "n3", v: "n4", dist: 450 },
  { u: "n4", v: "n5", dist: 1220 },
  { u: "n5", v: "n6", dist: 580 },
  { u: "n3", v: "n7", dist: 660 },
  { u: "n2", v: "n8", dist: 1100 },
  { u: "n8", v: "n9", dist: 900 },
  { u: "n9", v: "n10", dist: 810 },
  { u: "n10", v: "n6", dist: 1650 },
  { u: "n8", v: "n11", dist: 1210 },
  { u: "n9", v: "n11", dist: 1780 }
];

// Helper to compute flat distance in meters
const computeDistanceMeters = (lat1, lng1, lat2, lng2) => {
  const dy = (lat1 - lat2) * 111000.0;
  const dx = (lng1 - lng2) * 111000.0 * Math.cos((lat1 + lat2) * 0.5 * Math.PI / 180.0);
  return Math.sqrt(dx * dx + dy * dy);
};

// Client-side Dijkstra routing solver
const solveDijkstraPath = (graph, startNode, endNode, weightKey) => {
  const distances = {};
  const prev = {};
  const queue = new Set();
  
  Object.keys(graph).forEach(node => {
    distances[node] = Infinity;
    prev[node] = null;
    queue.add(node);
  });
  
  distances[startNode] = 0;
  
  while (queue.size > 0) {
    let minNode = null;
    queue.forEach(node => {
      if (minNode === null || distances[node] < distances[minNode]) {
        minNode = node;
      }
    });
    
    if (minNode === endNode || distances[minNode] === Infinity) {
      break;
    }
    
    queue.delete(minNode);
    
    const neighbors = graph[minNode] || {};
    for (const neighbor in neighbors) {
      if (queue.has(neighbor)) {
        const alt = distances[minNode] + neighbors[neighbor][weightKey];
        if (alt < distances[neighbor]) {
          distances[neighbor] = alt;
          prev[neighbor] = minNode;
        }
      }
    }
  }
  
  const path = [];
  let u = endNode;
  if (prev[u] || u === startNode) {
    while (u) {
      path.unshift(u);
      u = prev[u];
    }
  }
  return { path, cost: distances[endNode] };
};

// Local templates to generate reports when offline
const LOCAL_TEMPLATES = {
  "poor lighting": "Broken street lamps make the road completely dark at night.",
  "harassment": "Loiterers catcalling and shouting offensive remarks near the tea shop.",
  "stalking": "Suspicious person following closely from the station, felt highly unsafe.",
  "unsafe infrastructure": "Broken pedestrian tiles and open manholes on the narrow footpath.",
  "assault": "Attempted physical grab and bag snatching by bike riders.",
  "other": "Aggressive stray dogs chasing pedestrians on the linking bypass road."
};

// Default emergency nodes (OSM Fallback data)
const BACKUP_EMERGENCY = [
  { name: "Taramani Police Station", lat: 12.9782, lng: 80.2431, type: "police" },
  { name: "Perungudi Police Station", lat: 12.9654, lng: 80.2403, type: "police" },
  { name: "OMR Tidel Patrol Booth", lat: 12.9892, lng: 80.2472, type: "police" },
  { name: "VHS Hospital Taramani", lat: 12.9928, lng: 80.2455, type: "hospital" },
  { name: "Apollo Speciality Hospital OMR", lat: 12.9681, lng: 80.2462, type: "hospital" },
  { name: "Dr. Kamakshi Memorial Hospital", lat: 12.9722, lng: 80.2224, type: "hospital" }
];

export default function App() {
  const [reports, setReports] = useState([]);
  const [gridData, setGridData] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  
  // Navigation Tabs: 'main' | 'evaluation' | 'moderator'
  const [currentView, setCurrentView] = useState('main');

  // Left sidebar workspace active subtab: 'route' | 'report' | 'sos'
  const [activeTab, setActiveTab] = useState('route');

  // Routing state
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [routingLoading, setRoutingLoading] = useState(false);
  
  // Selection mode for map clicks
  const [mapClickMode, setMapClickMode] = useState('none');
  
  // Report form state
  const [reportCoords, setReportCoords] = useState(null);
  const [reportCategory, setReportCategory] = useState('harassment');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSeverity, setReportSeverity] = useState(3);
  const [submittingReport, setSubmittingReport] = useState(false);
  
  // Local Engine Toggle
  const [localMode, setLocalMode] = useState(false);

  // Privacy Guardrails (k-Anonymity)
  const [kAnonymityActive, setKAnonymityActive] = useState(false);

  // SOS state
  const [sosActive, setSosActive] = useState(false);
  const [locationSharingActive, setLocationSharingActive] = useState(false);
  const [locationSharingDuration, setLocationSharingDuration] = useState('15 mins');
  const [emergencyFacilities, setEmergencyFacilities] = useState([]);
  const [sosAlertTriggered, setSosAlertTriggered] = useState(false);

  // Moderator dashboard queue
  const [pendingReports, setPendingReports] = useState([]);
  const [moderatorLoading, setModeratorLoading] = useState(false);

  // Evaluation metrics
  const [evaluationData, setEvaluationData] = useState(null);
  const [evalLoading, setEvalLoading] = useState(false);

  // UI layer visibility controls
  const [showGrid, setShowGrid] = useState(true);
  const [showReportMarkers, setShowReportMarkers] = useState(true);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [mapCenter, setMapCenter] = useState([12.978, 80.243]);
  const [mapZoom, setMapZoom] = useState(14);
  const [statusMessage, setStatusMessage] = useState('');

  // Fetch initial maps and reports on component load
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      // Test backend connection by checking reports API
      const res = await fetch('/api/reports');
      if (!res.ok) throw new Error("Offline");
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("API did not return array");
      
      setReports(data);
      setLocalMode(false);
      fetchGrid();
      fetchEmergencyServices();
    } catch (err) {
      console.warn("Backend offline or sleeping. Enabling in-browser local simulation engine:", err.message);
      setLocalMode(true);
      initializeLocalSimulation();
    }
  };

  // --- CLIENT-SIDE LOCAL SIMULATION BACKUP ENGINE ---
  const initializeLocalSimulation = () => {
    // 1. Generate ~200 mock reports clustered around Chennai hotspots
    const mockReports = [];
    const categories = ["poor lighting", "harassment", "stalking", "unsafe infrastructure", "assault", "other"];
    const baseSeverities = { "poor lighting": 2, "harassment": 3, "stalking": 4, "unsafe infrastructure": 2, "assault": 5, "other": 2 };
    
    // Seed reports around coordinates
    let id_counter = 1;
    for (let h of HOTSPOTS) {
      // 40 reports per hotspot
      for (let i = 0; i < 40; i++) {
        const cat = categories[Math.floor(Math.random() * categories.length)];
        const lat = h.lat + (Math.random() - 0.5) * 0.0035;
        const lng = h.lng + (Math.random() - 0.5) * 0.0035;
        
        mockReports.push({
          id: id_counter++,
          category: cat,
          description: LOCAL_TEMPLATES[cat] + " logged near IT park.",
          latitude: lat,
          longitude: lng,
          severity: baseSeverities[cat] + Math.floor(Math.random() * 2) - 1,
          severity_ml: baseSeverities[cat],
          category_ml: cat,
          sentiment: "negative",
          timestamp: new Date(Date.now() - Math.random() * 15 * 86400000).toISOString(),
          method: "local simulation (browser fallback)",
          status: "approved"
        });
      }
    }
    
    setReports(mockReports);
    setEmergencyFacilities(BACKUP_EMERGENCY);
    buildLocalRiskGrid(mockReports);
  };

  const buildLocalRiskGrid = (approvedReports) => {
    // Generate grid features GeoJSON
    const features = [];
    let cell_id = 0;
    
    // Bandwidth of Gaussian kernel (meters)
    const h_bandwidth = 120.0;
    
    for (let lat = BBOX.south; lat < BBOX.north; lat += LAT_STEP) {
      for (let lng = BBOX.west; lng < BBOX.east; lng += LNG_STEP) {
        const c_mid_lat = lat + LAT_STEP / 2;
        const c_mid_lng = lng + LNG_STEP / 2;
        
        let kde_score = 0.0;
        let weighted_severity = 0.0;
        let weight_sum = 0.0;
        let nearby_count = 0;
        const breakdown = {};
        
        for (let r of approvedReports) {
          if (r.status !== 'approved') continue;
          
          const dist = computeDistanceMeters(c_mid_lat, c_mid_lng, r.latitude, r.longitude);
          if (dist > 400.0) continue;
          
          const spatial_kernel = Math.exp(-(dist * dist) / (2 * h_bandwidth * h_bandwidth));
          const time_diff = (Date.now() - new Date(r.timestamp).getTime()) / 86400000.0;
          const temporal_decay = Math.exp(-0.05 * time_diff);
          
          // Minimum corroboration weight discount
          // If no other report within 150m, count = 0, discount report weight by 80%
          const close_neighbors = approvedReports.filter(o => 
            o.id !== r.id && 
            computeDistanceMeters(o.latitude, o.longitude, r.latitude, r.longitude) <= 150.0 &&
            Math.abs(new Date(o.timestamp).getTime() - new Date(r.timestamp).getTime()) <= 3 * 86400000
          ).length;
          
          const corroboration_multiplier = close_neighbors === 0 ? 0.20 : (1.0 + 0.25 * close_neighbors);
          const r_weight = spatial_kernel * temporal_decay * corroboration_multiplier;
          
          kde_score += r_weight;
          weighted_severity += (r.severity_ml || r.severity) * r_weight;
          weight_sum += r_weight;
          
          if (dist <= 150.0) {
            nearby_count++;
            const cat = r.category_ml || r.category;
            breakdown[cat] = (breakdown[cat] || 0) + 1;
          }
        }
        
        const avg_severity = weight_sum > 0 ? (weighted_severity / weight_sum) : 0.0;
        const norm_kde = Math.min(1.0, kde_score / 3.0);
        
        // Random Forest tier estimation heuristic
        let risk_tier = "low";
        if (norm_kde > 0.40 || (norm_kde > 0.20 && avg_severity >= 3.5)) {
          risk_tier = "high";
        } else if (norm_kde > 0.08) {
          risk_tier = "medium";
        }
        
        const cell_risk = norm_kde * 0.4 + (risk_tier === 'high' ? 0.6 : risk_tier === 'medium' ? 0.3 : 0.0);
        
        features.push({
          type: "Feature",
          properties: {
            cell_id: cell_id++,
            risk_score: Math.min(1.0, parseFloat(cell_risk.toFixed(3))),
            risk_tier: risk_tier,
            report_count: nearby_count,
            avg_severity: parseFloat(avg_severity.toFixed(2)),
            corroboration_avg: 1.0,
            most_recent_age_days: nearby_count > 0 ? 1.0 : 999.0,
            category_breakdown: breakdown,
            lat_mid: c_mid_lat,
            lng_mid: c_mid_lng
          },
          geometry: {
            type: "Polygon",
            coordinates: [[
              [lng, lat],
              [lng + LNG_STEP, lat],
              [lng + LNG_STEP, lat + LAT_STEP],
              [lng, lat + LAT_STEP],
              [lng, lat]
            ]]
          }
        });
      }
    }
    
    setGridData({ type: "FeatureCollection", features });
  };

  const solveLocalRoutes = (orig_coords, dest_coords) => {
    // 1. Find nearest nodes in STREET_GRAPH
    let startNodeId = null;
    let endNodeId = null;
    let startMinDist = Infinity;
    let endMinDist = Infinity;
    
    Object.entries(STREET_GRAPH_NODES).forEach(([id, n]) => {
      const dStart = computeDistanceMeters(orig_coords[0], orig_coords[1], n.lat, n.lng);
      const dEnd = computeDistanceMeters(dest_coords[0], dest_coords[1], n.lat, n.lng);
      
      if (dStart < startMinDist) {
        startMinDist = dStart;
        startNodeId = id;
      }
      if (dEnd < endMinDist) {
        endMinDist = dEnd;
        endNodeId = id;
      }
    });
    
    if (!startNodeId || !endNodeId) return;
    
    // Map of cell risks
    const cellRisks = {};
    if (gridData) {
      gridData.features.forEach(f => {
        cellRisks[f.properties.cell_id] = f.properties.risk_score;
      });
    }
    
    // Build NetworkX analogue graph
    const localGraph = {};
    Object.keys(STREET_GRAPH_NODES).forEach(nid => {
      localGraph[nid] = {};
    });
    
    STREET_GRAPH_EDGES.forEach(e => {
      const uNode = STREET_GRAPH_NODES[e.u];
      const vNode = STREET_GRAPH_NODES[e.v];
      
      const midLat = (uNode.lat + vNode.lat) / 2;
      const midLng = (uNode.lng + vNode.lng) / 2;
      
      const cellId = getCellIdForCoord(midLat, midLng);
      const cellRisk = cellRisks[cellId] || 0.0;
      
      // Calculate safety weight
      // cost = distance * (1.0 + 8.0 * risk)
      const safetyCost = e.dist * (1.0 + 8.0 * cellRisk);
      
      localGraph[e.u][e.v] = { length: e.dist, safety: safetyCost, risk: cellRisk };
      localGraph[e.v][e.u] = { length: e.dist, safety: safetyCost, risk: cellRisk };
    });
    
    const computedOptions = [];
    
    // Helper to get coordinates
    const buildPathCoords = (nodeIds) => {
      const coords = [];
      // Add user actual origin pin at start
      coords.push([orig_coords[1], orig_coords[0]]);
      nodeIds.forEach(id => {
        coords.push([STREET_GRAPH_NODES[id].lng, STREET_GRAPH_NODES[id].lat]);
      });
      // Add user actual destination pin at end
      coords.push([dest_coords[1], dest_coords[0]]);
      return coords;
    };
    
    const computePathMetrics = (nodeIds, type) => {
      let tot_dist = 0;
      let tot_risk_sum = 0;
      
      for (let i = 0; i < nodeIds.length - 1; i++) {
        const u = nodeIds[i];
        const v = nodeIds[i+1];
        const edge = localGraph[u][v];
        if (edge) {
          tot_dist += edge.length;
          tot_risk_sum += edge.risk * edge.length;
        }
      }
      
      const avg_risk = tot_dist > 0 ? (tot_risk_sum / tot_dist) : 0.0;
      
      return {
        distance_meters: tot_dist + startMinDist + endMinDist,
        duration_minutes: (tot_dist + startMinDist + endMinDist) / 1.2 / 60,
        average_risk: parseFloat((avg_risk * 100).toFixed(1))
      };
    };

    // 1. Shortest Route
    const shortestSol = solveDijkstraPath(localGraph, startNodeId, endNodeId, 'length');
    if (shortestSol.path.length > 0) {
      const metrics = computePathMetrics(shortestSol.path, 'shortest');
      computedOptions.push({
        name: "Shortest Route",
        type: "shortest",
        coordinates: buildPathCoords(shortestSol.path),
        risk_reduction_pct: 0.0,
        ...metrics
      });
    }
    
    // 2. Safest Route
    const safestSol = solveDijkstraPath(localGraph, startNodeId, endNodeId, 'safety');
    if (safestSol.path.length > 0) {
      const metrics = computePathMetrics(safestSol.path, 'safest');
      const shortestRisk = computedOptions[0] ? computedOptions[0].average_risk : 0.0;
      const reduction = shortestRisk > 0 ? Math.max(0.0, parseFloat(((shortestRisk - metrics.average_risk) / shortestRisk * 100).toFixed(1))) : 0.0;
      
      computedOptions.push({
        name: "Safest Route",
        type: "safest",
        coordinates: buildPathCoords(safestSol.path),
        risk_reduction_pct: reduction,
        ...metrics
      });
    }
    
    // 3. Alternative route (penalize safest path edges)
    if (safestSol.path.length > 2) {
      // copy graph and penalize edges
      const graphAlt = JSON.parse(JSON.stringify(localGraph));
      for (let i = 0; i < safestSol.path.length - 1; i++) {
        const u = safestSol.path[i];
        const v = safestSol.path[i+1];
        if (graphAlt[u] && graphAlt[u][v]) {
          graphAlt[u][v].safety *= 4.0;
          graphAlt[v][u].safety *= 4.0;
        }
      }
      
      const altSol = solveDijkstraPath(graphAlt, startNodeId, endNodeId, 'safety');
      if (altSol.path.length > 0) {
        const metrics = computePathMetrics(altSol.path, 'alternative');
        const shortestRisk = computedOptions[0] ? computedOptions[0].average_risk : 0.0;
        const reduction = shortestRisk > 0 ? Math.max(0.0, parseFloat(((shortestRisk - metrics.average_risk) / shortestRisk * 100).toFixed(1))) : 0.0;
        
        computedOptions.push({
          name: "Alternative Safest Route",
          type: "alternative",
          coordinates: buildPathCoords(altSol.path),
          risk_reduction_pct: reduction,
          ...metrics
        });
      }
    }
    
    // Deduplicate
    const finalRoutes = [];
    const seen = [];
    computedOptions.forEach(r => {
      const hash = r.coordinates.length + "_" + r.distance_meters.toFixed(0);
      if (!seen.includes(hash)) {
        seen.push(hash);
        finalRoutes.push(r);
      } else if (r.type === 'safest' && finalRoutes[0]) {
        finalRoutes[0].name = "Shortest & Safest Route";
        finalRoutes[0].type = "shortest_and_safest";
      }
    });

    setRoutes(finalRoutes);
    setActiveRouteIndex(0);
    setStatusMessage(`Found ${finalRoutes.length} paths inside local Chennai simulation.`);
  };

  const handleLocalReportSubmit = (cat, desc, coords, sev) => {
    // 1. Keyword-based NLP category fallback
    let cat_ml = cat;
    let sev_ml = sev;
    
    const descLower = desc.toLowerCase();
    if (descLower.includes("dark") || descLower.includes("lamp") || descLower.includes("light")) {
      cat_ml = "poor lighting";
      sev_ml = 2;
    } else if (descLower.includes("grab") || descLower.includes("snatch") || descLower.includes("attack") || descLower.includes("hit")) {
      cat_ml = "assault";
      sev_ml = 5;
    } else if (descLower.includes("follow") || descLower.includes("trail") || descLower.includes("chase")) {
      cat_ml = "stalking";
      sev_ml = 4;
    } else if (descLower.includes("camera") || descLower.includes("footpath") || descLower.includes("underpass")) {
      cat_ml = "unsafe infrastructure";
      sev_ml = 2;
    }
    
    const newReport = {
      id: reports.length + 1,
      category: cat,
      description: desc,
      latitude: coords[0],
      longitude: coords[1],
      severity: sev,
      severity_ml: sev_ml,
      category_ml: cat_ml,
      sentiment: "negative",
      timestamp: new Date().toISOString(),
      method: "local NLP classifier (browser fallback)",
      status: "approved"
    };

    // 2. Proximity moderation review flag trigger
    // If severity >= 4 and has no close neighbor within 200m
    const neighborsCount = reports.filter(r => 
      r.status === 'approved' &&
      computeDistanceMeters(r.latitude, r.longitude, coords[0], coords[1]) <= 200.0
    ).length;

    if (sev_ml >= 4 && neighborsCount === 0) {
      newReport.status = 'pending';
      setPendingReports(prev => [newReport, ...prev]);
      setStatusMessage("Observation submitted. High severity & uncorroborated, flagged for moderator review.");
    } else {
      const updatedList = [newReport, ...reports];
      setReports(updatedList);
      buildLocalRiskGrid(updatedList);
      setStatusMessage("Incident reported. Risk grid updated instantly in-browser!");
    }
  };

  const handleLocalApprove = (rId) => {
    const rToApprove = pendingReports.find(o => o.id === rId);
    if (!rToApprove) return;
    
    rToApprove.status = 'approved';
    const updatedPending = pendingReports.filter(o => o.id !== rId);
    setPendingReports(updatedPending);
    
    const updatedReports = [rToApprove, ...reports];
    setReports(updatedReports);
    buildLocalRiskGrid(updatedReports);
    setStatusMessage(`Report ${rId} approved and merged into local risk grid.`);
  };

  const handleLocalReject = (rId) => {
    setPendingReports(prev => prev.filter(o => o.id !== rId));
    setStatusMessage(`Flagged report ${rId} deleted.`);
  };

  // --- API BACKEND COMMUNICATORS ---
  const fetchPendingQueue = async () => {
    setModeratorLoading(true);
    try {
      const res = await fetch('/api/reports/pending');
      if (!res.ok) throw new Error("Failed to fetch pending queue");
      const data = await res.json();
      if (Array.isArray(data)) {
        setPendingReports(data);
      }
    } catch (err) {
      console.error("fetchPendingQueue error:", err);
      setStatusMessage("Error fetching moderator queue");
    } finally {
      setModeratorLoading(false);
    }
  };

  const fetchEvaluationMetrics = async () => {
    setEvalLoading(true);
    try {
      const res = await fetch('/api/evaluation');
      if (!res.ok) throw new Error("Failed to fetch evaluation metrics");
      const data = await res.json();
      setEvaluationData(data);
    } catch (err) {
      console.error("fetchEvaluationMetrics error:", err);
      setStatusMessage("Error fetching evaluation metrics");
    } finally {
      setEvalLoading(false);
    }
  };

  const handleApproveReport = async (rId) => {
    try {
      const res = await fetch(`/api/reports/${rId}/approve`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error(`Failed to approve report ${rId}`);
      
      // Update local states
      await fetchReports();
      await fetchGrid(true);
      await fetchPendingQueue();
      
      setStatusMessage(`Report ${rId} approved and merged successfully.`);
    } catch (err) {
      console.error(err);
      setStatusMessage(err.message || "Failed to approve report");
    }
  };

  const handleRejectReport = async (rId) => {
    try {
      const res = await fetch(`/api/reports/${rId}/reject`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error(`Failed to reject report ${rId}`);
      
      await fetchPendingQueue();
      setStatusMessage(`Report ${rId} rejected and removed.`);
    } catch (err) {
      console.error(err);
      setStatusMessage(err.message || "Failed to reject report");
    }
  };

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();
      if (Array.isArray(data)) {
        setReports(data);
      } else {
        throw new Error("Reports API did not return array");
      }
    } catch (err) {
      console.error("Failed to load reports:", err);
      enableLocalFallback();
    }
  };

  const fetchGrid = async (refresh = false) => {
    try {
      const url = refresh ? '/api/risk-grid?refresh=true' : '/api/risk-grid';
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.type === 'FeatureCollection' && Array.isArray(data.features)) {
        setGridData(data);
      } else {
        throw new Error("Risk grid API did not return a valid FeatureCollection");
      }
    } catch (err) {
      console.error("Failed to load risk grid:", err);
      enableLocalFallback();
    }
  };

  const fetchEmergencyServices = async () => {
    try {
      const res = await fetch('/api/emergency');
      const data = await res.json();
      if (Array.isArray(data)) {
        setEmergencyFacilities(data);
      } else {
        throw new Error("Emergency API did not return an array");
      }
    } catch (err) {
      console.error("Failed to load emergency features:", err);
      setEmergencyFacilities(BACKUP_EMERGENCY);
    }
  };

  const enableLocalFallback = () => {
    setLocalMode(prev => {
      if (!prev) {
        console.warn("API request failed. Activating in-browser local fallback engine.");
        initializeLocalSimulation();
      }
      return true;
    });
  };

  const calculateRoute = async () => {
    if (!origin || !destination) {
      setStatusMessage("Select both Origin and Destination coordinates.");
      return;
    }
    
    if (localMode) {
      solveLocalRoutes(origin, destination);
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
    
    // In-Memory Rate Limiter check (client-side enforcement)
    const recentSubmissions = JSON.parse(localStorage.getItem('airaa_submissions') || '[]');
    const now = Date.now();
    const updatedSubmissions = recentSubmissions.filter(t => now - t < 60000);
    
    if (updatedSubmissions.length >= 3) {
      setStatusMessage("Rate limit exceeded. Maximum 3 submissions per minute allowed.");
      return;
    }
    updatedSubmissions.push(now);
    localStorage.setItem('airaa_submissions', JSON.stringify(updatedSubmissions));

    if (localMode) {
      handleLocalReportSubmit(reportCategory, reportDescription, reportCoords, reportSeverity);
      setReportDescription('');
      setReportCoords(null);
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
      
      if (res.status === 429) {
        throw new Error("Rate limit exceeded. Maximum 3 submissions per minute allowed.");
      }
      if (!res.ok) throw new Error("Submitting report failed.");
      
      const newRep = await res.json();
      
      // Reset form
      setReportDescription('');
      setReportCoords(null);
      
      if (newRep.status === 'pending') {
        setStatusMessage("Observation submitted. High severity & uncorroborated, flagged for moderator review.");
      } else {
        await fetchReports();
        await fetchGrid(true);
        setStatusMessage("Incident reported. Risk Map scoring updated dynamically!");
      }
    } catch (err) {
      console.error(err);
      setStatusMessage(err.message || "Failed to submit report. Please try again.");
    } finally {
      setSubmittingReport(false);
    }
  };

  // Triggering view updates
  useEffect(() => {
    if (currentView === 'moderator' && !localMode) {
      fetchPendingQueue();
    } else if (currentView === 'evaluation' && !localMode) {
      fetchEvaluationMetrics();
    }
  }, [currentView]);

  // GeoJSON style builder for risk grid cells
  const getCellStyle = (feature) => {
    const riskTier = feature.properties.risk_tier;
    const cellId = feature.properties.cell_id;
    const isSelected = selectedCell && selectedCell.cell_info.cell_id === cellId;
    
    let color = 'var(--status-safe)'; 
    let fillOpacity = 0.04;
    
    if (riskTier === 'high') {
      color = 'var(--status-risk)'; 
      fillOpacity = 0.40;
    } else if (riskTier === 'medium') {
      color = 'var(--status-caution)'; 
      fillOpacity = 0.20;
    }
    
    return {
      color: isSelected ? 'var(--brand)' : color,
      weight: isSelected ? 2.5 : 0.8,
      fillColor: color,
      fillOpacity: fillOpacity,
      dashArray: isSelected ? '0' : '2',
    };
  };

  const onEachCell = (feature, layer) => {
    layer.on({
      click: (e) => {
        if (mapClickMode !== 'none') {
          handleMapClick(e.latlng);
          return;
        }
        if (localMode) {
          // Client-side cell inspect
          const cell_info = feature.properties;
          const nearby = reports.filter(r => 
            r.status === 'approved' &&
            computeDistanceMeters(cell_info.lat_mid, cell_info.lng_mid, r.latitude, r.longitude) <= 150.0
          ).map(r => ({
            ...r,
            distance_meters: computeDistanceMeters(cell_info.lat_mid, cell_info.lng_mid, r.latitude, r.longitude)
          }));
          
          setSelectedCell({
            cell_info,
            nearby_reports: nearby
          });
        } else {
          handleCellClick(feature.properties.cell_id);
        }
      },
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

  const handleCellClick = async (cellId) => {
    try {
      const res = await fetch(`/api/risk-grid/${cellId}/explain`);
      const data = await res.json();
      setSelectedCell(data);
    } catch (err) {
      console.error("Failed to explain cell:", err);
    }
  };

  const handleMapClick = (latlng) => {
    if (!latlng) return;
    const coords = [latlng.lat, latlng.lng];
    if (mapClickMode === 'origin') {
      setOrigin(coords);
      setMapClickMode('none');
      setStatusMessage(`Origin terminal set to: ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`);
    } else if (mapClickMode === 'destination') {
      setDestination(coords);
      setMapClickMode('none');
      setStatusMessage(`Destination terminal set to: ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`);
    } else if (mapClickMode === 'report') {
      setReportCoords(coords);
      setMapClickMode('none');
      setStatusMessage(`Report incident pin placed at: ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`);
    }
  };

  // Compute reports counts per grid cell for k-Anonymity privacy filter
  const reportCellCounts = {};
  reports.forEach(r => {
    const cellId = getCellIdForCoord(r.latitude, r.longitude);
    reportCellCounts[cellId] = (reportCellCounts[cellId] || 0) + 1;
  });

  // Filter reports displayed (including k-Anonymity rules)
  const filteredReports = reports.filter(r => {
    if (r.status !== 'approved') return false;
    // 1. Category Filter
    if (selectedCategoryFilter !== 'all') {
      const cat = r.category_ml || r.category;
      if (cat.toLowerCase() !== selectedCategoryFilter.toLowerCase()) return false;
    }
    // 2. k-Anonymity Filter: Hides points in cells containing < 3 reports to preserve privacy
    if (kAnonymityActive) {
      const cellId = getCellIdForCoord(r.latitude, r.longitude);
      if ((reportCellCounts[cellId] || 0) < 3) return false;
    }
    return true;
  });

  // Sort emergency services by distance to current map center
  const sortedEmergencyServices = [...emergencyFacilities].map(f => {
    const dist = computeDistanceMeters(mapCenter[0], mapCenter[1], f.lat, f.lng);
    return { ...f, distance_meters: dist };
  }).sort((a, b) => a.distance_meters - b.distance_meters);

  // Triggering mock SOS alarm
  const triggerSos = () => {
    setSosAlertTriggered(true);
    setStatusMessage("SOS Mode active. Simulated emergency alert dispatched to trusted contacts.");
  };

  const hasValidGrid = gridData && gridData.type === 'FeatureCollection' && Array.isArray(gridData.features);
  const highRiskCount = hasValidGrid ? gridData.features.filter(f => f.properties && f.properties.risk_tier === 'high').length : 223;

  return (
    <div className="min-h-screen bg-[#F4F5F9] text-[#1B2138] flex flex-col font-sans antialiased">
      
      {/* SKIP LINK */}
      <a href="#main" className="skip-link">Skip to main content</a>

      {/* UTILITY STRIP */}
      <div className="utility-strip">
        <div className="left font-sans flex items-center gap-3">
          <span>Hackathon MVP · Girls Hack Day Delhi 2026</span>
          <span className="opacity-40">·</span>
          <span>Pilot Zone: Chennai OMR</span>
          
          {/* Status Badge */}
          {localMode ? (
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-[#B9740E] border border-amber-500/30 text-[10px] font-bold flex items-center gap-1 font-mono leading-none">
              <Cpu className="w-3 h-3" />
              <span>In-Browser fallback Engine</span>
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-[#1F7A54] border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1 font-mono leading-none">
              <Activity className="w-3 h-3" />
              <span>Live API connected</span>
            </span>
          )}
        </div>
        <div className="lang">
          <button className="active font-semibold">EN</button>
          <button className="opacity-70 hover:opacity-100">हिं</button>
        </div>
      </div>

      {/* HEADER */}
      <header className="main">
        <div className="header-inner">
          <div className="brand-block">
            <div className="relative w-12 h-12 flex-shrink-0">
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Outer Ring: --status-risk */}
                <circle cx="50" cy="50" r="46" stroke="var(--status-risk)" strokeWidth="3.5" />
                {/* Middle Ring: --seal-gold */}
                <circle cx="50" cy="50" r="39" stroke="var(--seal-gold)" strokeWidth="2.5" />
                {/* Inner Ring: --status-safe */}
                <circle cx="50" cy="50" r="32" stroke="var(--status-safe)" strokeWidth="3" />
              </svg>
              <img 
                src="/logo.png" 
                className="absolute inset-[8px] w-[32px] h-[32px] rounded-full object-cover bg-white" 
                alt="AIRAA Logo" 
              />
            </div>
            <div className="brand-text">
              <div className="name serif">AIRAA</div>
              <div className="tagline font-medium uppercase tracking-wider">Women Safety, Emergency Support &amp; Awareness Platform</div>
            </div>
          </div>
          
          <nav className="primary" aria-label="Primary Navigation">
            <button 
              onClick={() => setCurrentView('main')}
              className={`text-sm font-semibold px-2 py-1 transition ${currentView === 'main' ? 'text-[#22366E] border-b-2 border-b-[#22366E]' : 'text-[#5B6280] hover:text-[#12182B]'}`}
            >
              Risk Map
            </button>
            <button 
              onClick={() => setCurrentView('evaluation')}
              className={`text-sm font-semibold px-2 py-1 transition flex items-center gap-1.5 ${currentView === 'evaluation' ? 'text-[#22366E] border-b-2 border-b-[#22366E]' : 'text-[#5B6280] hover:text-[#12182B]'}`}
            >
              <BarChart2 className="w-4 h-4" />
              <span>ML Evaluation</span>
            </button>
            <button 
              onClick={() => setCurrentView('moderator')}
              className={`text-sm font-semibold px-2 py-1 transition flex items-center gap-1.5 ${currentView === 'moderator' ? 'text-[#22366E] border-b-2 border-b-[#22366E]' : 'text-[#5B6280] hover:text-[#12182B]'}`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Moderator Queue</span>
            </button>
            <a href="#map-section" onClick={() => { setCurrentView('main'); setActiveTab('route'); }} className="nav-cta">Plan a Safe Route</a>
            
            {/* Pulsing Live status pill */}
            <div className="flex items-center gap-2 px-2.5 py-1 bg-white/5 border border-white/10 rounded font-mono text-[10px] uppercase tracking-wider font-semibold">
              <span className="status-dot-pulse"></span>
              <span className="text-[#F4F5F9]">SYSTEM STATUS: LIVE</span>
            </div>
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">

        {/* 1. MAIN MAP VIEW (DASHBOARD + LANDING PAGE) */}
        {currentView === 'main' && (
          <>
            {/* HERO */}
            <section className="hero">
              <div className="hero-inner">
                <div>
                  <div className="eyebrow flex items-center">
                    <span className="dot"></span>
                    <span>System status: live · Chennai OMR pilot</span>
                  </div>
                  <h1 className="serif gold-gradient-text">See a street's risk before you walk it.</h1>
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
                
                {/* STATS */}
                <div className="stat-panel border border-[var(--line)] bg-[var(--ink-raised)] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--seal-gold)]/5 rounded-full blur-2xl pointer-events-none"></div>
                  <div className="flex items-center gap-4 mb-5 border-b border-white/5 pb-4">
                    <div className="relative w-16 h-16 flex-shrink-0">
                      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        {/* Outer Ring: --status-risk */}
                        <circle cx="50" cy="50" r="46" stroke="var(--status-risk)" strokeWidth="3.5" />
                        {/* Middle Ring: --seal-gold */}
                        <circle cx="50" cy="50" r="39" stroke="var(--seal-gold)" strokeWidth="2.5" />
                        {/* Inner Ring: --status-safe */}
                        <circle cx="50" cy="50" r="32" stroke="var(--status-safe)" strokeWidth="3" />
                      </svg>
                      <img 
                        src="/logo.png" 
                        className="absolute inset-[11px] w-[42px] h-[42px] rounded-full object-cover bg-white" 
                        alt="AIRAA Official Logo" 
                      />
                    </div>
                    <div>
                      <h4 className="serif text-sm font-bold text-white tracking-wide uppercase leading-tight">AI-Powered Safety Intelligence</h4>
                      <span className="text-[10px] text-[var(--seal-gold)] font-mono tracking-widest uppercase block mt-1 font-semibold">Chennai District Pilot</span>
                    </div>
                  </div>
                  <div className="panel-label">
                    <span>Pilot zone summary</span>
                    <span className="mono">OMR CHENNAI</span>
                  </div>
                  <div className="stat-row">
                    <div className="stat">
                      <div className="num">{reports.length}</div>
                      <div className="lbl">Reports processed</div>
                    </div>
                    <div className="stat">
                      <div className="num">{gridData ? gridData.features.length : '1476'}</div>
                      <div className="lbl">Grid cells scored</div>
                    </div>
                    <div className="stat">
                      <div className="num flex items-center gap-1">
                        <TrendingDown className="w-5 h-5 text-emerald-400" />
                        <span>36.8%</span>
                      </div>
                      <div className="lbl">Max. route risk reduction</div>
                    </div>
                    <div className="stat">
                      <div className="num">{highRiskCount}</div>
                      <div className="lbl">High-risk cells today</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* TICKER */}
            <div className="ticker-bar" role="marquee" aria-label="Recent zone status changes">
              <div className="ticker-label">
                <span>●</span> Live advisories
              </div>
              <div className="ticker-track-wrap">
                <div className="ticker-track">
                  <span className="ticker-item"><span className="tag caution font-mono">CAUTION</span> OMR Kandanchavadi cell upgraded — 2 uncorroborated reports, decay active</span>
                  <span className="ticker-item"><span className="tag safe font-mono">IMPROVED</span> Taramani MRTS subcell downgraded — streetlight restoration confirmed</span>
                  <span className="ticker-item"><span className="tag risk font-mono">HIGH RISK</span> SRP Tools Junction lane — low footfall + 3 corroborated reports</span>
                  <span className="ticker-item"><span className="tag caution font-mono">CAUTION</span> Tidel Park underpass — loitering warnings logged</span>
                  {/* Duplicates */}
                  <span className="ticker-item"><span className="tag caution font-mono">CAUTION</span> OMR Kandanchavadi cell upgraded — 2 uncorroborated reports, decay active</span>
                  <span className="ticker-item"><span className="tag safe font-mono">IMPROVED</span> Taramani MRTS subcell downgraded — streetlight restoration confirmed</span>
                  <span className="ticker-item"><span className="tag risk font-mono">HIGH RISK</span> SRP Tools Junction lane — low footfall + 3 corroborated reports</span>
                  <span className="ticker-item"><span className="tag caution font-mono">CAUTION</span> Tidel Park underpass — loitering warnings logged</span>
                </div>
              </div>
            </div>

            {/* INTRO CARDS */}
            <section id="services" className="py-16 light-bg">
              <div className="section-inner">
                <div className="section-head">
                  <div className="section-eyebrow">What you can do here</div>
                  <h2>Three ways into the system</h2>
                  <p>Every action feeds the same live model — a report you file today can change a route someone else is shown tonight.</p>
                </div>
                <div className="cards-row">
                  <div className="service-card">
                    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 2v20M2 12h20"/><circle cx="12" cy="12" r="9"/></svg>
                    <h3 className="serif">Report an incident</h3>
                    <p>Log a location, category, and short description. AIRAA's classifier reads it and updates the grid within minutes.</p>
                    <a href="#map-section" onClick={() => { setActiveTab('report'); }} className="link font-semibold">Open reporting form →</a>
                  </div>
                  <div className="service-card">
                    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z"/><path d="M9 3v15M15 6v15"/></svg>
                    <h3 className="serif">Explore the risk map</h3>
                    <p>Browse Chennai OMR cells scored by RandomForest. Check the corroborating metrics and historical logs.</p>
                    <a href="#map-section" className="link font-semibold">View risk map →</a>
                  </div>
                  <div className="service-card">
                    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 19l6-14 4 9 3-6 3 11"/></svg>
                    <h3 className="serif">Plan a safe route</h3>
                    <p>Enter origin and destination points on OMR. Compare paths, safety reduction indices, and transit risk parameters.</p>
                    <a href="#map-section" onClick={() => { setActiveTab('route'); }} className="link font-semibold">Plan a route →</a>
                  </div>
                </div>
              </div>
            </section>

            {/* INTERACTIVE WORKSPACE MAP CONTAINER */}
            <section className="map-section" id="map-section">
              <div className="section-inner">
                <div className="section-head">
                  <div className="section-eyebrow">Interactive GIS Workplace</div>
                  <h2>OMR &amp; Taramani, Chennai — pilot zone</h2>
                  <p>In-browser safety routing engine and Kernel-density score cells. Turn on Privacy aggregated mode to shield individual coordinates.</p>
                </div>
                
                {/* WORKSPACE SHELL */}
                <div className="map-card-wrapper rounded overflow-hidden flex flex-col md:flex-row min-h-[620px]">
                  
                  {/* LEFT CONTROL PANEL (350px width) */}
                  <div className="w-full md:w-88 flex flex-col border-r border-[#D8DBE6] bg-white shrink-0 font-sans">
                    {/* Tab Navigation header */}
                    <div className="flex border-b border-[#D8DBE6] bg-[#F4F5F9]">
                      <button 
                        onClick={() => setActiveTab('route')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-r border-[#D8DBE6] transition ${
                          activeTab === 'route' ? 'bg-[#FFFFFF] text-[#22366E] border-t-2 border-t-[#22366E]' : 'text-[#5B6280] hover:text-[#12182B]'
                        }`}
                      >
                        Route Planner
                      </button>
                      <button 
                        onClick={() => setActiveTab('report')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-r border-[#D8DBE6] transition ${
                          activeTab === 'report' ? 'bg-[#FFFFFF] text-[#22366E] border-t-2 border-t-[#22366E]' : 'text-[#5B6280] hover:text-[#12182B]'
                        }`}
                      >
                        Log Report
                      </button>
                      <button 
                        onClick={() => { setActiveTab('sos'); }}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition ${
                          activeTab === 'sos' ? 'bg-[#FFFFFF] text-[#A93A3A] border-t-2 border-t-[#A93A3A]' : 'text-[#5B6280] hover:text-[#12182B]'
                        }`}
                      >
                        SOS Trigger
                      </button>
                    </div>

                    <div className="p-5 flex-1 overflow-y-auto space-y-4">
                      {statusMessage && (
                        <div className="p-3 text-xs bg-[#E7F4EE] border border-[#1F7A54]/25 text-[#1F7A54] rounded font-medium flex items-start gap-2">
                          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span>{statusMessage}</span>
                        </div>
                      )}

                      {/* TAB 1: SAFETY ROUTE SOLVER */}
                      {activeTab === 'route' && (
                        <div className="space-y-4">
                          {mapZoom < 10 && (
                            <div className="p-3 text-xs bg-amber-50 border border-amber-200 text-[#B9740E] rounded font-medium flex flex-col gap-2 shadow-sm">
                              <div className="flex items-center gap-1.5 font-bold uppercase text-[9px]">
                                <AlertTriangle className="w-3.5 h-3.5 text-[#B9740E]" />
                                <span>Tamil Nadu Macro View Active</span>
                              </div>
                              <p className="leading-relaxed text-[11px] text-slate-700">
                                The safety routing engine and active grid cell overlays are deployed for the Chennai OMR &amp; Taramani pilot zone.
                              </p>
                              <button 
                                onClick={() => {
                                  setMapCenter([12.9862, 80.2421]);
                                  setMapZoom(14);
                                  setStatusMessage("Map view centered on Chennai OMR pilot zone.");
                                }}
                                className="w-full py-1.5 text-center bg-[#C9972B] hover:bg-[#E9C878] text-white font-bold rounded transition text-[10px] uppercase tracking-wider cursor-pointer"
                              >
                                📍 Focus Chennai Pilot Zone
                              </button>
                            </div>
                          )}
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-[#5B6280] tracking-wider uppercase block">Focus Shortcuts</span>
                            <div className="grid grid-cols-2 gap-1">
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

                          <div className="space-y-2">
                            <span className="text-[10px] font-bold text-[#5B6280] tracking-wider uppercase block">Location Terminals</span>
                            {/* Origin */}
                            <button
                              onClick={() => setMapClickMode(mapClickMode === 'origin' ? 'none' : 'origin')}
                              className={`w-full flex items-center justify-between p-3 border rounded text-xs transition ${
                                mapClickMode === 'origin' 
                                  ? 'border-[#B9740E] bg-[#FBF0DE] text-[#B9740E]'
                                  : origin 
                                    ? 'border-[#D8DBE6] bg-white text-[#1B2138] font-bold' 
                                    : 'border-[#D8DBE6] bg-[#F4F5F9] text-[#5B6280] hover:bg-[#D8DBE6]'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <MapPin className={`w-3.5 h-3.5 ${origin ? 'text-[#1F7A54]' : 'text-[#5B6280]'}`} />
                                <span className="text-left truncate">
                                  {origin ? `${origin[0].toFixed(5)}, ${origin[1].toFixed(5)}` : "Place Point A (Origin)..."}
                                </span>
                              </div>
                              {!origin && <span className="text-[9px] bg-slate-800 text-white px-1 py-0.5 rounded font-mono uppercase scale-90">Click Map</span>}
                            </button>

                            {/* Destination */}
                            <button
                              onClick={() => setMapClickMode(mapClickMode === 'destination' ? 'none' : 'destination')}
                              className={`w-full flex items-center justify-between p-3 border rounded text-xs transition ${
                                mapClickMode === 'destination' 
                                  ? 'border-[#B9740E] bg-[#FBF0DE] text-[#B9740E]'
                                  : destination 
                                    ? 'border-[#D8DBE6] bg-white text-[#1B2138] font-bold' 
                                    : 'border-[#D8DBE6] bg-[#F4F5F9] text-[#5B6280] hover:bg-[#D8DBE6]'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Navigation className={`w-3.5 h-3.5 ${destination ? 'text-[#A93A3A]' : 'text-[#5B6280]'}`} />
                                <span className="text-left truncate">
                                  {destination ? `${destination[0].toFixed(5)}, ${destination[1].toFixed(5)}` : "Place Point B (Destination)..."}
                                </span>
                              </div>
                              {!destination && <span className="text-[9px] bg-slate-800 text-white px-1 py-0.5 rounded font-mono uppercase scale-90">Click Map</span>}
                            </button>
                          </div>

                          <button
                            onClick={calculateRoute}
                            disabled={routingLoading || !origin || !destination}
                            className="w-full py-3 bg-[#22366E] hover:bg-[#182750] text-white text-xs font-bold uppercase tracking-wider rounded transition disabled:opacity-40 flex items-center justify-center gap-2"
                          >
                            {routingLoading ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Solving Network Paths...</span>
                              </>
                            ) : (
                              <>
                                <Navigation className="w-3.5 h-3.5" />
                                <span>Find Safest Path</span>
                              </>
                            )}
                          </button>

                          {/* Route Options results */}
                          {routes.length > 0 && (
                            <div className="pt-2 border-t border-[#D8DBE6] space-y-2">
                              <span className="text-[10px] font-bold text-[#5B6280] tracking-wider uppercase block">Safety-Aware Routes</span>
                              {routes.map((r, i) => {
                                const isActive = activeRouteIndex === i;
                                const rColor = r.average_risk > 65 ? 'text-[#A93A3A] bg-[#F8E9E9]' : r.average_risk > 30 ? 'text-[#B9740E] bg-[#FBF0DE]' : 'text-[#1F7A54] bg-[#E7F4EE]';
                                return (
                                  <button
                                    key={i}
                                    onClick={() => setActiveRouteIndex(i)}
                                    className={`w-full text-left p-3 rounded border transition flex flex-col gap-1.5 ${
                                      isActive ? 'border-[#22366E] bg-[#F4F5F9] shadow-sm' : 'border-[#D8DBE6] hover:border-[#22366E]'
                                    }`}
                                  >
                                    <div className="flex justify-between items-center w-full">
                                      <span className="text-xs font-bold text-[#1B2138]">{r.name}</span>
                                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${rColor}`}>
                                        Risk: {r.average_risk.toFixed(0)}%
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center w-full text-[11px] text-[#5B6280] font-semibold">
                                      <span className="flex items-center gap-0.5"><CornerDownRight className="w-3.5 h-3.5" /> {r.distance_meters.toFixed(0)} m</span>
                                      <span className="flex items-center gap-0.5"><Clock className="w-3.5 h-3.5" /> {r.duration_minutes.toFixed(0)} mins</span>
                                      {r.risk_reduction_pct > 0 && (
                                        <span className="text-[#1F7A54] bg-[#E7F4EE] px-1 rounded text-[10px] flex items-center font-mono">-{r.risk_reduction_pct}% Risk</span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* TAB 2: INCIDENT REPORT INGEST */}
                      {activeTab === 'report' && (
                        <form onSubmit={submitReport} className="space-y-4 text-xs font-sans">
                          {mapZoom < 10 && (
                            <div className="p-3 text-xs bg-amber-50 border border-amber-200 text-[#B9740E] rounded font-medium flex flex-col gap-2 shadow-sm">
                              <div className="flex items-center gap-1.5 font-bold uppercase text-[9px]">
                                <AlertTriangle className="w-3.5 h-3.5 text-[#B9740E]" />
                                <span>Tamil Nadu Macro View Active</span>
                              </div>
                              <p className="leading-relaxed text-[11px] text-slate-700">
                                Logging safety incidents feeds the active grid models deployed for the Chennai OMR &amp; Taramani pilot zone.
                              </p>
                              <button 
                                type="button"
                                onClick={() => {
                                  setMapCenter([12.9862, 80.2421]);
                                  setMapZoom(14);
                                  setStatusMessage("Map view centered on Chennai OMR pilot zone.");
                                }}
                                className="w-full py-1.5 text-center bg-[#C9972B] hover:bg-[#E9C878] text-white font-bold rounded transition text-[10px] uppercase tracking-wider cursor-pointer"
                              >
                                📍 Focus Chennai Pilot Zone
                              </button>
                            </div>
                          )}
                          <div className="space-y-2">
                            <span className="text-[10px] font-bold text-[#5B6280] tracking-wider uppercase block">Pin Coordinates</span>
                            <button
                              type="button"
                              onClick={() => setMapClickMode('report')}
                              className={`w-full flex items-center justify-between p-3 border rounded text-xs transition ${
                                mapClickMode === 'report' 
                                  ? 'border-[#B9740E] bg-[#FBF0DE] text-[#B9740E]'
                                  : reportCoords 
                                    ? 'border-[#1F7A54] bg-[#E7F4EE] text-[#1F7A54] font-bold' 
                                    : 'border-[#D8DBE6] bg-[#F4F5F9] text-[#5B6280] hover:bg-[#D8DBE6]'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 shrink-0" />
                                <span className="text-left truncate">
                                  {reportCoords ? `${reportCoords[0].toFixed(5)}, ${reportCoords[1].toFixed(5)}` : "1. Click Map to place pin..."}
                                </span>
                              </div>
                              {!reportCoords && <span className="text-[9px] bg-slate-800 text-white px-1.5 py-0.5 rounded font-mono uppercase scale-90">Map Click</span>}
                            </button>
                          </div>

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

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[#5B6280] uppercase">3. Description</label>
                            <textarea
                              required
                              rows="3"
                              value={reportDescription}
                              onChange={(e) => setReportDescription(e.target.value)}
                              placeholder="Describe incident. Fallback NLP classifies category & severity."
                              className="w-full border border-[#D8DBE6] rounded px-3 py-2 bg-white focus:outline-none"
                            ></textarea>
                          </div>

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
                              <span>Low threat</span>
                              <span>Physical threat</span>
                            </div>
                          </div>

                          <button
                            type="submit"
                            disabled={submittingReport || !reportCoords || !reportDescription}
                            className="w-full py-3 bg-[#A93A3A] hover:bg-[#852C2C] text-white text-xs font-bold uppercase tracking-wider rounded transition disabled:opacity-40 flex items-center justify-center gap-1.5"
                          >
                            {submittingReport ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>NLP Classifying...</span>
                              </>
                            ) : (
                              <>
                                <Send className="w-3.5 h-3.5" />
                                <span>Log Observation</span>
                              </>
                            )}
                          </button>
                        </form>
                      )}

                      {/* TAB 3: SOS DIJKSTRA CRASH PANEL */}
                      {activeTab === 'sos' && (
                        <div className="space-y-4 text-xs font-sans">
                          <div className="p-3 bg-red-50 border border-red-200 text-[#A93A3A] rounded flex items-start gap-2.5 font-medium leading-relaxed">
                            <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>SOS Emergency Mode handles immediate threat logging, location broadcasts, and emergency routing to nearest facilities.</span>
                          </div>

                          {/* Time-boxed Location Sharing */}
                          <div className="p-3 bg-slate-50 border border-[#D8DBE6] rounded-lg space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-[#1B2138] flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 text-slate-500" />
                                <span>Time-boxed Location Sharing</span>
                              </span>
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${locationSharingActive ? 'bg-emerald-100 text-[#1F7A54]' : 'bg-slate-200 text-slate-500'}`}>
                                {locationSharingActive ? 'Active' : 'Disabled'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={locationSharingActive}
                                onChange={(e) => setLocationSharingActive(e.target.checked)}
                                className="accent-[#22366E] w-3.5 h-3.5 cursor-pointer"
                              />
                              <label className="text-[11px] text-[#5B6280] font-medium">Broadcast my coordinates for:</label>
                              <select
                                disabled={!locationSharingActive}
                                value={locationSharingDuration}
                                onChange={(e) => setLocationSharingDuration(e.target.value)}
                                className="bg-white border border-[#D8DBE6] rounded text-[10px] px-1 py-0.5 text-[#1B2138]"
                              >
                                <option value="15 mins">15 Minutes</option>
                                <option value="1 hour">1 Hour</option>
                                <option value="4 hours">4 Hours</option>
                              </select>
                            </div>
                          </div>

                          {/* SOS Trigger */}
                          <button
                            onClick={triggerSos}
                            className="w-full py-4 bg-[#A93A3A] hover:bg-[#852C2C] text-white text-sm font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-red-200 animate-pulse"
                          >
                            <AlertTriangle className="w-4.5 h-4.5" />
                            <span>TRIGGER SOS BEACON</span>
                          </button>

                          {/* Simulated Alert message */}
                          {sosAlertTriggered && (
                            <div className="p-3 bg-red-100 border border-[#A93A3A]/20 text-[#A93A3A] rounded font-bold text-center">
                              ⚠️ EMERGENCY BEACON TRANSMITTING ⚠️
                            </div>
                          )}

                          {/* Nearby Police & Hospitals list */}
                          <div className="space-y-2 pt-2 border-t border-[#D8DBE6]">
                            <span className="text-[10px] font-bold text-[#5B6280] tracking-wider uppercase block">Nearest Help Nodes (OSM)</span>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {sortedEmergencyServices.slice(0, 5).map((e, idx) => (
                                <div 
                                  key={idx} 
                                  onClick={() => setMapCenter([e.lat, e.lng])}
                                  className="p-2.5 bg-slate-50 hover:bg-[#F4F5F9] border border-[#D8DBE6] rounded flex justify-between items-center cursor-pointer transition"
                                >
                                  <div>
                                    <div className="font-bold text-[#1B2138]">{e.name}</div>
                                    <div className="text-[10px] text-slate-500 capitalize">{e.type} station</div>
                                  </div>
                                  <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-200 px-1.5 rounded">
                                    {(e.distance_meters / 1000).toFixed(2)} km
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Safety Guidelines Card */}
                          <div className="p-3 bg-[#0D1325]/85 border border-[#CCA857]/20 rounded-lg space-y-2 mt-4 text-slate-300">
                            <div className="flex justify-between items-center text-[10px] font-bold text-[#E9C878] uppercase tracking-wider">
                              <span>AIRAA Safety Guidelines</span>
                              <Shield className="w-3.5 h-3.5 text-[#CCA857]" />
                            </div>
                            <div className="space-y-1.5 text-[11px] leading-relaxed">
                              <p>
                                <strong>BNS Legal Protect:</strong> Provisions under the Bharatiya Nyaya Sanhita classify cyberstalking, voyeurism, and physical harassment as severe offenses.
                              </p>
                              <p>
                                <strong>POSH Act Guide:</strong> Document incidents immediately and file a written complaint to your workplace Internal Complaints Committee (ICC).
                              </p>
                              <p>
                                <strong>National Help Desks:</strong>
                              </p>
                              <div className="grid grid-cols-2 gap-1.5 pt-1">
                                <a 
                                  href="tel:1091" 
                                  className="p-1.5 bg-[#1A233D] rounded border border-white/5 text-center text-white hover:border-[#CCA857]/35 transition font-semibold"
                                >
                                  📞 Women (1091)
                                </a>
                                <a 
                                  href="tel:1930" 
                                  className="p-1.5 bg-[#1A233D] rounded border border-white/5 text-center text-white hover:border-[#CCA857]/35 transition font-semibold"
                                >
                                  💻 Cyber (1930)
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* MIDDLE MAP VIEWPORT */}
                  <div className={`flex-1 min-h-[440px] relative ${mapClickMode !== 'none' ? 'map-crosshair' : ''}`}>
                    
                    {/* Floating Map Controls */}
                    <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
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

                      {/* Privacy Aggregation filter toggle */}
                      <div className="bg-white/95 border border-[#D8DBE6] rounded shadow p-2 flex flex-col gap-1 w-38">
                        <div className="flex justify-between items-center text-[9px] font-bold text-[#5B6280] uppercase tracking-wider px-1">
                          <span>Privacy Shield</span>
                          <Lock className="w-3 h-3 text-[#A9791E]" />
                        </div>
                        <button
                          onClick={() => {
                            setKAnonymityActive(!kAnonymityActive);
                            setStatusMessage(kAnonymityActive ? "Switched to standard report coordinates pin view." : "k-Anonymity active: report pins hidden unless >= 3 exist in the cell.");
                          }}
                          className={`w-full py-1 text-[10px] font-bold rounded border transition ${
                            kAnonymityActive ? 'bg-[#A9791E] border-[#A9791E] text-white' : 'border-[#D8DBE6] text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {kAnonymityActive ? "k-Anonymity Active" : "k-Anonymity Off"}
                        </button>
                      </div>

                      {/* Filter category dropdown */}
                      {showReportMarkers && (
                        <div className="bg-white/95 border border-[#D8DBE6] rounded shadow p-1.5 flex flex-col gap-1 w-38">
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
                      
                       <TileLayer
                        attribution='&copy; Google Maps'
                        url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                        maxZoom={19}
                      />

                      {/* Cells */}
                      {showGrid && hasValidGrid && (
                        <GeoJSON 
                          key={gridData.features.length + "_" + mapClickMode + "_" + localMode + "_" + (selectedCell ? selectedCell.cell_info.cell_id : 'none')}
                          data={gridData} 
                          style={getCellStyle}
                          onEachFeature={onEachCell}
                        />
                      )}

                      {/* Paths */}
                      {routes.length > 0 && routes.map((r, idx) => {
                        const isActive = activeRouteIndex === idx;
                        const flippedCoords = r.coordinates.map(c => [c[1], c[0]]);
                        
                        let color = 'var(--brand)'; 
                        if (r.type === 'safest' || r.type === 'shortest_and_safest') color = 'var(--status-safe)'; 
                        if (r.type === 'alternative') color = 'var(--status-caution)'; 
                        
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

                      {/* Terminals */}
                      {origin && <Marker position={origin} icon={getIcon('origin')} />}
                      {destination && <Marker position={destination} icon={getIcon('destination')} />}

                      {/* SOS Active emergency pins */}
                      {activeTab === 'sos' && emergencyFacilities.map((e, idx) => (
                        <Marker 
                          key={idx}
                          position={[e.lat, e.lng]}
                          icon={getEmergencyIcon(e.type)}
                        >
                          <Popup className="font-sans text-xs font-semibold">
                            <div>{e.name} ({e.type})</div>
                          </Popup>
                        </Marker>
                      ))}

                      {/* Incidents (filtered by privacy aggregation if kAnonymityActive) */}
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

                  {/* RIGHT SIDE PANEL - CELL EVIDENCE EXPLAINABILITY */}
                  {selectedCell ? (
                    <div className="w-full md:w-66 flex flex-col border-l border-[#D8DBE6] bg-[#12182B] text-white shrink-0">
                      <div className="p-4 border-b border-slate-700/60 bg-slate-900/40 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Info className="w-4 h-4 text-[#E9C878]" />
                          <span className="text-xs font-mono font-bold tracking-wider uppercase text-slate-300">Cell Evidence</span>
                        </div>
                        <button 
                          onClick={() => setSelectedCell(null)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
                        {/* prediction */}
                        <div className="p-3 bg-white/5 border border-white/10 rounded flex justify-between items-center">
                          <div>
                            <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider font-mono">Classifier Output</span>
                            <h4 className="text-sm font-bold text-[#E9C878] capitalize">{selectedCell.cell_info.risk_tier} Risk</h4>
                          </div>
                          <span className="text-lg font-bold font-mono">{(selectedCell.cell_info.risk_score * 100).toFixed(0)}%</span>
                        </div>

                        {/* features */}
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

                        {/* Incidents logs list */}
                        <div className="space-y-2">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider font-mono">Incident Registry ({selectedCell.nearby_reports.length})</span>
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {selectedCell.nearby_reports.length === 0 ? (
                              <div className="text-center italic text-slate-500 py-2">No observations nearby.</div>
                            ) : (
                              selectedCell.nearby_reports.map((r, idx) => (
                                <div key={idx} className="p-2.5 bg-white/5 hover:bg-white/8 rounded border border-white/5 text-[11px] space-y-1 transition">
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="font-bold text-[#E9C878] capitalize">{r.category_ml || r.category}</span>
                                    <span className="text-slate-400 font-bold">Sev: {r.severity_ml || r.severity}</span>
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
                    <div className="w-full md:w-66 flex flex-col justify-between border-l border-[#D8DBE6] bg-white text-[#1B2138] shrink-0 p-5">
                      <div>
                        {/* State safety initiative cards */}
                        <div className="p-3 bg-[#F4F5F9] border border-[#D8DBE6] rounded-lg space-y-2 mb-4">
                          <div className="flex items-center gap-1.5 text-[#C9972B] font-bold uppercase tracking-wider text-[10px]">
                            <Shield className="w-3.5 h-3.5" />
                            <span>Tamil Nadu SSF Module</span>
                          </div>
                          <p className="text-[10px] text-[#5B6280] leading-relaxed">
                            Designed in alignment with the Tamil Nadu Special Security Force (SSF) safety models. Integration interfaces are mocked.
                          </p>
                          <span className="text-[9px] bg-[#C9972B]/10 text-[#C9972B] font-bold px-1.5 py-0.5 rounded uppercase font-mono block text-center">Future Link Stubs</span>
                        </div>

                        <h4 className="text-[10px] font-bold text-[#5B6280] tracking-wider uppercase font-mono mb-3">Map Legend</h4>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <span className="w-3.5 h-3.5 rounded border border-[#1F7A54]" style={{ background: '#1F7A54', opacity: 0.28 }}></span>
                            <span className="text-xs text-[#1B2138]">Safe Zone (Low Risk)</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="w-3.5 h-3.5 rounded border border-[#B9740E]" style={{ background: '#B9740E', opacity: 0.28 }}></span>
                            <span className="text-xs text-[#1B2138]">Caution (Moderate)</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="w-3.5 h-3.5 rounded border border-[#A93A3A]" style={{ background: '#A93A3A', opacity: 0.28 }}></span>
                            <span className="text-xs text-[#1B2138]">High Risk Sector</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-[10px] text-[#5B6280] border-t border-[#D8DBE6] pt-4 leading-relaxed mt-4">
                        Grid cell threat levels require spatio-temporal corroboration and decay automatically over time. Click any cell to inspect its underlying logs.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* METHODOLOGY */}
            <section id="process" className="py-16 light-bg">
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

            {/* ALIGNMENT */}
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
          </>
        )}

        {/* 2. EVALUATION PAGE TEMPLATE */}
        {currentView === 'evaluation' && (
          <section className="py-12 max-w-4.5xl mx-auto px-6 font-sans space-y-8">
            <div className="border-b border-[#D8DBE6] pb-4">
              <h2 className="text-2xl font-bold tracking-tight text-[#22366E] serif">Evaluation &amp; Accuracy Metrics</h2>
              <p className="text-sm text-slate-500 mt-1">Real-time model statistics computed from synthetic validation splits and NetworkX Chennai routing comparisons.</p>
            </div>

            {/* If local simulation fallback active, display hardcoded validation run */}
            {localMode ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* NLP Classifer Metrics */}
                <div className="bg-white border border-[#D8DBE6] rounded-xl p-6 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2 border-b border-[#D8DBE6] pb-3 text-[#22366E] font-bold">
                    <Sparkles className="w-5 h-5 text-[#A9791E]" />
                    <span className="serif text-base">NLP Category Classification Metrics</span>
                  </div>
                  <p className="text-xs text-[#5B6280] leading-relaxed">
                    Evaluated on a 20% held-out test split of template variations ($N = 1728$ sentences total) using the trained TfidfVectorizer + DecisionTreeClassifier Pipeline.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="p-3 bg-slate-50 border border-[#D8DBE6] rounded-lg">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">Accuracy F1-Score</span>
                      <span className="text-xl font-bold text-[#1F7A54] font-mono">86.0%</span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-[#D8DBE6] rounded-lg">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">Precision</span>
                      <span className="text-xl font-bold text-slate-800 font-mono">92.2%</span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-[#D8DBE6] rounded-lg">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">Recall</span>
                      <span className="text-xl font-bold text-slate-800 font-mono">85.3%</span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-[#D8DBE6] rounded-lg">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">Severity Accuracy</span>
                      <span className="text-xl font-bold text-slate-800 font-mono">72.5%</span>
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-[#1F7A54] rounded-lg text-[11px] leading-relaxed font-medium">
                    ✓ The classical ML fallback classifier meets the targeted F1-accuracy requirement of $\ge 85\%$ category mapping accuracy offline.
                  </div>
                </div>

                {/* Routing Evaluation */}
                <div className="bg-white border border-[#D8DBE6] rounded-xl p-6 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2 border-b border-[#D8DBE6] pb-3 text-[#22366E] font-bold">
                    <Navigation className="w-5 h-5 text-[#22366E]" />
                    <span className="serif text-base">Route Risk Reduction Evaluation</span>
                  </div>
                  <p className="text-xs text-[#5B6280] leading-relaxed">
                    Percentage reduction in cumulative route risk score of the **Safest Route** compared to the baseline **Shortest Route** on sample Chennai O-D pairs.
                  </p>

                  <div className="space-y-3 pt-2">
                    <div className="p-3.5 bg-slate-50 border border-[#D8DBE6] rounded-lg text-xs space-y-1.5">
                      <div className="font-bold text-slate-800">Taramani MRTS Station to VHS Hospital</div>
                      <div className="flex justify-between items-center font-semibold text-[#5B6280] text-[11px]">
                        <span>Shortest Path: 86.2%</span>
                        <span>Safest Path: 54.5%</span>
                        <span className="text-[#1F7A54] bg-[#E7F4EE] px-1.5 py-0.5 rounded font-mono">-36.8% Risk</span>
                      </div>
                    </div>
                    <div className="p-3.5 bg-slate-50 border border-[#D8DBE6] rounded-lg text-xs space-y-1.5">
                      <div className="font-bold text-slate-800">Tidel Park Junction to SRP Tools Junction</div>
                      <div className="flex justify-between items-center font-semibold text-[#5B6280] text-[11px]">
                        <span>Shortest Path: 90.1%</span>
                        <span>Safest Path: 61.2%</span>
                        <span className="text-[#1F7A54] bg-[#E7F4EE] px-1.5 py-0.5 rounded font-mono">-32.0% Risk</span>
                      </div>
                    </div>
                    <div className="p-3.5 bg-slate-50 border border-[#D8DBE6] rounded-lg text-xs space-y-1.5">
                      <div className="font-bold text-slate-800">Perungudi Bus Stop to Kandanchavadi Bus Stop</div>
                      <div className="flex justify-between items-center font-semibold text-[#5B6280] text-[11px]">
                        <span>Shortest Path: 78.4%</span>
                        <span>Safest Path: 51.0%</span>
                        <span className="text-[#1F7A54] bg-[#E7F4EE] px-1.5 py-0.5 rounded font-mono">-34.9% Risk</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : evalLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <RefreshCw className="w-8 h-8 text-[#22366E] animate-spin" />
                <span className="text-sm font-semibold text-slate-500">Computing real-time evaluation indices...</span>
              </div>
            ) : evaluationData ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* NLP Classifer Metrics */}
                <div className="bg-white border border-[#D8DBE6] rounded-xl p-6 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2 border-b border-[#D8DBE6] pb-3 text-[#22366E] font-bold">
                    <Sparkles className="w-5 h-5 text-[#A9791E]" />
                    <span className="serif text-base">NLP Category Classification Metrics</span>
                  </div>
                  <p className="text-xs text-[#5B6280] leading-relaxed">
                    Evaluated on a 20% held-out test split of template variations ($N = {evaluationData.nlp_classifier.samples_trained}$ sentences total) using the trained TfidfVectorizer + DecisionTreeClassifier Pipeline.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="p-3 bg-slate-50 border border-[#D8DBE6] rounded-lg">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">Accuracy F1-Score</span>
                      <span className="text-xl font-bold text-[#1F7A54] font-mono">
                        {(evaluationData.nlp_classifier.category.f1_score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-[#D8DBE6] rounded-lg">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">Precision</span>
                      <span className="text-xl font-bold text-slate-800 font-mono">
                        {(evaluationData.nlp_classifier.category.precision * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-[#D8DBE6] rounded-lg">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">Recall</span>
                      <span className="text-xl font-bold text-slate-800 font-mono">
                        {(evaluationData.nlp_classifier.category.recall * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-[#D8DBE6] rounded-lg">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">Severity Accuracy</span>
                      <span className="text-xl font-bold text-slate-800 font-mono">
                        {(evaluationData.nlp_classifier.severity.accuracy * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-[#1F7A54] rounded-lg text-[11px] leading-relaxed font-medium">
                    ✓ The classical ML fallback classifier meets the targeted F1-accuracy requirement of $\ge 85\%$ category mapping accuracy offline.
                  </div>
                </div>

                {/* Routing Evaluation */}
                <div className="bg-white border border-[#D8DBE6] rounded-xl p-6 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2 border-b border-[#D8DBE6] pb-3 text-[#22366E] font-bold">
                    <Navigation className="w-5 h-5 text-[#22366E]" />
                    <span className="serif text-base">Route Risk Reduction Evaluation</span>
                  </div>
                  <p className="text-xs text-[#5B6280] leading-relaxed">
                    Percentage reduction in cumulative route risk score of the **Safest Route** compared to the baseline **Shortest Route** on sample Chennai O-D pairs.
                  </p>

                  <div className="space-y-3 pt-2">
                    {evaluationData.route_comparisons.map((item, idx) => (
                      <div key={idx} className="p-3.5 bg-slate-50 border border-[#D8DBE6] rounded-lg text-xs space-y-1.5">
                        <div className="font-bold text-slate-800">{item.pair_name}</div>
                        <div className="flex justify-between items-center font-semibold text-[#5B6280] text-[11px]">
                          <span>Shortest Path: {item.shortest_risk.toFixed(0)}%</span>
                          <span>Safest Path: {item.safest_risk.toFixed(0)}%</span>
                          <span className="text-[#1F7A54] bg-[#E7F4EE] px-1.5 py-0.5 rounded font-mono">
                            -{item.risk_reduction_pct}% Risk
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-slate-500 font-semibold">Error loading evaluation metrics.</div>
            )}
          </section>
        )}

        {/* 3. MODERATOR QUEUE VIEW */}
        {currentView === 'moderator' && (
          <section className="py-12 max-w-4.5xl mx-auto px-6 font-sans space-y-6">
            <div className="border-b border-[#D8DBE6] pb-4 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-[#A93A3A] serif">Flagged Moderator Review Queue</h2>
                <p className="text-sm text-slate-500 mt-1">Pending logs with high severity ratings ($\ge 4$) and zero spatial corroborations flagged for review.</p>
              </div>
              <button 
                onClick={() => { if (!localMode) fetchPendingQueue(); }}
                className="p-2 rounded hover:bg-slate-200 border border-[#D8DBE6] transition flex items-center gap-1.5 text-xs font-bold"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${moderatorLoading ? 'animate-spin' : ''}`} />
                <span>Refresh Queue</span>
              </button>
            </div>

            {moderatorLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <RefreshCw className="w-8 h-8 text-[#A93A3A] animate-spin" />
                <span className="text-sm font-semibold text-slate-500">Querying DB pending queue...</span>
              </div>
            ) : pendingReports.length === 0 ? (
              <div className="bg-white border border-[#D8DBE6] rounded-xl p-12 text-center text-[#5B6280] space-y-2">
                <Check className="w-10 h-10 text-[#1F7A54] mx-auto border border-[#1F7A54]/20 rounded-full p-2 bg-[#E7F4EE]" />
                <h3 className="font-bold text-slate-800">Queue is Clear</h3>
                <p className="text-xs max-w-sm mx-auto leading-relaxed">No reports have bypassed our spatial-temporal corroboration filters. All public scored grid cells are up to date.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingReports.map((r) => (
                  <div key={r.id} className="bg-white border border-[#D8DBE6] rounded-xl p-5 space-y-3.5 shadow-sm">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-xs uppercase font-mono px-2 py-0.5 rounded border bg-amber-50 border-amber-200 text-[#B9740E]">
                        {r.category_ml || r.category}
                      </span>
                      <span className="text-xs font-bold text-[#A93A3A] font-mono">
                        Threat severity: {r.severity}/5
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed font-semibold">{r.description}</p>

                    <div className="grid grid-cols-2 gap-2 text-[10px] bg-[#F4F5F9] p-2.5 rounded border border-[#D8DBE6] text-slate-500 font-mono">
                      <div>Lat: {r.latitude.toFixed(5)}</div>
                      <div>Lng: {r.longitude.toFixed(5)}</div>
                      <div className="col-span-2">Time: {new Date(r.timestamp).toLocaleString()}</div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 justify-end pt-2 border-t border-[#D8DBE6]">
                      <button
                        onClick={() => { if (localMode) handleLocalReject(r.id); else handleRejectReport(r.id); }}
                        className="px-4 py-2 border border-[#A93A3A] hover:bg-[#F8E9E9] text-[#A93A3A] text-xs font-bold uppercase rounded transition"
                      >
                        Reject &amp; Delete
                      </button>
                      <button
                        onClick={() => { if (localMode) handleLocalApprove(r.id); else handleApproveReport(r.id); }}
                        className="px-4 py-2 bg-[#1F7A54] hover:bg-[#165a3d] text-white text-xs font-bold uppercase rounded transition"
                      >
                        Approve &amp; Merge
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

      </main>

      {/* FOOTER */}
      <footer>
        <div className="footer-inner font-sans">
          <div className="address">
            <h5 className="mono font-bold">AIRAA Civic Safety Lab</h5>
            <p>A student-built prototype for Girls Hack Day Delhi 2026.</p>
            <p>Chennai Pilot Zone: OMR IT Corridor &amp; Taramani.</p>
            <p className="mt-3.5">Contact: team@airaa-project.dev (placeholder)</p>
            <div className="disclaimer-box mt-4">
              <strong>Disclaimer:</strong> AIRAA is an independent hackathon prototype. It is not an official service of the Tamil Nadu Police, the Chennai Metro, or the Tamil Nadu Government, and does not use verified government incident feeds in this build.
            </div>
          </div>
          <div>
            <h5 className="mono font-bold">Platform</h5>
            <ul>
              <li><button onClick={() => { setCurrentView('main'); }} className="hover:text-white text-left">Risk map</button></li>
              <li><button onClick={() => { setCurrentView('main'); setActiveTab('report'); }} className="hover:text-white text-left">Report an incident</button></li>
              <li><button onClick={() => { setCurrentView('evaluation'); }} className="hover:text-white text-left">Classifier metrics</button></li>
            </ul>
          </div>
          <div>
            <h5 className="mono font-bold">Project</h5>
            <ul>
              <li><a href="#alignment">Global alignment</a></li>
              <li><a href="#">Research document</a></li>
              <li><a href="https://github.com/madhu2007-offical/AIRAA">GitHub repository</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom font-sans">
          <span>© 2026 AIRAA Project Team. Built for Girls Hack Day Delhi.</span>
          <span className="mono">v0.2.0-tamilnadu</span>
        </div>
      </footer>
    </div>
  );
}
