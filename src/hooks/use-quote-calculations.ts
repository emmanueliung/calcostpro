

"use client";

import { useMemo } from 'react';
import type { ProjectConfiguration, UserProfileData, LineItem } from '@/lib/types';

const SIZES = ["6 a 8", "10 a 12", "14", "S, M, L", "XL", "XXL", "XXXL", "XXXXL"];
const BASE_SIZE_INDEX = SIZES.indexOf("S, M, L");

interface CalculatedLineItem extends LineItem {
  subtotalPerUnit: number;
  taxPerUnit: number;
  costPerUnit: number;
  profitAmount: number;
  finalPricePerUnit_Base: number;
  calculatedSizePrices: {
    size: string;
    price: number;
    isSelected: boolean;
  }[];
}

export interface CalculatedData {
  lineItemsWithCalculations: CalculatedLineItem[];
  totalProjectCost: number; // Total cost without profit
  totalProfit: number;
  totalTax: number;
  grandTotal: number; // Total cost with profit and tax
}

const EMPTY_CALCULATED_DATA: CalculatedData = {
    lineItemsWithCalculations: [],
    totalProjectCost: 0,
    totalProfit: 0,
    totalTax: 0,
    grandTotal: 0,
};

export function useQuoteCalculations(projectConfig: ProjectConfiguration | null, companyInfo: UserProfileData | null): CalculatedData {
  
  return useMemo(() => {
    if (!projectConfig) {
        return EMPTY_CALCULATED_DATA;
    }
    const { lineItems, quoteMode } = projectConfig;

    const taxRate = (companyInfo?.taxPercentage || 0) / 100;
    
    let totalProjectCost = 0;
    let totalProfit = 0;
    let totalTax = 0;

    const calculatedLineItems = lineItems.map(line => {
      const materialCostPerUnit = line.items.reduce((acc, item) => acc + item.total, 0);
      const laborCostPerUnit = line.laborCosts.labor + line.laborCosts.cutting + (line.laborCosts.other || 0);
      
      const subtotalPerUnit = materialCostPerUnit + laborCostPerUnit;
      const taxPerUnit = subtotalPerUnit * taxRate;
      const costPerUnit = subtotalPerUnit + taxPerUnit;
      
      const profitAmount = costPerUnit * ((line.profitMargin || 0) / 100);
      const finalPricePerUnit_Base = Math.ceil(costPerUnit + profitAmount);
      
      const calculatedSizePrices = SIZES.map(size => {
        const userSizePrice = line.sizePrices.find(sp => sp.size === size);
        if (!userSizePrice || !userSizePrice.isSelected) {
            return { size, price: 0, isSelected: false };
        }
        
        const sizeIndex = SIZES.indexOf(size);
        const indexDiff = sizeIndex - BASE_SIZE_INDEX;
        const priceMultiplier = 1 + (indexDiff * 0.10); // 10% increase/decrease per size step
        const calculatedPrice = Math.ceil(finalPricePerUnit_Base * priceMultiplier);
        
        return { size, price: calculatedPrice, isSelected: true };
      });
      
      const quantity = quoteMode === 'individual' ? 1 : line.quantity;

      // Note: For totals, we should use the rounded final prices
      if (quoteMode === 'individual') {
        // In individual mode, we can't easily calculate total profit/cost without knowing quantities per size.
        // We can estimate based on base price or just sum up selected sizes.
        // For simplicity, let's use the final prices for grand total estimate.
        // This part is tricky as we don't have per-size quantities.
        // The grand total will be an approximation or based on a different logic.
        // For now, let's calculate based on the final price of selected sizes.
      } else {
        totalProjectCost += costPerUnit * quantity;
        totalProfit += (finalPricePerUnit_Base - costPerUnit) * quantity;
        totalTax += taxPerUnit * quantity;
      }
      
      return {
        ...line,
        subtotalPerUnit,
        taxPerUnit,
        costPerUnit,
        profitAmount, // This is now an approximation
        finalPricePerUnit_Base,
        calculatedSizePrices,
      };
    });

    const grandTotal = calculatedLineItems.reduce((acc, item) => {
        if (quoteMode === 'individual') {
            // This is a rough estimate for the dashboard/summary.
            // A more accurate total would require quantity per size.
            // Let's assume the base price for all items for a summary total.
             return acc + (item.finalPricePerUnit_Base * item.quantity);

        }
        // For group mode
        return acc + Math.ceil(item.finalPricePerUnit_Base * item.quantity);
    }, 0);
    
    // Recalculate totalProjectCost for a more accurate representation without profit
    const finalTotalProjectCost = calculatedLineItems.reduce((acc, item) => {
      const quantity = item.quantity || 1;
      return acc + (item.costPerUnit * quantity);
    }, 0);


    return { 
        lineItemsWithCalculations: calculatedLineItems, 
        totalProjectCost: finalTotalProjectCost,
        totalProfit: grandTotal - finalTotalProjectCost,
        totalTax: calculatedLineItems.reduce((acc, item) => acc + (item.taxPerUnit * (item.quantity || 1)),0),
        grandTotal,
    };
  }, [projectConfig, companyInfo]);
}
