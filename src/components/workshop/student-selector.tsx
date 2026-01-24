"use client";

import { useState, useEffect } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Student, StudentMeasurements, College } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, UserPlus, User as UserIcon, Edit, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { BulkImportDialog } from './bulk-import-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

    // Generate unique composite keys for the filter: "CollegeName (Course)" or just "CollegeName"
    const uniqueGroups = Array.from(new Set(students.map(s => {
        return s.classroom ? `${s.college} (${s.classroom})` : s.college;
    }))).filter(Boolean).sort();

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
            // Try to split logic if it's formatted as "Name (Course)"
            // Regex to extract Name and Course from "Name (Course)"
            const match = selectedCollegeFilter.match(/^(.*)\s\((.*)\)$/);
            if (match) {
                setNewCollege(match[1]);
            } else {
                setNewCollege(selectedCollegeFilter);
            }
        }
    }, [isCreateOpen, editingStudent, selectedCollegeFilter]);

    // Handle Edit Click
    const handleEditClick = (e: React.MouseEvent, student: Student) => {
        e.stopPropagation();
        setEditingStudent(student);
        setNewName(student.name);
        setNewCollege(student.college);
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

    // Get the config for the selected college (newCollege is the Name string for now, or match by name)
    // We try to match by name because 'newCollege' is a string in this form state
    const selectedCollegeConfig = availableColleges.find(c => c.name === newCollege);

    // Determine which garments to show: Use College Config if available, otherwise fallback to default list
    const garmentsToShow = selectedCollegeConfig?.priceList?.map(item => item.name) || ['Pantalon', 'Saco', 'Camisa', 'Polo', 'Deportivo', 'Falda'];

    const handleSaveStudent = async () => {
        if (!user || !newName || !newCollege) {
            toast({ variant: 'destructive', title: 'Faltan datos', description: 'Nombre y Colegio son obligatorios.' });
            return;
        }

        setIsCreating(true);
        try {
            // Find matched config to get hidden classroom/course
            const matchedConfig = availableColleges.find(c => c.name === newCollege);
            const hiddenClassroom = matchedConfig?.course || '';

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
                college: newCollege.trim(),
                classroom: hiddenClassroom, // SAVING THE COURSE HERE
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
                        {uniqueGroups.map(group => (
                            <SelectItem key={group} value={group}>{group}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <BulkImportDialog
                    defaultCollege={selectedCollegeFilter !== "all" ? selectedCollegeFilter : ''}
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
                <div className="p-2 space-y-2">
                    {filteredStudents.length === 0 ? (
                        <p className="text-sm text-center text-muted-foreground py-4">
                            No se encontraron estudiantes.
                        </p>
                    ) : (
                        filteredStudents.map(student => (
                            <div
                                key={student.id}
                                onClick={() => onSelectStudent(student)}
                                className={`group p-3 rounded-lg border cursor-pointer transition-colors flex items-center justify-between gap-3 ${selectedStudentId === student.id
                                    ? 'bg-primary/10 border-primary'
                                    : 'hover:bg-muted bg-card'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedStudentId === student.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                                        }`}>
                                        <UserIcon className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">{student.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {student.college} {student.classroom ? `(${student.classroom})` : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-1">
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
                                                <SelectItem key={c.id} value={c.name}>
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
                                                onChange={(e) => setSizes({ ...sizes, [garment]: e.target.value })}
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
                </DialogContent>
            </Dialog>
        </div>
    );
}
