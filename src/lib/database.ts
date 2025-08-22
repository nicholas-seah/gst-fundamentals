import { PrismaClient } from '@prisma/client';

// Main ERCOT database client for analytics_workspace (ERCOT structural demand data)
export const ercotDb = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_THIRD || 'postgresql://localhost:5432/analytics_workspace'
    }
  },
  log: ['error', 'warn']
});

// Separate database client for RT Load data (postgres database with yes_fundamentals table)
export const rtLoadDb = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_SECONDARY || 'postgresql://localhost:5432/postgres'
    }
  },
  log: ['error', 'warn']
});

// Test connection to yes_fundamentals table specifically
export async function testYesFundamentalsConnection() {
  try {
    const result = await rtLoadDb.$queryRaw`
      SELECT COUNT(*) as count FROM public.yes_fundamentals 
      WHERE entity = 'ERCOT' AND attribute = 'RTLOAD'
      LIMIT 1
    `;
    
    console.log('✅ yes_fundamentals table connection successful:', result);
    return result;
  } catch (error) {
    console.error('❌ yes_fundamentals table connection failed:', error);
    throw error;
  }
}

// Helper function to test the connection and query ERCOT structural demand data
export async function getERCOTStructuralDemand() {
  try {
    const result = await ercotDb.$queryRaw`
      SELECT * FROM "ERCOT"."ERCOT_structural_demand"
      ORDER BY "Month" ASC, "Zone" ASC, "Year" ASC 
      LIMIT 100
    `;
    
    console.log('ERCOT Database connection successful');
    console.log('Sample data:', result);
    return result;
  } catch (error) {
    console.error('ERCOT Database connection failed:', error);
    throw error;
  }
}

// Helper function specifically for weather normalized demand chart data
export async function getWeatherNormalizedDemandData() {
  try {
    // This query will need to be adjusted based on your actual table structure
    const result = await ercotDb.$queryRaw`
      SELECT "Month", "Year", SUM("demand") as total_demand
      FROM "ERCOT"."ERCOT_structural_demand"
      WHERE "Year" BETWEEN 2020 AND 2025
      GROUP BY "Month", "Year"
      ORDER BY "Year" ASC, "Month" ASC
    `;
    
    return result;
  } catch (error) {
    console.error('Failed to fetch weather normalized demand data:', error);
    throw error;
  }
}

// Cleanup function to disconnect when needed
export async function disconnectERCOTDb() {
  await ercotDb.$disconnect();
  await rtLoadDb.$disconnect();
} 