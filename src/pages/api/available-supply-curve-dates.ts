import type { APIRoute } from 'astro';
import { ercotDb } from '../../lib/database';

export const GET: APIRoute = async () => {
  try {
    console.log('Fetching available supply curve dates...');
    
    // Query for distinct dates that have offer curve data
    const availableDates = await ercotDb.$queryRaw<Array<{
      date: Date;
    }>>`
      SELECT DISTINCT DATE("interval_start_local") as date
      FROM "ERCOT"."ERCOT_Generation_Offer_Curve"
      WHERE "interval_start_local" IS NOT NULL
      ORDER BY date DESC
    `;
    
    // Convert to simple date strings in YYYY-MM-DD format
    const dates = availableDates.map(row => {
      const date = new Date(row.date);
      return date.toISOString().split('T')[0]; // Convert to YYYY-MM-DD format
    });
    
    console.log(`Found ${dates.length} available dates for supply curve data:`, dates);
    
    return new Response(JSON.stringify({
      success: true,
      dates: dates,
      count: dates.length
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    console.error('Error fetching available dates:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      dates: []
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};
