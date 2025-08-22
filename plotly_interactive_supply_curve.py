import pandas as pd
import plotly.graph_objects as go
import numpy as np
import ast
import argparse
import sys

# Load the CSV data and process exactly like the matplotlib version
def load_and_process_data():
    df = pd.read_csv("public/mock_offer_curve_data.csv")

    # Process data exactly like matplotlib version
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
    
    return supply_df

# Define color mapping for resource types (exact match to matplotlib)
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

# Function to get color for resource type (exact match to matplotlib)
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

# Symlog transformation functions (similar to matplotlib symlog)
def symlog_transform(x, linthresh=10):
    """Transform values using symlog - linear near zero, log for large values"""
    # Special case: give $0 generators a small visual height equivalent to $0.01
    if x == 0:
        x = 0.01
    
    return np.where(np.abs(x) <= linthresh, 
                   x, 
                   np.sign(x) * (linthresh + np.log10(np.abs(x) / linthresh)))

def inverse_symlog_transform(y, linthresh=10):
    """Inverse symlog transformation"""
    return np.where(np.abs(y) <= linthresh,
                   y,
                   np.sign(y) * linthresh * (10 ** (np.abs(y) - linthresh)))

# Create interactive Plotly chart that matches matplotlib exactly
def create_interactive_plotly_chart(supply_df, title_date=None, title_time=None):
    # Transform the actual price data for plotting
    linthresh = 10  # Linear threshold - values below this are linear, above are compressed
    supply_df = supply_df.copy()
    supply_df['price_transformed'] = supply_df['price'].apply(lambda x: symlog_transform(x, linthresh))
    
    # Dynamic title
    chart_title = 'Supply Curve'
    if title_date and title_time:
        chart_title += f' ({title_date} at {title_time})'
    
    # Apply color mapping
    supply_df['color'] = supply_df['resource_type'].apply(get_color_for_resource)
    
    fig = go.Figure()
    
    # Create stacked bars exactly like matplotlib version
    prev_mw = 0
    bars_created = 0
    legend_added = set()
    
    # Group bars by resource type for better performance and legend management
    resource_groups = {}
    
    for idx, row in supply_df.iterrows():
        width = row['mw']
        height = row['price_transformed']  # Use transformed price for Y position
        original_price = row['price']      # Keep original for hover
        color = row['color']
        resource_type = row['resource_type']
        
        if resource_type not in resource_groups:
            resource_groups[resource_type] = {
                'x': [],
                'y': [],
                'color': color,
                'hover_text': [],
                'show_legend': resource_type not in legend_added
            }
            legend_added.add(resource_type)
        
        # Create bar coordinates (same as matplotlib: prev_mw + width/2 as center)
        bar_left = prev_mw
        bar_right = prev_mw + width
        
        # For Plotly, we'll use Bar trace which is more efficient for many bars
        resource_groups[resource_type]['x'].append(prev_mw + width/2)  # Bar center
        resource_groups[resource_type]['y'].append(height)  # Use transformed height
        resource_groups[resource_type]['hover_text'].append(
            f"<b>{row['resource_name']}</b><br>" +
            f"Resource Type: {resource_type}<br>" +
            f"Capacity: {width:.1f} MW<br>" +
            f"Price: ${original_price:.2f}/MWh" + (" (Zero Cost)" if original_price == 0 else "") + "<br>" +  # Show original price with note if $0
            f"Load: {bar_left:.0f} - {bar_right:.0f} MW"
        )
        
        prev_mw += width
        bars_created += 1
    
    print(f"Created {bars_created} bars grouped by {len(resource_groups)} resource types")
    
    # Add bar traces for each resource type
    for resource_type, group_data in resource_groups.items():
        fig.add_trace(go.Bar(
            x=group_data['x'],
            y=group_data['y'],
            name=resource_type,
            marker=dict(
                color=group_data['color'],
                line=dict(width=0)
            ),
            width=[supply_df.loc[supply_df['resource_type'] == resource_type, 'mw'].iloc[i] 
                   for i in range(len(group_data['x']))],  # Individual bar widths
            showlegend=group_data['show_legend'],
            hovertemplate='%{hovertext}<extra></extra>',
            hovertext=group_data['hover_text']
        ))
    
    # Add vertical demand line - set to realistic 80k MW with matching thickness
    demand = 80000  # 80k MW realistic demand
    fig.add_vline(
        x=demand,
        line=dict(color='red', width=4, dash='dash'),  # Match clearing price line thickness
        annotation=dict(text=f"Demand: {demand:,.0f} MW", bgcolor="rgba(255,255,255,0.8)", bordercolor="red")
    )
    
    # Format y-axis labels (same as matplotlib) - define before use
    def format_price_labels(x):
        if x == 0:
            return '0'
        elif abs(x) < 1:
            return f'{x:.1f}'
        elif abs(x) < 500:
            return f'{int(x)}'
        elif abs(x) < 1000:
            return f'{int(x/500)*500}'
        else:
            if x % 1000 == 0:
                return f'{int(x/1000)}k'
            else:
                return f'{x/1000:.1f}k'
    
    # Create custom tick positions in transformed space - reduced density
    raw_ticks = [-250, -100, -25, -1, 0, 1, 10, 50, 250, 1000]  # Fewer ticks for cleaner look
    transformed_ticks = [symlog_transform(x, linthresh) for x in raw_ticks]
    
    # Set axis range in transformed space
    y_min_transformed = symlog_transform(-300, linthresh)
    y_max_transformed = symlog_transform(1000, linthresh)  # Much more compressed range
    
    # Filter ticks to fit in range
    filtered_ticks = []
    filtered_labels = []
    for i, (raw_tick, trans_tick) in enumerate(zip(raw_ticks, transformed_ticks)):
        if y_min_transformed <= trans_tick <= y_max_transformed:
            filtered_ticks.append(trans_tick)
            filtered_labels.append(format_price_labels(raw_tick))
    
    # Calculate clearing price AFTER bars are added
    supply_df_sorted = supply_df.sort_values('cumulative_mw')
    max_capacity = supply_df['cumulative_mw'].max()  # Get max capacity from data
    clearing_gen = supply_df_sorted[supply_df_sorted['cumulative_mw'] >= demand].iloc[0] if len(supply_df_sorted[supply_df_sorted['cumulative_mw'] >= demand]) > 0 else supply_df_sorted.iloc[-1]
    clearing_price = clearing_gen['price']
    clearing_price_transformed = symlog_transform(clearing_price, linthresh)
    
    print(f"Demand: {demand:,} MW")
    print(f"Clearing price: ${clearing_price:.2f}/MWh")
    print(f"Clearing price transformed: {clearing_price_transformed:.2f}")
    print(f"Y-axis range: {y_min_transformed:.2f} to {y_max_transformed:.2f}")
    print(f"Horizontal line: x=[0, {max_capacity}], y=[{clearing_price_transformed:.2f}, {clearing_price_transformed:.2f}]")
    
    # Update layout to exactly match matplotlib styling
    fig.update_layout(
        title=dict(
            text=chart_title,
            x=0.5,
            font={'size': 16, 'color': 'black', 'family': 'Arial, sans-serif'},
            pad={'t': 20}
        ),
        xaxis=dict(
            title=dict(text='Load (MW)', font=dict(size=14, color='black', family='Arial, sans-serif')),
            tickfont=dict(size=12, color='black'),
            gridcolor='rgba(0,0,0,0.2)',
            gridwidth=0.5,
            showgrid=True,
            zeroline=False,
            # Format x-axis like matplotlib
            tickmode='array',
            tickvals=list(range(0, int(max_capacity) + 10000, 10000)),
            ticktext=[f'{int(x/1000)}k' if x > 0 else '0' for x in range(0, int(max_capacity) + 10000, 10000)]
        ),
        yaxis=dict(
            title=dict(text='Offer Price ($/MWh)', font=dict(size=14, color='black', family='Arial, sans-serif')),
            tickfont=dict(size=12, color='black'),
            gridcolor='rgba(0,0,0,0.2)',
            gridwidth=0.5,
            showgrid=True,
            zeroline=False,  # Disable the red zero line
            type='linear',
            range=[y_min_transformed, y_max_transformed],
            tickmode='array',
            tickvals=filtered_ticks,
            ticktext=filtered_labels
        ),
        plot_bgcolor='white',  # Light background for web interface
        paper_bgcolor='white',
        font=dict(color='black', family='Arial, sans-serif'),
        legend=dict(
            orientation='h',  # Horizontal
            yanchor='top',
            y=-0.15,  # Position below the X-axis
            xanchor='center',
            x=0.5,
            font=dict(size=10, color='black'),
            bgcolor='rgba(255,255,255,0.8)',
            bordercolor='black',
            borderwidth=1,
            title=dict(text='Resource Type', font=dict(size=11, color='black'))
        ),
        margin=dict(l=80, r=60, t=100, b=120),  # Increased bottom margin for legend
        hovermode='closest',
        showlegend=True,
        bargap=0,  # No gaps between bars
        bargroupgap=0,
        # Ensure interactivity
        dragmode='pan',  # Default to pan mode
        selectdirection='any'  # Allow selection in any direction
    )
    
    # ADD CLEARING PRICE LINE AS THE VERY LAST ELEMENT to ensure it's on top
    fig.add_trace(go.Scatter(
        x=[0, max_capacity],
        y=[clearing_price_transformed, clearing_price_transformed],
        mode='lines',
        line=dict(color='red', width=4, dash='dash'),
        showlegend=False,
        name='Clearing Price Line',
        hoverinfo='skip',
        connectgaps=True
    ))
    
    # Add clearing price annotation positioned on the line (also as last element)
    fig.add_annotation(
        x=max_capacity * 0.15,  # Position on left side
        y=clearing_price_transformed,  # Exact Y coordinate of the line
        text=f"Clearing Price: ${clearing_price:.2f}/MWh",
        showarrow=False,
        bgcolor="rgba(255,255,255,0.8)",
        bordercolor="red",
        borderwidth=1,
        font=dict(size=12, color="red"),
        xanchor="left",
        yanchor="bottom",  # Bottom of annotation box sits on the line
        xref="x",
        yref="y"
    )
    
    print(f"FINAL: Added horizontal clearing price line at y={clearing_price_transformed:.2f} as last element")
    
    return fig

# Main execution
def main():
    parser = argparse.ArgumentParser(description='Generate Interactive ERCOT Supply Curve Chart')
    parser.add_argument('--date', type=str, help='Date filter (YYYY-MM-DD)')
    parser.add_argument('--hour', type=str, help='Hour filter (HH)')
    parser.add_argument('--minute', type=str, help='Minute filter (MM)')
    parser.add_argument('--scenario', type=str, default='Current Grid', help='Market scenario')
    parser.add_argument('--output', type=str, default='public/supply_curve_interactive.html', help='Output HTML file path')
    
    args = parser.parse_args()
    
    try:
        # Load and process data
        supply_df = load_and_process_data()
        
        # Format time display
        time_display = None
        if args.hour and args.minute:
            time_display = f"{args.hour}:{args.minute}"
        
        # Create the interactive chart
        fig = create_interactive_plotly_chart(supply_df, args.date, time_display)
        
        # Save as HTML with full interactivity
        fig.write_html(args.output, config={
            'displayModeBar': True,
            'displaylogo': False,
            'modeBarButtonsToRemove': ['lasso2d', 'select2d'],  # Keep all other tools
            'scrollZoom': True,
            'doubleClick': 'reset+autosize',
            'showTips': True,
            'responsive': True,
            'toImageButtonOptions': {
                'format': 'png',
                'filename': 'supply_curve',
                'height': 600,
                'width': 1200,
                'scale': 2
            }
        }, include_plotlyjs=True)
        print(f"Interactive chart saved as '{args.output}'")
        
        # Show in browser if running directly
        if len(sys.argv) == 1:
            fig.show()
        
    except Exception as e:
        print(f"Error creating chart: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 