"use client";

import { useMemo } from 'react';
import { Order, OrderItem } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Printer, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useReactToPrint } from 'react-to-print';
import { useRef, useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ProjectConfiguration } from '@/lib/types';
import { FITTING_SIZE_FACTORS } from '@/lib/calculation-helpers';

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
    const db = useFirestore();
    const printRef = useRef<HTMLDivElement>(null);
    const [selectedGarment, setSelectedGarment] = useState<string>("all");
    const [projectConfigs, setProjectConfigs] = useState<Record<string, ProjectConfiguration>>({});

    // Fetch projects used in these orders
    useEffect(() => {
        const fetchNeededProjects = async () => {
            const projectIds = new Set<string>();
            orders.forEach(o => {
                if (o.projectId) projectIds.add(o.projectId);
            });

            const newConfigs: Record<string, ProjectConfiguration> = { ...projectConfigs };
            let hasNew = false;

            for (const pid of Array.from(projectIds)) {
                if (!newConfigs[pid]) {
                    try {
                        const snap = await getDoc(doc(db, "projects", pid));
                        if (snap.exists()) {
                            newConfigs[pid] = { id: snap.id, ...snap.data() } as ProjectConfiguration;
                            hasNew = true;
                        }
                    } catch (e) {
                        console.error("Error fetching project config", pid, e);
                    }
                }
            }

            if (hasNew) setProjectConfigs(newConfigs);
        };

        if (orders.length > 0) fetchNeededProjects();
    }, [orders, db]);

    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `Produccion_${selectedGarment === 'all' ? 'Completa' : selectedGarment}_${collegeName}`,
    });

    const groupedSummary = useMemo(() => {
        // Structure: { GarmentName: { Gender: { Size: count } } }
        const data: Record<string, Record<string, Record<string, number>>> = {};

        orders.forEach(order => {
            order.items.forEach(item => {
                const name = item.productName;

                // Filter by garment if selected
                if (selectedGarment !== "all" && name !== selectedGarment) return;

                const gender = order.studentGender || 'Hombre';
                const size = (item.size || 'N/A').toUpperCase();

                if (!data[name]) data[name] = {};
                if (!data[name][gender]) data[name][gender] = {};
                if (!data[name][gender][size]) data[name][gender][size] = 0;

                data[name][gender][size] += item.quantity;
            });
        });

        return data;
    }, [orders, selectedGarment]);

    const uniqueGarments = useMemo(() => {
        const garments = new Set<string>();
        orders.forEach(o => o.items.forEach(i => garments.add(i.productName)));
        return Array.from(garments).sort();
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

    const materialAggregates = useMemo(() => {
        const aggregates: Record<string, { totalQuantity: number; unit: string; totalCost: number }> = {};

        orders.forEach(order => {
            const pid = order.projectId;
            const project = pid ? projectConfigs[pid] : null;

            order.items.forEach(item => {
                // Apply garment filter to materials too
                if (selectedGarment !== "all" && item.productName !== selectedGarment) return;

                if (project) {
                    const lineItem = project.lineItems.find(li => li.name === item.productName);
                    if (lineItem) {
                        const size = item.size || 'M';
                        const factor = FITTING_SIZE_FACTORS[size] || 1.0;

                        lineItem.items.forEach(materialItem => {
                            const name = materialItem.material.name;
                            const unit = materialItem.material.unit;
                            const price = materialItem.material.price;

                            if (!aggregates[name]) {
                                aggregates[name] = { totalQuantity: 0, unit, totalCost: 0 };
                            }

                            const qtyPerGarment = materialItem.type === 'Fabric' ? materialItem.quantity * factor : materialItem.quantity;
                            const totalQty = qtyPerGarment * item.quantity;

                            aggregates[name].totalQuantity += totalQty;
                            aggregates[name].totalCost += totalQty * price;
                        });
                    }
                }
            });
        });

        return aggregates;
    }, [orders, projectConfigs, selectedGarment]);

    const getUnitLabel = (unit: string) => {
        if (unit === 'm²') return 'm';
        return unit;
    };

    return (
        <Card className="border shadow-none">
            <CardHeader className="bg-slate-50 border-b">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-xl">Resumen de Producción</CardTitle>
                        <p className="text-sm text-muted-foreground">{collegeName === 'all' ? 'Todos los colegios' : collegeName}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-[200px]">
                            <Select value={selectedGarment} onValueChange={setSelectedGarment}>
                                <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Filtrar por prenda" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las prendas</SelectItem>
                                    {uniqueGarments.map(g => (
                                        <SelectItem key={g} value={g}>{g}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button variant="outline" size="sm" onClick={handlePrint}>
                            <Printer className="h-4 w-4 mr-2" />
                            Imprimir
                        </Button>
                        <Badge variant="secondary" className="px-3 py-1 text-sm font-bold">
                            {totalGarments} prendas
                        </Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-6" ref={printRef}>
                <div className="print:p-8">
                    <div className="hidden print:block mb-6">
                        <h1 className="text-2xl font-bold uppercase">
                            Producción: {selectedGarment === 'all' ? 'GENERAL' : selectedGarment}
                        </h1>
                        <div className="flex justify-between items-end mt-2 border-b-2 border-black pb-2">
                            <div>
                                <p className="text-sm font-medium">Colegio / Proyecto:</p>
                                <p className="text-lg font-bold">{collegeName === 'all' ? 'Todos los colegios' : collegeName}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-medium">Total Items:</p>
                                <p className="text-xl font-bold">{totalGarments}</p>
                            </div>
                        </div>
                    </div>

                    {/* Compact Summary Totals Table */}
                    <div className="mb-8">
                        <h3 className="text-lg font-bold border-b pb-2 mb-4 uppercase text-xs tracking-wide">Resumen General por Confección</h3>
                        <div className="border rounded-md overflow-hidden bg-white">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                                        <TableHead className="font-bold">Prenda</TableHead>
                                        <TableHead className="text-center font-bold">Hombre</TableHead>
                                        <TableHead className="text-center font-bold">Mujer</TableHead>
                                        <TableHead className="text-right font-bold">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {Object.entries(groupedSummary).sort(([a], [b]) => a.localeCompare(b)).map(([garment, genders]) => {
                                        const hombreTotal = Object.values(genders['Hombre'] || {}).reduce((s, q) => s + q, 0);
                                        const mujerTotal = Object.values(genders['Mujer'] || {}).reduce((s, q) => s + q, 0);
                                        const total = hombreTotal + mujerTotal;
                                        return (
                                            <TableRow key={garment} className="hover:bg-transparent">
                                                <TableCell className="font-medium">{garment}</TableCell>
                                                <TableCell className="text-center">{hombreTotal}</TableCell>
                                                <TableCell className="text-center">{mujerTotal}</TableCell>
                                                <TableCell className="text-right font-bold text-primary">{total}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {Object.keys(groupedSummary).length === 0 ? (
                        <p className="text-center py-8 text-muted-foreground">No hay datos para resumir</p>
                    ) : (
                        <div className="space-y-8">
                            {Object.entries(groupedSummary).sort(([a], [b]) => a.localeCompare(b)).map(([garment, genders], idx) => {
                                const hombreTotal = Object.values(genders['Hombre'] || {}).reduce((s, q) => s + q, 0);
                                const mujerTotal = Object.values(genders['Mujer'] || {}).reduce((s, q) => s + q, 0);
                                const total = hombreTotal + mujerTotal;
                                return (
                                    <div
                                        key={garment}
                                        className="space-y-4"
                                        style={{ breakBefore: idx > 0 ? 'page' : 'auto' }}
                                    >
                                        <div className="flex items-center justify-between border-b pb-2">
                                            <h3 className="text-xl font-black uppercase tracking-tight">
                                                {garment}
                                            </h3>
                                            <div className="flex gap-2">
                                                {hombreTotal > 0 && <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">H: {hombreTotal}</Badge>}
                                                {mujerTotal > 0 && <Badge variant="outline" className="border-pink-200 text-pink-700 bg-pink-50">M: {mujerTotal}</Badge>}
                                                <Badge variant="default" className="bg-primary">{total} unidades</Badge>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {Object.entries(genders).sort(([a], [b]) => b.localeCompare(a)).map(([gender, sizes]) => {
                                                const genderTotal = Object.values(sizes).reduce((s, q) => s + q, 0);
                                                return (
                                                    <div key={gender} className="border rounded-md overflow-hidden bg-white">
                                                        <div className={`px-3 py-2 text-sm font-bold border-b flex justify-between items-center ${gender === 'Mujer' ? 'bg-pink-50 text-pink-700' : 'bg-blue-50 text-blue-700'}`}>
                                                            <span>{gender}</span>
                                                            <span className="text-[10px] bg-white/50 px-2 py-0.5 rounded-full">Total: {genderTotal}</span>
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
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {Object.keys(materialAggregates).length > 0 && (
                        <div className="mt-12 pt-8 border-t-2 border-slate-200">
                            <h3 className="text-xl font-black uppercase tracking-tight mb-4 flex items-center gap-2">
                                <ShoppingBag className="h-5 w-5" />
                                Necesidad de Materiales (Compra Global)
                            </h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Basado en los proyectos vinculados y las tallas seleccionadas.
                            </p>
                            <div className="border rounded-md overflow-hidden bg-white">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50">
                                            <TableHead className="font-bold">Material</TableHead>
                                            <TableHead className="text-center font-bold">Cantidad Total</TableHead>
                                            <TableHead className="text-right font-bold">Costo Estimado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {Object.entries(materialAggregates).sort(([a], [b]) => a.localeCompare(b)).map(([name, data]) => (
                                            <TableRow key={name}>
                                                <TableCell className="font-medium">{name}</TableCell>
                                                <TableCell className="text-center">{data.totalQuantity.toFixed(2)} {getUnitLabel(data.unit)}</TableCell>
                                                <TableCell className="text-right font-bold">{data.totalCost.toLocaleString()} Bs</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
