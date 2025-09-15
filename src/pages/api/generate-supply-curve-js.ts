import type { APIRoute } from 'astro';
import { ercotDb, rtLoadDb } from '../../lib/database';

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
    const { date, hour, minute, resourceStatuses } = body;
    
    console.log(`Generating JS supply curve for ${date} ${hour}:${minute} (Resource Statuses: ${resourceStatuses?.join(', ') || 'All'})`);
    
    // Load and process database data
    const offerCurveData = await loadAndProcessDatabaseData(date, hour, minute, resourceStatuses);
    
    // Fetch actual demand from yes_fundamentals table
    const actualDemand = await fetchActualDemand(date, hour, minute);
    
    // Generate the chart configuration
    const chartConfig = generatePlotlyChart(offerCurveData, date, hour, minute, 'Current Grid', actualDemand);
    
    // Calculate some key metrics for debugging
    const totalCapacity = offerCurveData.reduce((sum, d) => sum + d.mw, 0);
    const priceRange = {
      min: Math.min(...offerCurveData.map(d => d.price)),
      max: Math.max(...offerCurveData.map(d => d.price))
    };
    
    console.log('='.repeat(50));
    console.log('🔍 SUPPLY CURVE DEBUG SUMMARY');
    console.log(`📊 Total Capacity: ${totalCapacity.toFixed(1)} MW`);
    console.log(`📈 Price Range: $${priceRange.min.toFixed(2)} to $${priceRange.max.toFixed(2)}`);
    console.log(`🎯 Actual Demand: ${actualDemand || 'Not found'} MW`);
    console.log(`📋 Data Points: ${offerCurveData.length} segments`);
    console.log('='.repeat(50));
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Chart generated successfully with JavaScript',
      chartConfig: chartConfig,
      dataPoints: offerCurveData.length,
      actualDemand: actualDemand,
      debugInfo: {
        totalCapacity: totalCapacity,
        priceRange: priceRange,
        timestamp: new Date().toISOString()
      }
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

async function fetchActualDemand(date: string, hour: string, minute: string): Promise<number | null> {
  try {
    // Parse hour from format "01 (1 AM)" to get "01"
    const hourNumber = hour.split(' ')[0];
    
    // Create timestamp string for Texas local time
    const targetTimestamp = `${date} ${hourNumber}:${minute}:00`;
    console.log(`Fetching actual demand for: ${targetTimestamp}`);
    
    // Query yes_fundamentals table for CAISO RTLOAD data
    const demandData = await rtLoadDb.$queryRaw<Array<{
      value: number;
    }>>`
      SELECT "value"
      FROM public.yes_fundamentals
      WHERE "local_datetime_ib" = ${targetTimestamp}::timestamp
        AND "entity" = 'ERCOT'
        AND "attribute" = 'RTLOAD'
      LIMIT 1
    `;
    
    if (demandData.length > 0) {
      const demand = demandData[0].value;
      console.log(`Found actual demand: ${demand} MW`);
      return demand;
    } else {
      console.log('No demand data found for specified time');
      return null;
    }
    
  } catch (error) {
    console.error('Error fetching actual demand:', error);
    return null;
  }
}

async function loadAndProcessDatabaseData(dateFilter?: string, hourFilter?: string, minuteFilter?: string, resourceStatusFilters?: string[]): Promise<ExpandedDataPoint[]> {
  try {
    console.log(`Loading offer curve data from database for ${dateFilter} ${hourFilter}:${minuteFilter}...`);
    
    // Convert user selections to Texas local time timestamp
    let targetTimestamp: string | null = null;
    
    if (dateFilter && hourFilter && minuteFilter) {
      // Parse hour from format "02 (2 AM)" to get "02"
      const hourNumber = hourFilter.split(' ')[0];
      
      // Create timestamp string in Texas local time
      // Format: YYYY-MM-DD HH:MM:SS
      targetTimestamp = `${dateFilter} ${hourNumber}:${minuteFilter}:00`;
      console.log(`Target timestamp (Texas local): ${targetTimestamp}`);
    }
    
    // Query the database for offer curve data with optional filtering
    let rawData;
    
    if (targetTimestamp) {
      // Handle multiple resource status filtering
      const shouldFilter = resourceStatusFilters && 
                          resourceStatusFilters.length > 0 && 
                          !resourceStatusFilters.includes('All');
      
      if (shouldFilter && resourceStatusFilters.length === 1) {
        // Simple single status filtering
        const singleStatus = resourceStatusFilters[0];
        console.log(`Filtering by single resource status: ${singleStatus}`);
        
        const query = `
          SELECT "resource_name", "resource_type", "sced_tpo_offer_curve", "interval_start_local", "telemetered_resource_status", "telemetered_net_output"
          FROM "ERCOT"."ERCOT_Generation_Offer_Curve"
          WHERE "interval_start_local" = '${targetTimestamp}'::timestamp
            AND "telemetered_resource_status" = '${singleStatus}'
            AND "telemetered_net_output" != 0
          ORDER BY "resource_name" ASC
        `;
        console.log('Executing SQL query:', query);
        
        rawData = await ercotDb.$queryRaw<Array<{
          resource_name: string;
          resource_type: string;
          sced_tpo_offer_curve: string;
          interval_start_local?: Date;
          telemetered_resource_status?: string;
          telemetered_net_output?: number;
        }>>`
          SELECT "resource_name", "resource_type", "sced_tpo_offer_curve", "interval_start_local", "telemetered_resource_status", "telemetered_net_output"
          FROM "ERCOT"."ERCOT_Generation_Offer_Curve"
          WHERE "interval_start_local" = ${targetTimestamp}::timestamp
            AND "telemetered_resource_status" = ${singleStatus}
            AND "telemetered_net_output" != 0
          ORDER BY "resource_name" ASC
        `;
      } else if (shouldFilter && resourceStatusFilters.length > 1) {
        // Handle multiple status filtering with separate queries and combine results
        console.log(`Filtering by multiple resource statuses: ${resourceStatusFilters.join(', ')}`);
        
        const allResults: Array<{
          resource_name: string;
          resource_type: string;
          sced_tpo_offer_curve: string;
          interval_start_local?: Date;
          telemetered_resource_status?: string;
          telemetered_net_output?: number;
        }> = [];
        
        // Query each status separately and combine results
        for (const status of resourceStatusFilters) {
          const statusData = await ercotDb.$queryRaw<Array<{
            resource_name: string;
            resource_type: string;
            sced_tpo_offer_curve: string;
            interval_start_local?: Date;
            telemetered_resource_status?: string;
            telemetered_net_output?: number;
          }>>`
            SELECT "resource_name", "resource_type", "sced_tpo_offer_curve", "interval_start_local", "telemetered_resource_status", "telemetered_net_output"
            FROM "ERCOT"."ERCOT_Generation_Offer_Curve"
            WHERE "interval_start_local" = ${targetTimestamp}::timestamp
              AND "telemetered_resource_status" = ${status}
              AND "telemetered_net_output" != 0
            ORDER BY "resource_name" ASC
          `;
          allResults.push(...statusData);
        }
        
        rawData = allResults;
      } else {
        // No filtering - show all statuses (but exclude zero output)
        rawData = await ercotDb.$queryRaw<Array<{
          resource_name: string;
          resource_type: string;
          sced_tpo_offer_curve: string;
          interval_start_local?: Date;
          telemetered_resource_status?: string;
          telemetered_net_output?: number;
        }>>`
          SELECT "resource_name", "resource_type", "sced_tpo_offer_curve", "interval_start_local", "telemetered_resource_status", "telemetered_net_output"
          FROM "ERCOT"."ERCOT_Generation_Offer_Curve"
          WHERE "interval_start_local" = ${targetTimestamp}::timestamp
            AND "telemetered_net_output" != 0
          ORDER BY "resource_name" ASC
        `;
      }
    } else {
      // If no date/time specified, get the latest interval with optional resource status filtering
      const shouldFilter = resourceStatusFilters && 
                          resourceStatusFilters.length > 0 && 
                          !resourceStatusFilters.includes('All');
      
      if (shouldFilter) {
        console.log(`Filtering latest interval by resource statuses: ${resourceStatusFilters.join(', ')}`);
        
        rawData = await ercotDb.$queryRaw<Array<{
          resource_name: string;
          resource_type: string;
          sced_tpo_offer_curve: string;
          interval_start_local?: Date;
          telemetered_resource_status?: string;
          telemetered_net_output?: number;
        }>>`
          SELECT "resource_name", "resource_type", "sced_tpo_offer_curve", "interval_start_local", "telemetered_resource_status", "telemetered_net_output"
          FROM "ERCOT"."ERCOT_Generation_Offer_Curve"
          WHERE "interval_start_local" = (
            SELECT MAX("interval_start_local") 
            FROM "ERCOT"."ERCOT_Generation_Offer_Curve"
          )
            AND "telemetered_resource_status" = ${resourceStatusFilters[0]}
            AND "telemetered_net_output" != 0
          ORDER BY "resource_name" ASC
        `;
      } else {
        rawData = await ercotDb.$queryRaw<Array<{
          resource_name: string;
          resource_type: string;
          sced_tpo_offer_curve: string;
          interval_start_local?: Date;
          telemetered_resource_status?: string;
          telemetered_net_output?: number;
        }>>`
          SELECT "resource_name", "resource_type", "sced_tpo_offer_curve", "interval_start_local", "telemetered_resource_status", "telemetered_net_output"
          FROM "ERCOT"."ERCOT_Generation_Offer_Curve"
          WHERE "interval_start_local" = (
            SELECT MAX("interval_start_local") 
            FROM "ERCOT"."ERCOT_Generation_Offer_Curve"
          )
            AND "telemetered_net_output" != 0
          ORDER BY "resource_name" ASC
        `;
      }
    }
    
    console.log(`Loaded ${rawData.length} rows from database`);
    
    // Debug: Show breakdown of resource statuses in the data
    const statusBreakdown: { [key: string]: number } = {};
    rawData.forEach(row => {
      const status = row.telemetered_resource_status || 'NULL';
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
    });
    console.log('Resource status breakdown:', statusBreakdown);
    
    // Process data (equivalent to Python logic)
    const expandedData: ExpandedDataPoint[] = [];
    let totalProcessedMW = 0;
    let priceRange = { min: Infinity, max: -Infinity };
    
    console.log(`Processing ${rawData.length} units...`);
    
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
      
      // Debug first few units
      if (i < 3) {
        console.log(`Unit ${row.resource_name}: ${curve.length} curve points, Status: ${row.telemetered_resource_status}, Output: ${row.telemetered_net_output}`);
      }
      
      // Process each point in the curve
      let unitTotalMW = 0;
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
            
            unitTotalMW += mwSegment;
            totalProcessedMW += mwSegment;
            priceRange.min = Math.min(priceRange.min, price);
            priceRange.max = Math.max(priceRange.max, price);
          }
          prevMw = mw;
        }
      }
      
      // Debug first few units
      if (i < 3) {
        console.log(`Unit ${row.resource_name}: Processed ${unitTotalMW.toFixed(1)} MW`);
      }
    }
    
    console.log(`Total processed capacity: ${totalProcessedMW.toFixed(1)} MW`);
    console.log(`Price range in offer curves: $${priceRange.min.toFixed(2)} to $${priceRange.max.toFixed(2)}`);
    console.log(`Number of price segments: ${expandedData.length}`);
    
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
  
  // Add negative values if needed (exactly like Python version)
  if (yMin < 0) {
    const negTicks = [-5000, -2500, -1000, -500, -250, -100, -50, -25, -10, -1];
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

function generatePlotlyChart(data: ExpandedDataPoint[], date: string, hour: string, minute: string, scenario: string, actualDemand?: number | null) {
  const traces: ChartData[] = [];
  
  // Use actual demand from database if available, otherwise calculate 75% of capacity
  const totalCapacity = data.reduce((sum, d) => sum + d.mw, 0);
  const demand = actualDemand || Math.floor(totalCapacity * 0.75);
  
  console.log(`Total capacity: ${totalCapacity.toLocaleString()} MW`);
  if (actualDemand) {
    console.log(`Using actual demand: ${demand.toLocaleString()} MW (from database)`);
  } else {
    console.log(`Using calculated demand: ${demand.toLocaleString()} MW (75% load factor)`);
  }
  
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
    let height = point.price;
    const color = point.color;
    
    // Apply minimum height for visibility and special handling for zero prices
    let barTop, barBottom;
    
    if (height === 0) {
      // For zero prices, split the bar half above and half below zero line
      barTop = 0.125;
      barBottom = -0.125;
    } else if (Math.abs(height) < 0.25) {
      // For very small non-zero prices, apply minimum height
      height = height >= 0 ? 0.25 : -0.25;
      barTop = height;
      barBottom = 0;
    } else {
      // For normal prices, use actual height
      barTop = height;
      barBottom = 0;
    }
    
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
    
    // Create individual bar as filled rectangle (with special zero-price handling)
    traces.push({
      x: [displayLeft, displayLeft, displayRight, displayRight, displayLeft],
      y: [barBottom, barTop, barTop, barBottom, barBottom],
      name: point.fuel_type,
      type: 'scatter',
      fill: 'toself',
      fillcolor: color,
      line: { color: color, width: 0.5 },
      mode: 'lines',
      showlegend: showLegend,
      opacity: 0.8,
      text: `<b>${point.unit_code}</b><br>Resource Type: ${point.fuel_type}<br>Capacity: ${point.mw.toFixed(1)} MW<br>Price: $${point.price.toFixed(2)}/MWh<br>Load: ${barLeft.toFixed(0)} - ${barRight.toFixed(0)} MW`,
      hoverinfo: 'text'
    });
    
    prevMw += width;
  }
  
  // Removed horizontal $0 price line for cleaner visualization
  
  // Add vertical demand line (red dashed line) with better Y-axis scaling
  const prices = dataWithColors.map(d => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  
  // Simple fixed Y-axis range for optimal viewing of renewable generation
  const yMin = -50;
  const yMax = 100;
  
  console.log(`Price range in data: ${minPrice.toFixed(2)} to ${maxPrice.toFixed(2)}`);
  console.log(`Fixed Y-axis range: ${yMin} to ${yMax} (optimized for renewable generation view)`);
  
  // Add vertical demand line using actual demand from database
  if (demand > 0) {
    const maxCapacity = Math.max(...dataWithColors.map(d => d.cumulative_mw));
    
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
  }
  
  // Find clearing price at demand level
  let clearingPrice = 0;
  for (const point of dataWithColors) {
    if (point.cumulative_mw >= demand) {
      clearingPrice = point.price;
      break;
    }
  }
  
  // Create layout (clean, no title)
  const layout = {
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
      type: 'linear', // Same as Python - linear with custom ticks  
      range: [yMin, yMax], // Use exact Python range calculation
      // Custom tick values for symlog-like behavior (exactly like Python version)
      tickmode: 'array',
      tickvals: generateYTicks(yMin, yMax),
      ticktext: generateYTicks(yMin, yMax).map(formatPriceLabel)
    },
    hovermode: 'closest', // Best for individual bar hover
    showlegend: true,
    legend: {
      orientation: 'h', // Horizontal orientation
      x: 0.5, // Center horizontally
      xanchor: 'center',
      y: -0.35, // Position much lower to avoid overlap with x-axis title
      yanchor: 'top',
      bgcolor: 'rgba(255,255,255,0.8)', // Semi-transparent white background
      bordercolor: 'rgba(0,0,0,0.1)', // Light border
      borderwidth: 1
    },
    plot_bgcolor: 'white',
    paper_bgcolor: 'white',
    margin: { l: 60, r: 30, t: 80, b: 150 } // Increased bottom margin for lower legend position
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
