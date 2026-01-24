
import { doc, runTransaction, collection, getDocs } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import type { ProjectConfiguration, Fitting, QuoteItem } from '@/lib/types';

const { firestore: db } = initializeFirebase();

export const FITTING_SIZE_FACTORS: { [key: string]: number } = {
  "6 a 8": 0.85,
  "10 a 12": 0.9,
  "14": 0.95,
  "S, M, L": 1.0,
  "XL": 1.10,
  "XXL": 1.20,
  "XXXL": 1.30,
  "XXXXL": 1.40,
};

// This function recalculates total surface and cost based on ALL fittings.
export async function recalculateProjectConsumption(projectId: string) {
    const projectRef = doc(db, 'projects', projectId);
    
    await runTransaction(db, async (transaction) => {
        const projectSnap = await transaction.get(projectRef);

        if (!projectSnap.exists()) {
            throw new Error(`Project ${projectId} not found for recalculation.`);
        }
        const projectData = projectSnap.data() as ProjectConfiguration;

        const baseGarment = projectData.lineItems?.[0];
        if (!baseGarment) {
            console.error(`Project ${projectId} has no line items for calculation.`);
            transaction.update(projectRef, {
                surfaceTotale: 0,
                coutTissuTotal: 0
            });
            return;
        }
        
        const fabricItems = baseGarment.items.filter((item: QuoteItem) => item.type === 'Fabric');
        const baseFabricLengthPerGarment = fabricItems.reduce((acc, item) => acc + item.quantity, 0);
        const baseFabricCostPerMeter = fabricItems.length > 0 ? (fabricItems[0].material.price) : 0;
        
        const fittingsRef = collection(db, 'projects', projectId, 'fittings');
        const allFittingsSnap = await getDocs(fittingsRef); // Note: No query, gets all docs
        
        if (allFittingsSnap.empty) {
            transaction.update(projectRef, {
                surfaceTotale: 0,
                coutTissuTotal: 0
            });
            return;
        }

        let longueurTotale = 0;
        const allFittings = allFittingsSnap.docs.map(doc => doc.data() as Fitting);

        allFittings.forEach(fitting => {
            const garmentId = baseGarment.id;
            const size = fitting.sizes?.[garmentId] || "S, M, L";
            const factor = FITTING_SIZE_FACTORS[size] || 1.0;
            longueurTotale += baseFabricLengthPerGarment * factor;
        });

        const coutTissuTotal = longueurTotale * baseFabricCostPerMeter;

        transaction.update(projectRef, {
            surfaceTotale: parseFloat(longueurTotale.toFixed(2)),
            coutTissuTotal: parseFloat(coutTissuTotal.toFixed(2))
        });
    }).catch(error => {
        // We log the error but don't throw it to the UI, as it's a background process.
        console.error("Failed to recalculate project consumption:", error);
    });
}
