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
Je te donne le nom d'un fournisseur ou d'un client issu de la facturation d'une entreprise de confection textile.
Ton rôle est d'analyser le nom et de deviner de manière pertinente :
1. "Secteur", qui correspond au secteur d'activité (limite-toi à un secteur logique parmi les secteurs génériques).
2. "Categorie", qui correspond à la catégorie de dépense ou recette (ex: Tissu, Accessoires, Électricité, Loyer, Main d'oeuvre, Matériel de bureau, Frais généraux, Ventes).

Nom du fournisseur/client : "${supplierName}"

Réponds UNIQUEMENT au format JSON strict avec la structure suivante, sans aucun autre texte (pas de markdown en dehors du bloc json):
{
  "secteurActivite": "...",
  "categorieDepense": "..."
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
