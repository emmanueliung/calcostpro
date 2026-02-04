import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: NextRequest) {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
        return NextResponse.json({
            error: 'RESEND_API_KEY no encontrada en el servidor. Por favor, asegúrate de configurar las variables de entorno en Firebase App Hosting.',
            details: 'La variable RESEND_API_KEY no está definida.'
        }, { status: 500 });
    }

    const resend = new Resend(apiKey);
    try {
        const body = await request.json();
        const { email, name } = body;

        if (!email) {
            return NextResponse.json({ error: 'El email es obligatorio' }, { status: 400 });
        }

        const fromEmail = process.env.RESEND_FROM_EMAIL || 'CalcostPro <notificaciones@calcostpro.com>';

        await resend.emails.send({
            from: fromEmail,
            to: email,
            subject: 'CalcostPro - Email de Prueba',
            html: `
                <h1>Hola ${name || 'Usuario'},</h1>
                <p>Esta es una prueba de configuración de tu sistema de notificaciones en CalcostPro.</p>
                <p>Si recibiste este mensaje, significa que:</p>
                <ul>
                    <li>Tu RESEND_API_KEY está configurada correctamente.</li>
                    <li>Tu dominio calcostpro.com está listo para enviar correos.</li>
                </ul>
                <p>¡Todo listo para recibir notificaciones de pedidos!</p>
            `,
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error sending test email:', error);
        return NextResponse.json({ error: error.message || 'Failed to send test email' }, { status: 500 });
    }
}
