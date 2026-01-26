"use client";

import { useMemo } from 'react';
import { Order, OrderItem } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
    const summary = useMemo(() => {
        const counts: Record<string, SummaryItem> = {};

        orders.forEach(order => {
            order.items.forEach(item => {
                const name = item.productName;
                const gender = order.studentGender || 'Hombre';
                const size = item.size || 'N/A';
                const key = `${name}-${gender}-${size}`;

                if (!counts[key]) {
                    counts[key] = { name, gender, size, count: 0 };
                }
                counts[key].count += item.quantity;
            });
        });

        return Object.values(counts).sort((a, b) => {
            if (a.name !== b.name) return a.name.localeCompare(b.name);
            if (a.gender !== b.gender) return a.gender.localeCompare(b.gender);
            return a.size.localeCompare(b.size);
        });
    }, [orders]);

    const totalGarments = summary.reduce((sum, item) => sum + item.count, 0);

    return (
        <Card className="border shadow-none">
            <CardHeader className="bg-slate-50 border-b">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-xl">Resumen de Producción</CardTitle>
                        <p className="text-sm text-muted-foreground">{collegeName === 'all' ? 'Todos los colegios' : collegeName}</p>
                    </div>
                    <Badge variant="secondary" className="px-3 py-1 text-sm font-bold">
                        {totalGarments} prendas en total
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Prenda</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Talla</TableHead>
                            <TableHead className="text-right">Cantidad</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {summary.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                    No hay datos para resumir
                                </TableCell>
                            </TableRow>
                        ) : (
                            summary.map((item, idx) => (
                                <TableRow key={idx}>
                                    <TableCell className="font-medium">{item.name}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={item.gender === 'Mujer' ? 'border-pink-200 text-pink-600 bg-pink-50' : 'border-blue-200 text-blue-600 bg-blue-50'}>
                                            {item.gender}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{item.size}</TableCell>
                                    <TableCell className="text-right font-bold text-lg">{item.count}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
