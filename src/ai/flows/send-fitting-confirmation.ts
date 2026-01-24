
'use server';

/**
 * @fileOverview A Genkit flow for sending a fitting confirmation email.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { Resend } from 'resend';

const FittingConfirmationInputSchema = z.object({
  projectId: z.string().describe("The project's ID."),
  fittingId: z.string().describe("The fitting's ID, used as the confirmation token."),
  personName: z.string().describe("The name of the person."),
  email: z.string().email().describe("The email of the person."),
  projectName: z.string().describe("The name of the project."),
  sizeDetailsHtml: z.string().describe("An HTML string detailing the sizes for each garment."),
  date: z.string().describe("The date of the fitting record."),
});
export type FittingConfirmationInput = z.infer<typeof FittingConfirmationInputSchema>;

const FittingConfirmationOutputSchema = z.object({
  status: z.string().describe('The status of the email sending operation.'),
  message: z.string().describe('A message detailing the result.'),
});
export type FittingConfirmationOutput = z.infer<typeof FittingConfirmationOutputSchema>;

export async function sendFittingConfirmationEmail(input: FittingConfirmationInput): Promise<FittingConfirmationOutput> {
  return sendFittingConfirmationEmailFlow(input);
}

const sendFittingConfirmationEmailFlow = ai.defineFlow(
  {
    name: 'sendFittingConfirmationEmailFlow',
    inputSchema: FittingConfirmationInputSchema,
    outputSchema: FittingConfirmationOutputSchema,
  },
  async (input) => {
    const { projectId, fittingId, personName, email, projectName, sizeDetailsHtml, date } = input;
    
    // Determine the base URL based on the environment
    const appUrl = process.env.NODE_ENV === 'production' 
      ? 'https://calcostpro.com'
      : 'http://localhost:3000'; // Using port 3000, ensure it matches your local setup

    // Combine projectId and fittingId into a single URL segment
    const confirmationToken = `${projectId}_${fittingId}`;
    const confirmationUrl = `${appUrl}/confirm-fitting/${confirmationToken}`;

    // Send the email with Resend
    const resend = new Resend(process.env.RESEND_API_KEY);
    try {
      const { data, error } = await resend.emails.send({
        from: 'CalcostPro <contact@calcostpro.com>',
        to: [email],
        subject: `Confirme sus tallas para el proyecto ${projectName}`,
        html: `
          <h1>Hola ${personName},</h1>
          <p>Por favor, confirme sus tallas para el proyecto "${projectName}" haciendo clic en el enlace de abajo:</p>
          
          <div style="background-color: #f9f9f9; border: 1px solid #eee; padding: 16px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Detalles del registro (del ${date}):</h3>
            ${sizeDetailsHtml}
          </div>
          
          <a href="${confirmationUrl}" style="background-color: #144b87; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Confirmar mis tallas
          </a>
          <p>Si el botón no funciona, copie y pegue este enlace en su navegador:</p>
          <p>${confirmationUrl}</p>
          <p>Este enlace es permanente hasta su primer uso.</p>
          <br>
          <p>Gracias,</p>
          <p>El equipo de CalcostPro</p>
        `,
      });

      if (error) {
        console.error('Resend error:', error);
        return {
          status: 'error',
          message: `Failed to send email: ${error.message}`,
        };
      }

      return {
        status: 'success',
        message: `Email sent successfully to ${email}. Message ID: ${data?.id}`,
      };
    } catch (emailError: any) {
        console.error('Error sending confirmation email:', emailError);
        return {
            status: 'error',
            message: `An unexpected error occurred: ${emailError.message}`,
        };
    }
  }
);
