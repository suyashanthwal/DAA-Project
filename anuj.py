import tkinter as tk
from tkinter import ttk

def find_route():
    vehicle = vehicle_type.get()
    source = source_entry.get()
    destination = dest_entry.get()
    # Here you would run Dijkstra and show results
    result_label.config(text=f"Finding route for {vehicle} from {source} to {destination}...")

# Main Window
window = tk.Tk()
window.title("Emergency Vehicle Routing System")
window.geometry("400x300")

# Vehicle Type Dropdown
vehicle_type = ttk.Combobox(window, values=["Ambulance", "Fire Truck", "Normal Car"])
vehicle_type.set("Select Vehicle")
vehicle_type.pack(pady=10)

# Source & Destination
tk.Label(window, text="Source:").pack()
source_entry = tk.Entry(window)
source_entry.pack()

tk.Label(window, text="Destination:").pack()
dest_entry = tk.Entry(window)
dest_entry.pack()

# Find Route Button
tk.Button(window, text="Find Shortest Route", command=find_route).pack(pady=10)

# Output Label
result_label = tk.Label(window, text="")
result_label.pack()

window.mainloop()