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
Analyse le nom "${supplierName}" et réponds strictement au format JSON avec ces clés :
1. "secteurActivite" : (ex: Électricité, Textile, Informatique, Carburant, Télécoms).
2. "isDeductible" : true/false.
3. "deductibilityReason" : Courte explication.
4. "rule" : Utilise l'une de ces valeurs : "GENERAL", "FUEL_70", "ELEC_EXEMPT".

Règles spéciales à détecter par mot-clé :
- Surtel, Entel, Tigo, Viva -> Secteur: Télécoms, rule: GENERAL.
- Gasolinera, Surtidor, YPBF -> Secteur: Carburant, rule: FUEL_70.
- ELFEC, Delapaz, CRE -> Secteur: Électricité, rule: ELEC_EXEMPT.

Format JSON :
{
  "secteurActivite": "...",
  "isDeductible": true,
  "deductibilityReason": "...",
  "rule": "..."
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
    } catch (e) {
      // Fallback or cleanup
      result = JSON.parse(data.response.replace(/```json/g, '').replace(/```/g, '').trim());
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error categorizing with Ollama:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
