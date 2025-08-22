import type { APIRoute } from 'astro';
import { ercotDb } from '../../lib/database';

export const GET: APIRoute = async ({ request }) => {
  try {
    console.log('Fetching ERCOT BESS capacity data...');
    
    // Use raw SQL to query the ERCOT_BESS_Capacity_Annual table
    const bessData = await ercotDb.$queryRaw`
      SELECT 
        "Year",
        "Capacity"
      FROM "ERCOT"."ERCOT_BESS_Capacity_Annual"
      WHERE "Year" >= 2020 AND "Year" <= 2030
      ORDER BY "Year" ASC
    ` as Array<{
      Year: number;
      Capacity: number | null;
    }>;

    console.log(`Retrieved ${bessData.length} BESS historical data records`);
    
    // Log a sample of the data for debugging
    if (bessData.length > 0) {
      console.log('Sample BESS historical data:', bessData.slice(0, 3));
    }
    
    // Define artificial data for missing years and projections
    const artificialData = {
      // Historical artificial data (starting at higher baseline)
      2020: 13000,  // Starting baseline capacity
      2021: 15500,  // Moderate growth (+19%)
      2022: 18200,  // Continued expansion (+17%)
      2023: 21800,  // Accelerated deployment (+20%)
      2024: 26500,  // Strong market growth (+22%)
      // Future projections
      2025: 30000,  // Conservative projection
      2026: 34500,  // Moderate growth
      2027: 39500,  // Continued expansion
      2028: 45000,  // Accelerated deployment
      2029: 51500,  // High growth scenario
      2030: 58000   // Long-term target
    };
    
    // Define projection scenarios for future years (2025-2030)
    const mockProjections = {
      conservative: {
        2025: 30000, 2026: 34000, 2027: 38000, 2028: 42000, 2029: 46000, 2030: 50000
      },
      moderate: {
        2025: 32000, 2026: 38000, 2027: 45000, 2028: 53000, 2029: 62000, 2030: 72000
      },
      aggressive: {
        2025: 35000, 2026: 45000, 2027: 58000, 2028: 74000, 2029: 95000, 2030: 120000
      }
    };
    
    // Define all years we want to show (2020-2030)
    const allYears = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];
    
    // Initialize scenario arrays
    const scenarios = {
      historical: new Array(allYears.length).fill(null),
      conservative: new Array(allYears.length).fill(null),
      moderate: new Array(allYears.length).fill(null),
      aggressive: new Array(allYears.length).fill(null)
    };
    
    // Create a map of database data for quick lookup
    const dbDataMap = new Map();
    bessData.forEach(row => {
      dbDataMap.set(row.Year, row.Capacity);
    });
    
    // Fill historical data (combine database + artificial data)
    allYears.forEach((year, index) => {
      if (year <= 2024) { // Historical years
        if (dbDataMap.has(year)) {
          // Use database data if available (rounded to whole numbers)
          scenarios.historical[index] = Math.round(dbDataMap.get(year) || 0);
        } else {
          // Use artificial data for missing historical years
          scenarios.historical[index] = artificialData[year as keyof typeof artificialData] || null;
        }
      }
      // For 2025-2030, historical line will be null (only projections)
    });
    
    // Fill projection data for 2025-2030
    allYears.forEach((year, index) => {
      if (year >= 2025) {
        scenarios.conservative[index] = (mockProjections.conservative as any)[year] || null;
        scenarios.moderate[index] = (mockProjections.moderate as any)[year] || null;
        scenarios.aggressive[index] = (mockProjections.aggressive as any)[year] || null;
      }
    });
    
    const response = {
      success: true,
      message: 'BESS capacity data retrieved successfully',
      data: {
        years: allYears,
        scenarios: scenarios,
        rawData: bessData
      },
      metadata: {
        totalRecords: bessData.length,
        databaseYears: bessData.map(row => row.Year).sort(),
        artificialYears: allYears.filter(year => year <= 2024 && !dbDataMap.has(year)),
        yearRange: `${allYears[0]}-${allYears[allYears.length - 1]}`,
        lastUpdated: new Date().toISOString(),
        dataSource: 'Historical: Database + Artificial, Projections: Sample'
      }
    };
    
    console.log('BESS data transformation complete:', {
      totalYears: allYears.length,
      databaseRecords: bessData.length,
      artificialHistoricalYears: response.metadata.artificialYears.length,
      yearRange: response.metadata.yearRange
    });
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('BESS data API error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to fetch BESS capacity data',
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        timestamp: new Date().toISOString()
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}; 