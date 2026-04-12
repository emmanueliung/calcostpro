import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Define the absolute path to the local 'factures' directory
const FACTURES_DIR = path.join(process.cwd(), 'factures');
const DB_FILE = path.join(FACTURES_DIR, 'factures-db.json');

// Helper to ensure the directory and file exist
function initDb() {
  if (!fs.existsSync(FACTURES_DIR)) {
    fs.mkdirSync(FACTURES_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([]), 'utf-8');
  }
}

export async function GET(req: Request) {
  try {
    initDb();
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    const factures = JSON.parse(data);
    return NextResponse.json(factures);
  } catch (error: any) {
    console.error('Error reading local factures:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    initDb();
    const body = await req.json();
    const { factures: newFactures } = body;

    if (!Array.isArray(newFactures)) {
       return NextResponse.json({ error: 'Expected an array of factures' }, { status: 400 });
    }

    // Read current data
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    const currentFactures = JSON.parse(data);

    // Merge and save
    const updatedFactures = [...currentFactures, ...newFactures];
    fs.writeFileSync(DB_FILE, JSON.stringify(updatedFactures, null, 2), 'utf-8');

    return NextResponse.json({ success: true, count: updatedFactures.length });
  } catch (error: any) {
    console.error('Error saving local factures:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
