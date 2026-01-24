"use client";

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { College, CollegeItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Trash2, Plus, Edit, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PublicLinkSection } from '@/components/settings/public-link-section';

export default function WorkshopSettingsPage() {
    const { user } = useUser();
    const db = useFirestore();
    const { toast } = useToast();
    const [colleges, setColleges] = useState<College[]>([]);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Create State
    const [newCollegeName, setNewCollegeName] = useState('');
    const [newCollegeCourse, setNewCollegeCourse] = useState('');

    // Editing State (for prices)
    const [editingCollege, setEditingCollege] = useState<College | null>(null);
    const [newItemName, setNewItemName] = useState('');
    const [newItemPrice, setNewItemPrice] = useState('');

    // Editing State (for list details inside dialog)
    const [editName, setEditName] = useState('');
    const [editCourse, setEditCourse] = useState('');

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, "colleges"), where("userId", "==", user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as College));
            setColleges(data);
        });
        return () => unsubscribe();
    }, [user, db]);

    // Open Edit Dialog and init detailed editing fields
    const openEditDialog = (college: College) => {
        setEditingCollege(college);
        setEditName(college.name);
        setEditCourse(college.course || '');
        setNewItemName('');
        setNewItemPrice('');
    };

    const handleCreateCollege = async () => {
        if (!newCollegeName || !user) return;
        try {
            await addDoc(collection(db, "colleges"), {
                userId: user.uid,
                name: newCollegeName,
                course: newCollegeCourse,
                priceList: [],
                createdAt: serverTimestamp()
            });
            setNewCollegeName('');
            setNewCollegeCourse('');
            setIsCreateOpen(false);
            toast({ title: "Lista creada" });
        } catch (e) {
            console.error(e);
        }
    };

    // Update Name/Course of the list
    const handleUpdateListDetails = async () => {
        if (!editingCollege || !editName) return;
        try {
            await updateDoc(doc(db, "colleges", editingCollege.id), {
                name: editName,
                course: editCourse
            });
            // Update local state is handled by snapshot, but we can update optimistic
            toast({ title: "Información actualizada" });
        } catch (e) {
            console.error(e);
            toast({ variant: "destructive", title: "Error al actualizar" });
        }
    };

    const handleDeleteList = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar esta lista completa?")) return;
        try {
            await deleteDoc(doc(db, "colleges", id));
            toast({ title: "Lista eliminada" });
        } catch (e) {
            console.error(e);
        }
    };

    const handleAddItem = async () => {
        if (!editingCollege || !newItemName || !newItemPrice) return;
        const price = parseFloat(newItemPrice);
        if (isNaN(price)) return;

        const newItem: CollegeItem = { name: newItemName, price };
        const updatedList = [...(editingCollege.priceList || []), newItem];

        try {
            await updateDoc(doc(db, "colleges", editingCollege.id), { priceList: updatedList });
            setEditingCollege({ ...editingCollege, priceList: updatedList });
            setNewItemName('');
            setNewItemPrice('');
        } catch (e) {
            console.error(e);
        }
    };

    const handleRemoveItem = async (index: number) => {
        if (!editingCollege) return;
        const updatedList = [...(editingCollege.priceList || [])];
        updatedList.splice(index, 1);

        try {
            await updateDoc(doc(db, "colleges", editingCollege.id), { priceList: updatedList });
            setEditingCollege({ ...editingCollege, priceList: updatedList });
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Configuración de Taller</h1>
                    <p className="text-muted-foreground">Gestiona tus listas de precios por colegio/curso.</p>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Nueva Lista</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Registrar Nueva Lista</DialogTitle></DialogHeader>
                        <div className="py-4 space-y-4">
                            <div className="space-y-2">
                                <Label>Nombre del Colegio / Lista</Label>
                                <Input value={newCollegeName} onChange={e => setNewCollegeName(e.target.value)} placeholder="Ej: La Salle" />
                            </div>
                            <div className="space-y-2">
                                <Label>Curso (Opcional)</Label>
                                <Input value={newCollegeCourse} onChange={e => setNewCollegeCourse(e.target.value)} placeholder="Ej: Promo 2026, 6to B..." />
                            </div>
                        </div>
                        <DialogFooter><Button onClick={handleCreateCollege}>Guardar</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Public Order Link Section */}
            <PublicLinkSection />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {colleges.map(college => (
                    <Card key={college.id} className="relative flex flex-col">
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-lg">{college.name}</CardTitle>
                                    {college.course && <CardDescription className="text-sm font-semibold text-primary">{college.course}</CardDescription>}
                                </div>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" onClick={() => openEditDialog(college)}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => handleDeleteList(college.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 text-sm">
                            <p className="text-muted-foreground mb-2">{(college.priceList?.length || 0)} artículos configurados</p>
                            <div className="space-y-1">
                                {college.priceList?.slice(0, 3).map((item, i) => (
                                    <div key={i} className="flex justify-between text-muted-foreground">
                                        <span>{item.name}</span>
                                        <span>{item.price} Bs</span>
                                    </div>
                                ))}
                                {(college.priceList?.length || 0) > 3 && <p className="text-xs italic text-muted-foreground">... y más</p>}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Edit Dialog */}
            <Dialog open={!!editingCollege} onOpenChange={(open) => !open && setEditingCollege(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Editar Lista de Precios</DialogTitle>
                    </DialogHeader>

                    {/* Header Editing Section */}
                    <div className="grid grid-cols-2 gap-4 border-b pb-4">
                        <div className="space-y-1">
                            <Label>Colegio / Grupo</Label>
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label>Curso</Label>
                            <div className="flex gap-2">
                                <Input value={editCourse} onChange={(e) => setEditCourse(e.target.value)} />
                                <Button size="icon" onClick={handleUpdateListDetails} title="Guardar Cambios de Nombre/Curso">
                                    <Save className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Price List Section */}
                    <div className="flex-1 overflow-hidden flex flex-col mt-2">
                        <Label className="mb-2">Agregar Prenda o Artículo</Label>
                        <div className="flex gap-2 items-end mb-4 bg-muted/50 p-3 rounded-lg">
                            <div className="flex-1 space-y-1">
                                <Label className="text-xs">Nombre</Label>
                                <Input placeholder="Ej: Pantalon" value={newItemName} onChange={e => setNewItemName(e.target.value)} />
                            </div>
                            <div className="w-24 space-y-1">
                                <Label className="text-xs">Precio</Label>
                                <Input type="number" placeholder="0" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} />
                            </div>
                            <Button onClick={handleAddItem}><Plus className="h-4 w-4" /></Button>
                        </div>

                        <div className="border rounded-md flex-1 overflow-y-auto min-h-[200px]">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Prenda</TableHead>
                                        <TableHead className="text-right">Precio</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {editingCollege?.priceList?.map((item, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell>{item.name}</TableCell>
                                            <TableCell className="text-right">{item.price} Bs</TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveItem(idx)}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {(!editingCollege?.priceList || editingCollege.priceList.length === 0) && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center text-muted-foreground h-24">
                                                No hay precios configurados.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {(editingCollege?.priceList && editingCollege.priceList.length > 0) && (
                                        <TableRow className="bg-muted/50 font-bold">
                                            <TableCell>Total</TableCell>
                                            <TableCell className="text-right">
                                                {editingCollege.priceList.reduce((acc, item) => acc + item.price, 0)} Bs
                                            </TableCell>
                                            <TableCell></TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
