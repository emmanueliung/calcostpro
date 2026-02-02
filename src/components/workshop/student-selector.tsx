"use client";

import { useState, useEffect } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, doc, updateDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { Student, StudentMeasurements, College } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, UserPlus, User as UserIcon, Edit, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { BulkImportDialog } from './bulk-import-dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface StudentSelectorProps {
    onSelectStudent: (student: Student) => void;
    selectedStudentId?: string;
}

export function StudentSelector({ onSelectStudent, selectedStudentId }: StudentSelectorProps) {
    const { user } = useUser();
    const db = useFirestore();
    const { toast } = useToast();
    const [students, setStudents] = useState<Student[]>([]);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCollegeFilter, setSelectedCollegeFilter] = useState<string>("all");

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // New Student Form State
    const [newName, setNewName] = useState('');
    const [newCollege, setNewCollege] = useState('');
    const [newGender, setNewGender] = useState<'Hombre' | 'Mujer'>('Hombre');
    const [newNotes, setNewNotes] = useState('');
    // Classroom removed as requested

    // Sizes State
    const [sizes, setSizes] = useState<Record<string, string>>({});

    // Fetch colleges for the dropdown
    const [availableColleges, setAvailableColleges] = useState<College[]>([]);

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, "colleges"), where("userId", "==", user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as College));
            setAvailableColleges(data);
        });
        return () => unsubscribe();
    }, [user, db]);

    // Fetch students
    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, "students"),
            where("userId", "==", user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));

            // Client-side sort by createdAt descending
            data.sort((a, b) => {
                const timeA = a.createdAt?.seconds ? a.createdAt.seconds : (a.createdAt instanceof Date ? a.createdAt.getTime() / 1000 : 0);
                const timeB = b.createdAt?.seconds ? b.createdAt.seconds : (b.createdAt instanceof Date ? b.createdAt.getTime() / 1000 : 0);
                return timeB - timeA;
            });

            setStudents(data);
        });

        return () => unsubscribe();
    }, [user, db]);

    // Generate filter options based on availableColleges
    // We also include student groups that might not be in availableColleges (legacy/orphaned)
    const studentGroups = Array.from(new Set(students.map(s => {
        return s.classroom ? `${s.college} (${s.classroom})` : s.college;
    }))).filter(Boolean);

    const configuredGroups = availableColleges.map(c => {
        return c.course ? `${c.name} (${c.course})` : c.name;
    });

    const allFilterOptions = Array.from(new Set([...configuredGroups, ...studentGroups])).sort();

    const filteredStudents = students.filter(student => {
        const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            student.college.toLowerCase().includes(searchTerm.toLowerCase());

        const studentGroup = student.classroom ? `${student.college} (${student.classroom})` : student.college;
        const matchesCollege = selectedCollegeFilter === "all" || studentGroup === selectedCollegeFilter;

        return matchesSearch && matchesCollege;
    });

    // Editing State
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);

    // When creating, if a filter is active, auto-fill the college name
    useEffect(() => {
        if (isCreateOpen && !editingStudent && selectedCollegeFilter !== "all") {
            // Regex to extract Name and Course from "Name (Course)"
            const match = selectedCollegeFilter.match(/^(.*)\s\((.*)\)$/);
            if (match) {
                const name = match[1];
                const course = match[2];
                const found = availableColleges.find(c => c.name === name && (c.course || '') === course);
                if (found) {
                    setNewCollege(found.id);
                } else {
                    setNewCollege(name); // Fallback to name if ID not found
                }
            } else {
                const found = availableColleges.find(c => c.name === selectedCollegeFilter);
                if (found) {
                    setNewCollege(found.id);
                } else {
                    setNewCollege(selectedCollegeFilter);
                }
            }
        }
    }, [isCreateOpen, editingStudent, selectedCollegeFilter, availableColleges]);

    // Handle Edit Click
    const handleEditClick = (e: React.MouseEvent, student: Student) => {
        e.stopPropagation();
        setEditingStudent(student);
        setNewName(student.name);
        setNewCollege(student.collegeId || student.college); // Use ID if available, fallback to name for migration
        setNewGender(student.gender || 'Hombre');
        setNewNotes(student.notes || '');
        setSizes(student.sizes || {});
        setIsCreateOpen(true);
    };

    const handleDeleteStudent = async (e: React.MouseEvent, studentId: string) => {
        e.stopPropagation();
        if (!confirm("¿Estás seguro de eliminar este estudiante?")) return;
        try {
            await deleteDoc(doc(db, "students", studentId));
            toast({ title: "Estudiante eliminado" });
        } catch (err) {
            console.error(err);
            toast({ variant: "destructive", title: "Error al eliminar" });
        }
    };

    // Get the config for the selected college
    const selectedCollegeConfig = availableColleges.find(c => c.id === newCollege || c.name === newCollege);

    // Determine which garments to show: Use College Config if available, otherwise fallback to default list
    const garmentsToShow = selectedCollegeConfig?.priceList?.map(item => item.name) || ['Pantalon', 'Saco', 'Camisa', 'Polo', 'Deportivo', 'Falda'];

    const handleSaveStudent = async () => {
        if (!user || !newName || !newCollege) {
            toast({ variant: 'destructive', title: 'Faltan datos', description: 'Nombre y Colegio son obligatorios.' });
            return;
        }

        setIsCreating(true);
        try {
            // Find matched config
            const matchedConfig = availableColleges.find(c => c.id === newCollege || c.name === newCollege);
            const hiddenClassroom = matchedConfig?.course || '';
            const collegeName = matchedConfig?.name || newCollege;
            const collegeId = matchedConfig?.id || '';

            // Default measurements to 0 as we use sizes now
            const defaultMeasurements = { height: 0, chest: 0, waist: 0, hips: 0, sleeve: 0, leg: 0, shoulder: 0, neck: 0 };

            // Clean empty sizes
            const cleanSizes: Record<string, string> = {};
            Object.keys(sizes).forEach(key => {
                if (sizes[key]?.trim()) cleanSizes[key] = sizes[key].trim();
            });

            const studentData = {
                userId: user.uid,
                name: newName.trim(),
                college: collegeName,
                collegeId: collegeId,
                gender: newGender,
                classroom: hiddenClassroom, // SAVING THE COURSE HERE
                notes: newNotes.trim(),
                measurements: defaultMeasurements,
                sizes: cleanSizes, // Save the sizes map
                // Only set createdAt on creation
            };

            if (editingStudent) {
                // UPDATE
                const docRef = doc(db, "students", editingStudent.id);
                // @ts-ignore
                await updateDoc(docRef, {
                    ...studentData,
                    updatedAt: serverTimestamp()
                });
                toast({ title: 'Estudiante actualizado', description: `${newName} ha sido modificado.` });

                // Update local selection if needed
                if (selectedStudentId === editingStudent.id) {
                    onSelectStudent({ ...editingStudent, ...studentData, sizes: cleanSizes });
                }

                // NEW: Update open orders for this student with the new sizes
                try {
                    const ordersRef = collection(db, "orders");
                    const q = query(
                        ordersRef,
                        where("studentId", "==", editingStudent.id),
                        where("status", "in", ["pending", "in_production"])
                    );
                    const querySnapshot = await getDocs(q);

                    if (!querySnapshot.empty) {
                        const batch = writeBatch(db);
                        let batchCount = 0;

                        querySnapshot.forEach((docSnap) => {
                            const order = docSnap.data();
                            let orderUpdated = false;

                            // @ts-ignore
                            const updatedItems = order.items.map((item: any) => {
                                // If item is standard (sur_mesure) and we have a new size for this product
                                if (item.type === 'sur_mesure' && cleanSizes[item.productName]) {
                                    if (item.size !== cleanSizes[item.productName]) {
                                        orderUpdated = true;
                                        return { ...item, size: cleanSizes[item.productName] };
                                    }
                                }
                                return item;
                            });

                            if (orderUpdated) {
                                batch.update(docSnap.ref, { items: updatedItems });
                                batchCount++;
                            }
                        });

                        if (batchCount > 0) {
                            await batch.commit();
                            console.log(`Updated ${batchCount} orders with new sizes.`);
                            toast({ title: "Pedidos actualizados", description: `${batchCount} pedidos pendientes fueron actualizados con las nuevas tallas.` });
                        }
                    }
                } catch (err) {
                    console.error("Error syncing sizes to orders:", err);
                    // Non-blocking error
                }
            } else {
                // CREATE
                // @ts-ignore
                const docRef = await addDoc(collection(db, "students"), {
                    ...studentData,
                    createdAt: serverTimestamp()
                });

                // Auto-select the new student (re-fetching locally, but we can construct the object)
                const createdStudent: Student = {
                    id: docRef.id,
                    ...studentData,
                    createdAt: new Date(),
                };
                onSelectStudent(createdStudent);
                toast({ title: 'Estudiante creado', description: `${newName} ha sido registrado.` });
            }

            setIsCreateOpen(false);
            setEditingStudent(null);
            resetForm();

        } catch (error: any) {
            console.error("Error saving student:", error);
            const errorMessage = error.code ? `Error Code: ${error.code}` : (error.message || 'Desconocido');
            toast({
                variant: 'destructive',
                title: 'Error al guardar',
                description: `No se pudo guardar. ${errorMessage}`
            });
        } finally {
            setIsCreating(false);
        }
    };

    const resetForm = () => {
        setNewName('');
        setNewCollege('');
        setNewGender('Hombre');
        setNewNotes('');
        setSizes({});
        setEditingStudent(null);
    };

    return (
        <div className="flex flex-col h-full gap-4">

            {/* Top Controls: Filter & Bulk Import */}
            <div className="flex gap-2">
                <Select value={selectedCollegeFilter} onValueChange={setSelectedCollegeFilter}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Todos los colegios" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos los Colegios</SelectItem>
                        {allFilterOptions.map(group => (
                            <SelectItem key={group} value={group}>{group}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <BulkImportDialog
                    defaultCollege={selectedCollegeFilter !== "all" ? selectedCollegeFilter : ''}
                    availableColleges={availableColleges}
                    onSuccess={() => toast({ title: "Lista actualizada" })}
                />
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar por nombre o colegio..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Student List */}
            <ScrollArea className="flex-1 border rounded-md">
                <div className="p-2 space-y-4">
                    {filteredStudents.length === 0 ? (
                        <p className="text-sm text-center text-muted-foreground py-4">
                            No se encontraron estudiantes.
                        </p>
                    ) : (
                        Object.entries(
                            filteredStudents.reduce((acc, student) => {
                                const group = student.classroom ? `${student.college} (${student.classroom})` : student.college;
                                if (!acc[group]) acc[group] = [];
                                acc[group].push(student);
                                return acc;
                            }, {} as Record<string, Student[]>)
                        )
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([group, groupStudents]) => (
                                <div key={group} className="space-y-1">
                                    <div className="px-2 py-1 sticky top-0 bg-white/95 backdrop-blur-sm z-10 flex justify-between items-center border-b mb-1">
                                        <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{group}</h5>
                                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">{groupStudents.length}</span>
                                    </div>
                                    <div className="space-y-1.5">
                                        {groupStudents.map(student => (
                                            <div
                                                key={student.id}
                                                onClick={() => onSelectStudent(student)}
                                                className={`group p-2.5 rounded-lg border cursor-pointer transition-colors flex items-center justify-between gap-3 ${selectedStudentId === student.id
                                                    ? 'bg-primary/10 border-primary shadow-sm'
                                                    : 'hover:bg-muted bg-card'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${selectedStudentId === student.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                                                        }`}>
                                                        <UserIcon className="h-3.5 w-3.5" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-medium text-sm truncate leading-tight">{student.name}</p>
                                                            <Badge variant="outline" className={`text-[9px] px-1 py-0 h-3.5 ${student.gender === 'Mujer' ? 'border-pink-200 text-pink-600 bg-pink-50' : 'border-blue-200 text-blue-600 bg-blue-50'}`}>
                                                                {student.gender === 'Mujer' ? 'M' : 'H'}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground truncate">
                                                            {student.college} {student.classroom ? `(${student.classroom})` : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1 shrink-0">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:text-primary"
                                                        onClick={(e) => handleEditClick(e, student)}
                                                    >
                                                        <Edit className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
                                                        onClick={(e) => handleDeleteStudent(e, student.id)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                    )}
                </div>
            </ScrollArea>

            {/* Create/Edit Modal */}
            <Dialog open={isCreateOpen} onOpenChange={(open) => {
                setIsCreateOpen(open);
                if (!open) resetForm();
            }}>
                <DialogTrigger asChild>
                    <Button className="w-full" variant="outline" onClick={() => {
                        setEditingStudent(null);
                        resetForm();
                    }}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Nuevo Estudiante
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingStudent ? 'Editar Estudiante' : 'Registrar Nuevo Estudiante'}</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nombre Completo *</Label>
                                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej: Juan Pérez" />
                            </div>
                            <div className="space-y-2">
                                <Label>Colegio *</Label>
                                {availableColleges.length > 0 ? (
                                    <Select value={newCollege} onValueChange={setNewCollege}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar Colegio" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableColleges.map(c => (
                                                <SelectItem key={c.id} value={c.id}>
                                                    {c.name} {c.course ? `(${c.course})` : ''}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <div className="flex flex-col gap-1">
                                        <Input value={newCollege} onChange={(e) => setNewCollege(e.target.value)} placeholder="Ej: Don Bosco" />
                                        <p className="text-xs text-red-500">No hay colegios configurados.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Género *</Label>
                                <Select value={newGender} onValueChange={(val: any) => setNewGender(val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar Género" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Hombre">Hombre</SelectItem>
                                        <SelectItem value="Mujer">Mujer</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Notas / Observaciones</Label>
                                <Textarea
                                    value={newNotes}
                                    onChange={(e) => setNewNotes(e.target.value)}
                                    placeholder="Información adicional..."
                                    className="resize-none h-10"
                                />
                            </div>
                        </div>

                        <div className="border-t pt-4 mt-2">
                            <h4 className="font-medium mb-4">
                                Tallas por Prenda
                                {selectedCollegeConfig && <span className="text-sm font-normal text-muted-foreground ml-2">({selectedCollegeConfig.name})</span>}
                            </h4>

                            {!newCollege ? (
                                <p className="text-sm text-muted-foreground italic bg-slate-100 p-3 rounded-md">
                                    👈 Primero selecciona un colegio para ver sus prendas.
                                </p>
                            ) : garmentsToShow.length === 0 ? (
                                <p className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded-md">
                                    Este colegio no tiene prendas configuradas. Ve a <strong>Configuración</strong> para añadirlas.
                                </p>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    {garmentsToShow.map((garment) => (
                                        <div key={garment} className="flex items-center gap-3">
                                            <Label className="w-24 text-sm truncate" title={garment}>{garment}</Label>
                                            <Input
                                                placeholder="Talla"
                                                value={sizes[garment] || ''}
                                                onChange={(e) => setSizes({ ...sizes, [garment]: e.target.value.toUpperCase() })}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveStudent} disabled={isCreating}>
                            {isCreating ? 'Guardando...' : (editingStudent ? 'Actualizar' : 'Guardar y Seleccionar')}
                        </Button>
                    </DialogFooter>
                </DialogContent >
            </Dialog >
        </div >
    );
}
