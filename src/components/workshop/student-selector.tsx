"use client";

import { useState, useEffect } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, doc, updateDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { Student, StudentMeasurements, College, ProjectConfiguration, Fitting } from '@/lib/types';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface StudentSelectorProps {
    onSelectStudent: (student: Student) => void;
    selectedStudentId?: string;
}

export function StudentSelector({ onSelectStudent, selectedStudentId }: StudentSelectorProps) {
    const { user } = useUser();
    const db = useFirestore();
    const { toast } = useToast();
    const [students, setStudents] = useState<Student[]>([]);

    // Mode State: 'school' | 'project'
    const [sourceType, setSourceType] = useState<'school' | 'project'>('school');

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCollegeFilter, setSelectedCollegeFilter] = useState<string>("all");
    const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>("all");

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
    const [availableProjects, setAvailableProjects] = useState<ProjectConfiguration[]>([]);
    const [projectFittings, setProjectFittings] = useState<Student[]>([]);

    useEffect(() => {
        if (!user) return;

        // Fetch Colleges
        const qColleges = query(collection(db, "colleges"), where("userId", "==", user.uid));
        const unsubColleges = onSnapshot(qColleges, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as College));
            setAvailableColleges(data);
        });

        // Fetch Projects
        const qProjects = query(collection(db, "projects"), where("userId", "==", user.uid));
        const unsubProjects = onSnapshot(qProjects, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectConfiguration));
            setAvailableProjects(data);
        });

        return () => {
            unsubColleges();
            unsubProjects();
        };
    }, [user, db]);

    // Fetch students (School Mode)
    useEffect(() => {
        if (!user || sourceType !== 'school') return;

        const q = query(
            collection(db, "students"),
            where("userId", "==", user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                sourceType: 'school' // Explicitly set source type
            } as Student));

            // Client-side sort by createdAt descending
            data.sort((a, b) => {
                const timeA = a.createdAt?.seconds ? a.createdAt.seconds : (a.createdAt instanceof Date ? a.createdAt.getTime() / 1000 : 0);
                const timeB = b.createdAt?.seconds ? b.createdAt.seconds : (b.createdAt instanceof Date ? b.createdAt.getTime() / 1000 : 0);
                return timeB - timeA;
            });

            setStudents(data);
        });

        return () => unsubscribe();
    }, [user, db, sourceType]);

    // Fetch Fittings (Project Mode) - Only when a project is selected to optimize
    useEffect(() => {
        if (!user || sourceType !== 'project' || selectedProjectFilter === 'all') {
            setProjectFittings([]);
            return;
        }

        const project = availableProjects.find(p => p.id === selectedProjectFilter || p.projectDetails.projectName === selectedProjectFilter);
        if (!project) return;

        const q = collection(db, "projects", project.id, "fittings");

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => {
                const fitting = doc.data() as Fitting;
                // Map Fitting to Student interface
                return {
                    id: doc.id,
                    userId: user.uid,
                    college: project.projectDetails.projectName,
                    collegeId: project.id,
                    name: fitting.personName,
                    gender: 'Hombre', // Default or need to infer? Project might have gender info? For now default.
                    classroom: 'Proyecto',
                    measurements: {}, // Project usually uses sizes directly
                    sizes: fitting.sizes || {},
                    notes: fitting.email,
                    createdAt: fitting.createdAt,
                    sourceType: 'project',
                    projectId: project.id
                } as Student;
            });

            // Sort by name for projects usually
            data.sort((a, b) => a.name.localeCompare(b.name));
            setProjectFittings(data);
        });

        return () => unsubscribe();
    }, [user, db, sourceType, selectedProjectFilter, availableProjects]);

    // Generate filter options based on availableColleges
    const studentGroups = Array.from(new Set(students.map(s => {
        return s.classroom ? `${s.college} (${s.classroom})` : s.college;
    }))).filter(Boolean);

    const configuredGroups = availableColleges.map(c => {
        return c.course ? `${c.name} (${c.course})` : c.name;
    });

    const allFilterOptions = Array.from(new Set([...configuredGroups, ...studentGroups])).sort();

    // Determine which list to show
    const displayList = sourceType === 'school' ? students : projectFittings;

    const filteredStudents = displayList.filter(student => {
        const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            student.college.toLowerCase().includes(searchTerm.toLowerCase());

        if (sourceType === 'school') {
            const studentGroup = student.classroom ? `${student.college} (${student.classroom})` : student.college;
            const matchesCollege = selectedCollegeFilter === "all" || studentGroup === selectedCollegeFilter;
            return matchesSearch && matchesCollege;
        } else {
            // For project mode, we are already filtering by fetching only the selected project's fittings
            // But we still apply local search
            return matchesSearch;
        }
    });

    // Editing State
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);

    // When creating, if a filter is active, auto-fill the college name
    useEffect(() => {
        if (isCreateOpen && !editingStudent && selectedCollegeFilter !== "all") {
            const match = selectedCollegeFilter.match(/^(.*)\s\((.*)\)$/);
            if (match) {
                const name = match[1];
                const course = match[2];
                const found = availableColleges.find(c => c.name === name && (c.course || '') === course);
                if (found) {
                    setNewCollege(found.id);
                } else {
                    setNewCollege(name); // Fallback
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
        setNewCollege(student.collegeId || student.college);
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

    const selectedCollegeConfig = availableColleges.find(c => c.id === newCollege || c.name === newCollege);
    const garmentsToShow = selectedCollegeConfig?.priceList?.map(item => item.name) || ['Pantalon', 'Saco', 'Camisa', 'Polo', 'Deportivo', 'Falda'];

    const handleSaveStudent = async () => {
        if (!user || !newName || !newCollege) {
            toast({ variant: 'destructive', title: 'Faltan datos', description: 'Nombre y Colegio son obligatorios.' });
            return;
        }

        setIsCreating(true);
        try {
            // Common Data Preparation
            const matchedConfig = availableColleges.find(c => c.id === newCollege || c.name === newCollege);
            const hiddenClassroom = matchedConfig?.course || '';
            const collegeName = matchedConfig?.name || newCollege;
            const collegeId = matchedConfig?.id || '';

            const defaultMeasurements = { height: 0, chest: 0, waist: 0, hips: 0, sleeve: 0, leg: 0, shoulder: 0, neck: 0 };

            const cleanSizes: Record<string, string> = {};
            Object.keys(sizes).forEach(key => {
                if (sizes[key]?.trim()) cleanSizes[key] = sizes[key].trim().toUpperCase();
            });

            console.log('[DEBUG] Saving student/participant sizes:', cleanSizes);

            if (sourceType === 'project') {
                if (!newCollege) { // In project mode, newCollege holds the project ID
                    toast({ variant: 'destructive', title: 'Error', description: 'Seleccione un proyecto.' });
                    return;
                }

                // Prepare Fitting Data
                const fittingData = {
                    personName: newName.trim(),
                    email: newNotes.trim(), // Using notes field for email or extra info
                    sizes: cleanSizes,
                    confirmed: false,
                    userId: user.uid,
                    createdAt: serverTimestamp()
                };

                if (editingStudent) {
                    await updateDoc(doc(db, "projects", newCollege, "fittings", editingStudent.id), fittingData);
                    toast({ title: 'Participante actualizado' });
                    // No need to manually update state as onSnapshot handles it
                } else {
                    await addDoc(collection(db, "projects", newCollege, "fittings"), fittingData);
                    toast({ title: 'Participante registrado' });
                }

            } else {
                // SCHOOL MODE
                const studentData = {
                    userId: user.uid,
                    name: newName.trim(),
                    college: collegeName,
                    collegeId: collegeId,
                    gender: newGender,
                    classroom: hiddenClassroom,
                    notes: newNotes.trim(),
                    measurements: defaultMeasurements,
                    sizes: cleanSizes,
                };

                if (editingStudent) {
                    // 1. UPDATE STUDENT DOCUMENT
                    const docRef = doc(db, "students", editingStudent.id);
                    // @ts-ignore
                    await updateDoc(docRef, {
                        ...studentData,
                        updatedAt: serverTimestamp()
                    });
                    toast({ title: 'Estudiante actualizado', description: `${newName} ha sido modificado.` });

                    if (selectedStudentId === editingStudent.id) {
                        onSelectStudent({ ...editingStudent, ...studentData, sizes: cleanSizes });
                    }

                    // 2. UPDATE ORDERS SYNC (with simplified query & local filtering)
                    try {
                        console.log(`[DEBUG] Starting sync to orders for student ${editingStudent.id}`);
                        const ordersRef = collection(db, "orders");

                        // The simplest query (by userId) is guaranteed to pass security rules
                        const q = query(
                            ordersRef,
                            where("userId", "==", user.uid)
                        );

                        console.log(`[DEBUG] Fetching all orders for user ${user.uid} to filter locally...`);
                        const querySnapshot = await getDocs(q);
                        console.log(`[DEBUG] Successfully fetched ${querySnapshot.size} total orders.`);

                        if (!querySnapshot.empty) {
                            const batch = writeBatch(db);
                            let batchCount = 0;

                            // Filter relevant orders locally
                            const relevantOrders = querySnapshot.docs.filter(docSnap => {
                                const data = docSnap.data();
                                return data.studentId === editingStudent.id &&
                                    ["pending", "in_production", "ready"].includes(data.status);
                            });

                            console.log(`[DEBUG] Found ${relevantOrders.length} relevant orders to check.`);

                            relevantOrders.forEach((docSnap) => {
                                const order = docSnap.data();
                                let orderUpdated = false;
                                const updateData: any = {
                                    userId: user.uid, // Explicitly include userId to satisfy security rules
                                    updatedAt: serverTimestamp()
                                };

                                // Sync Denormalized Data
                                if (order.studentName !== newName.trim()) {
                                    updateData.studentName = newName.trim();
                                    orderUpdated = true;
                                    console.log(`[DEBUG] Order ${docSnap.id}: Updating name`);
                                }
                                if (order.college !== collegeName) {
                                    updateData.college = collegeName;
                                    orderUpdated = true;
                                    console.log(`[DEBUG] Order ${docSnap.id}: Updating college`);
                                }
                                if (order.studentGender !== newGender) {
                                    updateData.studentGender = newGender;
                                    orderUpdated = true;
                                    console.log(`[DEBUG] Order ${docSnap.id}: Updating gender`);
                                }

                                // Sync Item Sizes
                                // @ts-ignore
                                const updatedItems = order.items.map((item: any) => {
                                    const isSurMesure = item.type === 'sur_mesure' || !item.type;
                                    const productName = item.productName.trim();

                                    if (isSurMesure) {
                                        let newSize = cleanSizes[productName];
                                        if (!newSize) {
                                            const matchingKey = Object.keys(cleanSizes).find(
                                                key => key.toLowerCase() === productName.toLowerCase()
                                            );
                                            if (matchingKey) newSize = cleanSizes[matchingKey];
                                        }

                                        if (newSize) {
                                            const currentSize = (item.size || '').toUpperCase();
                                            const newSizeUpper = newSize.toUpperCase();
                                            if (currentSize !== newSizeUpper) {
                                                orderUpdated = true;
                                                console.log(`[DEBUG] Order ${docSnap.id} - ${productName}: "${currentSize}" -> "${newSizeUpper}"`);
                                                return { ...item, size: newSizeUpper };
                                            }
                                        }
                                    }
                                    return item;
                                });

                                if (orderUpdated) {
                                    updateData.items = updatedItems;
                                    batch.update(docSnap.ref, updateData);
                                    batchCount++;
                                }
                            });

                            if (batchCount > 0) {
                                console.log(`[DEBUG] Committing ${batchCount} order updates...`);
                                await batch.commit();
                                console.log(`[DEBUG] Batch commit successful.`);
                                toast({ title: "Pedidos actualizados", description: `${batchCount} pedidos fueron sincronizados.` });
                            } else {
                                console.log(`[DEBUG] No updates required for relevant orders.`);
                            }
                        }
                    } catch (err) {
                        console.error("Error syncing to orders:", err);
                    }
                } else {
                    // CREATE
                    // @ts-ignore
                    const docRef = await addDoc(collection(db, "students"), {
                        ...studentData,
                        createdAt: serverTimestamp()
                    });

                    const createdStudent: Student = {
                        id: docRef.id,
                        ...studentData,
                        createdAt: new Date(),
                    };
                    onSelectStudent(createdStudent);
                    toast({ title: 'Estudiante creado', description: `${newName} ha sido registrado.` });
                }
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
            <Tabs value={sourceType} onValueChange={(v: any) => setSourceType(v)} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="school">Colegio / Taller</TabsTrigger>
                    <TabsTrigger value="project">Proyecto / Empresa</TabsTrigger>
                </TabsList>
            </Tabs>

            <div className="flex gap-2">
                {sourceType === 'school' ? (
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
                ) : (
                    <Select value={selectedProjectFilter} onValueChange={setSelectedProjectFilter}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Seleccionar Proyecto" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Seleccionar Proyecto...</SelectItem>
                            {availableProjects.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.projectDetails.projectName}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                {sourceType === 'school' && (
                    <BulkImportDialog
                        defaultCollege={selectedCollegeFilter !== "all" ? selectedCollegeFilter : ''}
                        availableColleges={availableColleges}
                        onSuccess={() => toast({ title: "Lista actualizada" })}
                    />
                )}
            </div>

            <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar por nombre o colegio..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <ScrollArea className="flex-1 border rounded-md">
                <div className="p-2 space-y-4">
                    {filteredStudents.length === 0 ? (
                        <p className="text-sm text-center text-muted-foreground py-4">
                            {sourceType === 'project' && selectedProjectFilter === 'all'
                                ? "Seleccione un proyecto para ver los participantes."
                                : "No se encontraron resultados."}
                        </p>
                    ) : (
                        Object.entries(
                            filteredStudents.reduce((acc, student) => {
                                const group = sourceType === 'school'
                                    ? (student.classroom ? `${student.college} (${student.classroom})` : student.college)
                                    : student.college; // For projects, just group by project name (should be single group mostly)
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
                        {sourceType === 'school' ? 'Nuevo Estudiante' : 'Nuevo Participante'}
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingStudent ? 'Editar Registro' : 'Registrar Nuevo Estudiante'}</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nombre Completo *</Label>
                                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej: Juan Pérez" />
                            </div>
                            <div className="space-y-2">
                                <Label>{sourceType === 'school' ? 'Colegio *' : 'Proyecto *'}</Label>
                                {availableColleges.length > 0 ? (
                                    <Select value={newCollege} onValueChange={setNewCollege} disabled={sourceType === 'project'}>
                                        <SelectTrigger>
                                            <SelectValue placeholder={sourceType === 'school' ? "Seleccionar Colegio" : "Proyecto del participante"} />
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
