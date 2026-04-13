import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

/**
 * GET: Fetch all invoices for a specific user
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const snapshot = await db.collection('factures')
      .where('userId', '==', userId)
      .get();

    const factures = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];

    // Sort manually in Memory to avoid "Missing Index" error on Firestore
    factures.sort((a, b) => {
        const dateA = a.date || "";
        const dateB = b.date || "";
        return dateB.localeCompare(dateA); // Descending
    });

    return NextResponse.json(factures);
  } catch (error: any) {
    console.error('Error fetching factures from Firestore:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

/**
 * POST: Batch save invoices to Firestore
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { factures } = body;

    if (!Array.isArray(factures)) {
      return NextResponse.json({ error: 'Expected an array of factures' }, { status: 400 });
    }

    const batch = db.batch();
    const collectionRef = db.collection('factures');

    factures.forEach((facture: any) => {
      // Use existing ID if provided, otherwise generate one
      const docId = facture.id || crypto.randomUUID();
      const docRef = collectionRef.doc(docId);
      
      // Ensure we don't overwrite if it exists, or just set it
      batch.set(docRef, {
        ...facture,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    });

    await batch.commit();

    return NextResponse.json({ success: true, count: factures.length });
  } catch (error: any) {
    console.error('Error saving factures to Firestore:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
