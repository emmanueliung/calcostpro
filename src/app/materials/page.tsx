
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2 } from 'lucide-react';
import type { Material } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getDefaultMaterials } from '@/lib/default-materials';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Header } from '@/components/header';
import { Loader } from '@/components/ui/loader';

type MaterialType = 'fabrics' | 'accessories' | 'prints';
type MaterialsState = { fabrics: Material[], accessories: Material[], prints: Material[] };

const EMPTY_MATERIAL: Partial<Omit<Material, 'id'>> = { name: '', price: 0, unit: 'm' };

export default function MaterialsPage() {
    const { user, isUserLoading } = useUser();
    const db = useFirestore();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);

    const [materials, setMaterials] = useState<MaterialsState>({ fabrics: [], accessories: [], prints: [] });
    const [isDialogOpen, setDialogOpen] = useState(false);
    const [currentMaterial, setCurrentMaterial] = useState<Partial<Material> & { type?: MaterialType, index?: number }>({ ...EMPTY_MATERIAL });
    const [currentTab, setCurrentTab] = useState<MaterialType>('fabrics');
    
    useEffect(() => {
        if (isUserLoading) return;
        if (!user) {
            setIsLoading(false);
            // Optionally redirect to login
            return;
        }
        
        const fetchMaterials = async () => {
            setIsLoading(true);
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);
            
            if (userDocSnap.exists()) {
                const data = userDocSnap.data();
                if (data.materialsCatalog && (data.materialsCatalog.fabrics?.length > 0 || data.materialsCatalog.accessories?.length > 0 || data.materialsCatalog.prints?.length > 0)) {
                    setMaterials(data.materialsCatalog);
                } else {
                    setMaterials(getDefaultMaterials());
                }
            } else {
                 setMaterials(getDefaultMaterials());
            }
            setIsLoading(false);
        };

        fetchMaterials();
    }, [user, isUserLoading, db]);

    const handleSaveMaterials = async () => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Debes iniciar sesión para guardar.' });
            return;
        }

        try {
            // Data validation step
            const validatedMaterials: MaterialsState = {
                fabrics: materials.fabrics.map(m => ({
                    id: m.id || `fab-${Date.now()}`,
                    name: m.name || 'Material sin nombre',
                    price: Number(m.price) || 0,
                    unit: m.unit || 'm',
                    ...(m.grammage && { grammage: m.grammage }),
                    ...(m.ancho && { ancho: m.ancho }),
                })),
                accessories: materials.accessories.map(m => ({
                    id: m.id || `acc-${Date.now()}`,
                    name: m.name || 'Material sin nombre',
                    price: Number(m.price) || 0,
                    unit: m.unit || 'piece',
                    ...(m.grammage && { grammage: m.grammage }),
                    ...(m.ancho && { ancho: m.ancho }),
                })),
                prints: materials.prints.map(m => ({
                    id: m.id || `prt-${Date.now()}`,
                    name: m.name || 'Material sin nombre',
                    price: Number(m.price) || 0,
                    unit: m.unit || 'fixed',
                    ...(m.grammage && { grammage: m.grammage }),
                    ...(m.ancho && { ancho: m.ancho }),
                })),
            };

            const userDocRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(userDocRef);

            if (docSnap.exists()) {
                await updateDoc(userDocRef, { materialsCatalog: validatedMaterials });
            } else {
                await setDoc(userDocRef, { materialsCatalog: validatedMaterials }, { merge: true });
            }
           
            toast({ title: 'Materiales Guardados', description: 'Tu catálogo de materiales ha sido actualizado.' });
        } catch (error) {
            console.error("Error saving materials: ", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron guardar los materiales.' });
        }
    };

    const handleResetToDefault = () => {
        setMaterials(getDefaultMaterials());
        toast({ title: 'Catálogo Restablecido', description: 'Tu catálogo se ha restablecido a los valores por defecto. Haz clic en "Guardar Cambios" para confirmar.' });
    };
    
    const openNewMaterialDialog = (type: MaterialType) => {
        setCurrentTab(type);
        let unit: Material['unit'] = 'm';
        if (type === 'accessories') unit = 'piece';
        if (type === 'prints') unit = 'fixed';
        setCurrentMaterial({ ...EMPTY_MATERIAL, unit, ancho: 1.50 });
        setDialogOpen(true);
    };

    const openEditMaterialDialog = (type: MaterialType, material: Material, index: number) => {
        setCurrentTab(type);
        setCurrentMaterial({ ...material, type, index });
        setDialogOpen(true);
    }
    
    const handleAddOrUpdateMaterial = () => {
        const materialData: Partial<Material> = {
            name: currentMaterial.name,
            price: Number(currentMaterial.price) || 0,
            unit: currentMaterial.unit,
            grammage: currentMaterial.grammage ? Number(currentMaterial.grammage) : undefined,
            ancho: currentMaterial.ancho ? Number(currentMaterial.ancho) : undefined,
        };

        if (!materialData.name || !materialData.price || !materialData.unit) {
            toast({ variant: 'destructive', title: 'Datos incompletos', description: 'Por favor, introduce un nombre, un precio y una unidad válidos.' });
            return;
        }

        if (materialData.unit === 'kg' && (!materialData.grammage || materialData.grammage <= 0)) {
            toast({ variant: 'destructive', title: 'Datos incompletos', description: 'El gramaje es obligatorio y debe ser mayor que cero para la unidad "kg".' });
            return;
        }


        setMaterials(prev => {
            const list = [...prev[currentTab]];
            if (currentMaterial.index !== undefined && 'id' in currentMaterial) { // Editing existing
                list[currentMaterial.index] = { ...list[currentMaterial.index], ...materialData };
            } else { // Adding new
                list.push({ id: `${currentTab}-${Date.now()}`, ...(materialData as Omit<Material, 'id'>) });
            }
            return { ...prev, [currentTab]: list };
        });

        setDialogOpen(false);
    };

    const handleRemoveMaterial = (type: MaterialType, index: number) => {
        setMaterials(prev => {
            const list = [...prev[type]];
            list.splice(index, 1);
            return { ...prev, [type]: list };
        });
    };
    
    const renderTable = (type: MaterialType) => (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="capitalize">{type === 'fabrics' ? 'Telas' : type === 'accessories' ? 'Accesorios' : 'Estampados'}</CardTitle>
                <Button variant="outline" size="sm" onClick={() => openNewMaterialDialog(type)}><Plus className="mr-2 h-4 w-4" />Añadir</Button>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <Loader text={`Cargando ${type}...`} />
                ) : materials[type].length === 0 ? (
                     <p className="text-muted-foreground text-center py-8">No hay {type === 'fabrics' ? 'telas' : type === 'accessories' ? 'accesorios' : 'estampados'} en tu catálogo.</p>
                ) : (
                    <div className="w-full overflow-x-auto">
                        <Table className="min-w-full">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Precio</TableHead>
                                    <TableHead>Unidad</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {materials[type].map((mat, index) => (
                                    <TableRow key={mat.id} onClick={() => openEditMaterialDialog(type, mat, index)} className="cursor-pointer">
                                        <TableCell className="font-medium whitespace-nowrap">{mat.name}</TableCell>
                                        <TableCell>Bs. {mat.price}</TableCell>
                                        <TableCell>{mat.unit}</TableCell>
                                        <TableCell className="text-right">
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                     <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>¿Está seguro?</AlertDialogTitle></AlertDialogHeader>
                                                    <AlertDialogDescription>Esta acción eliminará permanentemente el material "{mat.name}".</AlertDialogDescription>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleRemoveMaterial(type, index)}>Sí, eliminar</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 p-4 md:p-8">
                 <div className="max-w-6xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Catálogo de Materiales</h1>
                            <p className="text-muted-foreground">Gestiona tus telas, accesorios y estampados.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline">Restablecer</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>¿Estás seguro de que quieres restablecer tu catálogo?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esta acción reemplazará tu catálogo actual con la lista por defecto. Perderás todos los materiales personalizados que hayas añadido.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleResetToDefault}>Sí, Restablecer</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            <Button onClick={handleSaveMaterials}>Guardar Cambios</Button>
                        </div>
                    </div>
                    
                    <Tabs value={currentTab} onValueChange={(value) => setCurrentTab(value as MaterialType)} className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="fabrics">Telas</TabsTrigger>
                            <TabsTrigger value="accessories">Accesorios</TabsTrigger>
                            <TabsTrigger value="prints">Estampados</TabsTrigger>
                        </TabsList>
                        <TabsContent value="fabrics" className="mt-4">{renderTable('fabrics')}</TabsContent>
                        <TabsContent value="accessories" className="mt-4">{renderTable('accessories')}</TabsContent>
                        <TabsContent value="prints" className="mt-4">{renderTable('prints')}</TabsContent>
                    </Tabs>
                    
                    <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{currentMaterial.id ? 'Editar' : 'Añadir'} Material</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Nombre del Material</Label>
                                    <Input id="name" value={currentMaterial.name ?? ''} onChange={(e) => setCurrentMaterial(p => ({...p, name: e.target.value}))} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="price">Precio</Label>
                                        <Input id="price" type="number" value={currentMaterial.price ?? ''} onChange={(e) => setCurrentMaterial(p => ({...p, price: Number(e.target.value)}))} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="unit">Unidad</Label>
                                        <Select 
                                            value={currentMaterial.unit} 
                                            onValueChange={(val: Material['unit']) => setCurrentMaterial(p => ({...p, unit: val}))}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="m">m (metro lineal)</SelectItem>
                                                <SelectItem value="kg">kg (kilo)</SelectItem>
                                                <SelectItem value="piece">pz (pieza)</SelectItem>
                                                <SelectItem value="fixed">fijo (costo único)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                {currentTab === 'fabrics' && (
                                    <div className="space-y-2 pt-4 border-t">
                                        <Label htmlFor="ancho">Ancho de la tela (m)</Label>
                                        <Input id="ancho" type="number" placeholder="p. ej., 1.50" value={currentMaterial.ancho ?? ''} onChange={(e) => setCurrentMaterial(p => ({...p, ancho: Number(e.target.value)}))} />
                                        <p className="text-xs text-muted-foreground">Opcional. Útil para referencia.</p>
                                    </div>
                                )}
                                {currentMaterial.unit === 'kg' && (
                                    <div className="space-y-2 pt-4 border-t">
                                        <Label htmlFor="grammage">Gramaje (g/m²)</Label>
                                        <Input id="grammage" type="number" placeholder="p. ej., 180" value={currentMaterial.grammage ?? ''} onChange={(e) => setCurrentMaterial(p => ({...p, grammage: Number(e.target.value)}))} required />
                                        <p className="text-xs text-muted-foreground">Obligatorio para telas por kilo. Se usa para convertir área a peso.</p>
                                    </div>
                                )}
                            </div>
                            <DialogFooter>
                                <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                                <Button onClick={handleAddOrUpdateMaterial}>Guardar</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </main>
        </div>
    );
}
