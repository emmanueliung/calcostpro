"use client";

import { useMemo } from 'react';
import { Order, OrderItem } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useReactToPrint } from 'react-to-print';
import { useRef } from 'react';

interface ProductionSummaryProps {
    orders: Order[];
    collegeName: string;
}

interface SummaryItem {
    name: string;
    gender: 'Hombre' | 'Mujer';
    size: string;
    count: number;
}

export function ProductionSummary({ orders, collegeName }: ProductionSummaryProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `Resumen_Produccion_${collegeName}`,
    });

    const groupedSummary = useMemo(() => {
        // Structure: { GarmentName: { Gender: { Size: count } } }
        const data: Record<string, Record<string, Record<string, number>>> = {};

        orders.forEach(order => {
            order.items.forEach(item => {
                const name = item.productName;
                const gender = order.studentGender || 'Hombre';
                const size = (item.size || 'N/A').toUpperCase();

                if (!data[name]) data[name] = {};
                if (!data[name][gender]) data[name][gender] = {};
                if (!data[name][gender][size]) data[name][gender][size] = 0;

                data[name][gender][size] += item.quantity;
            });
        });

        return data;
    }, [orders]);

    const totalGarments = useMemo(() => {
        let count = 0;
        Object.values(groupedSummary).forEach(genders => {
            Object.values(genders).forEach(sizes => {
                Object.values(sizes).forEach(qty => count += qty);
            });
        });
        return count;
    }, [groupedSummary]);

    return (
        <Card className="border shadow-none">
            <CardHeader className="bg-slate-50 border-b">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-xl">Resumen de Producción</CardTitle>
                        <p className="text-sm text-muted-foreground">{collegeName === 'all' ? 'Todos los colegios' : collegeName}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" onClick={handlePrint}>
                            <Printer className="h-4 w-4 mr-2" />
                            Imprimir Resumen
                        </Button>
                        <Badge variant="secondary" className="px-3 py-1 text-sm font-bold">
                            {totalGarments} prendas en total
                        </Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-6" ref={printRef}>
                <div className="print:p-8">
                    <div className="hidden print:block mb-6">
                        <h1 className="text-2xl font-bold">Resumen de Producción</h1>
                        <p className="text-sm text-muted-foreground">Colegio: {collegeName === 'all' ? 'Todos los colegios' : collegeName}</p>
                        <p className="text-sm text-muted-foreground">Total: {totalGarments} prendas</p>
                    </div>

                    {Object.keys(groupedSummary).length === 0 ? (
                        <p className="text-center py-8 text-muted-foreground">No hay datos para resumir</p>
                    ) : (
                        <div className="space-y-8">
                            {Object.entries(groupedSummary).sort(([a], [b]) => a.localeCompare(b)).map(([garment, genders]) => (
                                <div key={garment} className="space-y-4">
                                    <h3 className="text-lg font-bold border-b pb-2 flex items-center justify-between">
                                        {garment}
                                        <Badge variant="outline">{Object.values(genders).reduce((acc, sizes) => acc + Object.values(sizes).reduce((s, q) => s + q, 0), 0)} unidades</Badge>
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {Object.entries(genders).sort(([a], [b]) => b.localeCompare(a)).map(([gender, sizes]) => (
                                            <div key={gender} className="border rounded-md overflow-hidden bg-white">
                                                <div className={`px-3 py-2 text-sm font-bold border-b ${gender === 'Mujer' ? 'bg-pink-50 text-pink-700' : 'bg-blue-50 text-blue-700'}`}>
                                                    {gender}
                                                </div>
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="hover:bg-transparent">
                                                            <TableHead className="h-8">Talla</TableHead>
                                                            <TableHead className="h-8 text-right">Cantidad</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {Object.entries(sizes).sort(([a], [b]) => a.localeCompare(b)).map(([size, count]) => (
                                                            <TableRow key={size} className="hover:bg-transparent">
                                                                <TableCell className="py-2 text-sm font-medium">{size}</TableCell>
                                                                <TableCell className="py-2 text-right font-bold text-base">{count}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
