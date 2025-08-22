import pandas as pd
import plotly.graph_objects as go
import ast

# Simple test to verify Plotly chart works
def create_simple_test_chart():
    fig = go.Figure()
    
    # Add a few test bars
    test_data = [
        {'x_start': 0, 'x_end': 1000, 'price': -50, 'color': '#32CD32', 'name': 'WIND'},
        {'x_start': 1000, 'x_end': 2000, 'price': 25, 'color': '#FFD700', 'name': 'SOLAR'},
        {'x_start': 2000, 'x_end': 3000, 'price': 100, 'color': '#FF8C00', 'name': 'GAS'},
        {'x_start': 3000, 'x_end': 4000, 'price': 500, 'color': '#9932CC', 'name': 'STORAGE'}
    ]
    
    for bar in test_data:
        fig.add_trace(go.Scatter(
            x=[bar['x_start'], bar['x_start'], bar['x_end'], bar['x_end'], bar['x_start']],
            y=[0, bar['price'], bar['price'], 0, 0],
            fill='toself',
            fillcolor=bar['color'],
            line=dict(color=bar['color'], width=1),
            mode='lines',
            name=bar['name'],
            showlegend=True
        ))
    
    # Add zero line
    fig.add_trace(go.Scatter(
        x=[0, 4000],
        y=[0, 0],
        mode='lines',
        line=dict(color='red', width=2, dash='dash'),
        name='Zero Line',
        showlegend=False
    ))
    
    # Update layout
    fig.update_layout(
        title='Test Supply Curve',
        xaxis=dict(title='Load (MW)', range=[0, 4000]),
        yaxis=dict(title='Price ($/MWh)', range=[-100, 600]),
        plot_bgcolor='#2F2F2F',
        paper_bgcolor='#2F2F2F',
        font=dict(color='white')
    )
    
    return fig

if __name__ == "__main__":
    fig = create_simple_test_chart()
    fig.write_html("public/test_chart.html")
    print("Test chart saved as public/test_chart.html")
    fig.show() 