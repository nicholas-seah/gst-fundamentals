import type { APIRoute } from 'astro';

// Helper function to determine if a date is in daylight saving time
function isDaylightSavingTime(date: Date): boolean {
  // DST in US typically runs from second Sunday in March to first Sunday in November
  const year = date.getFullYear();
  const march = new Date(year, 2, 1); // March 1
  const november = new Date(year, 10, 1); // November 1
  
  // Find second Sunday in March
  const dstStart = new Date(year, 2, 14 - march.getDay());
  // Find first Sunday in November  
  const dstEnd = new Date(year, 10, 7 - november.getDay());
  
  return date >= dstStart && date < dstEnd;
}

// Convert Texas time to UTC
function texasTimeToUTC(dateStr: string, hour: string, minute: string): string {
  const date = new Date(dateStr);
  const hourNum = parseInt(hour);
  const minuteNum = parseInt(minute);
  
  // Set Texas time
  date.setHours(hourNum, minuteNum, 0, 0);
  
  // Determine offset (CST = UTC-6, CDT = UTC-5)
  const offset = isDaylightSavingTime(date) ? 5 : 6;
  
  // Convert to UTC
  const utcDate = new Date(date.getTime() + (offset * 60 * 60 * 1000));
  
  return utcDate.toISOString().slice(0, 19) + '+00:00';
}

interface OfferCurvePoint {
  mw: number;
  price: number;
  resource_name: string;
  resource_type: string;
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const hour = url.searchParams.get('hour');
    const minute = url.searchParams.get('minute');
    
    console.log('=== GridStatus API Request ===');
    console.log('Received parameters:', { date, hour, minute });
    
    if (!date || !hour || !minute) {
      console.error('Missing required parameters');
      return new Response(JSON.stringify({
        success: false,
        message: 'Missing required parameters: date, hour, minute'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Convert Texas time to UTC - user input is END of 15-minute interval
    const endTime = texasTimeToUTC(date, hour, minute);
    
    // Calculate start time as 15 minutes before the end time
    const endDate = new Date(endTime);
    const startDate = new Date(endDate.getTime() - (15 * 60 * 1000)); // Subtract 15 minutes
    const startTime = startDate.toISOString().slice(0, 19) + '+00:00';
    
    console.log('Time conversion:');
    console.log('  Texas input:', `${date} ${hour}:${minute}`);
    console.log('  UTC start time:', startTime);
    console.log('  UTC end time:', endTime);
    
    // Get GridStatus auth from environment
    const authToken = import.meta.env.GRIDSTATUS_AUTH;
    if (!authToken) {
      console.error('GRIDSTATUS_AUTH environment variable not found');
      throw new Error('GRIDSTATUS_AUTH environment variable not found');
    }
    console.log('Auth token found, length:', authToken.length);
    
    // Make API call to GridStatus (GET method with query parameter auth only)
    const apiUrl = new URL('https://api.gridstatus.io/v1/datasets/ercot_sced_gen_resource_60_day/query');
    apiUrl.searchParams.set('start', startTime);
    apiUrl.searchParams.set('end', endTime);
    apiUrl.searchParams.set('format', 'json');
    apiUrl.searchParams.set('api_key', authToken);
    
    console.log('GridStatus API URL:', apiUrl.toString());
    
    const gridStatusResponse = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('GridStatus API response status:', gridStatusResponse.status);
    console.log('GridStatus API response headers:', Object.fromEntries(gridStatusResponse.headers.entries()));
    
    if (!gridStatusResponse.ok) {
      console.error(`GridStatus API error: ${gridStatusResponse.status} ${gridStatusResponse.statusText}`);
      const errorText = await gridStatusResponse.text();
      console.error('GridStatus API error response:', errorText);
      throw new Error(`GridStatus API error: ${gridStatusResponse.status} ${gridStatusResponse.statusText}`);
    }
    
    const rawData = await gridStatusResponse.json();
    console.log('Raw data received, length:', rawData.data?.length || 0);
    
    // Check the actual date range of returned data
    if (rawData.data && rawData.data.length > 0) {
      const firstRecord = rawData.data[0];
      const lastRecord = rawData.data[rawData.data.length - 1];
      console.log('First record date:', firstRecord.interval_start_utc);
      console.log('Last record date:', lastRecord.interval_start_utc);
      console.log('Requested start:', startTime);
      console.log('Requested end:', endTime);
      
      // Check if returned data matches requested time period
      const firstRecordDate = new Date(firstRecord.interval_start_utc);
      const requestedStartDate = new Date(startTime);
      const timeDiff = Math.abs(firstRecordDate.getTime() - requestedStartDate.getTime());
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
      
      console.log('Days difference between requested and returned data:', daysDiff);
      
      if (daysDiff > 1) {
        console.warn('⚠️ WARNING: Returned data is from a different time period than requested!');
        console.warn(`Requested: ${startTime} to ${endTime}`);
        console.warn(`Received: ${firstRecord.interval_start_utc} to ${lastRecord.interval_start_utc}`);
      }
    }
    
    if (!rawData.data || rawData.data.length === 0) {
      throw new Error('No data available for the selected time period');
    }
    
    console.log('Starting data processing...');
    
    // Process the data with selective truncation
    const expandedData: OfferCurvePoint[] = [];
    const excludedStatuses = ['OUT', 'OFF', 'OFFNS']; // Filter out unavailable generators
    
    let processedRows = 0;
    let activeUnitsCount = 0;
    let skippedForStatus = 0;
    let skippedForZeroSchedule = 0;
    let skippedForMissingSchedule = 0;
    
    // Track all statuses found in the data
    const statusCounts: { [key: string]: number } = {};
    const includedStatusCounts: { [key: string]: number } = {};
    const excludedStatusCounts: { [key: string]: number } = {};
    
    // Add debugging for capacity tracking
    let totalOfferedCapacity = 0;
    let totalScheduledCapacity = 0;
    
    rawData.data.forEach((row: any) => {
      processedRows++;
      if (processedRows % 10000 === 0) {
        console.log(`Processed ${processedRows} rows...`);
      }
      
      // Track all statuses
      const status = row.telemetered_resource_status || 'UNKNOWN';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      
      // Filter out generators that are OUT or OFF
      if (excludedStatuses.includes(row.telemetered_resource_status)) {
        skippedForStatus++;
        excludedStatusCounts[status] = (excludedStatusCounts[status] || 0) + 1;
        return; // Skip unavailable units
      }
      
      // Track included statuses
      includedStatusCounts[status] = (includedStatusCounts[status] || 0) + 1;
      
      // Check for missing resource information
      if (!row.resource_name || !row.resource_type) {
        console.warn(`⚠️ Generator with missing info: name="${row.resource_name}" type="${row.resource_type}" status="${row.telemetered_resource_status}"`);
      }
      
      // Check if this is a renewable resource that requires special handling
      const isRenewableToTruncate = row.resource_type === 'WIND' || row.resource_type === 'PVGR';
      
      // Track total offered capacity (before any filtering)
      const maxOfferedMW = row.sced_tpo_offer_curve && row.sced_tpo_offer_curve.length > 0 
        ? Math.max(...row.sced_tpo_offer_curve.map((point: number[]) => point[0] || 0))
        : 0;
      totalOfferedCapacity += maxOfferedMW;
      
      // Check output_schedule - skip if missing
      const outputSchedule = row.output_schedule;
      if (outputSchedule === null || outputSchedule === undefined) {
        skippedForMissingSchedule++;
        if (skippedForMissingSchedule <= 3) {
          console.log(`⚠️ Generator ${row.resource_name} has missing output_schedule (offered ${maxOfferedMW} MW)`);
        }
        return;
      }
      
      // Skip renewables with zero or negative scheduled output, but include other types
      if (isRenewableToTruncate && outputSchedule <= 0) {
        skippedForZeroSchedule++;
        if (skippedForZeroSchedule <= 3) {
          console.log(`⚠️ Renewable ${row.resource_name} has zero/negative output_schedule: ${outputSchedule} MW`);
        }
        return;
      }
      
      // Track scheduled capacity (for renewables) or offered capacity (for others)
      if (isRenewableToTruncate) {
        totalScheduledCapacity += outputSchedule;
      } else {
        totalScheduledCapacity += maxOfferedMW; // Count full offered capacity for non-renewables
      }
      
      // This unit will be processed
      activeUnitsCount++;
      
      const curve = row.sced_tpo_offer_curve || [];
      let prevMw = 0;
      let cumulativeScheduled = 0; // Track how much we've scheduled so far
      
      // Process offer curve - truncate renewables to output_schedule, show full curve for others
      for (const point of curve) {
        if (point.length === 2) {
          const currentMw = point[0];
          const price = point[1];
          const segmentMw = currentMw - prevMw;
          
          if (segmentMw > 0) {
            if (isRenewableToTruncate && cumulativeScheduled < outputSchedule) {
              // For WIND/PVGR: truncate at output_schedule
              const remainingToSchedule = outputSchedule - cumulativeScheduled;
              const actualSegmentMw = Math.min(segmentMw, remainingToSchedule);
              
              expandedData.push({
                mw: actualSegmentMw,
                price: price,
                resource_name: row.resource_name || 'UNKNOWN_GENERATOR',
                resource_type: row.resource_type || 'UNKNOWN_TYPE'
              });
              
              cumulativeScheduled += actualSegmentMw;
              
              // If we've reached the scheduled output, stop processing this generator's curve
              if (cumulativeScheduled >= outputSchedule) {
                break;
              }
            } else if (!isRenewableToTruncate) {
              // For all other resource types: show full offer curve
              expandedData.push({
                mw: segmentMw,
                price: price,
                resource_name: row.resource_name || 'UNKNOWN_GENERATOR',
                resource_type: row.resource_type || 'UNKNOWN_TYPE'
              });
            }
          }
          
          prevMw = currentMw;
        }
      }
      
      // Verify we scheduled the expected amount for renewables (allow small floating point differences)
      if (isRenewableToTruncate && Math.abs(cumulativeScheduled - outputSchedule) > 0.1) {
        console.log(`⚠️ Generator ${row.resource_name}: scheduled ${cumulativeScheduled} MW vs expected ${outputSchedule} MW`);
      }
    });
    
    console.log(`🔍 CAPACITY ANALYSIS:`);
    console.log(`  Total generators from API: ${rawData.data.length}`);
    console.log(`  Total offered capacity: ${Math.round(totalOfferedCapacity).toLocaleString()} MW`);
    console.log(`  Total capacity in curve: ${Math.round(totalScheduledCapacity).toLocaleString()} MW`);
    console.log(`Data processing complete. Expanded data points: ${expandedData.length}`);
    console.log(`Active units processed: ${activeUnitsCount}`);
    console.log(`Skipped renewable units (zero/negative scheduled output): ${skippedForZeroSchedule}`);
    console.log(`Skipped units (missing output_schedule): ${skippedForMissingSchedule}`);
    console.log(`Skipped units (unavailable status): ${skippedForStatus}`);
    
    // Display status breakdown
    console.log(`📊 GENERATOR STATUS BREAKDOWN:`);
    console.log(`  All statuses found in data:`, statusCounts);
    console.log(`  ✅ INCLUDED statuses:`, includedStatusCounts);
    console.log(`  ❌ EXCLUDED statuses:`, excludedStatusCounts);
    
    // Alert if there are missing output_schedule values
    if (skippedForMissingSchedule > 0) {
      console.error(`🚨 ALERT: ${skippedForMissingSchedule} generators have missing output_schedule values!`);
    }
    if (skippedForStatus > 0) {
      console.warn(`⚠️ INFO: ${skippedForStatus} generators are unavailable (OUT/OFF status)`);
    }
    
    console.log(`📊 SUPPLY CURVE LOGIC:`);
    console.log(`   • Status filtering: OUT, OFF, and OFFNS generators excluded`);
    console.log(`   • WIND & PVGR: Truncated to output_schedule (actual renewable output)`);
    console.log(`   • All other resource types: Full offer curve shown (complete thermal/other capacity)`);
    console.log(`   This shows renewable actual output + available thermal capacity.`);
    
    // Filter for positive MW (generation resources)
    const supplyData = expandedData.filter(point => point.mw > 0);
    console.log(`Filtered supply data points: ${supplyData.length}`);
    
    // Sort by price (merit order)
    supplyData.sort((a, b) => a.price - b.price || a.mw - b.mw);
    console.log('Supply data sorted by merit order');
    
    // No longer limiting for performance - show full dataset
    const limitedSupplyData = supplyData; // Show all data points
    console.log(`Processing full supply dataset: ${limitedSupplyData.length} points`);
    
    // Calculate cumulative capacity and group by resource type for chart
    let cumulativeCapacity = 0;
    const processedData = limitedSupplyData.map(point => {
      const result = {
        ...point,
        cumulativeCapacity: cumulativeCapacity,
        cumulativeCapacityEnd: cumulativeCapacity + point.mw
      };
      cumulativeCapacity += point.mw;
      return result;
    });
    
    console.log('Cumulative capacity calculated');
    
    // Group by resource type for the chart display
    const resourceTypeMap: { [key: string]: { capacity: number; marginalCost: number; color: string } } = {};
    const colorMap: { [key: string]: string } = {
      'WIND': '#10B981',
      'SOLAR': '#F59E0B', 
      'NUCLEAR': '#8B5CF6',
      'GAS_CC': '#3B82F6',
      'COAL': '#6B7280',
      'GAS_ST': '#EF4444',
      'OIL_ST': '#F97316',
      'GAS_CT': '#EC4899',
      'OIL_CT': '#84CC16',
      'HYDRO': '#06B6D4',
      'OTHER': '#9CA3AF'
    };
    
    processedData.forEach(point => {
      const type = point.resource_type || 'OTHER';
      if (!resourceTypeMap[type]) {
        resourceTypeMap[type] = {
          capacity: 0,
          marginalCost: point.price,
          color: colorMap[type] || '#9CA3AF'
        };
      }
      resourceTypeMap[type].capacity += point.mw;
    });
    
    console.log('Resource type mapping complete');
    
    const response = {
      success: true,
      message: 'GridStatus data retrieved successfully',
      data: {
        rawSupplyCurve: processedData,
        resourceTypeSummary: resourceTypeMap,
        totalCapacity: cumulativeCapacity,
        dataPoints: processedData.length
      },
      metadata: {
        startTime,
        endTime,
        originalDataPoints: rawData.data.length,
        processedDataPoints: processedData.length,
        totalExpandedPoints: expandedData.length,
        limitedForPerformance: false // No longer limiting dataset
      }
    };
    
    console.log(`Sending response with full dataset: ${processedData.length} data points (no performance limiting)`);
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('GridStatus API error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to fetch GridStatus data',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}; 