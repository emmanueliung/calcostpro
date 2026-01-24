
"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { LineItem, SizePrice } from "@/lib/types";

const SIZES = ["6 a 8", "10 a 12", "14", "S, M, L", "XL", "XXL", "XXXL", "XXXXL"];

interface SizeSelectionProps {
  updateLineItem: (updater: (prev: LineItem) => LineItem) => void;
  sizePrices: SizePrice[];
}

export function SizeSelection({ updateLineItem, sizePrices }: SizeSelectionProps) {

    const handleSizeChange = (size: string, checked: boolean) => {
        updateLineItem(prev => {
            const otherSizes = prev.sizePrices.filter(s => s.size !== size);
            if (checked) {
                return {
                    ...prev,
                    sizePrices: [...otherSizes, { size, price: 0, isSelected: true }].sort((a, b) => SIZES.indexOf(a.size) - SIZES.indexOf(b.size))
                };
            } else {
                 return {
                    ...prev,
                    sizePrices: otherSizes
                };
            }
        });
    }
    
    const isSizeSelected = (size: string) => {
        return !!sizePrices.find(sp => sp.size === size && sp.isSelected);
    }

  return (
    <div>
        <Label>Tallas a Cotizar</Label>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-4 mt-2">
        {SIZES.map((size) => (
            <div key={size} className="flex flex-col items-center gap-2">
                <Label htmlFor={size} className="text-sm font-medium text-center">{size}</Label>
                <Checkbox 
                    id={size} 
                    checked={isSizeSelected(size)}
                    onCheckedChange={(checked) => handleSizeChange(size, !!checked)}
                />
            </div>
        ))}
        </div>
    </div>
  );
}
