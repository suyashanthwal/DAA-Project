import sys
import geopandas as gpd
from PyQt5.QtWebEngineWidgets import QWebEngineView
from PyQt5.QtWidgets import (QApplication, QMainWindow, QVBoxLayout,QWidget, QHBoxLayout, QLineEdit, QPushButton)
import folium
import os
from PyQt5.QtCore import QUrl
from folium.plugins import AntPath

class EmergencyMapGUI(QMainWindow):
    def __init__(self):
        super().__init__()
        
        # Create input fields and button
        self.source_input = QLineEdit(placeholderText="Enter source location")
        self.dest_input = QLineEdit(placeholderText="Enter destination")
        self.route_button = QPushButton("Show Route")
        self.route_button.clicked.connect(self.draw_route)

        # Create input layout
        input_layout = QHBoxLayout()
        input_layout.addWidget(self.source_input)
        input_layout.addWidget(self.dest_input)
        input_layout.addWidget(self.route_button)

        # Load map data
        self.roads = gpd.read_file("map/shape/roads.shp")
        self.points = gpd.read_file("map/shape/points.shp")
        self.roads['geometry'] = self.roads.geometry.simplify(0.001)

        # Initialize map
        self.map = folium.Map(location=[30.3165, 78.0322], zoom_start=13)
        self.add_emergency_markers()

        # Setup GUI
        self.web_view = QWebEngineView()
        self.update_map_display()

        main_layout = QVBoxLayout()
        main_layout.addLayout(input_layout)
        main_layout.addWidget(self.web_view)
        
        container = QWidget()
        container.setLayout(main_layout)
        self.setCentralWidget(container)
        self.setWindowTitle("Emergency Map with Routing")

    def add_emergency_markers(self):
        """Add default emergency markers"""
        # Ambulance marker
        folium.Marker(
            location=[30.2723, 78.0011],
            popup="Ambulance Station",
            icon=folium.Icon(color='blue', icon='ambulance')
        ).add_to(self.map)

        # Traffic lights
        traffic_lights = self.points[self.points['type'] == 'traffic_light']
        for _, row in traffic_lights.iterrows():
            folium.Marker(
                location=[row.geometry.y, row.geometry.x],
                popup="Traffic Light",
                icon=folium.Icon(color='green', icon='traffic-light')
            ).add_to(self.map)

    
    def draw_route(self):
        """Get road-based route using OSRM API"""
        import requests

        # For now, use fixed points. Later, get these from user input
        start_point = [30.2723, 78.0011]  # [lat, lon]
        end_point = [30.3489, 77.8886]    # [lat, lon]

        # OSRM expects lon,lat order
        url = f"https://router.project-osrm.org/route/v1/driving/" \
              f"{start_point[1]},{start_point[0]};{end_point[1]},{end_point[0]}?overview=full&geometries=geojson"

        try:
            response = requests.get(url)
            data = response.json()

            if data['code'] == 'Ok':
                # Extract route coordinates
                route_coords = [
                    [lat, lon] for lon, lat in data['routes'][0]['geometry']['coordinates']
                ]
                # Draw the route
                AntPath(
                    locations=route_coords,
                    color='red',
                    weight=5,
                    dash_array=[10, 20]
                ).add_to(self.map)
                self.update_map_display()
            else:
                print("Routing failed:", data.get('message', 'Unknown error'))
        except Exception as e:
            print("Error during routing:", str(e))

    def update_map_display(self): 
        self.map.save("temp_map.html")
        self.web_view.load(QUrl.fromLocalFile(os.path.abspath("temp_map.html")))

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = EmergencyMapGUI()
    window.show()
    sys.exit(app.exec_())
