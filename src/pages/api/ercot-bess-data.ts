import type { APIRoute } from 'astro';
import { ercotDb } from '../../lib/database';

export const GET: APIRoute = async ({ request }) => {
  try {
    console.log('Fetching ERCOT BESS capacity data...');
    
    // Use raw SQL to query the ERCOT_BESS_Capacity_Annual table for monthly data
    const bessData = await ercotDb.$queryRaw`
      SELECT 
        "Date",
        "Capacity"
      FROM "ERCOT"."ERCOT_BESS_Capacity_Annual"
      WHERE "Date" >= '2023-01-01'::date
      ORDER BY "Date" ASC
    ` as Array<{
      Date: Date;
      Capacity: number | null;
    }>;

    console.log(`Retrieved ${bessData.length} BESS monthly data records`);
    
    // Convert monthly data to format component expects (monthly labels as "years")
    const monthlyLabels: string[] = [];
    const monthlyCapacities: (number | null)[] = [];
    
    bessData.forEach(row => {
      const date = new Date(row.Date);
      const monthLabel = date.toLocaleDateString('en-US', { 
        month: 'short', 
        year: 'numeric' 
      }); // e.g., "Jan 2023"
      
      monthlyLabels.push(monthLabel);
      monthlyCapacities.push(row.Capacity);
    });
    
    console.log(`Processed ${monthlyLabels.length} months from ${monthlyLabels[0]} to ${monthlyLabels[monthlyLabels.length - 1]}`);
    
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
    
    // Use monthly data directly (no projections)
    const scenarios = {
      historical: monthlyCapacities,
      conservative: new Array(monthlyLabels.length).fill(null), // No projections for monthly data
      moderate: new Array(monthlyLabels.length).fill(null),
      aggressive: new Array(monthlyLabels.length).fill(null)
    };
    
    const response = {
      success: true,
      message: 'BESS capacity data retrieved successfully',
      data: {
        years: monthlyLabels, // Monthly labels like "Jan 2023", "Feb 2023"
        scenarios: scenarios,
        rawData: bessData
      },
      metadata: {
        totalRecords: bessData.length,
        databaseYears: monthlyLabels, // All data from database
        yearRange: `${monthlyLabels[0]}-${monthlyLabels[monthlyLabels.length - 1]}`,
        lastUpdated: new Date().toISOString(),
        dataSource: 'Historical: Database + Artificial, Projections: Sample'
      }
    };
    
    console.log('BESS data transformation complete:', {
      totalMonths: monthlyLabels.length,
      databaseRecords: bessData.length,
      dateRange: response.metadata.yearRange
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