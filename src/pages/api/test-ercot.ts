import type { APIRoute } from 'astro';
import { getERCOTStructuralDemand } from '../../lib/database';

export const GET: APIRoute = async ({ request }) => {
  try {
    console.log('Testing ERCOT database connection...');
    
    const data = await getERCOTStructuralDemand();
    
    return new Response(JSON.stringify({
      success: true,
      message: 'ERCOT database connection successful',
      dataCount: Array.isArray(data) ? data.length : 0,
      sampleData: data
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('ERCOT database test failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'ERCOT database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}; 