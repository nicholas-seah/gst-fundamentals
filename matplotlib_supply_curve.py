import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
import ast

# Load the CSV data
df = pd.read_csv("public/mock_offer_curve_data.csv")

# Process data exactly like user's example code
expanded_data = []
for idx, row in df.iterrows():
    curve = row['sced_tpo_offer_curve']
    prev_mw = 0
    
    # Parse curve if it's a string
    if isinstance(curve, str):
        try:
            curve = ast.literal_eval(curve)
        except:
            continue
    
    if not curve:
        continue
    
    for point in curve:
        if len(point) == 2:
            current_mw = point[0]
            price = point[1]
            
            # Calculate incremental MW
            incremental_mw = current_mw - prev_mw
            
            if incremental_mw > 0:  # Only add positive increments
                expanded_data.append({
                    'resource_name': row['resource_name'],
                    'resource_type': row['resource_type'],
                    'interval_start': row['interval_start_utc'],
                    'mw': incremental_mw,  # This is now incremental
                    'price': price,
                    'telemetered_status': row['telemetered_resource_status']
                })
            
            prev_mw = current_mw

curve_df = pd.DataFrame(expanded_data)
curve_df = curve_df[~ curve_df['telemetered_status'].isin(['ONTEST','OFFQS','OFFNS','OFF','OUT','SHUTDOWN'])]

# Filter for generation resources (positive MW)
supply_df = curve_df[curve_df['mw'] > 0].copy()

# Sort by price (merit order)
supply_df = supply_df.sort_values(['price', 'mw'])

# Calculate cumulative capacity
supply_df['cumulative_mw'] = supply_df['mw'].cumsum()

print(f"Processed {len(df)} CSV rows")
print(f"Expanded to {len(expanded_data)} data points")
print(f"After filtering: {len(supply_df)} segments")
print(f"Total capacity: {supply_df['mw'].sum():,.0f} MW")

# Define color mapping for resource types
resource_colors = {
    'WIND': '#32CD32',      # Bright green
    'PVGR': '#FFD700',      # Gold for solar PV
    'SOLAR': '#FFD700',     # Gold for solar
    'HYDRO': '#4169E1',     # Royal blue
    'NUCLEAR': '#8A2BE2',   # Blue violet
    'COAL': '#8B4513',      # Saddle brown
    'GAS': '#FF4500',       # Orange red
    'STEAM': '#FF6347',     # Tomato
    'CC': '#FF8C00',        # Dark orange for combined cycle
    'GT': '#FFA500',        # Orange for gas turbine
    'BIOMASS': '#228B22',   # Forest green
    'LANDFILL': '#556B2F',  # Dark olive green
    'PWRSTR': '#9932CC',    # Dark orchid for power storage/batteries
    'ESR': '#9932CC',       # Dark orchid for energy storage
    'DC': '#FF1493',        # Deep pink for DC tie
    'SYNC_COND': '#708090', # Slate gray
    'OTHER': '#696969',     # Dim gray
    'UNKNOWN': '#A9A9A9'    # Dark gray
}

# Function to get color for resource type
def get_color_for_resource(resource_type):
    # Handle common variations and abbreviations
    resource_type_upper = str(resource_type).upper()
    
    # Direct matches
    if resource_type_upper in resource_colors:
        return resource_colors[resource_type_upper]
    
    # Partial matches for resource types
    if 'WIND' in resource_type_upper:
        return resource_colors['WIND']
    elif 'SOLAR' in resource_type_upper or 'PV' in resource_type_upper:
        return resource_colors['PVGR']
    elif 'HYDRO' in resource_type_upper:
        return resource_colors['HYDRO']
    elif 'NUCLEAR' in resource_type_upper:
        return resource_colors['NUCLEAR']
    elif 'COAL' in resource_type_upper:
        return resource_colors['COAL']
    elif 'GAS' in resource_type_upper or 'NG' in resource_type_upper:
        return resource_colors['GAS']
    elif 'CC' in resource_type_upper or 'COMBINED' in resource_type_upper:
        return resource_colors['CC']
    elif 'GT' in resource_type_upper or 'TURBINE' in resource_type_upper:
        return resource_colors['GT']
    elif 'STEAM' in resource_type_upper:
        return resource_colors['STEAM']
    elif 'BIOMASS' in resource_type_upper or 'BIO' in resource_type_upper:
        return resource_colors['BIOMASS']
    elif 'BESS' in resource_type_upper or 'BATTERY' in resource_type_upper or 'STORAGE' in resource_type_upper:
        return resource_colors['PWRSTR']
    else:
        return resource_colors['OTHER']

# Apply color mapping
supply_df['color'] = supply_df['resource_type'].apply(get_color_for_resource)

# Create the supply curve plot with stacked bars
fig, ax = plt.subplots(figsize=(16, 8))

# Add grid first (so it appears behind bars)
ax.grid(True, alpha=0.3, color='white', linestyle='-', linewidth=0.5, zorder=0)

# Create stacked bars for the supply curve
prev_mw = 0
bars_created = 0
for idx, row in supply_df.iterrows():
    width = row['mw']
    height = row['price']
    
    # Create a bar from previous cumulative MW to current
    ax.bar(prev_mw + width/2, height, width=width, 
           color=row['color'], alpha=1.0, edgecolor='none', linewidth=0, zorder=2)
    
    prev_mw += width
    bars_created += 1

print(f"Created {bars_created} bars")

# Add a horizontal line at $0
ax.axhline(y=0, color='red', linestyle='--', linewidth=2, alpha=0.8, zorder=3)

# Styling to match the reference image
ax.set_facecolor('#2F2F2F')  # Dark background
fig.patch.set_facecolor('#2F2F2F')

# Set labels and title
ax.set_xlabel('Load (MW)', fontsize=14, color='white', fontweight='bold')
ax.set_ylabel('Offer Price', fontsize=14, color='white', fontweight='bold')
ax.set_title('Supply Curve', fontsize=16, color='white', fontweight='bold', pad=20)

# Format axes
ax.tick_params(colors='white', labelsize=12)
ax.spines['bottom'].set_color('white')
ax.spines['left'].set_color('white')
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

# Format x-axis to show MW in thousands
max_mw = supply_df['cumulative_mw'].max()
x_ticks = np.arange(0, max_mw + 10000, 10000)
ax.set_xticks(x_ticks)
ax.set_xticklabels([f'{int(x/1000)}k' if x > 0 else '0' for x in x_ticks])

# Set logarithmic y-axis scale
ax.set_yscale('symlog', linthresh=10)  # symlog handles negative values better than log

# Set y-axis limits to focus on reasonable price ranges
min_price = supply_df['price'].min()
max_price = supply_df['price'].max()

# Set reasonable limits for the log scale
if min_price < 0:
    y_min = min_price * 1.2  # Give some margin for negative prices
else:
    y_min = max(0.1, min_price * 0.8)  # Avoid zero for log scale

y_max = max_price * 1.2
ax.set_ylim(y_min, y_max)

# Format y-axis to show prices in terms of 500, 1k, 1.5k, etc.
def format_price_labels(x, pos):
    """Format y-axis labels for prices"""
    if x == 0:
        return '0'
    elif abs(x) < 1:
        return f'{x:.1f}'
    elif abs(x) < 500:
        return f'{int(x)}'
    elif abs(x) < 1000:
        return f'{int(x/500)*500}'
    else:
        # For values >= 1000, show in thousands
        if x % 1000 == 0:
            return f'{int(x/1000)}k'
        else:
            return f'{x/1000:.1f}k'

# Create custom y-tick locations that work well with log scale
y_ticks = []
# Add some negative values if we have negative prices
if min_price < 0:
    # Include more negative values to cover the full range
    y_ticks.extend([-5000, -2500, -1000, -500, -250, -100, -50, -25, -10, -1])

# Add positive values
y_ticks.extend([0, 1, 10, 25, 50, 100, 250, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000])

# Filter y_ticks to only include values within our data range
y_ticks = [y for y in y_ticks if y_min <= y <= y_max]

print(f"Price range in data: {min_price:.2f} to {max_price:.2f}")
print(f"Y-axis limits: {y_min:.2f} to {y_max:.2f}")
print(f"Selected y_ticks: {y_ticks}")

# Set the y-ticks and labels
ax.set_yticks(y_ticks)
ax.set_yticklabels([format_price_labels(y, None) for y in y_ticks])

# Create legend for resource types
unique_resources = supply_df['resource_type'].unique()
legend_elements = []
for resource in sorted(unique_resources):
    if pd.notna(resource):  # Skip NaN values
        color = get_color_for_resource(resource)
        legend_elements.append(plt.Rectangle((0,0),1,1, facecolor=color, alpha=1.0, label=resource))

if legend_elements:
    ax.legend(handles=legend_elements, loc='upper left', 
             frameon=True, facecolor='#2F2F2F', edgecolor='white',
             labelcolor='white', fontsize=10, title='Resource Type',
             title_fontsize=11, ncol=2)
    ax.get_legend().get_title().set_color('white')

plt.tight_layout()

# Save as image for web display
plt.savefig('public/supply_curve_matplotlib.png', dpi=150, bbox_inches='tight', 
            facecolor='#2F2F2F', edgecolor='none')
print("Chart saved as public/supply_curve_matplotlib.png")

# Also save as SVG for better web quality
plt.savefig('public/supply_curve_matplotlib.svg', bbox_inches='tight', 
            facecolor='#2F2F2F', edgecolor='none')
print("Chart saved as public/supply_curve_matplotlib.svg")

plt.show() 