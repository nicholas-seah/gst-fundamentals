import type { APIRoute } from 'astro';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { date, hour, minute, scenario } = body;
    
    console.log(`Generating supply curve for ${date} ${hour}:${minute} (${scenario})`);
    
    // Run the Python script with arguments
    const pythonArgs = [
      'plotly_supply_curve_dynamic.py',
      '--date', date,
      '--hour', hour.split(' ')[0], // Extract hour number from "02 (2 AM)"
      '--minute', minute,
      '--scenario', scenario,
      '--output', 'public/supply_curve_plotly.html'
    ];
    
    console.log('Running Python command:', 'python', pythonArgs.join(' '));
    
    const pythonProcess = spawn('python', pythonArgs, {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    // Wait for the Python process to complete
    await new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve(code);
        } else {
          reject(new Error(`Python script exited with code ${code}: ${stderr}`));
        }
      });
    });
    
    console.log('Python script output:', stdout);
    
    // Check if the HTML file was generated
    const htmlPath = path.join(process.cwd(), 'public', 'supply_curve_plotly.html');
    
    try {
      await fs.access(htmlPath);
      console.log('Chart HTML file generated successfully');
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Chart generated successfully',
        chartUrl: '/supply_curve_plotly.html'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
    } catch (fileError) {
      throw new Error('Chart HTML file was not generated');
    }
    
  } catch (error) {
    console.error('Error generating supply curve:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}; 