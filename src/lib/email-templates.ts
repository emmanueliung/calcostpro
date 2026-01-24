import { CustomerInfo, OrderItem } from './types';

export function generateCustomerConfirmationEmail(
    customer: CustomerInfo,
    orderId: string,
    items: OrderItem[],
    totalAmount: number,
    college: string
): { subject: string; html: string } {
    const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.productName}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.price.toFixed(2)} Bs</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${(item.price * item.quantity).toFixed(2)} Bs</td>
    </tr>
  `).join('');

    return {
        subject: `Confirmación de Pedido #${orderId.slice(0, 8)} - ${college}`,
        html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; background-color: #f9fafb; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 700;">¡Pedido Recibido!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Gracias por tu pedido, ${customer.name}</p>
          </div>

          <!-- Content -->
          <div style="padding: 30px 20px;">
            
            <!-- Order Info -->
            <div style="background-color: #f3f4f6; border-left: 4px solid #3b82f6; padding: 15px; margin-bottom: 25px; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #6b7280;">Número de Pedido</p>
              <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: 700; font-family: monospace; color: #1f2937;">#${orderId.slice(0, 8)}</p>
            </div>

            <!-- College -->
            <div style="margin-bottom: 25px;">
              <h2 style="margin: 0 0 10px 0; font-size: 18px; color: #1f2937;">Colegio</h2>
              <p style="margin: 0; font-size: 16px; color: #4b5563;">${college}</p>
            </div>

            <!-- Items Table -->
            <div style="margin-bottom: 25px;">
              <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #1f2937;">Detalle del Pedido</h2>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 10px 8px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-weight: 600;">Prenda</th>
                    <th style="padding: 10px 8px; text-align: center; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-weight: 600;">Cant.</th>
                    <th style="padding: 10px 8px; text-align: right; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-weight: 600;">Precio</th>
                    <th style="padding: 10px 8px; text-align: right; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-weight: 600;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="3" style="padding: 15px 8px 8px 8px; text-align: right; font-weight: 600; font-size: 16px; color: #1f2937;">Total:</td>
                    <td style="padding: 15px 8px 8px 8px; text-align: right; font-weight: 700; font-size: 18px; color: #3b82f6;">${totalAmount.toFixed(2)} Bs</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <!-- Next Steps -->
            <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 20px; margin-bottom: 25px;">
              <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #1e40af; display: flex; align-items: center;">
                📋 Próximos Pasos
              </h3>
              <ol style="margin: 0; padding-left: 20px; color: #1e40af;">
                <li style="margin-bottom: 8px;">Validaremos tu pago en las próximas horas</li>
                <li style="margin-bottom: 8px;">Te contactaremos por WhatsApp al <strong>${customer.phone}</strong></li>
                <li style="margin-bottom: 8px;">Coordinaremos la fecha de entrega</li>
                <li>Recibirás tu uniforme en perfecto estado</li>
              </ol>
            </div>

            <!-- Contact Info -->
            <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">¿Tienes preguntas?</p>
              <p style="margin: 0; color: #3b82f6; font-size: 14px;">Contáctanos por WhatsApp</p>
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 12px; color: #9ca3af;">
              Este es un email automático, por favor no respondas a este mensaje.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
    };
}

export function generateWorkshopNotificationEmail(
    customer: CustomerInfo,
    orderId: string,
    items: OrderItem[],
    totalAmount: number,
    college: string
): { subject: string; html: string } {
    const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.productName}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${(item.price * item.quantity).toFixed(2)} Bs</td>
    </tr>
  `).join('');

    return {
        subject: `🔔 Nuevo Pedido en Línea #${orderId.slice(0, 8)}`,
        html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; background-color: #f9fafb; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 700;">🎉 Nuevo Pedido</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Pedido en línea recibido</p>
          </div>

          <!-- Content -->
          <div style="padding: 30px 20px;">
            
            <!-- Alert -->
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 25px; border-radius: 4px;">
              <p style="margin: 0; font-weight: 600; color: #92400e;">⚠️ Acción Requerida</p>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #92400e;">Valida el pago y contacta al cliente</p>
            </div>

            <!-- Order Info -->
            <div style="margin-bottom: 25px;">
              <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #1f2937;">Información del Pedido</h2>
              <table style="width: 100%; font-size: 14px;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; width: 120px;">Pedido:</td>
                  <td style="padding: 8px 0; font-weight: 600; font-family: monospace;">#${orderId.slice(0, 8)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Colegio:</td>
                  <td style="padding: 8px 0; font-weight: 600;">${college}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Total:</td>
                  <td style="padding: 8px 0; font-weight: 700; color: #10b981; font-size: 16px;">${totalAmount.toFixed(2)} Bs</td>
                </tr>
              </table>
            </div>

            <!-- Customer Info -->
            <div style="margin-bottom: 25px;">
              <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #1f2937;">Datos del Cliente</h2>
              <table style="width: 100%; font-size: 14px;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; width: 120px;">Nombre:</td>
                  <td style="padding: 8px 0; font-weight: 600;">${customer.name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Email:</td>
                  <td style="padding: 8px 0;"><a href="mailto:${customer.email}" style="color: #3b82f6; text-decoration: none;">${customer.email}</a></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">WhatsApp:</td>
                  <td style="padding: 8px 0;"><a href="https://wa.me/591${customer.phone.replace(/\D/g, '')}" style="color: #10b981; text-decoration: none; font-weight: 600;">${customer.phone}</a></td>
                </tr>
              </table>
            </div>

            <!-- Items -->
            <div style="margin-bottom: 25px;">
              <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #1f2937;">Prendas Pedidas</h2>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 10px 8px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-weight: 600;">Prenda</th>
                    <th style="padding: 10px 8px; text-align: center; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-weight: 600;">Cantidad</th>
                    <th style="padding: 10px 8px; text-align: right; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-weight: 600;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://calcostpro.com'}/dashboard/online-orders" 
                 style="display: inline-block; background-color: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                Ver Pedido en Dashboard
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 12px; color: #9ca3af;">
              CalcostPro - Sistema de Gestión de Taller
            </p>
          </div>
        </div>
      </body>
      </html>
    `
    };
}
