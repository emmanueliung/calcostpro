
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2 } from 'lucide-react';
import type { Material } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import defaultMaterialsData from '@/lib/default-materials.json';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

type MaterialType = 'fabrics' | 'accessories' | 'prints';
type MaterialsState = { fabrics: Material[], accessories: Material[], prints: Material[] };

const defaultMaterials: MaterialsState = defaultMaterialsData as MaterialsState;

const EMPTY_MATERIAL: Omit<Material, 'id'> = { name: '', price: 0, unit: 'm' };

export default function MaterialsPage() {
    const [user] = useAuthState(auth);
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);

    const [materials, setMaterials] = useState<MaterialsState>({ fabrics: [], accessories: [], prints: [] });
    const [isDialogOpen, setDialogOpen] = useState(false);
    const [currentMaterial, setCurrentMaterial] = useState<Omit<Material, 'id'> | (Material & { type: MaterialType, index: number })>({ ...EMPTY_MATERIAL });
    const [currentTab, setCurrentTab] = useState<MaterialType>('fabrics');
    
    useEffect(() => {
        if (!user) {
            setIsLoading(false);
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
                    // If catalog is empty or doesn't exist, just set it in the local state.
                    // The user can then save it if they wish.
                    setMaterials(defaultMaterials);
                }
            } else {
                // This case happens for a newly signed up user.
                // We set the materials in local state. The user can save them.
                 setMaterials(defaultMaterials);
            }
            setIsLoading(false);
        };

        fetchMaterials();
    }, [user]);

    const handleSaveMaterials = async () => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Debes iniciar sesión para guardar.' });
            return;
        }

        try {
            const userDocRef = doc(db, 'users', user.uid);
            // Use updateDoc to avoid overwriting the whole document if it exists,
            // and setDoc with merge as a fallback if it does not.
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                 await updateDoc(userDocRef, { materialsCatalog: materials });
            } else {
                 await setDoc(userDocRef, { materialsCatalog: materials }, { merge: true });
            }
           
            toast({ title: 'Materiales Guardados', description: 'Tu catálogo de materiales ha sido actualizado.' });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron guardar los materiales.' });
        }
    };

    const handleResetToDefault = () => {
        setMaterials(defaultMaterials);
        toast({ title: 'Catálogo Restablecido', description: 'Tu catálogo se ha restablecido a los valores por defecto. Haz clic en "Guardar Cambios" para confirmar.' });
    };
    
    const openNewMaterialDialog = (type: MaterialType) => {
        setCurrentTab(type);
        let unit: Material['unit'] = 'm';
        if (type === 'accessories') unit = 'piece';
        if (type === 'prints') unit = 'fixed';
        setCurrentMaterial({ ...EMPTY_MATERIAL, unit });
        setDialogOpen(true);
    };
    
    const handleAddOrUpdateMaterial = () => {
        const materialData = {
            name: currentMaterial.name,
            price: Number(currentMaterial.price) || 0,
            unit: 'unit' in currentMaterial ? currentMaterial.unit : 'm'
        };

        if (!materialData.name || materialData.price <= 0) {
            toast({ variant: 'destructive', title: 'Datos incompletos', description: 'Por favor, introduce un nombre y un precio válido.' });
            return;
        }

        setMaterials(prev => {
            const list = [...prev[currentTab]];
            if ('id' in currentMaterial) { // Editing existing
                list[(currentMaterial as any).index] = { ...list[(currentMaterial as any).index], ...materialData };
            } else { // Adding new
                list.push({ id: `${currentTab}-${Date.now()}`, ...materialData });
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
                    <p className="text-muted-foreground text-center py-8">Cargando materiales...</p>
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
                                    <TableRow key={mat.id}>
                                        <TableCell className="font-medium whitespace-nowrap">{mat.name}</TableCell>
                                        <TableCell>Bs. {mat.price}</TableCell>
                                        <TableCell>{mat.unit}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleRemoveMaterial(type, index)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
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
        <div className="flex-1 space-y-8 p-4 md:p-8">
             <div className="flex items-center justify-between">
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
                <TabsList>
                    <TabsTrigger value="fabrics">Telas</TabsTrigger>
                    <TabsTrigger value="accessories">Accesorios</TabsTrigger>
                    <TabsTrigger value="prints">Estampados</TabsTrigger>
                </TabsList>
                <TabsContent value="fabrics">{renderTable('fabrics')}</TabsContent>
                <TabsContent value="accessories">{renderTable('accessories')}</TabsContent>
                <TabsContent value="prints">{renderTable('prints')}</TabsContent>
            </Tabs>
            
            <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Añadir/Editar Material</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nombre del Material</Label>
                            <Input id="name" value={currentMaterial.name} onChange={(e) => setCurrentMaterial(p => ({...p, name: e.target.value}))} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="price">Precio</Label>
                            <Input id="price" type="number" value={currentMaterial.price} onChange={(e) => setCurrentMaterial(p => ({...p, price: Number(e.target.value)}))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="unit">Unidad</Label>
                            <Select 
                                value={'unit' in currentMaterial ? currentMaterial.unit : 'm'} 
                                onValueChange={(val) => setCurrentMaterial(p => ({...p, unit: val as any}))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="m²">m² (metro cuadrado)</SelectItem>
                                    <SelectItem value="m">m (metro lineal)</SelectItem>
                                    <SelectItem value="piece">pz (pieza)</SelectItem>
                                    <SelectItem value="fixed">fijo (costo único)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleAddOrUpdateMaterial}>Guardar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}

    