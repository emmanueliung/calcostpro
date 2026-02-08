"use client";

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, doc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { TechnicalSheet, TechnicalSheetComponent, SizeConsumption, ComponentType } from '@/lib/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Scissors, Ruler, HardHat, Info, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { v4 as uuidv4 } from 'uuid';

interface TechnicalSheetEditorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sheet: TechnicalSheet | null;
}

export function TechnicalSheetEditor({ open, onOpenChange, sheet }: TechnicalSheetEditorProps) {
    const { user } = useUser();
    const db = useFirestore();
    const { toast } = useToast();

    // Form State
    const [name, setName] = useState('');
    const [category, setCategory] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [components, setComponents] = useState<TechnicalSheetComponent[]>([]);
    const [sizeConsumptions, setSizeConsumptions] = useState<SizeConsumption[]>([]);
    const [totalLaborMinutes, setTotalLaborMinutes] = useState<number>(0);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (sheet) {
            setName(sheet.name);
            setCategory(sheet.category);
            setImageUrl(sheet.imageUrl || '');
            setComponents(sheet.components || []);
            setSizeConsumptions(sheet.sizeConsumptions || []);
            setTotalLaborMinutes(sheet.totalLaborMinutes || 0);
        } else {
            setName('');
            setCategory('Uniforme');
            setImageUrl('');
            setComponents([]);
            setSizeConsumptions([
                { size: 'S', consumption: 0.75 },
                { size: 'M', consumption: 0.75 },
                { size: 'L', consumption: 1.40 },
                { size: 'XL', consumption: 1.40 },
            ]);
            setTotalLaborMinutes(0);
        }
    }, [sheet, open]);

    const handleAddComponent = () => {
        const newComponent: TechnicalSheetComponent = {
            id: uuidv4(),
            name: '',
            type: 'tissu',
            consumptionBase: 0,
            unit: 'm'
        };
        setComponents([...components, newComponent]);
    };

    const handleRemoveComponent = (id: string) => {
        setComponents(components.filter(c => c.id !== id));
    };

    const handleUpdateComponent = (id: string, updates: Partial<TechnicalSheetComponent>) => {
        setComponents(components.map(c => c.id === id ? { ...c, ...updates } : c));
    };

    const handleAddSize = () => {
        setSizeConsumptions([...sizeConsumptions, { size: '', consumption: 0 }]);
    };

    const handleRemoveSize = (index: number) => {
        const newSizes = [...sizeConsumptions];
        newSizes.splice(index, 1);
        setSizeConsumptions(newSizes);
    };

    const handleUpdateSize = (index: number, updates: Partial<SizeConsumption>) => {
        const newSizes = [...sizeConsumptions];
        newSizes[index] = { ...newSizes[index], ...updates };
        setSizeConsumptions(newSizes);
    };

    const handleSave = async () => {
        if (!user) return;
        if (!name.trim()) {
            toast({ variant: 'destructive', title: 'Error', description: 'El nombre es obligatorio.' });
            return;
        }

        setIsSaving(true);
        try {
            // Sanitize numeric values to prevent NaN errors in Firestore
            const safeComponents = components.map(c => ({
                ...c,
                consumptionBase: Number(c.consumptionBase) || 0
            }));

            const safeSizeConsumptions = sizeConsumptions.map(sc => ({
                ...sc,
                consumption: Number(sc.consumption) || 0
            }));

            const safeLaborMinutes = Number(totalLaborMinutes) || 0;

            const data: any = {
                userId: user.uid,
                name: name.trim(),
                category: category.trim(),
                components: safeComponents,
                sizeConsumptions: safeSizeConsumptions,
                totalLaborMinutes: safeLaborMinutes,
                updatedAt: serverTimestamp(),
            };

            // Helper to remove undefined values recursively
            const removeUndefined = (obj: any): any => {
                if (obj === null || typeof obj !== 'object') {
                    return obj;
                }
                if (Array.isArray(obj)) {
                    return obj.map(removeUndefined);
                }
                const newObj: any = {};
                Object.keys(obj).forEach(key => {
                    const value = removeUndefined(obj[key]);
                    if (value !== undefined) {
                        newObj[key] = value;
                    }
                });
                return newObj;
            };

            const cleanData = removeUndefined(data);

            if (sheet) {
                await updateDoc(doc(db, 'technical_sheets', sheet.id), cleanData);
                toast({ title: 'Ficha actualizada', description: 'Cambios guardados correctamente.' });
            } else {
                await addDoc(collection(db, 'technical_sheets'), {
                    ...cleanData,
                    createdAt: serverTimestamp(),
                });
                toast({ title: 'Ficha creada', description: 'Nuevo modelo añadido a la biblioteca.' });
            }
            onOpenChange(false);
        } catch (error: any) {
            console.error("Error saving technical sheet:", error);
            const errorMessage = error?.message || 'Hubo un problema al guardar.';
            // Add checking for permission
            if (errorMessage.includes("permission")) {
                toast({ variant: 'destructive', title: 'Error de Permisos', description: 'No tienes permiso para realizar esta acción. Verifica tu conexión.' });
            } else {
                toast({ variant: 'destructive', title: 'Error', description: errorMessage });
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle className="text-2xl">{sheet ? 'Editar Modelo' : 'Nuevo Modelo en Biblioteca'}</DialogTitle>
                    <DialogDescription>
                        Configura la estructura y consumos base de esta prenda.
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 space-y-8">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nombre del Modelo *</Label>
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Ej: T-shirt Colegio Colores"
                                    className="bg-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="category">Categoría</Label>
                                <Select value={category} onValueChange={setCategory}>
                                    <SelectTrigger className="bg-white">
                                        <SelectValue placeholder="Selecciona categoría" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Uniforme">Uniforme</SelectItem>
                                        <SelectItem value="Deportivo">Deportivo</SelectItem>
                                        <SelectItem value="Formal">Formal</SelectItem>
                                        <SelectItem value="Chaqueta">Chaqueta / Abrigo</SelectItem>
                                        <SelectItem value="Accesorio">Accesorio</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="labor">Tiempo de Mano de Obra (min)</Label>
                                <Input
                                    id="labor"
                                    type="number"
                                    value={totalLaborMinutes}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value.replace(',', '.'));
                                        setTotalLaborMinutes(isNaN(val) ? 0 : val);
                                    }}
                                    placeholder="Ej: 45"
                                    className="bg-white"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="imageUrl">URL de la Imagen (Opcional)</Label>
                            <Input
                                id="imageUrl"
                                value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                                placeholder="https://ejemplo.com/foto.jpg"
                                className="bg-white"
                            />
                            <p className="text-[10px] text-muted-foreground italic">
                                Puedes usar una URL de imagen para identificar mejor el modelo.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Components (Left) */}
                        <div className="lg:col-span-7 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <Scissors className="h-5 w-5 text-primary" />
                                    Componentes (Nomenclatura)
                                </h3>
                                <Button size="sm" variant="outline" onClick={handleAddComponent} className="h-8 gap-1">
                                    <Plus className="h-3 w-3" /> Añadir
                                </Button>
                            </div>

                            <div className="border rounded-md overflow-hidden bg-white">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50">
                                            <TableHead className="w-[150px]">Nombre</TableHead>
                                            <TableHead className="w-[120px]">Tipo</TableHead>
                                            <TableHead className="w-[100px]">Consumo</TableHead>
                                            <TableHead className="w-[80px]">Und</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {components.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                                                    No hay componentes definidos todavía.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            components.map((comp) => (
                                                <TableRow key={comp.id}>
                                                    <TableCell className="p-2">
                                                        <Input
                                                            value={comp.name}
                                                            onChange={(e) => handleUpdateComponent(comp.id, { name: e.target.value })}
                                                            placeholder="Tela local"
                                                            className="h-8 text-xs border-none focus-visible:ring-1"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="p-2">
                                                        <Select
                                                            value={comp.type}
                                                            onValueChange={(v) => handleUpdateComponent(comp.id, { type: v as ComponentType })}
                                                        >
                                                            <SelectTrigger className="h-8 text-xs border-none focus-visible:ring-1">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="tissu">Telas</SelectItem>
                                                                <SelectItem value="accessoire">Accesorios</SelectItem>
                                                                <SelectItem value="main_d_oeuvre">Mano de Obra</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell className="p-2">
                                                        <Input
                                                            type="number"
                                                            value={comp.consumptionBase}
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value.replace(',', '.'));
                                                                handleUpdateComponent(comp.id, { consumptionBase: isNaN(val) ? 0 : val });
                                                            }}
                                                            className="h-8 text-xs border-none focus-visible:ring-1"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="p-2">
                                                        <Input
                                                            value={comp.unit}
                                                            onChange={(e) => handleUpdateComponent(comp.id, { unit: e.target.value })}
                                                            className="h-8 text-xs border-none focus-visible:ring-1"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="p-2 text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                            onClick={() => handleRemoveComponent(comp.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Size Specific Consumption (Right) */}
                        <div className="lg:col-span-5 space-y-4">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Ruler className="h-5 w-5 text-primary" />
                                Consumo por Talla
                            </h3>

                            <Alert className="bg-blue-50 border-blue-100 py-3">
                                <Info className="h-4 w-4 text-blue-600" />
                                <AlertDescription className="text-[11px] text-blue-800 leading-tight">
                                    Define cuánta **materia prima (tela)** se consume para cada talla. El sistema usará esto para el cálculo automático en pedidos.
                                </AlertDescription>
                            </Alert>

                            <div className="border rounded-md overflow-hidden bg-white">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50">
                                            <TableHead>Talla</TableHead>
                                            <TableHead>Metros (m)</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sizeConsumptions.map((sc, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="p-2">
                                                    <Input
                                                        value={sc.size}
                                                        onChange={(e) => handleUpdateSize(index, { size: e.target.value })}
                                                        placeholder="S, M, 38..."
                                                        className="h-8 text-xs border-none focus-visible:ring-1 font-bold"
                                                    />
                                                </TableCell>
                                                <TableCell className="p-2">
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={sc.consumption}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value.replace(',', '.'));
                                                            handleUpdateSize(index, { consumption: isNaN(val) ? 0 : val });
                                                        }}
                                                        className="h-8 text-xs border-none focus-visible:ring-1"
                                                    />
                                                </TableCell>
                                                <TableCell className="p-2 text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                        onClick={() => handleRemoveSize(index)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                <Button
                                    variant="ghost"
                                    className="w-full h-9 text-xs gap-2 text-muted-foreground hover:text-primary rounded-none border-t"
                                    onClick={handleAddSize}
                                >
                                    <Plus className="h-3 w-3" /> Añadir Nueva Talla
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 bg-slate-50 border-t gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="min-w-[120px]">
                        {isSaving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            'Guardar Ficha'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
