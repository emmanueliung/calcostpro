import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { generateCustomerConfirmationEmail, generateWorkshopNotificationEmail } from '@/lib/email-templates';
import { CustomerInfo, OrderItem } from '@/lib/types';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Initialize Firebase Admin
if (getApps().length === 0) {
    initializeApp({
        credential: cert({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            orderId,
            customer,
            items,
            totalAmount,
            college,
            workshopUserId,
        }: {
            orderId: string;
            customer: CustomerInfo;
            items: OrderItem[];
            totalAmount: number;
            college: string;
            workshopUserId: string;
        } = body;

        // Fetch workshop owner email
        const db = getFirestore();
        const userDoc = await db.collection('users').doc(workshopUserId).get();

        if (!userDoc.exists) {
            return NextResponse.json(
                { error: 'Workshop user not found' },
                { status: 404 }
            );
        }

        const workshopEmail = userDoc.data()?.email;
        const workshopName = userDoc.data()?.name || 'Taller';

        if (!workshopEmail) {
            console.error('Workshop email not found');
            return NextResponse.json(
                { error: 'Workshop email not configured' },
                { status: 400 }
            );
        }

        // Generate emails
        const customerEmail = generateCustomerConfirmationEmail(
            customer,
            orderId,
            items,
            totalAmount,
            college
        );

        const workshopNotification = generateWorkshopNotificationEmail(
            customer,
            orderId,
            items,
            totalAmount,
            college
        );

        // Send customer confirmation
        try {
            await resend.emails.send({
                from: `${workshopName} <noreply@calcostpro.com>`,
                to: customer.email,
                subject: customerEmail.subject,
                html: customerEmail.html,
            });
        } catch (error) {
            console.error('Error sending customer email:', error);
        }

        // Send workshop notification
        try {
            await resend.emails.send({
                from: 'CalcostPro Notificaciones <notifications@calcostpro.com>',
                to: workshopEmail,
                subject: workshopNotification.subject,
                html: workshopNotification.html,
            });
        } catch (error) {
            console.error('Error sending workshop email:', error);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in send-order-notification:', error);
        return NextResponse.json(
            { error: 'Failed to send notifications' },
            { status: 500 }
        );
    }
}
