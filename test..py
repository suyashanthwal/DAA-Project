import geopandas as gpd

# Load points shapefile (traffic light data assumed to be in this file)
traffic_lights_gdf = gpd.read_file("map/shape/natural.shp")

# Check the columns to identify relevant data (e.g., traffic light ID, location)
print(traffic_lights_gdf.columns)