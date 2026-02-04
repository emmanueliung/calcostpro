import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { generateCustomerConfirmationEmail, generateWorkshopNotificationEmail } from '@/lib/email-templates';
import { CustomerInfo, OrderItem } from '@/lib/types';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

import { firebaseConfig } from '@/firebase/config';

// Initialize Firebase Admin
if (getApps().length === 0) {
    try {
        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || firebaseConfig.projectId;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

        if (clientEmail && privateKey) {
            initializeApp({
                credential: cert({
                    projectId,
                    clientEmail,
                    privateKey,
                }),
            });
            console.log('Firebase Admin initialized with service account');
        } else {
            // On Firebase App Hosting or Cloud Functions, initializeApp() with no args
            // will automatically use the default credentials.
            initializeApp();
            console.log('Firebase Admin initialized with default credentials');
        }
    } catch (e) {
        console.error('Error initializing Firebase Admin:', e);
    }
}

export async function POST(request: NextRequest) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.error('RESEND_API_KEY is missing');
        return NextResponse.json(
            { error: 'Email service configuration missing' },
            { status: 500 }
        );
    }
    const resend = new Resend(apiKey);
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
        const emailSettings = userDoc.data()?.emailSettings;

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

        // Sender Configuration
        const senderName = emailSettings?.senderName || workshopName;
        const replyTo = emailSettings?.replyTo || workshopEmail;
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'CalcostPro <notificaciones@calcostpro.com>';

        // Send customer confirmation
        if (emailSettings === undefined || emailSettings.sendConfirmationToCustomer !== false) {
            try {
                await resend.emails.send({
                    from: fromEmail,
                    to: customer.email,
                    reply_to: replyTo,
                    subject: customerEmail.subject,
                    html: customerEmail.html,
                });
            } catch (error) {
                console.error('Error sending customer email:', error);
            }
        }

        // Send workshop notification
        if (emailSettings === undefined || emailSettings.notifyWorkshopOnNewOrder !== false) {
            try {
                await resend.emails.send({
                    from: fromEmail,
                    to: workshopEmail,
                    reply_to: replyTo, // Optional: useful if workshop owner wants to reply to the system notification (though not common)
                    subject: workshopNotification.subject,
                    html: workshopNotification.html,
                });
            } catch (error) {
                console.error('Error sending workshop email:', error);
            }
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
