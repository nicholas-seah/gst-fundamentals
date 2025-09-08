import type { APIRoute } from 'astro';
import { ercotDb } from '../../lib/database';

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const contractTerm = url.searchParams.get('contractTerm') || 'Calendar'; // Default to Calendar
    
    console.log('Fetching available curve dates for contract term:', contractTerm);
    
    // Get unique curve dates from both power and gas tables for specific contract term
    const curveDates = await ercotDb.$queryRaw<Array<{ curve_date: Date }>>`
      SELECT DISTINCT "Curve_Date" as curve_date
      FROM (
        SELECT "Curve_Date"
        FROM "ERCOT"."OTCGH_Calendar_Curves_NG"
        WHERE "Contract_Term" = ${contractTerm}
          AND "Market" IN ('HSC', 'EP WEST TX', 'WAHA', 'SOCAL CITYGATE', 'HENRY BASIS', 'KATY')
        UNION
        SELECT "Curve_Date"
        FROM "ERCOT"."OTCGH_Calendar_Curves_PW"
        WHERE "Contract_Term" = ${contractTerm}
          AND "Market" IN ('Houston', 'South', 'North', 'West_TX', 'SP_15')
      ) combined_dates
      ORDER BY curve_date DESC
    `;

    console.log(`Retrieved ${curveDates.length} unique curve dates`);

    // Format dates as YYYY-MM-DD strings
    const formattedDates = curveDates.map(row => 
      new Date(row.curve_date).toISOString().split('T')[0]
    );

    const response = {
      success: true,
      message: 'Available curve dates retrieved successfully',
      data: {
        dates: formattedDates,
        count: formattedDates.length
      }
    };

    console.log('Curve dates processed successfully:', response.data);
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Failed to fetch curve dates:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to fetch curve dates',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
