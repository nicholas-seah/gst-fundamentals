// CSV Loader for mock supply curve data
export interface OfferCurveSegment {
  resource_name: string;
  resource_type: string;
  mw: number;
  price: number;
}

export async function loadMockSupplyCurveData(): Promise<OfferCurveSegment[]> {
  try {
    // Load the CSV file from the public folder (accessible via browser)
    const response = await fetch('/mock_offer_curve_data.csv');
    const csvText = await response.text();
    
    return parseMockCSV(csvText);
  } catch (error) {
    console.warn('Could not load CSV file, using fallback data:', error);
    return generateFallbackData();
  }
}

function parseMockCSV(csvText: string): OfferCurveSegment[] {
  const lines = csvText.split('\n');
  const segments: OfferCurveSegment[] = [];
  
  console.log(`📁 Processing ${lines.length} lines from CSV`);
  
  let skippedReasons = {
    tooFewColumns: 0,
    missingData: 0,
    outOfService: 0,
    emptyOfferCurve: 0,
    invalidOfferCurve: 0,
    zeroCaptaicty: 0,
    unreasonablePrice: 0,
    totalProcessed: 0
  };
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    skippedReasons.totalProcessed++;
    
    try {
      // Parse CSV line - the format has many columns, we need specific ones
      const columns = parseCSVLine(line);
      
      if (columns.length < 30) {
        skippedReasons.tooFewColumns++;
        continue; // Ensure we have enough columns
      }
      
      const resourceName = columns[6]; // resource_name
      const resourceType = columns[7]; // resource_type
      const telemeteredStatus = columns[8]; // telemetered_resource_status
      const tpoOfferCurveStr = columns[29]; // sced_tpo_offer_curve
      
      if (!resourceName || !resourceType || !tpoOfferCurveStr) {
        skippedReasons.missingData++;
        continue;
      }
      
      // Filter out resources with problematic status (matching Python filtering)
      const excludedStatuses = ['ONTEST', 'OFFQS', 'OFFNS', 'OFF', 'OUT', 'SHUTDOWN'];
      if (excludedStatuses.includes(telemeteredStatus)) {
        skippedReasons.outOfService++;
        continue;
      }
      
      // Parse the offer curve array from string like "[[0.0, -3.01], [139.2, -3.0]]"
      const offerCurve = parseOfferCurveArray(tpoOfferCurveStr);
      
      if (offerCurve.length === 0) {
        skippedReasons.emptyOfferCurve++;
        continue; // Skip empty offer curves
      }
      
      // Convert offer curve points to segments
      for (let j = 0; j < offerCurve.length - 1; j++) {
        const currentPoint = offerCurve[j];
        const nextPoint = offerCurve[j + 1];
        
        if (!currentPoint || !nextPoint || currentPoint.length < 2 || nextPoint.length < 2) {
          skippedReasons.invalidOfferCurve++;
          continue;
        }
        
        const startMW = currentPoint[0];
        const endMW = nextPoint[0];
        const price = nextPoint[1];
        const segmentMW = endMW - startMW;
        
        // More permissive filtering - allow wider price ranges and smaller capacities
        if (segmentMW <= 0) {
          skippedReasons.zeroCaptaicty++;
          continue;
        }
        
        if (price < -500 || price > 10000) {
          skippedReasons.unreasonablePrice++;
          continue;
        }
        
        segments.push({
          resource_name: resourceName,
          resource_type: resourceType,
          mw: segmentMW,
          price: price
        });
      }
    } catch (error) {
      console.warn(`⚠️ Error parsing CSV line ${i}:`, error);
      continue;
    }
  }
  
  console.log(`📊 CSV Parsing Results:`);
  console.log(`   Total lines processed: ${skippedReasons.totalProcessed}`);
  console.log(`   Too few columns: ${skippedReasons.tooFewColumns}`);
  console.log(`   Missing data: ${skippedReasons.missingData}`);
  console.log(`   Out of service: ${skippedReasons.outOfService}`);
  console.log(`   Empty offer curves: ${skippedReasons.emptyOfferCurve}`);
  console.log(`   Invalid offer curves: ${skippedReasons.invalidOfferCurve}`);
  console.log(`   Zero capacity: ${skippedReasons.zeroCaptaicty}`);
  console.log(`   Unreasonable price: ${skippedReasons.unreasonablePrice}`);
  console.log(`✅ Successfully parsed ${segments.length} offer curve segments`);
  
  // Sort by price (merit order)
  return segments.sort((a, b) => a.price - b.price);
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  
  while (i < line.length) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
    i++;
  }
  
  result.push(current.trim());
  return result;
}

function parseOfferCurveArray(offerCurveStr: string): number[][] {
  try {
    // Remove quotes and parse JSON-like array
    const cleanStr = offerCurveStr.replace(/^"/, '').replace(/"$/, '');
    
    if (cleanStr === '[]' || !cleanStr) {
      return [];
    }
    
    return JSON.parse(cleanStr);
  } catch (error) {
    console.warn('Could not parse offer curve:', offerCurveStr, error);
    return [];
  }
}

function generateFallbackData(): OfferCurveSegment[] {
  const mockData: OfferCurveSegment[] = [];
  
  // Generate realistic fallback data if CSV loading fails
  // Wind resources
  for (let i = 0; i < 200; i++) {
    mockData.push({
      resource_name: `WIND_UNIT_${i + 1}`,
      resource_type: 'WIND',
      mw: Math.random() * 100 + 50,
      price: Math.random() * 15 - 5
    });
  }
  
  // Solar resources
  for (let i = 0; i < 100; i++) {
    mockData.push({
      resource_name: `SOLAR_UNIT_${i + 1}`,
      resource_type: 'PVGR',
      mw: Math.random() * 80 + 20,
      price: Math.random() * 10 - 2
    });
  }
  
  // Natural Gas Combined Cycle
  for (let i = 0; i < 60; i++) {
    mockData.push({
      resource_name: `CC_UNIT_${i + 1}`,
      resource_type: 'CCGT90',
      mw: Math.random() * 400 + 300,
      price: Math.random() * 30 + 20
    });
  }
  
  // Nuclear
  for (let i = 0; i < 8; i++) {
    mockData.push({
      resource_name: `NUCLEAR_UNIT_${i + 1}`,
      resource_type: 'NUC',
      mw: Math.random() * 300 + 800,
      price: Math.random() * 10 + 15
    });
  }
  
  // Simple Cycle Gas Turbines
  for (let i = 0; i < 40; i++) {
    mockData.push({
      resource_name: `GT_UNIT_${i + 1}`,
      resource_type: 'SCGT90',
      mw: Math.random() * 150 + 100,
      price: Math.random() * 100 + 75
    });
  }
  
  // Battery Storage - expensive peakers
  for (let i = 0; i < 30; i++) {
    mockData.push({
      resource_name: `BESS_UNIT_${i + 1}`,
      resource_type: 'PWRSTR',
      mw: Math.random() * 50 + 25,
      price: Math.random() * 4000 + 1000
    });
  }
  
  return mockData.sort((a, b) => a.price - b.price);
} 