"use client";

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, onSnapshot, doc, addDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { TechnicalSheet } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Scissors, Trash2, Pencil, Search, Loader2, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { defaultTemplates } from '@/lib/default-templates';
import { v4 as uuidv4 } from 'uuid';

import { TechnicalSheetEditor } from '@/components/workshop/technical-sheet-editor';

export default function LibraryPage() {
    const { user } = useUser();
    const db = useFirestore();
    const { toast } = useToast();

    const [sheets, setSheets] = useState<TechnicalSheet[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingSheet, setEditingSheet] = useState<TechnicalSheet | null>(null);
    const [importing, setImporting] = useState(false);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'technical_sheets'),
            where('userId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as TechnicalSheet));
            setSheets(data);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching technical sheets:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, db]);

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta ficha técnica?')) return;
        try {
            await deleteDoc(doc(db, 'technical_sheets', id));
            toast({ title: 'Ficha eliminada', description: 'La ficha técnica ha sido eliminada correctamente.' });
        } catch (error) {
            console.error("Error deleting technical sheet:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar la ficha.' });
        }
    };

    const handleImportDefaults = async () => {
        if (!user) return;
        if (!confirm('¿Quieres importar los modelos por defecto? Esto creará nuevas fichas en tu biblioteca.')) return;

        setImporting(true);
        try {
            let count = 0;
            for (const template of defaultTemplates) {
                // Check if already exists to avoid exact duplicates (optional, but good for UX)
                // For simplicity, we just add them as new sheets

                const newSheet = {
                    userId: user.uid,
                    name: template.name,
                    category: template.category,
                    imageUrl: '',
                    components: template.components.map(c => ({
                        id: uuidv4(),
                        name: c.name,
                        type: c.type,
                        consumptionBase: c.consumptionBase,
                        unit: c.unit,
                        notes: ''
                    })),
                    sizeConsumptions: template.sizeConsumptions,
                    totalLaborMinutes: template.totalLaborMinutes,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };

                await addDoc(collection(db, 'technical_sheets'), newSheet);
                count++;
            }
            toast({
                title: 'Importación completada',
                description: `Se han añadido ${count} modelos a tu biblioteca.`
            });
        } catch (error) {
            console.error("Error importing templates:", error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Hubo un problema al importar los modelos.'
            });
        } finally {
            setImporting(false);
        }
    };

    const filteredSheets = sheets.filter(sheet =>
        sheet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sheet.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Biblioteca de Modelos</h1>
                    <p className="text-muted-foreground">Gestiona tus fiches técnicas y consumos por talla.</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={handleImportDefaults}
                        disabled={importing || loading}
                        className="gap-2"
                    >
                        {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Info className="h-4 w-4" />}
                        Importar Modelos
                    </Button>
                    <Button onClick={() => { setEditingSheet(null); setIsEditorOpen(true); }} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Nueva Ficha Técnica
                    </Button>
                </div>
            </div>

            <div className="relative w-full md:w-[400px]">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar modelo o categoría..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 bg-white"
                />
            </div>

            {filteredSheets.length === 0 ? (
                <Card className="border-dashed py-12">
                    <CardContent className="flex flex-col items-center justify-center text-center space-y-4">
                        <div className="p-4 bg-muted rounded-full">
                            <Scissors className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-bold text-lg">No hay fiches técnicas</h3>
                            <p className="text-muted-foreground max-w-sm">
                                Comienza creando tu primera ficha técnica para automatizar el cálculo de insumos.
                            </p>
                        </div>
                        <div className="flex flex-col gap-2 min-w-[200px]">
                            <Button onClick={() => { setEditingSheet(null); setIsEditorOpen(true); }} variant="outline">
                                Crear mi primera ficha
                            </Button>
                            <Button onClick={handleImportDefaults} disabled={importing}>
                                {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Importar Modelos Básicos
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredSheets.map(sheet => (
                        <Card key={sheet.id} className="group hover:shadow-md transition-all overflow-hidden border-slate-200">
                            <CardHeader className="p-0">
                                <div className="aspect-[4/3] bg-slate-100 flex items-center justify-center relative overflow-hidden">
                                    {sheet.imageUrl ? (
                                        <img src={sheet.imageUrl} alt={sheet.name} className="object-cover w-full h-full" />
                                    ) : (
                                        <Scissors className="h-16 w-16 text-slate-300" />
                                    )}
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            size="icon"
                                            variant="secondary"
                                            className="h-8 w-8 shadow-sm"
                                            onClick={() => { setEditingSheet(sheet); setIsEditorOpen(true); }}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="destructive"
                                            className="h-8 w-8 shadow-sm"
                                            onClick={() => handleDelete(sheet.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <Badge className="absolute bottom-2 left-2 bg-white/90 text-slate-900 border-none shadow-sm hover:bg-white">
                                        {sheet.category}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 space-y-3">
                                <h3 className="font-bold text-lg leading-tight">{sheet.name}</h3>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>Componentes:</span>
                                        <span className="font-medium text-slate-900">{sheet.components.length}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>Tallas con consumo:</span>
                                        <span className="font-medium text-slate-900">{sheet.sizeConsumptions.length}</span>
                                    </div>
                                </div>
                                <div className="pt-2 flex flex-wrap gap-1">
                                    {sheet.sizeConsumptions.slice(0, 4).map(sc => (
                                        <Badge key={sc.size} variant="outline" className="text-[10px] py-0">
                                            {sc.size}: {sc.consumption}m
                                        </Badge>
                                    ))}
                                    {sheet.sizeConsumptions.length > 4 && (
                                        <Badge variant="outline" className="text-[10px] py-0">+{sheet.sizeConsumptions.length - 4}</Badge>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Editor placeholder - logic will be in a separate component */}
            <TechnicalSheetEditor
                open={isEditorOpen}
                onOpenChange={setIsEditorOpen}
                sheet={editingSheet}
            />
        </div>
    );
}
