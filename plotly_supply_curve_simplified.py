import pandas as pd
import plotly.graph_objects as go
import ast

# Load and process CSV data (simplified for testing)
def load_csv_data():
    df = pd.read_csv("public/mock_offer_curve_data.csv")
    
    # Process exactly like user's code
    expanded_data = []
    for idx, row in df.iterrows():
        curve = row['sced_tpo_offer_curve']
        prev_mw = 0
        
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
                incremental_mw = current_mw - prev_mw
                
                if incremental_mw > 0:
                    expanded_data.append({
                        'resource_name': row['resource_name'],
                        'resource_type': row['resource_type'],
                        'mw': incremental_mw,
                        'price': price,
                        'telemetered_status': row['telemetered_resource_status']
                    })
                
                prev_mw = current_mw

    curve_df = pd.DataFrame(expanded_data)
    curve_df = curve_df[~ curve_df['telemetered_status'].isin(['ONTEST','OFFQS','OFFNS','OFF','OUT','SHUTDOWN'])]
    supply_df = curve_df[curve_df['mw'] > 0].copy()
    supply_df = supply_df.sort_values(['price', 'mw'])
    supply_df['cumulative_mw'] = supply_df['mw'].cumsum()
    
    print(f"Loaded {len(supply_df)} segments, Total: {supply_df['mw'].sum():.0f} MW")
    return supply_df

# Color mapping
def get_color(resource_type):
    colors = {
        'WIND': '#32CD32', 'PVGR': '#FFD700', 'SOLAR': '#FFD700', 'HYDRO': '#4169E1',
        'NUCLEAR': '#8A2BE2', 'COAL': '#8B4513', 'PWRSTR': '#9932CC', 'SCGT90': '#FFA500',
        'CCGT90': '#FF8C00', 'SCLE90': '#FFA500', 'CCLE90': '#FF8C00', 'DSL': '#708090',
        'GSREH': '#9932CC', 'GSNONR': '#9932CC', 'GSSUP': '#9932CC', 'NUC': '#8A2BE2',
        'CLLIG': '#228B22'
    }
    
    resource_type = str(resource_type).upper()
    if resource_type in colors:
        return colors[resource_type]
    
    # Partial matches
    for key, color in colors.items():
        if key in resource_type:
            return color
    
    return '#696969'  # Default gray

# Create chart using bar traces instead of scatter
def create_chart_with_bars(supply_df):
    fig = go.Figure()
    
    # Group small segments together for visibility
    min_bar_width = supply_df['mw'].sum() * 0.0005  # 0.05% of total
    
    grouped_data = []
    current_group = {'mw': 0, 'price_weighted_sum': 0, 'start_mw': 0, 'resource_types': set()}
    cumulative = 0
    
    for idx, row in supply_df.iterrows():
        if current_group['mw'] < min_bar_width and idx < len(supply_df) - 1:
            # Add to current group
            current_group['mw'] += row['mw']
            current_group['price_weighted_sum'] += row['price'] * row['mw']
            current_group['resource_types'].add(row['resource_type'])
            if current_group['start_mw'] == 0:
                current_group['start_mw'] = cumulative
        else:
            # Finalize current group
            if current_group['mw'] > 0:
                avg_price = current_group['price_weighted_sum'] / current_group['mw']
                main_resource = max(current_group['resource_types'], 
                                  key=lambda x: sum(r['mw'] for r in [row] if r['resource_type'] == x))
                
                grouped_data.append({
                    'start': current_group['start_mw'],
                    'end': cumulative + current_group['mw'],
                    'width': current_group['mw'],
                    'price': avg_price,
                    'resource_type': main_resource,
                    'color': get_color(main_resource)
                })
            
            # Start new group with current row
            current_group = {
                'mw': row['mw'],
                'price_weighted_sum': row['price'] * row['mw'],
                'start_mw': cumulative + current_group['mw'],
                'resource_types': {row['resource_type']}
            }
        
        cumulative += row['mw']
    
    # Add final group
    if current_group['mw'] > 0:
        avg_price = current_group['price_weighted_sum'] / current_group['mw']
        main_resource = list(current_group['resource_types'])[0]
        grouped_data.append({
            'start': current_group['start_mw'],
            'end': cumulative,
            'width': current_group['mw'],
            'price': avg_price,
            'resource_type': main_resource,
            'color': get_color(main_resource)
        })
    
    print(f"Grouped {len(supply_df)} segments into {len(grouped_data)} visible bars")
    
    # Create bars
    legend_added = set()
    for bar in grouped_data:
        show_legend = bar['resource_type'] not in legend_added
        if show_legend:
            legend_added.add(bar['resource_type'])
        
        fig.add_trace(go.Bar(
            x=[bar['start'] + bar['width']/2],  # Bar center
            y=[bar['price']],
            width=[bar['width']],
            marker=dict(color=bar['color'], line=dict(width=0)),
            name=bar['resource_type'],
            showlegend=show_legend,
            hovertemplate=f"Resource: {bar['resource_type']}<br>" +
                         f"Capacity: {bar['width']:.0f} MW<br>" +
                         f"Price: ${bar['price']:.2f}/MWh<extra></extra>"
        ))
    
    # Add zero line
    fig.add_hline(y=0, line=dict(color='red', width=2, dash='dash'), annotation_text="$0")
    
    # Add demand line
    demand = supply_df['mw'].sum() * 0.75
    fig.add_vline(x=demand, line=dict(color='red', width=2, dash='dash'), 
                  annotation_text=f"Demand: {demand:,.0f} MW")
    
    # Layout
    fig.update_layout(
        title='Supply Curve - Simplified',
        xaxis=dict(title='Load (MW)', tickformat=','),
        yaxis=dict(title='Price ($/MWh)'),
        plot_bgcolor='#2F2F2F',
        paper_bgcolor='#2F2F2F',
        font=dict(color='white'),
        bargap=0,
        bargroupgap=0
    )
    
    return fig

if __name__ == "__main__":
    supply_df = load_csv_data()
    fig = create_chart_with_bars(supply_df)
    fig.write_html("public/supply_curve_simplified.html")
    print("Simplified chart saved as public/supply_curve_simplified.html")
    fig.show() 