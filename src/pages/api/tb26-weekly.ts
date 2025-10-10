import type { APIRoute } from 'astro';

interface LMPDataPoint {
  MARKETDAY: string;
  HOURENDING: number;
  'GOLETA_6_N100 (DALMP)': number;
  'GOLETA_6_N100 (RTLMP)'?: number;
}

interface TB26Result {
  success: boolean;
  data?: {
    weeklyRevenue: number;
    tb26Value: number; // $/kW-month
    dateRange: {
      startDate: string;
      endDate: string;
    };
    dailyRevenues: Array<{
      date: string;
      revenue: number;
    }>;
  };
  error?: string;
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const marketType = url.searchParams.get('marketType') || 'DA';
    
    // Battery parameters (hardcoded as requested)
    const capacity = 160; // MW
    const roundtripEfficiency = 0.86;
    const chargingRestrictions = [11.0, 41.3, 41.3, 41.3, 41.3, 41.3, 41.3, 11.0, 11.0, 11.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11.0, 11.0, 11.0, 11.0, 11.0];
    
    // Check for YES_AUTH environment variable
    const yesAuth = process.env.YES_AUTH;
    if (!yesAuth) {
      return new Response(JSON.stringify({
        success: false,
        error: 'YES_AUTH environment variable not configured'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Calculate date range (last 7 days)
    const today = new Date();
    const endDate = new Date(today.getTime() - 24 * 60 * 60 * 1000); // Yesterday
    const startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    console.log(`Fetching TB2.6 data from ${startDateStr} to ${endDateStr} for ${marketType} market`);
    
    // Fetch LMP data from Yes Energy API
    const yesEnergyUrl = `https://services.yesenergy.com/PS/rest/timeseries/multiple.html?agglevel=hour&startdate=${startDateStr}&enddate=${endDateStr}&timezone=PPT&items=${marketType}LMP:20000001321`;
    
    const response = await fetch(yesEnergyUrl, {
      headers: {
        'Authorization': `Basic ${Buffer.from(yesAuth).toString('base64')}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Yes Energy API error: ${response.status} ${response.statusText}`);
    }
    
    const htmlContent = await response.text();
    
    // Parse HTML table (simplified - in production you'd want a proper HTML parser)
    const lmpData = parseYesEnergyHTML(htmlContent, marketType);
    
    if (lmpData.length === 0) {
      throw new Error('No LMP data received from Yes Energy API');
    }
    
    // Calculate TB2.6 for each day
    const dailyRevenues = calculateDailyRevenues(lmpData, chargingRestrictions, roundtripEfficiency, capacity, marketType);
    
    // Calculate weekly totals
    const weeklyRevenue = dailyRevenues.reduce((sum, day) => sum + day.revenue, 0);
    const tb26Value = estimateWeeklyToMonthly(weeklyRevenue, dailyRevenues.length, 60); // 60 MW for TB2.6 calculation
    
    const result: TB26Result = {
      success: true,
      data: {
        weeklyRevenue,
        tb26Value,
        dateRange: {
          startDate: startDateStr,
          endDate: endDateStr
        },
        dailyRevenues
      }
    };
    
    console.log(`TB2.6 calculation complete: ${tb26Value.toFixed(2)} $/kW-month`);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('TB2.6 calculation error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Helper function to parse Yes Energy HTML response
function parseYesEnergyHTML(htmlContent: string, marketType: string): LMPDataPoint[] {
  // This is a simplified parser - in production you'd want a proper HTML parser like cheerio
  // For now, we'll assume the data comes in a predictable table format
  
  try {
    // Extract table data (this is a placeholder - you'll need to adapt based on actual HTML structure)
    const lines = htmlContent.split('\n');
    const dataLines = lines.filter(line => line.includes('GOLETA_6_N100'));
    
    const lmpData: LMPDataPoint[] = [];
    
    // Parse each data line (adapt this based on actual HTML structure)
    dataLines.forEach(line => {
      // This parsing logic will need to be adjusted based on the actual HTML format
      // For now, this is a placeholder structure
      const data: LMPDataPoint = {
        MARKETDAY: '2025-01-01', // Extract from HTML
        HOURENDING: 1, // Extract from HTML
        [`GOLETA_6_N100 (${marketType}LMP)`]: 50.0 // Extract from HTML
      };
      lmpData.push(data);
    });
    
    return lmpData;
  } catch (error) {
    console.error('Error parsing Yes Energy HTML:', error);
    return [];
  }
}

// Calculate daily revenues using battery arbitrage logic
function calculateDailyRevenues(
  lmpData: LMPDataPoint[], 
  chargingRestrictions: number[], 
  roundtripEfficiency: number, 
  capacity: number,
  marketType: string
): Array<{ date: string; revenue: number }> {
  
  const dailyRevenues: Array<{ date: string; revenue: number }> = [];
  
  // Group data by market day
  const dataByDay = new Map<string, LMPDataPoint[]>();
  lmpData.forEach(point => {
    if (!dataByDay.has(point.MARKETDAY)) {
      dataByDay.set(point.MARKETDAY, []);
    }
    dataByDay.get(point.MARKETDAY)!.push(point);
  });
  
  // Calculate revenue for each day
  dataByDay.forEach((dayData, marketDay) => {
    const priceColumn = `GOLETA_6_N100 (${marketType}LMP)` as keyof LMPDataPoint;
    
    // Sort by price for buying (ascending - cheapest first)
    const sortedForBuying = [...dayData].sort((a, b) => 
      (a[priceColumn] as number) - (b[priceColumn] as number)
    );
    
    // Calculate buying cost
    let costBuy = 0;
    let mwBuy = 0;
    let buyIndex = 0;
    
    while (mwBuy < capacity && buyIndex < sortedForBuying.length) {
      const hour = sortedForBuying[buyIndex].HOURENDING;
      const price = sortedForBuying[buyIndex][priceColumn] as number;
      const restriction = chargingRestrictions[hour - 1]; // hour - 1 for 0-based array
      
      const availableCapacity = Math.min(restriction, capacity - mwBuy);
      
      costBuy += price * availableCapacity;
      mwBuy += availableCapacity;
      buyIndex++;
    }
    
    // Sort by price for selling (descending - highest first)
    const sortedForSelling = [...dayData].sort((a, b) => 
      (b[priceColumn] as number) - (a[priceColumn] as number)
    );
    
    // Calculate selling profit
    let profitSell = 0;
    let mwSell = 0;
    let sellIndex = 0;
    const totalSellQuantity = capacity * roundtripEfficiency;
    const sellQuantityPerHour = 60; // MW per hour
    
    while (mwSell < totalSellQuantity && sellIndex < sortedForSelling.length) {
      const price = sortedForSelling[sellIndex][priceColumn] as number;
      const quantity = Math.min(sellQuantityPerHour, totalSellQuantity - mwSell);
      
      profitSell += price * quantity;
      mwSell += quantity;
      sellIndex++;
    }
    
    const dailyRevenue = profitSell - costBuy;
    dailyRevenues.push({
      date: marketDay,
      revenue: dailyRevenue
    });
  });
  
  return dailyRevenues;
}

// Convert weekly revenue to monthly TB2.6 metric
function estimateWeeklyToMonthly(weeklyRevenue: number, daysCount: number, mwCapacity: number): number {
  const avgDailyRevenue = weeklyRevenue / daysCount;
  const estimatedMonthlyRevenue = avgDailyRevenue * 30.25; // Average days per month
  return estimatedMonthlyRevenue / (mwCapacity * 1000); // Convert to $/kW-month
}
