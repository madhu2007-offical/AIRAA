import os
import math
import logging
import networkx as nx
import osmnx as ox
from typing import List, Dict, Any, Tuple

logger = logging.getLogger(__name__)

# Bounding box configuration
BBOX = {
    "south": 28.535,
    "west": 77.185,
    "north": 28.570,
    "east": 77.225
}

GRAPH_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "pilot_zone_graph.graphml")

# Grid mapping details
LAT_STEP = 0.0010
LNG_STEP = 0.0011
NUM_COLS = int(math.ceil((BBOX["east"] - BBOX["west"]) / LNG_STEP))

def get_cell_id_for_coord(lat: float, lng: float) -> int:
    """
    Finds the grid cell ID containing a given latitude and longitude.
    """
    col = int((lng - BBOX["west"]) / LNG_STEP)
    row = int((lat - BBOX["south"]) / LAT_STEP)
    
    # Clip to bounds
    col = max(0, min(col, NUM_COLS - 1))
    # Calculate row count
    num_rows = int(math.ceil((BBOX["north"] - BBOX["south"]) / LAT_STEP))
    row = max(0, min(row, num_rows - 1))
    
    return row * NUM_COLS + col

def get_graph() -> nx.MultiDiGraph:
    """
    Loads the street graph from cache or downloads from OSM via OSMnx.
    Falls back to a synthetic grid-network if OSM is unavailable.
    """
    os.makedirs(os.path.dirname(GRAPH_PATH), exist_ok=True)
    
    if os.path.exists(GRAPH_PATH):
        try:
            logger.info("Loading street network from cache...")
            G = ox.load_graphml(filepath=GRAPH_PATH)
            return G
        except Exception as e:
            logger.error(f"Failed to load cached graph: {e}. Re-downloading.")

    try:
        logger.info("Downloading street network from OpenStreetMap via OSMnx...")
        # Bounding box tuple is (west, south, east, north) - i.e. left, bottom, right, top
        bbox_tuple = (BBOX["west"], BBOX["south"], BBOX["east"], BBOX["north"])
        G = ox.graph_from_bbox(
            bbox=bbox_tuple,
            network_type="walk"
        )
        # Save cache
        ox.save_graphml(G, filepath=GRAPH_PATH)
        logger.info(f"Saved street network graph to cache: {GRAPH_PATH}")
        return G
    except Exception as e:
        logger.error(f"Could not fetch network from OSM: {e}. Building synthetic grid graph fallback.")
        return build_synthetic_grid_graph()

def build_synthetic_grid_graph() -> nx.MultiDiGraph:
    """
    Builds a synthetic grid graph covering the pilot zone.
    Used as an offline/no-network fallback.
    """
    G = nx.MultiDiGraph()
    # OSMnx nearest_nodes expects a CRS to perform distance/projection logic
    G.graph['crs'] = 'epsg:4326'
    
    # Grid coordinates
    lat_steps = 15
    lng_steps = 15
    
    lats = [BBOX["south"] + i * (BBOX["north"] - BBOX["south"]) / (lat_steps - 1) for i in range(lat_steps)]
    lngs = [BBOX["west"] + j * (BBOX["east"] - BBOX["west"]) / (lng_steps - 1) for j in range(lng_steps)]
    
    # Add nodes
    node_id_map = {}
    node_counter = 0
    for r in range(lat_steps):
        for c in range(lng_steps):
            nid = node_counter
            G.add_node(nid, y=lats[r], x=lngs[c], osmid=nid)
            node_id_map[(r, c)] = nid
            node_counter += 1
            
    # Add edges with flat earth lengths
    for r in range(lat_steps):
        for c in range(lng_steps):
            u = node_id_map[(r, c)]
            lat_u = G.nodes[u]['y']
            lng_u = G.nodes[u]['x']
            
            # Connections (right, down, diagonal down-right, diagonal down-left)
            directions = [(0, 1), (1, 0), (1, 1), (1, -1)]
            for dr, dc in directions:
                nr, nc = r + dr, c + dc
                if 0 <= nr < lat_steps and 0 <= nc < lng_steps:
                    v = node_id_map[(nr, nc)]
                    lat_v = G.nodes[v]['y']
                    lng_v = G.nodes[v]['x']
                    
                    # Calculate distance
                    lat_mid = math.radians((lat_u + lat_v) * 0.5)
                    dy = (lat_u - lat_v) * 111000.0
                    dx = (lng_u - lng_v) * 111000.0 * math.cos(lat_mid)
                    dist = math.sqrt(dx*dx + dy*dy)
                    
                    # Add bidirectional edges
                    G.add_edge(u, v, length=dist, highway="residential", oneway=False)
                    G.add_edge(v, u, length=dist, highway="residential", oneway=False)
                    
    logger.info("Successfully built synthetic grid network fallback.")
    return G

def update_edge_weights(G: nx.MultiDiGraph, scored_cells: List[Dict[str, Any]], risk_weight: float = 5.0) -> nx.MultiDiGraph:
    """
    Annotates graph edges with a 'safety_weight' based on length and intersecting grid cells' risk scores.
    """
    # Create cell-to-risk lookup dictionary
    cell_risks = {cell["cell_id"]: cell["risk_score"] for cell in scored_cells}
    
    # Iterate through all edges
    for u, v, k, data in G.edges(keys=True, data=True):
        # Edge midpoint coordinates
        node_u = G.nodes[u]
        node_v = G.nodes[v]
        
        lat_mid = (node_u['y'] + node_v['y']) / 2.0
        lng_mid = (node_u['x'] + node_v['x']) / 2.0
        
        cell_id = get_cell_id_for_coord(lat_mid, lng_mid)
        risk_score = cell_risks.get(cell_id, 0.0)
        
        distance = data.get("length", 10.0)
        
        # Edge weight = distance * (1 + risk_weight * risk_score)
        safety_weight = distance * (1.0 + risk_weight * risk_score)
        
        data["safety_weight"] = safety_weight
        data["risk_score"] = risk_score
        
    return G

def get_route_coordinates(G: nx.MultiDiGraph, path_nodes: List[Any]) -> List[List[float]]:
    """
    Converts a node path list into an array of [lng, lat] coordinate pairs.
    """
    coords = []
    for node in path_nodes:
        coords.append([G.nodes[node]['x'], G.nodes[node]['y']])
    return coords

def compute_route_metrics(G: nx.MultiDiGraph, path_nodes: List[Any]) -> Dict[str, Any]:
    """
    Computes total distance, average risk score, and estimated travel time (at 1.2 m/s).
    """
    total_distance = 0.0
    weighted_risk_sum = 0.0
    
    for i in range(len(path_nodes) - 1):
        u = path_nodes[i]
        v = path_nodes[i+1]
        
        # Get edge data (choose shortest edge if multiple exist between u and v)
        edges = G.get_edge_data(u, v)
        if edges:
            edge_data = min(edges.values(), key=lambda e: e.get("length", 999.0))
            dist = edge_data.get("length", 0.0)
            risk = edge_data.get("risk_score", 0.0)
            
            total_distance += dist
            weighted_risk_sum += risk * dist
            
    avg_risk = (weighted_risk_sum / total_distance) if total_distance > 0 else 0.0
    walking_speed = 1.2  # 1.2 meters per second
    time_minutes = (total_distance / walking_speed) / 60.0
    
    return {
        "distance_meters": round(total_distance, 1),
        "duration_minutes": round(time_minutes, 1),
        "average_risk": round(avg_risk * 100, 1)  # Scale to 0-100 for user display
    }

def find_routes(origin: Tuple[float, float], destination: Tuple[float, float], scored_cells: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Calculates three routes between origin and destination:
    1. Shortest Path (by distance)
    2. Safest Path (by risk weight)
    3. Alternative Path (by temporarily blocking nodes on the safest path)
    """
    G = get_graph()
    G = update_edge_weights(G, scored_cells)
    
    lat_org, lng_org = origin
    lat_dst, lng_dst = destination
    
    try:
        # Get nearest nodes
        orig_node = ox.nearest_nodes(G, X=lng_org, Y=lat_org)
        dest_node = ox.nearest_nodes(G, X=lng_dst, Y=lat_dst)
    except Exception as e:
        logger.error(f"Error finding nearest nodes: {e}")
        return []
        
    routes = []
    
    # 1. Shortest Path
    try:
        path_shortest = nx.shortest_path(G, orig_node, dest_node, weight="length")
        metrics_shortest = compute_route_metrics(G, path_shortest)
        routes.append({
            "name": "Shortest Route",
            "type": "shortest",
            "coordinates": get_route_coordinates(G, path_shortest),
            **metrics_shortest
        })
    except Exception as e:
        logger.warning(f"Failed to find shortest route: {e}")
        
    # 2. Safest Path
    try:
        path_safest = nx.shortest_path(G, orig_node, dest_node, weight="safety_weight")
        metrics_safest = compute_route_metrics(G, path_safest)
        routes.append({
            "name": "Safest Route",
            "type": "safest",
            "coordinates": get_route_coordinates(G, path_safest),
            **metrics_safest
        })
    except Exception as e:
        logger.warning(f"Failed to find safest route: {e}")
        
    # 3. Alternative Route (Safest path with penalised edges to force deviation)
    try:
        if 'path_safest' in locals() and len(path_safest) > 2:
            # Create a copy of G to penalise edges on the safest path
            G_temp = G.copy()
            for i in range(len(path_safest) - 1):
                u = path_safest[i]
                v = path_safest[i+1]
                edges = G_temp.get_edge_data(u, v)
                if edges:
                    for k in edges:
                        G_temp[u][v][k]["safety_weight"] = G_temp[u][v][k].get("safety_weight", 0.0) * 3.0
                        
            path_alt = nx.shortest_path(G_temp, orig_node, dest_node, weight="safety_weight")
            metrics_alt = compute_route_metrics(G, path_alt)
            routes.append({
                "name": "Alternative Safest Route",
                "type": "alternative",
                "coordinates": get_route_coordinates(G, path_alt),
                **metrics_alt
            })
    except Exception as e:
        logger.warning(f"Failed to find alternative route: {e}")
        
    # De-duplicate routes if safest/alternative are identical to shortest
    unique_routes = []
    seen_coords = []
    for r in routes:
        # Check if this route is substantially unique
        coord_hash = str(r["coordinates"][0]) + str(r["coordinates"][-1]) + str(len(r["coordinates"]))
        if coord_hash not in seen_coords:
            seen_coords.append(coord_hash)
            unique_routes.append(r)
        elif r["type"] == "safest":
            # If safest is identical in layout, label it as Safest & Shortest
            for ur in unique_routes:
                if ur["type"] == "shortest":
                    ur["name"] = "Shortest & Safest Route"
                    ur["type"] = "shortest_and_safest"
                    
    return unique_routes
