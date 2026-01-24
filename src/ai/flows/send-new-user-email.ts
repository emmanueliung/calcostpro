
'use server';

/**
 * @fileOverview A Genkit flow for sending a notification email when a new user signs up.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { Resend } from 'resend';

const NewUserInputSchema = z.object({
  email: z.string().email().describe('The email of the new user.'),
  uid: z.string().describe('The UID of the new user.'),
  name: z.string().optional().describe('The name of the new user.'),
});
export type NewUserInput = z.infer<typeof NewUserInputSchema>;

const SendNewUserEmailOutputSchema = z.object({
  status: z.string().describe('The status of the email sending operation.'),
  message: z.string().describe('A message detailing the result.'),
});
export type SendNewUserEmailOutput = z.infer<typeof SendNewUserEmailOutputSchema>;


export async function sendNewUserEmail(input: NewUserInput): Promise<SendNewUserEmailOutput> {
  return sendNewUserEmailFlow(input);
}


const sendNewUserEmailFlow = ai.defineFlow(
  {
    name: 'sendNewUserEmailFlow',
    inputSchema: NewUserInputSchema,
    outputSchema: SendNewUserEmailOutputSchema,
  },
  async (input) => {
    // Check if the RESEND_API_KEY is available. If not, skip sending the email.
    if (!process.env.RESEND_API_KEY) {
      console.warn("RESEND_API_KEY is not set. Skipping sending new user email.");
      return {
        status: 'skipped',
        message: 'Email sending is disabled because the API key is not configured.',
      };
    }
    
    const resend = new Resend(process.env.RESEND_API_KEY);
    const adminEmail = 'emmanuel.iung@gmail.com';

    try {
      const { data, error } = await resend.emails.send({
        from: 'CalcostPro <contact@calcostpro.com>',
        to: [adminEmail],
        subject: '🎉 Nouveau utilisateur sur CalcostPro!',
        html: `
          <h1>Nouvel utilisateur inscrit!</h1>
          <p>Un nouvel utilisateur vient de s'inscrire sur CalcostPro.</p>
          <ul>
            <li><strong>Email:</strong> ${input.email}</li>
            <li><strong>Nom:</strong> ${input.name || 'Non fourni'}</li>
            <li><strong>UID:</strong> ${input.uid}</li>
          </ul>
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
        message: `Email sent successfully to ${adminEmail}. Message ID: ${data?.id}`,
      };
    } catch (error: any) {
        console.error('Error sending new user email:', error);
        return {
            status: 'error',
            message: `An unexpected error occurred: ${error.message}`,
        };
    }
  }
);
