"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Trash2, Send, CheckCircle, Clock, Users, Pencil, Printer, MoreVertical } from 'lucide-react';
import type { Fitting, ProjectConfiguration, LineItem, QuoteItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { doc, collection, addDoc, deleteDoc, serverTimestamp, getDoc, updateDoc, getDocs, writeBatch } from 'firebase/firestore';
import { Header } from '@/components/header';
import { Loader } from '@/components/ui/loader';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendFittingConfirmationEmail } from '@/ai/flows/send-fitting-confirmation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { useReactToPrint } from 'react-to-print';
import { FittingsPrint } from '@/components/fittings-print';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { recalculateProjectConsumption } from '@/lib/calculation-helpers';


const EMPTY_FITTING: Omit<Fitting, 'id' | 'createdAt' | 'confirmed' | 'userId'> = {
    personName: '',
    email: '',
    sizes: {},
};


export default function FittingDetailsPage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const params = useParams();
    const projectId = params.projectId as string;
    const { toast } = useToast();
    const db = useFirestore();

    const [fittings, setFittings] = useState<Fitting[]>([]);
    const [project, setProject] = useState<ProjectConfiguration | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSending, setIsSending] = useState<string | null>(null);

    const [isDialogOpen, setDialogOpen] = useState(false);
    const [isImportDialogOpen, setImportDialogOpen] = useState(false);
    const [namesToImport, setNamesToImport] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [currentFitting, setCurrentFitting] = useState<Partial<Fitting>>(EMPTY_FITTING);

    const printRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `Lista de Medidas - ${project?.projectDetails.projectName || 'Proyecto'}`,
    });
    
    useEffect(() => {
        if (isUserLoading) return;
        if (!user) {
            router.push('/login');
            return;
        }
        if (!projectId) {
            setError('ID de proyecto no válido.');
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const projectRef = doc(db, 'projects', projectId);
                const projectSnap = await getDoc(projectRef);

                if (!projectSnap.exists() || projectSnap.data().userId !== user.uid) {
                    throw new Error('No se pudo cargar el proyecto. Puede que no exista o que no tengas permiso.');
                }
                
                const projectData = { id: projectSnap.id, ...projectSnap.data() } as ProjectConfiguration;
                setProject(projectData);

                const fittingsRef = collection(db, 'projects', projectId, 'fittings');
                const fittingsSnapshot = await getDocs(fittingsRef);
                const fittingsData = fittingsSnapshot.docs.map(docSnap => {
                    const data = docSnap.data();
                    return { id: docSnap.id, ...data } as Fitting;
                });
                
                fittingsData.sort((a, b) => a.personName.localeCompare(b.personName));
                setFittings(fittingsData);

            } catch (err: any) {
                console.error("Error loading project details:", err);
                setError(err.message || 'Error al cargar los datos del proyecto.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();

    }, [user, isUserLoading, projectId, router, db]);

    const sizeSummary = useMemo(() => {
        const summary: { [garmentName: string]: { [size: string]: number } } = {};
        
        project?.lineItems.forEach(garment => {
            summary[garment.name] = {};
        });

        fittings.forEach(fitting => {
            if (fitting.sizes) {
                Object.entries(fitting.sizes).forEach(([garmentId, size]) => {
                    const garment = project?.lineItems.find(li => li.id === garmentId);
                    if (garment && size) {
                        const garmentName = garment.name;
                        const upperSize = size.trim().toUpperCase();
                        if (!summary[garmentName]) summary[garmentName] = {};
                        summary[garmentName][upperSize] = (summary[garmentName][upperSize] || 0) + 1;
                    }
                });
            }
        });
        return summary;
    }, [fittings, project]);

    const handleSendConfirmation = async (fitting: Fitting) => {
        if (!project) return;
        setIsSending(fitting.id);

        const sizeDetails = project.lineItems.map(garment => {
            const size = fitting.sizes?.[garment.id] || 'No especificado';
            return `<p><strong>${garment.name}:</strong> ${size}</p>`;
        }).join('');

        try {
            const result = await sendFittingConfirmationEmail({
                projectId: project.id,
                fittingId: fitting.id,
                personName: fitting.personName,
                email: fitting.email,
                projectName: project.projectDetails.projectName,
                sizeDetailsHtml: sizeDetails,
                date: new Date().toLocaleDateString()
            });

            if (result.status === 'success') {
                toast({
                    title: 'Correo Enviado',
                    description: `Se ha enviado la confirmación a ${fitting.personName}.`,
                });
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            console.error("Error sending confirmation email:", error);
            toast({
                variant: 'destructive',
                title: 'Error de Envío',
                description: `No se pudo enviar el correo. ${error.message}`,
            });
        } finally {
            setIsSending(null);
        }
    };

    const handleOpenDialog = (fitting?: Fitting) => {
        if (fitting) {
            setCurrentFitting(fitting);
        } else {
            setCurrentFitting({ ...EMPTY_FITTING, sizes: {} });
        }
        setDialogOpen(true);
    }
    
    const handleSaveFitting = async () => {
        if (!user) {
             toast({ variant: 'destructive', title: 'Acción no permitida', description: 'Debes iniciar sesión.' });
            return;
        }
        if (!currentFitting.personName) {
            toast({ variant: 'destructive', title: 'Datos Incompletos', description: 'El nombre es obligatorio.' });
            return;
        }

        try {
            const fittingsRef = collection(db, 'projects', projectId, 'fittings');
            let updatedFitting: Fitting;
            
            const cleanData = {
                personName: currentFitting.personName,
                email: currentFitting.email || '',
                sizes: currentFitting.sizes || {},
                userId: user.uid,
            };


            if (currentFitting.id) {
                const fittingDocRef = doc(db, 'projects', projectId, 'fittings', currentFitting.id);
                await updateDoc(fittingDocRef, cleanData);
                updatedFitting = { ...(currentFitting as Fitting), ...cleanData };
                setFittings(fittings.map(f => f.id === updatedFitting.id ? updatedFitting : f).sort((a,b) => a.personName.localeCompare(b.personName)));
                toast({ title: 'Medida Actualizada', description: `Se han actualizado las medidas para ${currentFitting.personName}.` });
            } else {
                const newFittingData = {
                    ...cleanData,
                    confirmed: false,
                    createdAt: serverTimestamp(),
                };
                const docRef = await addDoc(fittingsRef, newFittingData);
                updatedFitting = { id: docRef.id, ...newFittingData } as Fitting;
                setFittings([...fittings, updatedFitting].sort((a,b) => a.personName.localeCompare(b.personName)));
                toast({ title: 'Medida Añadida', description: `Se han guardado las medidas para ${currentFitting.personName}.` });
            }
            setDialogOpen(false);
            
            // Trigger recalculation in the background
            await recalculateProjectConsumption(projectId);

        } catch (error: any) {
            console.error("Error saving fitting:", error);
            toast({ variant: 'destructive', title: 'Error al Guardar', description: 'No se pudieron guardar las medidas.' });
        }
    };
    
    const handleDeleteFitting = async (fittingId: string) => {
        try {
            await deleteDoc(doc(db, 'projects', projectId, 'fittings', fittingId));
            setFittings(fittings.filter(f => f.id !== fittingId));
            toast({ title: 'Medida Eliminada', description: 'El registro de medidas ha sido eliminado.' });

            // Trigger recalculation in the background
            await recalculateProjectConsumption(projectId);

        } catch (error) {
            console.error("Error deleting fitting:", error);
            toast({ variant: 'destructive', title: 'Error al Eliminar', description: 'No se pudo eliminar el registro.' });
        }
    };
    
    const handleImportNames = async () => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Acción no permitida', description: 'Debes iniciar sesión.' });
            return;
        }

        const names = namesToImport.split('\n').map(name => name.trim()).filter(name => name.length > 0);
        if (names.length === 0) {
            toast({ variant: 'destructive', title: 'Lista Vacía', description: 'Por favor, ingrese al menos un nombre.' });
            return;
        }

        setIsImporting(true);
        try {
            const batch = writeBatch(db);
            const fittingsRef = collection(db, 'projects', projectId, 'fittings');
            const newFittings: Fitting[] = [];

            names.forEach(name => {
                const newFittingRef = doc(fittingsRef);
                const newFittingData: Omit<Fitting, 'id'> = {
                    personName: name,
                    email: '',
                    sizes: {},
                    confirmed: false,
                    createdAt: serverTimestamp(),
                    userId: user.uid,
                };
                batch.set(newFittingRef, newFittingData);
                newFittings.push({ id: newFittingRef.id, ...newFittingData });
            });

            await batch.commit();
            setFittings([...fittings, ...newFittings].sort((a, b) => a.personName.localeCompare(b.personName)));

            toast({
                title: 'Importación Exitosa',
                description: `${names.length} ${names.length > 1 ? 'personas han sido añadidas' : 'persona ha sido añadida'}.`,
            });
            setImportDialogOpen(false);
            setNamesToImport('');

            // Trigger recalculation in the background
            await recalculateProjectConsumption(projectId);

        } catch (error: any) {
            console.error("Error importing names:", error);
            toast({ variant: 'destructive', title: 'Error de Importación', description: 'No se pudieron importar los nombres.' });
        } finally {
            setIsImporting(false);
        }
    };

    if (isLoading || isUserLoading) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 p-4 md:p-8">
                    <Loader text="Cargando detalles de medidas..." />
                </main>
            </div>
        );
    }
    
    if (error) {
        return (
             <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 p-4 md:p-8 text-center">
                    <h2 className="text-xl text-destructive">Error</h2>
                    <p>{error}</p>
                    <Button onClick={() => router.push('/dashboard')} className="mt-4">Volver al escritorio</Button>
                </main>
            </div>
        )
    }

    const renderSummaryTable = (garmentName: string) => {
        const sizes = sizeSummary[garmentName];
        if (!sizes || Object.keys(sizes).length === 0) return null;

        const sortedSizes = Object.keys(sizes).sort();

        return (
            <Card key={garmentName}>
                <CardHeader><CardTitle className="text-base capitalize">{garmentName}</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Talla</TableHead>
                                <TableHead className="text-right">Cantidad</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedSizes.map(size => (
                                <TableRow key={size}>
                                    <TableCell>{size}</TableCell>
                                    <TableCell className="text-right">{sizes[size]}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        );
    };

    return (
        <>
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 p-4 md:p-8">
                    <TooltipProvider>
                    <div className="max-w-6xl mx-auto space-y-6">
                        <Card>
                             <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div>
                                    <CardTitle className="text-2xl">Medidas para: {project?.projectDetails.projectName}</CardTitle>
                                    <CardDescription>
                                        Añada y gestione las tallas para los participantes del proyecto. Total: {fittings.length} personas.
                                    </CardDescription>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Imprimir Lista</Button>
                                    <Dialog open={isImportDialogOpen} onOpenChange={setImportDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button variant="outline"><Users className="mr-2 h-4 w-4" /> Importar Lista</Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Importar lista de nombres</DialogTitle>
                                                <DialogDescription>
                                                    Pegue una lista de nombres, uno por línea. Se creará un registro para cada nombre.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="py-4">
                                                <Textarea
                                                    placeholder="Juan Pérez
María García
Carlos Rodriguez..."
                                                    rows={10}
                                                    value={namesToImport}
                                                    onChange={(e) => setNamesToImport(e.target.value)}
                                                    disabled={isImporting}
                                                />
                                            </div>
                                            <DialogFooter>
                                                <Button variant="ghost" onClick={() => setImportDialogOpen(false)} disabled={isImporting}>Cancelar</Button>
                                                <Button onClick={handleImportNames} disabled={isImporting}>
                                                    {isImporting ? 'Importando...' : 'Importar'}
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>

                                    <Button onClick={() => handleOpenDialog()}><PlusCircle className="mr-2 h-4 w-4" /> Añadir Persona</Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="mb-8">
                                    <h3 className="text-lg font-semibold mb-4">Resumen de Cantidades por Talla</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {project?.lineItems.map(garment => renderSummaryTable(garment.name))}
                                    </div>
                                    {Object.values(sizeSummary).every(g => Object.keys(g).length === 0) && (
                                        <p className="text-muted-foreground text-sm">Aún no se han introducido tallas.</p>
                                    )}
                                </div>
                                {fittings.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[50px]">#</TableHead>
                                                    <TableHead>Nombre</TableHead>
                                                    <TableHead>Tallas</TableHead>
                                                    <TableHead>Estado</TableHead>
                                                    <TableHead className="text-right">Acciones</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {fittings.map((fitting, index) => (
                                                    <TableRow key={fitting.id}>
                                                        <TableCell>{index + 1}</TableCell>
                                                        <TableCell className="font-medium">{fitting.personName}</TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            {fitting.sizes && Object.keys(fitting.sizes).length > 0 ? Object.values(fitting.sizes).join(', ') : '-'}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Tooltip>
                                                                <TooltipTrigger>
                                                                    <div className={`h-3 w-3 rounded-full ${fitting.confirmed ? 'bg-green-500' : 'bg-orange-500'}`} />
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p>{fitting.confirmed ? 'Confirmado' : 'Pendiente'}</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <AlertDialog>
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                            <MoreVertical className="h-4 w-4" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end">
                                                                        <DropdownMenuItem onSelect={() => handleOpenDialog(fitting)}>
                                                                            <Pencil className="mr-2 h-4 w-4" /> Editar
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem
                                                                            onSelect={() => handleSendConfirmation(fitting)}
                                                                            disabled={isSending === fitting.id || fitting.confirmed || !fitting.email}
                                                                        >
                                                                            <Send className="mr-2 h-4 w-4" /> Enviar Confirmación
                                                                        </DropdownMenuItem>
                                                                        <AlertDialogTrigger asChild>
                                                                            <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                                                                                <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                                                            </DropdownMenuItem>
                                                                        </AlertDialogTrigger>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            Esta acción eliminará permanentemente el registro de medidas de {fitting.personName}. No se puede deshacer.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleDeleteFitting(fitting.id)}>Sí, Eliminar</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                ) : (
                                    <div className="text-center py-10 border-2 border-dashed rounded-lg">
                                        <h3 className="text-lg font-medium text-muted-foreground">No hay registros de medidas.</h3>
                                        <p className="text-sm text-muted-foreground mt-2">Haga clic en "Añadir Persona" para empezar.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                    </TooltipProvider>
                </main>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{currentFitting.id ? 'Editar' : 'Añadir Nuevo'} Registro de Medidas</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="personName">Nombre Completo</Label>
                            <Input id="personName" value={currentFitting.personName || ''} onChange={(e) => setCurrentFitting(p => ({...p, personName: e.target.value}))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Correo Electrónico (Opcional)</Label>
                            <Input id="email" type="email" value={currentFitting.email || ''} onChange={(e) => setCurrentFitting(p => ({...p, email: e.target.value}))} />
                        </div>
                        <div className="space-y-4 pt-4 border-t">
                            <Label>Tallas</Label>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {project?.lineItems.map(garment => (
                                    <div className="space-y-2" key={garment.id}>
                                        <Label htmlFor={`size-${garment.id}`}>{garment.name}</Label>
                                        <Input
                                            id={`size-${garment.id}`}
                                            value={currentFitting.sizes?.[garment.id] || ''}
                                            onChange={(e) => {
                                                const newSizes = { ...currentFitting.sizes, [garment.id]: e.target.value };
                                                setCurrentFitting(p => ({ ...p, sizes: newSizes }));
                                            }}
                                            placeholder="p. ej., M, 42, etc."
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveFitting}>Guardar Medidas</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="hidden">
                <div className="print-block">
                    <FittingsPrint ref={printRef} project={project} fittings={fittings} sizeSummary={sizeSummary} />
                </div>
             </div>
        </>
    );
}
