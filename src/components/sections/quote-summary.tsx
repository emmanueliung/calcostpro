
"use client";

import { useEffect, useState } from 'react';
import { Slider } from '../ui/slider';
import { Label } from '../ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { ProjectConfiguration, QuoteItem } from '@/lib/types';
import type { CalculatedData } from '@/hooks/use-quote-calculations';

interface QuoteSummaryProps {
  projectConfig: ProjectConfiguration;
  updateProjectConfig: (updater: (prev: ProjectConfiguration) => ProjectConfiguration) => void;
  calculatedData: CalculatedData;
}

export function QuoteSummarySection({ projectConfig, updateProjectConfig, calculatedData }: QuoteSummaryProps) {
  const { lineItemsWithCalculations, totalProjectCost, grandTotal } = calculatedData;
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const getFabricItems = (items: QuoteItem[]) => items.filter(item => item.type === 'Fabric');
  const getAccessoryItems = (items: QuoteItem[]) => items.filter(item => item.type !== 'Fabric');

  const isIndividualMode = projectConfig.quoteMode === 'individual';
  
  const totalCostLabel = isIndividualMode ? "Total (Todos los productos)" : "Costo Total del Proyecto";
  const totalCostValue = grandTotal.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });


  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl">Resumen Final de la Cotización</CardTitle>
        <CardDescription>Visualiza el costo final por unidad y el total del proyecto según las ganancias definidas.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {isIndividualMode && lineItemsWithCalculations.length > 0 && (
          <div className="p-4 rounded-md border text-sm">
            <h4 className="font-semibold mb-2">Precios de Venta por Prenda y Talla</h4>
            {lineItemsWithCalculations.map(item => (
                <div key={item.id} className='mb-4 last:mb-0'>
                    <p className='font-medium'>{item.name}</p>
                    <div className="overflow-x-auto">
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead>Talla</TableHead>
                                  <TableHead className="text-right">Precio</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {item.calculatedSizePrices.filter(sp => sp.isSelected).map(size => (
                                  <TableRow key={size.size}>
                                      <TableCell>{size.size}</TableCell>
                                      <TableCell className="text-right">Bs. {size.price.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</TableCell>
                                  </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                    </div>
                </div>
            ))}
          </div>
        )}

        {!isIndividualMode && lineItemsWithCalculations.length > 0 && (
          <div className="p-4 rounded-md border text-sm">
            <h4 className="font-semibold mb-2">Precio de Venta por Prenda</h4>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prenda</TableHead>
                    <TableHead className="text-right">Precio Unitario (Todo Incluido)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItemsWithCalculations.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell className="text-right font-medium">Bs. {item.finalPricePerUnit_Base.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

         <div className="flex justify-between items-center font-bold text-lg p-4 bg-primary text-primary-foreground rounded-md">
            <span>{totalCostLabel.toUpperCase()}</span>
            <span className="font-bold text-lg whitespace-nowrap">Bs. {totalCostValue}</span>
        </div>

        <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
                <AccordionTrigger>Ver desglose de costos</AccordionTrigger>
                <AccordionContent>
                  {isClient && lineItemsWithCalculations.map(line => (
                    <div key={line.id} className="space-y-2 pt-2 text-sm border-t first:border-t-0 mt-2 first:mt-0">
                        <p className='font-bold text-base'>{line.name} (x{isIndividualMode ? '1' : line.quantity})</p>
                        
                        {isIndividualMode ? (
                            <>
                                <p className='font-semibold'>Costo de Materiales por Prenda</p>
                                <div className="pl-4 space-y-1">
                                    {getFabricItems(line.items).map(item => {
                                        return (
                                            <div key={item.id} className="flex justify-between text-muted-foreground">
                                                <span>- {item.material.name} ({item.quantity.toFixed(2)} {item.material.unit})</span>
                                                <span className='text-right'>Bs. {item.total.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>
                                        )
                                    })}
                                    {getAccessoryItems(line.items).map(item => (
                                        <div key={item.id} className="flex justify-between text-muted-foreground">
                                            <span>- {item.material.name} ({item.quantity.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} {item.material.unit === 'piece' ? 'pz' : item.material.unit})</span>
                                            <span className='text-right'>Bs. {item.total.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    ))}
                                </div>
                                
                                <div className="flex justify-between font-semibold pt-2">
                                    <span>Costo de Mano de Obra por Prenda</span>
                                    <span className='text-right'>Bs. {(line.laborCosts.labor + line.laborCosts.cutting).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>

                                <Separator className="my-2" />
                                <div className="flex justify-between font-bold">
                                    <span>Costo Total por Prenda (sin impuestos)</span>
                                    <span>Bs. {line.subtotalPerUnit.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                
                                {line.taxPerUnit > 0 && (
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>Impuestos por Prenda</span>
                                        <span>Bs. {line.taxPerUnit.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                )}
                                <div className="flex justify-between font-bold text-base mt-1">
                                    <span>Costo Total por Prenda (con impuestos)</span>
                                    <span>Bs. {line.costPerUnit.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className='font-semibold'>Costo de Materiales para {line.quantity} prendas</p>
                                <div className="pl-4 space-y-1">
                                     {getFabricItems(line.items).map(item => {
                                        const totalQuantity = item.quantity * line.quantity;
                                        return (
                                            <div key={item.id} className="flex justify-between text-muted-foreground">
                                                <span>- {item.material.name} ({totalQuantity.toFixed(2)} {item.material.unit})</span>
                                                <span className='text-right'>Bs. {(item.total * line.quantity).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>
                                        )
                                    })}
                                    {getAccessoryItems(line.items).map(item => (
                                        <div key={item.id} className="flex justify-between text-muted-foreground">
                                            <span>- {item.material.name} ({item.quantity * line.quantity} {item.material.unit === 'piece' ? 'pz' : item.material.unit})</span>
                                            <span className='text-right'>Bs. {(item.total * line.quantity).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    ))}
                                </div>
                                
                                <div className="flex justify-between font-semibold pt-2">
                                    <span>Costo de Mano de Obra para {line.quantity} prendas</span>
                                    <span className='text-right'>Bs. {((line.laborCosts.labor + line.laborCosts.cutting) * line.quantity).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>

                                <Separator className="my-2" />
                                <div className="flex justify-between font-bold">
                                    <span>Costo Total para {line.quantity} prendas (sin impuestos)</span>
                                    <span>Bs. {(line.subtotalPerUnit * line.quantity).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                
                                {line.taxPerUnit > 0 && (
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>Impuestos</span>
                                        <span>Bs. {(line.taxPerUnit * line.quantity).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                )}
                                <div className="flex justify-between font-bold text-base mt-1">
                                    <span>Costo Total para "{line.name}" (x{line.quantity})</span>
                                    <span>Bs. {(line.costPerUnit * line.quantity).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                </div>
                                <div className="flex justify-between text-sm text-muted-foreground pl-4">
                                  <span>Costo por unidad (todo incluido)</span>
                                  <span>Bs. {line.costPerUnit.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </>
                        )}
                    </div>
                  ))}
                  
                  <Separator className="my-4" />
                  <div className="flex justify-between font-bold text-lg p-2 bg-muted rounded-md">
                    <span>Costo Total del Proyecto (sin ganancia)</span>
                    <span>Bs. {totalProjectCost.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
                      
                </AccordionContent>
            </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}

    

    