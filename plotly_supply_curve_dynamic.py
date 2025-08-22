import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import numpy as np
import json
import ast
import sys
import argparse
from datetime import datetime

# Load and process the CSV data (exact match to user's Python code)
def load_and_process_csv(file_path, date_filter=None, hour_filter=None):
    df = pd.read_csv(file_path)
    
    # Apply date/time filtering if provided
    if date_filter or hour_filter:
        print(f"Filtering data for date: {date_filter}, hour: {hour_filter}")
        # Add your date/time filtering logic here based on your CSV structure
        # For now, we'll use all data as the CSV appears to be from a single timestamp
    
    # Process data exactly like the user's Python code
    expanded_data = []
    for idx, row in df.iterrows():
        curve = row['sced_tpo_offer_curve']
        prev_mw = 0
        
        # Parse the curve string to list if it's a string
        if isinstance(curve, str):
            try:
                curve = ast.literal_eval(curve)
            except:
                continue
        
        if not curve or curve == []:
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
    
    print(f"Processing {len(df)} rows from CSV")
    print(f"Expanded to {len(expanded_data)} data points")
    print(f"After filtering: {len(supply_df)} segments")
    print(f"Total capacity: {supply_df['mw'].sum():,.0f} MW")
    
    # Debug: Show first few rows
    if len(supply_df) > 0:
        print("\nFirst 10 segments:")
        print(supply_df[['resource_name', 'resource_type', 'mw', 'price', 'cumulative_mw']].head(10))
        
        print(f"\nMW range: {supply_df['mw'].min():.3f} to {supply_df['mw'].max():.3f}")
        print(f"Price range: {supply_df['price'].min():.2f} to {supply_df['price'].max():.2f}")
        print(f"Cumulative MW range: 0 to {supply_df['cumulative_mw'].max():.0f}")
    
    return supply_df

# Color mapping function (exact match to React component)
def get_color_for_resource_type(resource_type):
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
    
    resource_type_upper = str(resource_type or '').upper()
    
    # Direct matches
    if resource_type_upper in resource_colors:
        return resource_colors[resource_type_upper]
    
    # Partial matches (same logic as React)
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

# Create the Plotly supply curve chart (exact match to user's matplotlib code)
def create_supply_curve_chart(supply_df, title_date=None, title_time=None):
    fig = go.Figure()
    
    # Calculate demand (75% of total capacity like React component)
    total_capacity = supply_df['mw'].sum()
    demand = int(total_capacity * 0.75)
    
    print(f"Total capacity: {total_capacity:,.0f} MW")
    print(f"Setting demand to: {demand:,.0f} MW (75% load factor)")
    
    # Apply color mapping (exactly like matplotlib code)
    supply_df['color'] = supply_df['resource_type'].apply(get_color_for_resource_type)
    
    # Group by resource type for legend
    legend_added = set()
    
    # Create stacked bars for the supply curve (exactly like matplotlib code)
    prev_mw = 0
    bars_created = 0
    
    for idx, row in supply_df.iterrows():
        width = row['mw']
        height = row['price']
        color = row['color']
        
        # Ensure minimum bar width for visibility (but keep actual width for positioning)
        display_width = max(width, total_capacity * 0.0001)  # Minimum 0.01% of total capacity
        
        # Create a bar from previous cumulative MW to current (like matplotlib ax.bar)
        bar_left = prev_mw
        bar_right = prev_mw + width  # Use actual width for positioning
        
        # For very thin bars, expand display width slightly
        if width < total_capacity * 0.001:  # If less than 0.1% of total
            display_left = bar_left - (display_width - width) / 2
            display_right = bar_right + (display_width - width) / 2
        else:
            display_left = bar_left
            display_right = bar_right
        
        # Only add to legend once per resource type
        show_legend = row['resource_type'] not in legend_added
        if show_legend:
            legend_added.add(row['resource_type'])
        
        # Create individual bar as filled rectangle
        fig.add_trace(go.Scatter(
            x=[display_left, display_left, display_right, display_right, display_left],
            y=[0, height, height, 0, 0],
            fill='toself',
            fillcolor=color,
            line=dict(color=color, width=0.1),  # Very thin border
            mode='lines',
            name=row['resource_type'],
            showlegend=show_legend,
            opacity=0.8,  # Add slight transparency
            hovertemplate=f"<b>{row['resource_name']}</b><br>" +
                         f"Resource Type: {row['resource_type']}<br>" +
                         f"Capacity: {row['mw']:.1f} MW<br>" +
                         f"Price: ${height:.2f}/MWh<br>" +
                         f"Load: {bar_left:.0f} - {bar_right:.0f} MW<extra></extra>"
        ))
        
        bars_created += 1
        prev_mw += width
        
        # Debug first few bars
        if bars_created <= 5:
            print(f"Bar {bars_created}: {row['resource_type']} - MW: {width:.1f}, Price: ${height:.2f}, Position: {bar_left:.0f}-{bar_right:.0f}")
    
    print(f"Created {bars_created} visible bars")
    
    if bars_created == 0:
        print("WARNING: No bars were created! Check data processing.")
        # Add a test bar to verify the chart is working
        fig.add_trace(go.Scatter(
            x=[0, 1000, 1000, 0, 0],
            y=[0, 50, 50, 0, 0],
            fill='toself',
            fillcolor='red',
            line=dict(color='red', width=1),
            mode='lines',
            name='TEST',
            showlegend=True,
            hovertemplate="Test bar<extra></extra>"
        ))
    
    # Add horizontal line at $0 (exactly like matplotlib axhline)
    max_capacity = supply_df['cumulative_mw'].max()
    fig.add_trace(go.Scatter(
        x=[0, max_capacity],
        y=[0, 0],
        mode='lines',
        line=dict(color='red', width=2, dash='dash'),
        name='$0 Price Line',
        showlegend=False,
        hoverinfo='skip'
    ))
    
    # Add vertical demand line
    price_range = supply_df['price']
    min_price = price_range.min()
    max_price = price_range.max()
    
    # Set y-axis limits exactly like matplotlib code
    if min_price < 0:
        y_min = min_price * 1.2  # Give some margin for negative prices
    else:
        y_min = max(0.1, min_price * 0.8)  # Avoid zero for log scale
    
    y_max = max_price * 1.2
    
    fig.add_trace(go.Scatter(
        x=[demand, demand],
        y=[y_min, y_max],
        mode='lines',
        line=dict(color='red', width=2, dash='dash'),
        name='Demand Level',
        showlegend=False,
        hovertemplate=f"Demand: {demand:,.0f} MW<extra></extra>"
    ))
    
    # Create custom y-tick locations exactly like matplotlib code
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
    
    # Format y-axis labels exactly like matplotlib code
    def format_price_labels(x):
        """Format y-axis labels for prices (exact match to matplotlib code)"""
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
    
    # Dynamic title
    chart_title = 'Supply Curve'
    if title_date and title_time:
        chart_title += f' ({title_date} at {title_time})'
    
    # Update layout to exactly match matplotlib styling
    fig.update_layout(
        title={
            'text': chart_title,
            'x': 0.5,
            'font': {'size': 16, 'color': 'white', 'family': 'Arial, sans-serif'},
            'pad': {'t': 20}
        },
        xaxis=dict(
            title=dict(text='Load (MW)', font=dict(size=14, color='white', family='Arial, sans-serif')),
            tickfont=dict(size=12, color='white'),
            gridcolor='rgba(255,255,255,0.3)',
            gridwidth=0.5,
            showgrid=True,
            zeroline=False,
            # Format x-axis exactly like matplotlib code
            tickmode='array',
            tickvals=list(range(0, int(max_capacity) + 10000, 10000)),
            ticktext=[f'{int(x/1000)}k' if x > 0 else '0' for x in range(0, int(max_capacity) + 10000, 10000)]
        ),
        yaxis=dict(
            title=dict(text='Offer Price', font=dict(size=14, color='white', family='Arial, sans-serif')),
            tickfont=dict(size=12, color='white'),
            gridcolor='rgba(255,255,255,0.3)',
            gridwidth=0.5,
            showgrid=True,
            zeroline=False,
            # Use symlog-like behavior with custom ticks
            type='linear',
            range=[y_min, y_max],
            tickmode='array',
            tickvals=y_ticks,
            ticktext=[format_price_labels(y) for y in y_ticks]
        ),
        plot_bgcolor='#2F2F2F',  # Dark background exactly like matplotlib
        paper_bgcolor='#2F2F2F',
        font=dict(color='white', family='Arial, sans-serif'),
        legend=dict(
            orientation='v',
            yanchor='top',
            y=1,
            xanchor='left',
            x=0.02,
            font=dict(size=10, color='white'),
            bgcolor='rgba(47,47,47,0.8)',
            bordercolor='white',
            borderwidth=1,
            title=dict(text='Resource Type', font=dict(size=11, color='white'))
        ),
        margin=dict(l=80, r=60, t=100, b=60),
        hovermode='closest',
        showlegend=True
    )
    
    return fig

# Main execution
def main():
    parser = argparse.ArgumentParser(description='Generate ERCOT Supply Curve Chart')
    parser.add_argument('--date', type=str, help='Date filter (YYYY-MM-DD)')
    parser.add_argument('--hour', type=str, help='Hour filter (HH)')
    parser.add_argument('--minute', type=str, help='Minute filter (MM)')
    parser.add_argument('--scenario', type=str, default='Current Grid', help='Market scenario')
    parser.add_argument('--output', type=str, default='public/supply_curve_plotly.html', help='Output HTML file path')
    
    args = parser.parse_args()
    
    # Load and process the data
    csv_file = "public/mock_offer_curve_data.csv"
    
    try:
        segments_df = load_and_process_csv(csv_file, args.date, args.hour)
        
        # Format time display
        time_display = None
        if args.hour and args.minute:
            time_display = f"{args.hour}:{args.minute}"
        
        # Create the chart
        fig = create_supply_curve_chart(segments_df, args.date, time_display)
        
        # Save as HTML
        fig.write_html(args.output)
        print(f"Chart saved as '{args.output}'")
        
        # Also show in browser if running directly
        if len(sys.argv) == 1:  # No arguments = interactive mode
            fig.show()
        
    except FileNotFoundError:
        print(f"Could not find CSV file: {csv_file}")
        print("Make sure the mock_offer_curve_data.csv file is in the correct location")
        sys.exit(1)
    except Exception as e:
        print(f"Error creating chart: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 