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

// Helper function to get number of hours in a specific month and year
function getHoursInMonth(month: number, year: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  return daysInMonth * 24;
}

// Helper function to convert GWh to MWa
function convertGWhToMWa(gwh: number, month: number, year: number): number {
  const mwh = gwh * 1000; // Convert GWh to MWh
  const hoursInMonth = getHoursInMonth(month, year);
  return mwh / hoursInMonth; // Convert MWh to MWa (average)
}

export const GET: APIRoute = async ({ request }) => {
  try {
    console.log('Fetching ERCOT chart data...');
    
    // Get current date to filter incomplete months
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed
    
    // Query to get all ERCOT structural demand data (all available years)
    const rawData = await ercotDb.$queryRaw<Array<{
      Month: string;
      GWh: string;
      Zone: string;
      Year: number;
    }>>`
      SELECT "Month", "GWh", "Zone", "Year"
      FROM "ERCOT"."ERCOT_structural_demand"
      ORDER BY "Year" ASC, "Month" ASC
    `;

    console.log(`Retrieved ${rawData.length} raw data points`);

    // Filter out incomplete months
    const filteredData = rawData.filter(row => {
      const monthNum = monthNameToNumber(row.Month);
      
      // Include all data for past years
      if (row.Year < currentYear) {
        return true;
      }
      
      // For current year, only include fully completed months (not the current month we're in)
      if (row.Year === currentYear) {
        return monthNum < currentMonth; // Changed from <= to < to exclude current incomplete month
      }
      
      // Exclude future years entirely
      return false;
    });

    console.log(`Filtered to ${filteredData.length} data points (removed incomplete months)`);

    // Dynamically determine available years from filtered data
    const availableYears = [...new Set(filteredData.map(row => row.Year))].sort();
    console.log('Available years:', availableYears);

    // Group and sum by Month and Year (aggregate across all zones)
    const monthlyTotals: { [key: string]: number } = {};
    
    filteredData.forEach(row => {
      const monthNum = monthNameToNumber(row.Month);
      const key = `${row.Year}-${monthNum}`;
      const gwhValue = parseFloat(row.GWh);
      
      if (!monthlyTotals[key]) {
        monthlyTotals[key] = 0;
      }
      monthlyTotals[key] += gwhValue;
    });

    // Convert to Chart.js format using dynamic years
    const chartData: { [year: number]: (number | null)[] } = {};
    
    // Initialize arrays for each available year (12 months, with null for incomplete months)
    availableYears.forEach(year => {
      chartData[year] = new Array(12).fill(null);
      
      // For current year, only fill up to completed months (exclude current incomplete month)
      const maxMonth = year === currentYear ? currentMonth - 1 : 12;
      for (let month = 1; month <= maxMonth; month++) {
        chartData[year][month - 1] = 0; // Initialize with 0, will be filled with actual data
      }
    });
    
    // Fill in the actual data
    Object.entries(monthlyTotals).forEach(([key, total]) => {
      const [yearStr, monthStr] = key.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);
      
      if (chartData[year] && month >= 1 && month <= 12) {
        const mwa = convertGWhToMWa(total, month, year);
        chartData[year][month - 1] = Math.round(mwa); // Round to nearest MW
      }
    });

    const response = {
      success: true,
      message: 'ERCOT chart data retrieved successfully',
      data: {
        labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
        datasets: availableYears.map(year => ({
          year: year.toString(),
          data: chartData[year]
        }))
      },
      metadata: {
        rawDataPoints: rawData.length,
        filteredDataPoints: filteredData.length,
        years: availableYears,
        zones: ['Houston', 'North', 'South', 'West'],
        units: 'MW Avg. (Megawatt average)',
        currentDate: now.toISOString().split('T')[0],
        currentYear,
        currentMonth
      }
    };

    console.log('Chart data processed successfully:', response.metadata);
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Failed to fetch ERCOT chart data:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to fetch ERCOT chart data',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}; 