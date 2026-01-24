
"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ProjectConfiguration, QuoteItem } from '@/lib/types';
import { Separator } from '../ui/separator';

interface MaterialPurchaseSummaryProps {
  projectConfig: ProjectConfiguration;
}

interface MaterialSummary {
  name: string;
  totalQuantity: number;
  totalCost: number;
  unit: string;
}

export function MaterialPurchaseSummary({ projectConfig }: MaterialPurchaseSummaryProps) {
  
  const { lineItems, quoteMode } = projectConfig;

  const { summaryByMaterial, totalPurchaseCost, totalQuantity } = useMemo(() => {
    const summaryMap: { [key: string]: { totalQuantity: number; unit: string; totalCost: number } } = {};
    
    const allItems: (QuoteItem & { parentQuantity: number})[] = lineItems.flatMap(lineItem => {
         const quantityMultiplier = quoteMode === 'individual' 
            ? 1
            : (lineItem.quantity || 1);

        return lineItem.items.map(item => ({
            ...item,
            parentQuantity: quantityMultiplier
        }));
    });


    allItems.forEach(item => {
        if (!summaryMap[item.material.name]) {
            summaryMap[item.material.name] = { totalQuantity: 0, unit: item.material.unit, totalCost: 0 };
        }
        summaryMap[item.material.name].totalQuantity += item.quantity * item.parentQuantity;
        summaryMap[item.material.name].totalCost += item.total * item.parentQuantity;
    });

    const summaryArray: MaterialSummary[] = Object.entries(summaryMap).map(([name, data]) => ({
        name,
        ...data
    }));

    const totalCost = summaryArray.reduce((acc, material) => acc + material.totalCost, 0);
    const totalQty = lineItems.reduce((acc, li) => acc + (li.quantity || 1), 0);

    return { summaryByMaterial: summaryArray, totalPurchaseCost: totalCost, totalQuantity: totalQty };
  }, [lineItems, quoteMode]);


  if (lineItems.flatMap(li => li.items).length === 0) {
    return null;
  }

  const getUnitLabel = (unit: string, quantity: number) => {
    if (unit === 'piece') return quantity > 1 ? 'pzs' : 'pz';
    if (unit === 'm') return 'm';
    if (unit === 'm²') return 'm²';
    return unit;
  };

  return (
    <Card className='no-print'>
      <CardHeader>
        <CardTitle>Resumen de Compra de Materiales</CardTitle>
        <CardDescription>Resumen para uso interno. No se incluirá en la cotización final.</CardDescription>
      </CardHeader>
      <CardContent>
        {quoteMode !== 'individual' && (
            <p className="text-sm text-muted-foreground mb-4">
                Basado en una cantidad de <strong>{totalQuantity} {totalQuantity > 1 ? 'unidades' : 'unidad'}</strong>.
            </p>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead className="text-right">Cantidad Total</TableHead>
              <TableHead className="text-right">Costo Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summaryByMaterial.map((material) => (
                <TableRow key={material.name}>
                    <TableCell className="font-medium">{material.name}</TableCell>
                    <TableCell className="text-right">
                        {material.totalQuantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} {getUnitLabel(material.unit, material.totalQuantity)}
                    </TableCell>
                    <TableCell className="text-right">Bs. {Math.round(material.totalCost)}</TableCell>
                </TableRow>
            ))}
          </TableBody>
        </Table>
        <Separator className="my-4" />
        <div className="flex justify-between font-bold text-lg">
            <span>Total a Comprar</span>
            <span>Bs. {Math.round(totalPurchaseCost)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
