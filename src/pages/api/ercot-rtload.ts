import type { APIRoute } from 'astro';
import { rtLoadDb } from '../../lib/database';

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const hour = url.searchParams.get('hour');
    const minute = url.searchParams.get('minute');
    
    console.log('=== ERCOT RT Load API Request ===');
    console.log('Received parameters:', { date, hour, minute });
    
    if (!date || !hour || !minute) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Missing required parameters: date, hour, minute'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Convert user input to datetime string for database query
    // User input represents the END of a 15-minute interval
    const hourNum = parseInt(hour);
    const minuteNum = parseInt(minute);
    
    // Handle different date formats - convert to YYYY-MM-DD format
    let formattedDate = date;
    if (date.includes('/')) {
      // Handle MM/DD/YYYY format
      const dateParts = date.split('/');
      if (dateParts.length === 3) {
        const [month, day, year] = dateParts;
        formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        console.log('Converted date format:', date, '->', formattedDate);
      }
    }
    
    // Create the datetime string in format: YYYY-MM-DD HH:MM:00
    const datetime = `${formattedDate} ${hourNum.toString().padStart(2, '0')}:${minuteNum.toString().padStart(2, '0')}:00`;
    
    console.log('Querying for RT Load at datetime:', datetime);
    
    // Query the yes_fundamentals table for ERCOT RT Load at the specific datetime
    const result = await rtLoadDb.$queryRaw`
      SELECT value, local_datetime_ib, entity, attribute
      FROM public.yes_fundamentals
      WHERE entity = 'ERCOT' 
        AND attribute = 'RTLOAD'
        AND local_datetime_ib = ${datetime}::timestamp
      LIMIT 1
    `;
    
    console.log('Database query result:', result);
    
    if (!result || (result as any[]).length === 0) {
      console.log('No RT Load data found for the specified datetime, looking for closest match...');
      
      // Try to find the closest available data point
      const closestResult = await rtLoadDb.$queryRaw`
        SELECT value, local_datetime_ib, entity, attribute,
               ABS(EXTRACT(EPOCH FROM (local_datetime_ib - ${datetime}::timestamp))) as time_diff_seconds
        FROM public.yes_fundamentals
        WHERE entity = 'ERCOT' 
          AND attribute = 'RTLOAD'
          AND local_datetime_ib BETWEEN (${datetime}::timestamp - INTERVAL '2 hours') 
                                   AND (${datetime}::timestamp + INTERVAL '2 hours')
        ORDER BY time_diff_seconds ASC
        LIMIT 1
      `;
      
      if (!closestResult || (closestResult as any[]).length === 0) {
        return new Response(JSON.stringify({
          success: false,
          message: 'No RT Load data available for the requested time period'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const closestData = (closestResult as any[])[0];
      console.log('Using closest available data point:', closestData);
      
      return new Response(JSON.stringify({
        success: true,
        data: {
          rtLoad: Math.round(parseFloat(closestData.value)), // RT Load in MW
          datetime: closestData.local_datetime_ib,
          requestedDatetime: datetime,
          isExactMatch: false,
          timeDifferenceSeconds: Math.round(parseFloat(closestData.time_diff_seconds))
        },
        message: `Using closest available RT Load data (${Math.round(parseFloat(closestData.time_diff_seconds) / 60)} minutes difference)`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const rtLoadData = (result as any[])[0];
    const rtLoadValue = Math.round(parseFloat(rtLoadData.value));
    
    console.log(`Found exact RT Load data: ${rtLoadValue} MW at ${rtLoadData.local_datetime_ib}`);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        rtLoad: rtLoadValue, // RT Load in MW
        datetime: rtLoadData.local_datetime_ib,
        requestedDatetime: datetime,
        isExactMatch: true,
        timeDifferenceSeconds: 0
      },
      message: `RT Load data retrieved successfully: ${rtLoadValue} MW`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('RT Load API error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to fetch RT Load data from database',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}; 