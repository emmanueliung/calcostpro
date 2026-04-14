import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const month = searchParams.get('month'); // YYYY-MM

    if (!userId || !month) {
      return NextResponse.json({ error: 'User ID and Month are required' }, { status: 400 });
    }

    const doc = await db.collection('saldo_favor')
      .doc(`${userId}_${month}`)
      .get();

    if (!doc.exists) {
      return NextResponse.json({ saldo: 0, ufvPrevious: 0, ufvCurrent: 0 });
    }

    return NextResponse.json(doc.data());
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, month, saldo, ufvPrevious, ufvCurrent } = body;

    if (!userId || !month) {
      return NextResponse.json({ error: 'User ID and Month are required' }, { status: 400 });
    }

    await db.collection('saldo_favor')
      .doc(`${userId}_${month}`)
      .set({
        userId,
        month,
        saldo,
        ufvPrevious,
        ufvCurrent,
        updatedAt: new Date().toISOString()
      }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
