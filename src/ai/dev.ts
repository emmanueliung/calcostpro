
import { config } from 'dotenv';
config();

import '@/ai/flows/suggest-quote-styles.ts';

// Temporarily removing flows that use the admin SDK to isolate the issue.
// import '@/ai/flows/send-new-user-email.ts';
// import '@/ai/flows/delete-user.ts';
// import '@/ai/flows/send-fitting-confirmation.ts';
