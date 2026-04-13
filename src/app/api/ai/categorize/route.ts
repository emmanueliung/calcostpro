import { NextResponse } from 'next/server';

const OLLAMA_URL = 'http://localhost:11434/api/generate';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { supplierName } = body;

    if (!supplierName) {
      return NextResponse.json({ error: 'fournisseur/client name is required' }, { status: 400 });
    }

    const prompt = `Tu es un expert comptable en Bolivie (système SIAT).
L'entreprise opère dans la "Confection Textile" et le "Développement Web".
Je te donne le nom d'un fournisseur issu d'une facture.
Analyse le nom "${supplierName}" et réponds strictement au format JSON avec ces 4 clés :
1. "secteurActivite" : Le secteur d'activité du fournisseur (ex: Électricité, Textile, Informatique, Carburant, Alimentation).
2. "categorieDepense" : Ce qui est probablement acheté (ex: Matière première, Logiciel, Énergie).
3. "isDeductible" : Booléen (true/false) - Est-ce un coût nécessaire et déductible pour une entreprise de textile ou de développement web ?
4. "deductibilityReason" : Courte phrase en français expliquant ton choix (ex: "Considéré comme matière première indispensable" ou "Généralement une dépense personnelle non déductible").

Note : En Bolivie, l'essence ("Gasolina") est déductible mais possède une règle spéciale (70%). Marque-la comme true si c'est du carburant.

Format JSON strict :
{
  "secteurActivite": "...",
  "categorieDepense": "...",
  "isDeductible": true/false,
  "deductibilityReason": "..."
}`;

    const ollamaPayload = {
      model: 'gemma:2b', // Using gemma as requested
      prompt: prompt,
      stream: false,
      format: 'json'
    };

    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ollamaPayload),
    });

    if (!response.ok) {
        throw new Error(`Ollama responded with ${response.status}`);
    }

    const data = await response.json();
    let result;
    try {
        result = JSON.parse(data.response);
    } catch(e) {
        // Fallback or cleanup
        result = JSON.parse(data.response.replace(/```json/g, '').replace(/```/g, '').trim());
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error categorizing with Ollama:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
