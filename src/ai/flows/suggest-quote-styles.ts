
// This file is machine-generated - edit at your own risk!

'use server';

/**
 * @fileOverview This file defines a Genkit flow for suggesting quote styling options.
 *
 * It uses the current quote information to generate layout arrangements and styling suggestions, enhancing the quote's aesthetics.
 * - suggestQuoteStyles - A function that takes quote details as input and returns styling suggestions.
 * - SuggestQuoteStylesInput - The input type for the suggestQuoteStyles function.
 * - SuggestQuoteStylesOutput - The return type for the suggestQuoteStyles function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Define the input schema for the quote details
const SuggestQuoteStylesInputSchema = z.object({
  clientName: z.string().describe('El nombre del cliente.'),
  projectName: z.string().describe('El nombre del proyecto.'),
  quoteDetails: z.string().describe('Descripción detallada de la cotización, incluyendo artículos, cantidades y precios.'),
});
export type SuggestQuoteStylesInput = z.infer<typeof SuggestQuoteStylesInputSchema>;

// Define the output schema for the styling suggestions
const SuggestQuoteStylesOutputSchema = z.object({
  suggestions: z.array(
    z.string().describe('Una sugerencia de estilo para la cotización.')
  ).describe('Un array de sugerencias de estilo.'),
});
export type SuggestQuoteStylesOutput = z.infer<typeof SuggestQuoteStylesOutputSchema>;

// Exported function to trigger the flow
export async function suggestQuoteStyles(input: SuggestQuoteStylesInput): Promise<SuggestQuoteStylesOutput> {
  return suggestQuoteStylesFlow(input);
}

// Define the prompt to generate styling suggestions based on quote details
const suggestQuoteStylesPrompt = ai.definePrompt({
  name: 'suggestQuoteStylesPrompt',
  input: {schema: SuggestQuoteStylesInputSchema},
  output: {schema: SuggestQuoteStylesOutputSchema},
  prompt: `Eres un consultor de diseño experto especializado en la estética de documentos de cotización.
  Basado en los siguientes detalles de la cotización, sugiere diferentes arreglos de diseño y opciones de estilo para mejorar el atractivo visual y la profesionalidad de la cotización.

  Nombre del Cliente: {{{clientName}}}
  Nombre del Proyecto: {{{projectName}}}
  Detalles de la Cotización: {{{quoteDetails}}}

  Proporciona una lista de sugerencias que incluya opciones de fuentes, paletas de colores, estructuras de diseño y cualquier otro elemento de diseño relevante. Cada sugerencia debe ser concisa y procesable.
  Las sugerencias deben adaptarse al proyecto y al cliente para un toque personalizado.
  Sugerencias:
  `,
});

// Define the Genkit flow
const suggestQuoteStylesFlow = ai.defineFlow(
  {
    name: 'suggestQuoteStylesFlow',
    inputSchema: SuggestQuoteStylesInputSchema,
    outputSchema: SuggestQuoteStylesOutputSchema,
  },
  async input => {
    const {output} = await suggestQuoteStylesPrompt(input);
    return output!;
  }
);
