import sys
import geopandas as gpd
from PyQt5.QtWebEngineWidgets import QWebEngineView
from PyQt5.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget
import folium
import os
from PyQt5.QtCore import QUrl

class EmergencyMapGUI(QMainWindow):
    def __init__(self):
        super().__init__()

        # Load all shapefiles
        roads_gdf = gpd.read_file("map/shape/roads.shp")
        buildings_gdf = gpd.read_file("map/shape/buildings.shp")
        waterways_gdf = gpd.read_file("map/shape/waterways.shp")
        landuse_gdf = gpd.read_file("map/shape/landuse.shp")
        natural_gdf = gpd.read_file("map/shape/natural.shp")
        places_gdf = gpd.read_file("map/shape/places.shp")
        railways_gdf = gpd.read_file("map/shape/railways.shp")
        points_gdf = gpd.read_file("map/shape/points.shp")

        # Simplify geometries to improve performance
        roads_gdf['geometry'] = roads_gdf.geometry.simplify(tolerance=0.001)
        buildings_gdf['geometry'] = buildings_gdf.geometry.simplify(tolerance=0.001)
        waterways_gdf['geometry'] = waterways_gdf.geometry.simplify(tolerance=0.001)
        landuse_gdf['geometry'] = landuse_gdf.geometry.simplify(tolerance=0.001)
        natural_gdf['geometry'] = natural_gdf.geometry.simplify(tolerance=0.001)
        places_gdf['geometry'] = places_gdf.geometry.simplify(tolerance=0.001)
        railways_gdf['geometry'] = railways_gdf.geometry.simplify(tolerance=0.001)
        points_gdf['geometry'] = points_gdf.geometry.simplify(tolerance=0.001)

        # Initialize Folium map centered on Dehradun
        self.map = folium.Map(
            location=[30.3165, 78.0322],
            zoom_start=13,
            tiles="cartodbdark_matter"
        )

        # Helper function to add a GeoJson layer
        def add_layer(gdf, name, color, fill_opacity=0.4):
            folium.GeoJson(
                gdf.to_json(),
                name=name,
                style_function=lambda x: {
                    'color': color,
                    'weight': 1.5,
                    'fillColor': color,
                    'fillOpacity': fill_opacity
                },
                tooltip=folium.GeoJsonTooltip(fields=['osm_id', 'name', 'type'])
            ).add_to(self.map)

        # Add layers
        add_layer(roads_gdf, "Roads", "#4a7b9d", 0.2)
        add_layer(buildings_gdf, "Buildings", "#ffaa00", 0.5)
        add_layer(waterways_gdf, "Waterways", "#1f78b4", 0.3)
        add_layer(landuse_gdf, "Landuse", "#33a02c", 0.3)
        add_layer(natural_gdf, "Natural", "#66c2a5", 0.3)
        add_layer(places_gdf, "Places", "#e41a1c", 0.3)
        add_layer(railways_gdf, "Railways", "#6a3d9a", 0.3)
        add_layer(points_gdf, "Points", "#ff7f00", 0.3)

        # Add emergency vehicle markers (example locations)
        folium.Marker(
            location=[30.3170, 78.0330],
            popup="Ambulance",
            icon=folium.Icon(color='blue', icon='info-sign')
        ).add_to(self.map)
        folium.Marker(
            location=[30.3150, 78.0340],
            popup="Fire Truck",
            icon=folium.Icon(color='red', icon='fire')
        ).add_to(self.map)

        # Add traffic lights (filter from points)
        traffic_lights_gdf = points_gdf[points_gdf['type'] == 'traffic_light']
        for _, row in traffic_lights_gdf.iterrows():
            lat = row['geometry'].y
            lon = row['geometry'].x
            name = row['name']
            folium.Marker(
                location=[lat, lon],
                popup=f"Traffic Light: {name}",
                icon=folium.Icon(color='green', icon='info-sign')
            ).add_to(self.map)

        # Add layer control
        folium.LayerControl().add_to(self.map)

        # Set up PyQt web view
        self.web_view = QWebEngineView()
        self.map.save("temp_map.html")
        self.web_view.load(QUrl.fromLocalFile(os.path.abspath("temp_map.html")))

        # GUI Layout
        layout = QVBoxLayout()
        layout.addWidget(self.web_view)
        container = QWidget()
        container.setLayout(layout)
        self.setCentralWidget(container)

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = EmergencyMapGUI()
    window.show()
    sys.exit(app.exec_())
