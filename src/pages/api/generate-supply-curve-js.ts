import type { APIRoute } from 'astro';
import { ercotDb } from '../../lib/database';

interface OfferCurvePoint {
  mw: number;
  price: number;
}

interface ExpandedDataPoint {
  unit_code: string;
  fuel_type: string;
  mw: number;
  price: number;
  cumulative_mw: number;
}

interface ChartData {
  x: number[];
  y: number[];
  name: string;
  type: string;
  line?: any;
  fill?: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { date, hour, minute, scenario } = body;
    
    console.log(`Generating JS supply curve for ${date} ${hour}:${minute} (${scenario})`);
    
    // Load and process database data
    const offerCurveData = await loadAndProcessDatabaseData(date, hour);
    
    // Generate the chart configuration
    const chartConfig = generatePlotlyChart(offerCurveData, date, hour, minute, scenario);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Chart generated successfully with JavaScript',
      chartConfig: chartConfig,
      dataPoints: offerCurveData.length
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    console.error('Error generating JS supply curve:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'JavaScript implementation error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};

async function loadAndProcessDatabaseData(dateFilter?: string, hourFilter?: string): Promise<ExpandedDataPoint[]> {
  try {
    console.log('Loading offer curve data from database...');
    
    // Query the database for offer curve data
    const rawData = await ercotDb.$queryRaw<Array<{
      resource_name: string;
      resource_type: string;
      sced_tpo_offer_curve: string;
      interval_start_utc?: Date;
      sced_timestamp_utc?: Date;
    }>>`
      SELECT "resource_name", "resource_type", "sced_tpo_offer_curve", "interval_start_utc", "sced_timestamp_utc"
      FROM "ERCOT"."ERCOT_Generation_Offer_Curve"
      ORDER BY "resource_name" ASC
    `;
    
    console.log(`Loaded ${rawData.length} rows from database`);
    
    // Process data (equivalent to Python logic)
    const expandedData: ExpandedDataPoint[] = [];
    
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const curveString = row.sced_tpo_offer_curve;
      let prevMw = 0;
      
      // Parse the curve string (equivalent to ast.literal_eval in Python)
      let curve: OfferCurvePoint[];
      try {
        if (typeof curveString === 'string') {
          // Handle string format like "[[0, 25.5], [100, 30.0], ...]"
          curve = JSON.parse(curveString.replace(/'/g, '"'));
        } else {
          curve = curveString;
        }
      } catch (parseError) {
        console.warn(`Failed to parse curve for row ${i}:`, curveString);
        continue;
      }
      
      if (!Array.isArray(curve)) {
        continue;
      }
      
      // Process each point in the curve
      for (const point of curve) {
        if (Array.isArray(point) && point.length >= 2) {
          const [mw, price] = point;
          const mwSegment = mw - prevMw;
          
          if (mwSegment > 0) {
            expandedData.push({
              unit_code: row.resource_name || `Unit_${i}`,
              fuel_type: row.resource_type || 'Unknown',
              mw: mwSegment,
              price: price,
              cumulative_mw: 0 // Will be calculated later
            });
          }
          prevMw = mw;
        }
      }
    }
    
    // Sort by price (equivalent to Python sort)
    expandedData.sort((a, b) => a.price - b.price);
    
    // Calculate cumulative MW
    let cumulativeMw = 0;
    for (const point of expandedData) {
      cumulativeMw += point.mw;
      point.cumulative_mw = cumulativeMw;
    }
    
    console.log(`Processed ${expandedData.length} data points from database`);
    return expandedData;
    
  } catch (error) {
    console.error('Error loading database data:', error);
    throw new Error(`Failed to load database data: ${error}`);
  }
}

// Helper functions for Y-axis formatting (matching Python version)
function generateYTicks(yMin: number, yMax: number): number[] {
  const ticks: number[] = [];
  
  // Add negative values if needed
  if (yMin < 0) {
    const negTicks = [-250, -100, -50, -25, -10, -1];
    for (const tick of negTicks) {
      if (tick >= yMin && tick <= yMax) {
        ticks.push(tick);
      }
    }
  }
  
  // Add positive values
  const posTicks = [0, 1, 10, 25, 50, 100, 250, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000];
  for (const tick of posTicks) {
    if (tick >= yMin && tick <= yMax) {
      ticks.push(tick);
    }
  }
  
  return ticks.sort((a, b) => a - b);
}

function formatPriceLabel(price: number): string {
  if (price === 0) return '0';
  if (Math.abs(price) < 1) return price.toFixed(1);
  if (Math.abs(price) < 500) return price.toString();
  if (Math.abs(price) < 1000) return (Math.round(price / 500) * 500).toString();
  
  // For values >= 1000, show in thousands
  if (price % 1000 === 0) {
    return `${Math.round(price / 1000)}k`;
  } else {
    return `${(price / 1000).toFixed(1)}k`;
  }
}

function generatePlotlyChart(data: ExpandedDataPoint[], date: string, hour: string, minute: string, scenario: string) {
  const traces: ChartData[] = [];
  
  // Calculate total capacity and demand (75% like Python)
  const totalCapacity = data.reduce((sum, d) => sum + d.mw, 0);
  const demand = Math.floor(totalCapacity * 0.75);
  
  console.log(`Total capacity: ${totalCapacity.toLocaleString()} MW`);
  console.log(`Setting demand to: ${demand.toLocaleString()} MW (75% load factor)`);
  
  // Enhanced fuel type colors (matching Python exactly)
  const resourceColors: { [key: string]: string } = {
    'WIND': '#2E8B57',      // Sea green
    'PVGR': '#FFD700',      // Gold for solar
    'SOLAR': '#FFD700',     // Gold for solar
    'HYDRO': '#4682B4',     // Steel blue
    'NUCLEAR': '#32CD32',   // Lime green
    'COAL': '#8B4513',      // Saddle brown
    'GAS': '#FF6347',       // Tomato
    'CC': '#FF4500',        // Orange red for combined cycle
    'GT': '#FF8C00',        // Dark orange for gas turbine
    'STEAM': '#DC143C',     // Crimson
    'BIOMASS': '#228B22',   // Forest green
    'PWRSTR': '#9932CC',    // Dark orchid for batteries
    'ESR': '#9932CC',       // Dark orchid for energy storage
    'DC': '#FF1493',        // Deep pink for DC tie
    'SYNC_COND': '#708090', // Slate gray
    'OTHER': '#696969',     // Dim gray
    'UNKNOWN': '#A9A9A9'    // Dark gray
  };
  
  // Function to get color for resource type (matching Python logic)
  const getColorForResourceType = (resourceType: string): string => {
    const resourceTypeUpper = (resourceType || '').toString().toUpperCase();
    
    // Direct matches
    if (resourceColors[resourceTypeUpper]) {
      return resourceColors[resourceTypeUpper];
    }
    
    // Partial matches
    if (resourceTypeUpper.includes('WIND')) return resourceColors['WIND'];
    if (resourceTypeUpper.includes('SOLAR') || resourceTypeUpper.includes('PV')) return resourceColors['PVGR'];
    if (resourceTypeUpper.includes('HYDRO')) return resourceColors['HYDRO'];
    if (resourceTypeUpper.includes('NUCLEAR')) return resourceColors['NUCLEAR'];
    if (resourceTypeUpper.includes('COAL')) return resourceColors['COAL'];
    if (resourceTypeUpper.includes('GAS') || resourceTypeUpper.includes('NG')) return resourceColors['GAS'];
    if (resourceTypeUpper.includes('CC') || resourceTypeUpper.includes('COMBINED')) return resourceColors['CC'];
    if (resourceTypeUpper.includes('GT') || resourceTypeUpper.includes('TURBINE')) return resourceColors['GT'];
    if (resourceTypeUpper.includes('STEAM')) return resourceColors['STEAM'];
    if (resourceTypeUpper.includes('BIOMASS') || resourceTypeUpper.includes('BIO')) return resourceColors['BIOMASS'];
    if (resourceTypeUpper.includes('BESS') || resourceTypeUpper.includes('BATTERY') || resourceTypeUpper.includes('STORAGE')) return resourceColors['PWRSTR'];
    
    return resourceColors['OTHER'];
  };
  
  // Add colors to data
  const dataWithColors = data.map(d => ({
    ...d,
    color: getColorForResourceType(d.fuel_type)
  }));
  
  // Group by resource type for legend
  const legendAdded = new Set<string>();
  let prevMw = 0;
  
  // Create individual bars for each generator (like Python stacked bars)
  for (const point of dataWithColors) {
    const width = point.mw;
    const height = point.price;
    const color = point.color;
    
    // Ensure minimum bar width for visibility
    const displayWidth = Math.max(width, totalCapacity * 0.0001);
    
    // Create bar coordinates
    const barLeft = prevMw;
    const barRight = prevMw + width;
    
    // Adjust display width for very thin bars
    let displayLeft = barLeft;
    let displayRight = barRight;
    
    if (width < totalCapacity * 0.001) {
      const expansion = (displayWidth - width) / 2;
      displayLeft = barLeft - expansion;
      displayRight = barRight + expansion;
    }
    
    // Only add to legend once per resource type
    const showLegend = !legendAdded.has(point.fuel_type);
    if (showLegend) {
      legendAdded.add(point.fuel_type);
    }
    
    // Create individual bar as filled rectangle (matching Python)
    traces.push({
      x: [displayLeft, displayLeft, displayRight, displayRight, displayLeft],
      y: [0, height, height, 0, 0],
      name: point.fuel_type,
      type: 'scatter',
      fill: 'toself',
      fillcolor: color,
      line: { color: color, width: 0.5 },
      mode: 'lines',
      showlegend: showLegend,
      opacity: 0.8,
      text: `<b>${point.unit_code}</b><br>Resource Type: ${point.fuel_type}<br>Capacity: ${point.mw.toFixed(1)} MW<br>Price: $${height.toFixed(2)}/MWh<br>Load: ${barLeft.toFixed(0)} - ${barRight.toFixed(0)} MW`,
      hoverinfo: 'text'
    });
    
    prevMw += width;
  }
  
  // Add horizontal line at $0 (red dashed line)
  const maxCapacity = Math.max(...dataWithColors.map(d => d.cumulative_mw));
  traces.push({
    x: [0, maxCapacity],
    y: [0, 0],
    name: '$0 Price Line',
    type: 'scatter',
    mode: 'lines',
    line: { color: 'red', width: 2, dash: 'dash' },
    showlegend: false,
    hoverinfo: 'skip'
  });
  
  // Add vertical demand line (red dashed line) with better Y-axis scaling
  const prices = dataWithColors.map(d => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  
  // Use Python-like Y-axis scaling (much more compressed)
  let yMin, yMax;
  
  // Set Y-min to handle negative prices like Python
  if (minPrice < 0) {
    yMin = Math.max(-250, minPrice * 1.2); // Cap at -250 like Python
  } else {
    yMin = -25; // Show some negative space for better visualization
  }
  
  // Much more aggressive Y-max capping to match Python scaling
  const pricePercentiles = [...prices].sort((a, b) => a - b);
  const p90 = pricePercentiles[Math.floor(pricePercentiles.length * 0.90)];
  const p95 = pricePercentiles[Math.floor(pricePercentiles.length * 0.95)];
  
  // Very compressed Y-axis like Python - focus on where most generation is
  if (p90 <= 50) {
    yMax = 100; // Most generation at very low prices
  } else if (p90 <= 100) {
    yMax = 250; // Low-price market
  } else if (p90 <= 250) {
    yMax = 500; // Medium-price market
  } else if (p90 <= 500) {
    yMax = 1000; // Higher-price market
  } else {
    yMax = Math.min(p95 * 1.2, 1500); // Cap extreme cases
  }
  
  console.log(`Price range: ${minPrice.toFixed(2)} to ${maxPrice.toFixed(2)}`);
  console.log(`90th percentile: ${p90.toFixed(2)}, 95th percentile: ${p95.toFixed(2)}`);
  console.log(`Y-axis range: ${yMin.toFixed(2)} to ${yMax.toFixed(2)}`);
  
  traces.push({
    x: [demand, demand],
    y: [yMin, yMax],
    name: 'Demand Level',
    type: 'scatter',
    mode: 'lines',
    line: { color: 'red', width: 2, dash: 'dash' },
    showlegend: false,
    hovertemplate: `Demand: ${demand.toLocaleString()} MW<extra></extra>`
  });
  
  // Find clearing price at demand level
  let clearingPrice = 0;
  for (const point of dataWithColors) {
    if (point.cumulative_mw >= demand) {
      clearingPrice = point.price;
      break;
    }
  }
  
  // Create layout (matching Python styling)
  const layout = {
    title: {
      text: `Supply Curve (${date} at ${hour.split(' ')[0]}:${minute})`,
      font: { size: 16 }
    },
    xaxis: {
      title: 'Load (MW)',
      showgrid: true,
      gridcolor: 'lightgray',
      tickformat: ',.0f'
    },
    yaxis: {
      title: 'Offer Price ($/MWh)',
      showgrid: true,
      gridcolor: 'lightgray',
      tickformat: '$.0f',
      range: [yMin, yMax],
      // Custom tick values for better readability (like Python version)
      tickmode: 'array',
      tickvals: generateYTicks(yMin, yMax),
      ticktext: generateYTicks(yMin, yMax).map(formatPriceLabel)
    },
    annotations: [
      {
        x: demand,
        y: yMax * 0.9,
        text: `Demand: ${demand.toLocaleString()} MW`,
        showarrow: true,
        arrowhead: 2,
        arrowsize: 1,
        arrowwidth: 2,
        arrowcolor: 'red',
        font: { color: 'red', size: 12 },
        bgcolor: 'white',
        bordercolor: 'red',
        borderwidth: 1
      },
      {
        x: maxCapacity * 0.1,
        y: yMax * 0.9,
        text: `Clearing Price: $${clearingPrice.toFixed(2)}/MWh`,
        showarrow: false,
        font: { color: 'red', size: 12 },
        bgcolor: 'white',
        bordercolor: 'red',
        borderwidth: 1
      }
    ],
    hovermode: 'closest', // Best for individual bar hover
    showlegend: true,
    legend: {
      orientation: 'h', // Horizontal orientation
      x: 0.5, // Center horizontally
      xanchor: 'center',
      y: -0.2, // Position below the chart
      yanchor: 'top',
      bgcolor: 'rgba(255,255,255,0.8)', // Semi-transparent white background
      bordercolor: 'rgba(0,0,0,0.1)', // Light border
      borderwidth: 1
    },
    plot_bgcolor: 'white',
    paper_bgcolor: 'white',
    margin: { l: 60, r: 30, t: 80, b: 120 } // Increased top margin for horizontal toolbar
  };
  
  return {
    data: traces,
    layout: layout,
    config: {
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'], // Removed 'pan2d' to enable panning
      modeBarOrientation: 'h', // Horizontal orientation
      scrollZoom: true, // Enable scroll wheel zoom
      doubleClick: 'reset' // Double-click to reset zoom
    }
  };
}
