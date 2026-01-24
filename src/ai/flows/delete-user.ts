
'use server';

/**
 * @fileOverview A Genkit flow for deleting a user from Firebase.
 * THIS FLOW IS TEMPORARILY DISABLED TO FIX AUTHENTICATION ISSUES.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
// The admin SDK usage is causing issues, so this is commented out for now.
// import { db } from '@/lib/firebase-admin';

const DeleteUserInputSchema = z.string().describe("The UID of the user to delete.");
export type DeleteUserInput = z.infer<typeof DeleteUserInputSchema>;

const DeleteUserOutputSchema = z.object({
  status: z.string().describe('The status of the deletion operation.'),
  message: z.string().describe('A message detailing the result.'),
});
export type DeleteUserOutput = z.infer<typeof DeleteUserOutputSchema>;

export async function deleteUser(uid: DeleteUserInput): Promise<DeleteUserOutput> {
  // This functionality is temporarily disabled.
  console.error('deleteUser function is temporarily disabled.');
  return {
    status: 'error',
    message: 'La fonction de suppression est temporairement désactivée pour résoudre un problème de configuration.',
  };
}

// The flow definition is kept but the underlying function is disabled.
ai.defineFlow(
  {
    name: 'deleteUserFlow',
    inputSchema: DeleteUserInputSchema,
    outputSchema: DeleteUserOutputSchema,
  },
  deleteUser
);
