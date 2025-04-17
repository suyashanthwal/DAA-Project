import tkinter as tk
from tkintermapview import TkinterMapView
import networkx as nx
import time
import threading
import math 

places = {
    "ISBT": (30.285, 78.021),
    "ClockTower": (30.325, 78.043),
    "Rajpur": (30.350, 78.080),
    "Survey": (30.310, 78.037),
    "Ballupur": (30.290, 78.013),
    "Subhash": (30.300, 78.030),
}

roads = [
    ("ISBT", "Subhash", 3),
    ("Subhash", "Survey", 2),
    ("Survey", "ClockTower", 1),
    ("ClockTower", "Rajpur", 3),
    ("Survey", "Ballupur", 3),
    ("Ballupur", "ISBT", 4),
]

graph = nx.Graph()
for place in places:
    graph.add_node(place, pos=places[place])
for road in roads:
    point1, point2, cost = road
    graph.add_edge(point1, point2, weight=cost)


window = tk.Tk()
window.title("Emergency Map")
window.geometry("900x700")

mapview = TkinterMapView(window, width=900, height=700)
mapview.pack(fill="both", expand=True)
mapview.set_position(30.325, 78.043)
mapview.set_zoom(13)

signals = {}
lines = []


def draw_path(route):
    for line in lines:
        line.delete()
    lines.clear()
    for i in range(len(route)-1):
        point_a = places[route[i]]
        point_b = places[route[i+1]]
        path_line = mapview.set_path([point_a, point_b])
        lines.append(path_line)

def animate_route(route, vehicle):
    for stop in route:
        signals[stop].set_text(f"🟢 {stop}")
        print("Passing:", stop)
        time.sleep(1.5)
        signals[stop].set_text(f"🔴 {stop}")

def add_signals():
    for name in places:
        lat, lon = places[name]
        marker = mapview.set_marker(lat, lon, text=f"🔴 {name}")
        signals[name] = marker


def start_simulation():
    vehicle = vehicle_type.get()
    start = "ISBT"
    end = "Rajpur"
    route = nx.dijkstra_path(graph, start, end, weight="weight")
    draw_path(route)
    thread = threading.Thread(target=animate_route, args=(route, vehicle))
    thread.daemon = True
    thread.start()

vehicle_type = tk.StringVar()
vehicle_type.set("Ambulance")

label = tk.Label(window, text="Vehicle Type:")
label.place(x=10, y=10)

dropdown = tk.OptionMenu(window, vehicle_type, "Ambulance", "Fire Brigade")
dropdown.place(x=110, y=5)

button = tk.Button(window, text="Start Simulation", command=start_simulation)
button.place(x=10, y=40)

add_signals()
window.mainloop()
