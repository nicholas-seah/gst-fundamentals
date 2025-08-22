import type { APIRoute } from 'astro';
import { spawn } from 'child_process';
import path from 'path';

// Helper function to determine if a date is in daylight saving time
function isDaylightSavingTime(date: Date): boolean {
  const year = date.getFullYear();
  const march = new Date(year, 2, 1);
  const november = new Date(year, 10, 1);
  
  const dstStart = new Date(year, 2, 14 - march.getDay());
  const dstEnd = new Date(year, 10, 7 - november.getDay());
  
  return date >= dstStart && date < dstEnd;
}

// Convert Texas time to UTC
function texasTimeToUTC(dateStr: string, hour: string, minute: string): string {
  const date = new Date(dateStr);
  const hourNum = parseInt(hour);
  const minuteNum = parseInt(minute);
  
  date.setHours(hourNum, minuteNum, 0, 0);
  
  const offset = isDaylightSavingTime(date) ? 5 : 6;
  const utcDate = new Date(date.getTime() + (offset * 60 * 60 * 1000));
  
  return utcDate.toISOString().slice(0, 19) + '+00:00';
}

// Run Python script to fetch GridStatus data
function runPythonScript(startTime: string, endTime: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonScript = `
import sys
import json
import logging
from gridstatusio import GridStatusClient

# Suppress GridStatus INFO logs that go to stderr
logging.getLogger('gridstatusio').setLevel(logging.WARNING)
logging.getLogger('requests').setLevel(logging.WARNING)
logging.getLogger('urllib3').setLevel(logging.WARNING)

try:
    # Get auth token from environment or use the one we know works
    auth_token = "${import.meta.env.GRIDSTATUS_AUTH || 'f800e25fb5e4411d99fc3384a5e2ff54'}"
    
    # Create client
    client = GridStatusClient(auth_token)
    
    # Fetch data
    df = client.get_dataset(
        dataset="ercot_sced_gen_resource_60_day",
        start="${startTime}",
        end="${endTime}",
    )
    
    # Convert to JSON format
    # Handle datetime columns that aren't JSON serializable
    df_copy = df.copy()
    for col in df_copy.columns:
        if df_copy[col].dtype.name.startswith('datetime'):
            df_copy[col] = df_copy[col].dt.strftime('%Y-%m-%d %H:%M:%S+00:00')
    
    # Use pandas' built-in JSON serialization which properly handles NaN values
    import json as json_module
    json_str = df_copy.to_json(orient='records', date_format='iso')
    data_list = json_module.loads(json_str)
    
    result = {
        'success': True,
        'data': data_list,
        'metadata': {
            'rows': len(df),
            'columns': df.columns.tolist(),
            'start_time': '${startTime}',
            'end_time': '${endTime}'
        }
    }
    
    # Ensure we output to stdout and exit cleanly
    print(json.dumps(result))
    sys.stdout.flush()
    sys.exit(0)
    
except Exception as e:
    error_result = {
        'success': False,
        'error': str(e),
        'metadata': {
            'start_time': '${startTime}',
            'end_time': '${endTime}'
        }
    }
    print(json.dumps(error_result))
    sys.stdout.flush()
    sys.exit(1)
`;

    console.log('Starting Python process...');
    const pythonProcess = spawn('python', ['-c', pythonScript], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      // Only log first chunk to avoid overwhelming console with 1.26MB of data
      if (stdout.length < 1000) {
        console.log('Python stdout chunk:', chunk.substring(0, 200) + (chunk.length > 200 ? '...' : ''));
      } else if (stdout.length === 1000) {
        console.log('Large data stream detected, suppressing further stdout logs...');
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      console.log('Python stderr chunk:', chunk.substring(0, 200) + (chunk.length > 200 ? '...' : ''));
    });

    pythonProcess.on('close', (code) => {
      console.log(`Python process closed with code: ${code}`);
      console.log(`stdout length: ${stdout.length}`);
      console.log(`stderr length: ${stderr.length}`);
      
      if (stdout.trim()) {
        console.log('stdout preview:', stdout.substring(0, 500) + (stdout.length > 500 ? '...' : ''));
      }
      
      // Try to parse JSON output regardless of exit code
      if (stdout.trim()) {
        try {
          const result = JSON.parse(stdout.trim());
          console.log('Successfully parsed JSON from Python script');
          console.log('Success status:', result.success);
          console.log('Data rows:', result.metadata?.rows);
          
          if (result.success) {
            resolve(result);
            return;
          } else {
            reject(new Error(`Python script returned error: ${result.error}`));
            return;
          }
        } catch (parseError) {
          console.error('Failed to parse JSON from Python script:', parseError);
          console.error('Raw stdout:', stdout);
          reject(new Error(`Failed to parse Python JSON output: ${parseError}`));
          return;
        }
      }
      
      // If no stdout, it's definitely an error
      const errorMsg = stderr.trim() || 'No output from Python script';
      reject(new Error(`Python script failed (code ${code}): ${errorMsg}`));
    });

    pythonProcess.on('error', (error) => {
      console.error('Python process error:', error);
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });
    
    // Add timeout to prevent hanging
    setTimeout(() => {
      if (!pythonProcess.killed) {
        console.log('Python process timeout, killing...');
        pythonProcess.kill();
        reject(new Error('Python script timeout'));
      }
    }, 120000); // 120 second timeout for large data processing and slow API responses
  });
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const hour = url.searchParams.get('hour');
    const minute = url.searchParams.get('minute');
    
    console.log('=== Python Bridge API Request ===');
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
    
    // Convert Texas time to UTC - user input is END of 15-minute interval
    const endTime = texasTimeToUTC(date, hour, minute);
    
    // Calculate start time as 15 minutes before the end time
    const endDate = new Date(endTime);
    const startDate = new Date(endDate.getTime() - (15 * 60 * 1000));
    const startTime = startDate.toISOString().slice(0, 19) + '+00:00';
    
    console.log('Time conversion:');
    console.log('  Texas input:', `${date} ${hour}:${minute}`);
    console.log('  UTC start time:', startTime);
    console.log('  UTC end time:', endTime);
    
    // Run Python script to fetch data
    console.log('Running Python GridStatus client...');
    const pythonResult = await runPythonScript(startTime, endTime);
    
    if (!pythonResult.success) {
      throw new Error(pythonResult.error || 'Python script failed');
    }
    
    console.log(`Python script completed successfully: ${pythonResult.metadata.rows} rows`);
    
    // Process the data similar to our previous logic
    const rawData = pythonResult.data;
    
    if (!rawData || rawData.length === 0) {
      throw new Error('No data returned from Python script');
    }
    
    console.log('Processing data from Python client...');
    console.log(`Total units received from Python: ${rawData.length}`);
    
    // Track the actual number of units that get processed (after filtering)
    let processedUnitsCount = 0;
    
    // Process offer curve data with selective truncation
    const expandedData: any[] = [];
    const excludedStatuses = ['OUT', 'OFF', 'OFFNS']; // Filter out unavailable generators
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
    
    rawData.forEach((row: any) => {
      // Track all statuses
      const status = row.telemetered_resource_status || 'UNKNOWN';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      
      // Filter out generators that are OUT or OFF
      if (excludedStatuses.includes(row.telemetered_resource_status)) {
        skippedForStatus++;
        excludedStatusCounts[status] = (excludedStatusCounts[status] || 0) + 1;
        return; // Skip unavailable units
      }
      
      // Check for missing resource information
      if (!row.resource_name || !row.resource_type) {
        console.warn(`⚠️ Generator with missing info: name="${row.resource_name}" type="${row.resource_type}" status="${row.telemetered_resource_status}"`);
      }
      
      // Track included statuses
      includedStatusCounts[status] = (includedStatusCounts[status] || 0) + 1;
      
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
        if (skippedForMissingSchedule <= 3) { // Only log first 3 examples
          console.log(`⚠️ Generator ${row.resource_name} has missing output_schedule (offered ${maxOfferedMW} MW)`);
        }
        return;
      }
      
      // Skip renewables with zero or negative scheduled output, but include other types
      if (isRenewableToTruncate && outputSchedule <= 0) {
        skippedForZeroSchedule++;
        if (skippedForZeroSchedule <= 3) { // Only log first 3 examples
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
      processedUnitsCount++;
      
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
    
    // Log the filtering results
    console.log(`🔍 CAPACITY ANALYSIS:`);
    console.log(`  Total generators from API: ${rawData.length}`);
    console.log(`  Total offered capacity: ${Math.round(totalOfferedCapacity).toLocaleString()} MW`);
    console.log(`  Total capacity in curve: ${Math.round(totalScheduledCapacity).toLocaleString()} MW (renewable actual + thermal full)`);
    console.log(`  Processed units: ${processedUnitsCount}`);
    console.log(`  Skipped renewable units (zero/negative scheduled output): ${skippedForZeroSchedule}`);
    console.log(`  Skipped units (missing output_schedule): ${skippedForMissingSchedule}`);
    console.log(`  Skipped unavailable units (OUT/OFF): ${skippedForStatus}`);
    
    // Display status breakdown
    console.log(`📊 GENERATOR STATUS BREAKDOWN:`);
    console.log(`  All statuses found in data:`, statusCounts);
    console.log(`  ✅ INCLUDED statuses:`, includedStatusCounts);
    console.log(`  ❌ EXCLUDED statuses:`, excludedStatusCounts);
    
    // Alert if there are missing output_schedule values
    if (skippedForMissingSchedule > 0) {
      console.error(`🚨 ALERT: ${skippedForMissingSchedule} generators have missing output_schedule values!`);
      console.error(`   This could explain supply/demand mismatch if these generators have significant capacity.`);
    }
    
    if (skippedForZeroSchedule > 0) {
      console.warn(`⚠️ INFO: ${skippedForZeroSchedule} renewable generators (WIND/PVGR) have zero/negative scheduled output (excluded)`);
    }
    
    if (skippedForStatus > 0) {
      console.warn(`⚠️ INFO: ${skippedForStatus} generators are unavailable (OUT/OFF status)`);
    }
    
    console.log(`📊 SUPPLY CURVE LOGIC:`);
    console.log(`   • Status filtering: OUT, OFF, and OFFNS generators excluded`);
    console.log(`   • WIND & PVGR: Truncated to output_schedule (actual renewable output)`);
    console.log(`   • All other resource types: Full offer curve shown (complete thermal/other capacity)`);
    console.log(`   This shows renewable actual output + available thermal capacity.`);
    
    // Filter and sort supply data
    const supplyData = expandedData.filter(point => point.mw > 0);
    supplyData.sort((a, b) => a.price - b.price || a.mw - b.mw);
    
    // No longer limiting for performance - show full dataset
    const limitedSupplyData = supplyData; // Show all data points
    console.log(`Processing full supply dataset: ${limitedSupplyData.length} points`);
    
    // Calculate cumulative capacity
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
    
    // Group by resource type
    const resourceTypeMap: { [key: string]: { capacity: number; marginalCost: number; color: string } } = {};
    const colorMap: { [key: string]: string } = {
      // Wind resources - Bright Green
      'WIND': '#22C55E',
      
      // Solar resources - Bright Orange  
      'SOLAR': '#FF8C00',
      'SCLE90': '#FF8C00', // Solar
      
      // Nuclear resources - Deep Purple
      'NUCLEAR': '#7C3AED',
      'NUC': '#7C3AED', // Nuclear
      
      // Natural Gas Combined Cycle - Bright Blue
      'GAS_CC': '#2563EB',
      'CCLE90': '#2563EB', // Combined Cycle
      'CCGT90': '#2563EB', // Combined Cycle Gas Turbine
      
      // Coal resources - Dark Gray
      'COAL': '#4B5563',
      
      // Natural Gas Steam Turbine - Bright Red
      'GAS_ST': '#DC2626',
      'PWRSTR': '#DC2626', // Power Station (likely gas steam)
      
      // Oil Steam Turbine - Dark Orange
      'OIL_ST': '#EA580C',
      
      // Natural Gas Combustion Turbine / Peaker - Hot Pink
      'GAS_CT': '#E11D48',
      'SCGT90': '#E11D48', // Simple Cycle Gas Turbine
      
      // Oil Combustion Turbine - Lime Green
      'OIL_CT': '#65A30D',
      
      // Hydro resources - Cyan Blue
      'HYDRO': '#0891B2',
      
      // Pumped Storage / Grid Storage - Teal
      'GSREH': '#059669', // Grid Storage Renewable Energy Hub
      'GSNONR': '#0D9488', // Grid Storage Non-Renewable
      
      // Distribution/Load resources
      'DSL': '#9333EA', // Distributed Storage/Load - Purple
      'PVGR': '#F59E0B', // Photovoltaic Grid Resource (Solar) - Amber
      'CLLIG': '#16A34A', // Controllable Load Including Grid (Demand Response) - Green
      
      // Default for unknown types
      'OTHER': '#6B7280'
    };
    
    // Helper function to get color for resource type
    const getColorForResourceType = (resourceType: string): string => {
      // First try exact match
      if (colorMap[resourceType]) {
        return colorMap[resourceType];
      }
      
      // Then try partial matches for resource codes we might not have mapped
      const type = resourceType.toUpperCase();
      
      if (type.includes('WIND')) return '#22C55E';
      if (type.includes('SOLAR') || type.includes('PV')) return '#FF8C00';
      if (type.includes('NUC')) return '#7C3AED';
      if (type.includes('CC') || type.includes('CCGT')) return '#2563EB';
      if (type.includes('COAL')) return '#4B5563';
      if (type.includes('ST') || type.includes('STEAM')) return '#DC2626';
      if (type.includes('CT') || type.includes('SCGT') || type.includes('GT')) return '#E11D48';
      if (type.includes('HYDRO')) return '#0891B2';
      if (type.includes('GS') || type.includes('BESS') || type.includes('STORAGE')) return '#059669';
      
      // Default to gray for unmapped types
      return '#6B7280';
    };
    
    processedData.forEach(point => {
      const type = point.resource_type || 'OTHER';
      if (!resourceTypeMap[type]) {
        resourceTypeMap[type] = {
          capacity: 0,
          marginalCost: point.price,
          color: getColorForResourceType(type)
        };
      }
      resourceTypeMap[type].capacity += point.mw;
    });
    
    const response = {
      success: true,
      message: 'GridStatus data retrieved successfully via Python client',
      data: {
        rawSupplyCurve: processedData,
        resourceTypeSummary: resourceTypeMap,
        totalCapacity: cumulativeCapacity,
        dataPoints: processedData.length
      },
      metadata: {
        startTime,
        endTime,
        originalDataPoints: processedUnitsCount, // Use the actual count of processed units
        processedDataPoints: processedData.length,
        totalExpandedPoints: expandedData.length,
        excludedUnitsCount: rawData.length - processedUnitsCount,
        source: 'python-gridstatus-client'
      }
    };
    
    console.log(`Data transformation complete:`);
    console.log(`  ${processedUnitsCount} active generation units`);
    console.log(`  → ${expandedData.length} total offer curve segments`);
    console.log(`  → ${processedData.length} final supply curve points`);
    console.log(`Sending response with full dataset: ${processedData.length} data points from Python client (no performance limiting)`);
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Python Bridge API error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to fetch GridStatus data via Python client',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}; 