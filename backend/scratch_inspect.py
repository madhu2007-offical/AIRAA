import osmnx as ox
import inspect

print("graph_from_bbox signature:")
print(inspect.signature(ox.graph_from_bbox))

print("\nnearest_nodes signature:")
print(inspect.signature(ox.nearest_nodes))
