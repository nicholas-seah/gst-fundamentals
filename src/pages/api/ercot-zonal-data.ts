import type { APIRoute } from 'astro';
import { ercotDb } from '../../lib/database';

// Helper function to convert month names to numbers
function monthNameToNumber(monthName: string): number {
  const monthMap: { [key: string]: number } = {
    'JANUARY': 1, 'FEBRUARY': 2, 'MARCH': 3, 'APRIL': 4,
    'MAY': 5, 'JUNE': 6, 'JULY': 7, 'AUGUST': 8,
    'SEPTEMBER': 9, 'OCTOBER': 10, 'NOVEMBER': 11, 'DECEMBER': 12
  };
  return monthMap[monthName.toUpperCase()] || 0;
}

export const GET: APIRoute = async ({ request }) => {
  try {
    console.log('Fetching ERCOT zonal YoY data...');
    
    // Query to get all ERCOT structural demand data by zone (no year restriction)
    const rawData = await ercotDb.$queryRaw<Array<{
      Month: string;
      GWh: string;
      Zone: string;
      Year: number;
    }>>`
      SELECT "Month", "GWh", "Zone", "Year"
      FROM "ERCOT"."ERCOT_structural_demand"
      ORDER BY "Zone" ASC, "Year" ASC, "Month" ASC
    `;

    console.log(`Retrieved ${rawData.length} raw zonal data points`);

    // Get current date to filter incomplete months
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed

    // Filter out incomplete months
    const filteredData = rawData.filter(row => {
      const monthNum = monthNameToNumber(row.Month);
      if (row.Year < currentYear) {
        return true;
      }
      if (row.Year === currentYear) {
        return monthNum < currentMonth; // Exclude current incomplete month
      }
      return false;
    });

    // Dynamically determine available years for growth calculation
    const availableYears = [...new Set(filteredData.map(row => row.Year))].sort();
    const growthYears = availableYears.filter(year => year > availableYears[0]); // Exclude first year (base year)

    console.log('Available years:', availableYears);
    console.log('Growth calculation years:', growthYears);

    // Group data by Zone, Year, and Month
    const zonalData: { [key: string]: number } = {};
    
    filteredData.forEach(row => {
      const monthNum = monthNameToNumber(row.Month);
      const key = `${row.Zone}-${row.Year}-${monthNum}`;
      const gwhValue = parseFloat(row.GWh);
      
      zonalData[key] = gwhValue;
    });

    // Calculate YoY growth for each zone
    const zones = ['Houston', 'North', 'South', 'West'];
    const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    // Prepare Chart.js format data
    const labels: string[] = [];
    const datasets = zones.map(zone => ({
      label: zone,
      data: [] as number[]
    }));

    // Generate labels and calculate growth for each available growth year
    growthYears.forEach(year => {
      const maxMonth = year === currentYear ? currentMonth - 1 : 12;
      
      for (let month = 1; month <= maxMonth; month++) {
        // Add label for this month
        labels.push(`${year}-${month.toString().padStart(2, '0')}`);
        
        // Calculate YoY growth for each zone
        zones.forEach((zone, zoneIndex) => {
          const currentKey = `${zone}-${year}-${month}`;
          const previousKey = `${zone}-${year - 1}-${month}`;
          
          const currentValue = zonalData[currentKey] || 0;
          const previousValue = zonalData[previousKey] || 0;
          
          let growthPercent = 0;
          if (previousValue > 0) {
            growthPercent = ((currentValue - previousValue) / previousValue) * 100;
          }
          
          datasets[zoneIndex].data.push(Math.round(growthPercent * 10) / 10); // Round to 1 decimal
        });
      }
    });

    // Add colors to datasets
    const colorPalette = [
      { zone: 'Houston', color: '#4F46E5' }, // Action Indigo
      { zone: 'North', color: '#F59E0B' },   // Warning Orange  
      { zone: 'South', color: '#EF4444' },   // Critical Red
      { zone: 'West', color: '#34D5ED' },    // GridStor Blue
    ];

    const finalDatasets = datasets.map(dataset => {
      const colorInfo = colorPalette.find(c => c.zone === dataset.label);
      return {
        ...dataset,
        borderColor: colorInfo?.color || '#34D5ED',
        backgroundColor: `${colorInfo?.color || '#34D5ED'}1A`, // 10% opacity
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.2,
      };
    });

    const response = {
      success: true,
      message: 'ERCOT zonal YoY data retrieved successfully',
      data: {
        labels,
        datasets: finalDatasets
      },
      metadata: {
        rawDataPoints: rawData.length,
        filteredDataPoints: filteredData.length,
        zones,
        years: availableYears,
        growthYears: growthYears,
        units: 'YoY Growth %'
      }
    };

    console.log('Zonal YoY data processed successfully:', response.metadata);
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Failed to fetch ERCOT zonal YoY data:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to fetch ERCOT zonal YoY data',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}; 