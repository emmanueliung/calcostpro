"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OrderItem, College } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, ShoppingBag } from 'lucide-react';

interface PublicOrderPanelProps {
    college: College | null;
    items: OrderItem[];
    onAddItem: (item: OrderItem) => void;
    onRemoveItem: (index: number) => void;
}

export function PublicOrderPanel({ college, items, onAddItem, onRemoveItem }: PublicOrderPanelProps) {
    const handleAddConfiguredItem = (name: string, price: number) => {
        onAddItem({
            productName: name,
            quantity: 1,
            price: price,
            type: 'sur_mesure'
        });
    };

    if (!college) {
        return (
            <Card className="h-full flex flex-col justify-center items-center text-muted-foreground p-6">
                <ShoppingBag className="h-12 w-12 mb-4 opacity-50" />
                <p>Selecciona tu colegio para ver los uniformes disponibles.</p>
            </Card>
        );
    }

    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-3 border-b">
                <CardTitle className="text-lg">
                    Uniformes - <span className="text-primary">{college.name}</span>
                </CardTitle>
                {college.course && (
                    <p className="text-xs text-muted-foreground">{college.course}</p>
                )}
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4 p-4">

                {/* Available Items */}
                <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">Prendas Disponibles</h4>
                    {college.priceList && college.priceList.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                            {college.priceList.map((item, idx) => (
                                <Button
                                    key={idx}
                                    variant="outline"
                                    className="h-auto py-3 flex flex-col items-start gap-1 text-left bg-white hover:bg-primary/5 hover:border-primary"
                                    onClick={() => handleAddConfiguredItem(item.name, item.price)}
                                >
                                    <span className="font-semibold text-sm">{item.name}</span>
                                    <span className="text-xs text-muted-foreground">{item.price} Bs</span>
                                </Button>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-muted-foreground text-sm bg-muted/30 rounded-lg">
                            <p>No hay prendas configuradas para este colegio.</p>
                        </div>
                    )}
                </div>

                {/* Order Summary */}
                <div className="flex-1 flex flex-col border-t pt-3">
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">Tu Pedido</h4>
                    <ScrollArea className="flex-1 border rounded-md bg-white/50 min-h-[200px]">
                        {items.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-xs text-muted-foreground p-4">
                                Tu carrito está vacío. Agrega prendas arriba.
                            </div>
                        ) : (
                            <div className="divide-y">
                                {items.map((item, index) => (
                                    <div key={index} className="p-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                                        <div>
                                            <p className="font-medium text-sm">{item.productName}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {item.quantity} x {item.price} Bs
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-sm">{item.quantity * item.price} Bs</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                                onClick={() => onRemoveItem(index)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>

                    {/* Total */}
                    {items.length > 0 && (
                        <div className="mt-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
                            <div className="flex justify-between items-center">
                                <span className="font-semibold">Total:</span>
                                <span className="text-2xl font-bold text-primary">{total.toFixed(2)} Bs</span>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
