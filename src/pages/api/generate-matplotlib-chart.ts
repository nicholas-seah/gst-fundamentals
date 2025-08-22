import type { APIRoute } from 'astro';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { date, hour, minute, scenario } = body;
    
    console.log(`Generating matplotlib chart for ${date} ${hour}:${minute} (${scenario})`);
    
    // Run the matplotlib Python script
    const pythonProcess = spawn('python', ['matplotlib_supply_curve.py'], {
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
    
    // Check if the SVG file was generated
    const svgPath = path.join(process.cwd(), 'public', 'supply_curve_matplotlib.svg');
    const pngPath = path.join(process.cwd(), 'public', 'supply_curve_matplotlib.png');
    
    try {
      await fs.access(svgPath);
      console.log('Chart SVG file generated successfully');
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Chart generated successfully',
        chartUrl: '/supply_curve_matplotlib.svg',
        pngUrl: '/supply_curve_matplotlib.png'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
    } catch (fileError) {
      throw new Error('Chart image files were not generated');
    }
    
  } catch (error) {
    console.error('Error generating matplotlib chart:', error);
    
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