"use client";

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Order, TechnicalSheet, SizeConsumption } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Scissors, Ruler, AlertCircle, ShoppingBag, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface MinimalOrder {
    id: string;
    items: {
        productName: string;
        quantity: number;
        size?: string;
        technicalSheetId?: string;
    }[];
    status: string;
}

interface MaterialNeedsProps {
    orders: MinimalOrder[];
}

interface ComponentSummary {
    name: string;
    totalConsumption: number;
    unit: string;
    type: string;
}

export function MaterialNeeds({ orders }: MaterialNeedsProps) {
    const { user } = useUser();
    const db = useFirestore();
    const [technicalSheets, setTechnicalSheets] = useState<TechnicalSheet[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, "technical_sheets"), where("userId", "==", user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TechnicalSheet));
            setTechnicalSheets(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user, db]);

    // Calculation Logic
    const calculateNeeds = () => {
        const needsMap: Record<string, ComponentSummary> = {};
        let itemsWithNoSheet = 0;

        orders.forEach(order => {
            order.items.forEach(item => {
                const sheet = technicalSheets.find(s => s.id === item.technicalSheetId);

                if (!sheet) {
                    itemsWithNoSheet += item.quantity;
                    return;
                }

                // Find specific consumption for this size
                const sizeCons = sheet.sizeConsumptions.find(sc =>
                    sc.size.toUpperCase() === (item.size || '').toUpperCase()
                );

                // Use specific consumption if found, else default to 0
                const consumptionPerUnit = sizeCons ? sizeCons.consumption : 0;

                sheet.components.forEach(component => {
                    const key = `${sheet.id}-${component.id}`;

                    // If it's a fabric (tissu), we use the size-specific consumption
                    // If it's an accessory, we use the component's consumptionBase
                    const itemConsumption = component.type === 'tissu'
                        ? (consumptionPerUnit * item.quantity)
                        : (component.consumptionBase * item.quantity);

                    if (needsMap[key]) {
                        needsMap[key].totalConsumption += itemConsumption;
                    } else {
                        needsMap[key] = {
                            name: `${sheet.name} - ${component.name}`,
                            totalConsumption: itemConsumption,
                            unit: component.unit,
                            type: component.type
                        };
                    }
                });
            });
        });

        return {
            summaries: Object.values(needsMap),
            itemsWithNoSheet
        };
    };

    const calculation = calculateNeeds();

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (orders.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                <ShoppingBag className="h-10 w-10 mx-auto mb-4 opacity-50" />
                <p>No hay pedidos para calcular necesidades.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold">Resumen de Necesidades de Materia Prima</h3>
                    <p className="text-xs text-muted-foreground">Cálculo basado en pedidos registrados y fiches técnicas vinculadas.</p>
                </div>
                <Badge variant="outline" className="bg-slate-50">
                    {orders.length} pedidos procesados
                </Badge>
            </div>

            {calculation.itemsWithNoSheet > 0 && (
                <Alert className="bg-amber-50 border-amber-200">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800 text-sm">Prendas sin ficha técnica vinculada</AlertTitle>
                    <AlertDescription className="text-amber-700 text-xs">
                        Hay {calculation.itemsWithNoSheet} prendas en estos pedidos que no tienen una ficha técnica vinculada.
                        Vaya a Configuración para vincular sus productos a la Biblioteca.
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {calculation.summaries.filter(s => s.type === 'tissu').map((summary, idx) => (
                    <Card key={idx} className="border-l-4 border-l-blue-500 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs uppercase text-muted-foreground flex items-center gap-2">
                                <Scissors className="h-3 w-3" />
                                Tela / Materia Principal
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex justify-between items-end">
                                <div className="font-bold text-slate-900">{summary.name}</div>
                                <div className="text-2xl font-black text-blue-700">
                                    {summary.totalConsumption.toFixed(2)} <span className="text-sm font-normal">{summary.unit}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {calculation.summaries.filter(s => s.type !== 'tissu').length > 0 && (
                <div className="space-y-3">
                    <h4 className="text-sm font-bold flex items-center gap-2">
                        <Ruler className="h-4 w-4 text-slate-500" />
                        Accesorios y Suministros
                    </h4>
                    <div className="border rounded-md bg-white overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50">
                                    <TableHead>Artículo</TableHead>
                                    <TableHead className="text-right">Cantidad Necesaria</TableHead>
                                    <TableHead>Unidad</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {calculation.summaries
                                    .filter(s => s.type !== 'tissu')
                                    .map((summary, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell className="font-medium text-sm">{summary.name}</TableCell>
                                            <TableCell className="text-right font-bold text-slate-900">
                                                {summary.totalConsumption.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{summary.unit}</TableCell>
                                        </TableRow>
                                    ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}
        </div>
    );
}
