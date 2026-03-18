"use client";

import { useState, useEffect } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { Order, OrderStatus, Student, ProjectConfiguration, Fitting } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, DollarSign, Users, ClipboardList, CreditCard, QrCode, Pencil, Trash2, CheckCircle2, AlertCircle, UserCheck, Shirt, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { ProductionSummary } from './production-summary';

interface ClientUnifiedViewProps {
    selectedCollege: string;
    orders: Order[];
    projectConfigs: Record<string, ProjectConfiguration>;
    onPaymentClick: (order: Order) => void;
    onStatusChange: (orderId: string, status: OrderStatus) => void;
    onDeleteOrder: (orderId: string) => void;
    onEditAmountClick: (order: Order) => void;
    searchTerm?: string;
}

export function ClientUnifiedView({
    selectedCollege,
    orders,
    projectConfigs,
    onPaymentClick,
    onStatusChange,
    onDeleteOrder,
    onEditAmountClick,
    searchTerm = "",
}: ClientUnifiedViewProps) {
    const { user } = useUser();
    const db = useFirestore();

    // Participants state
    const [participants, setParticipants] = useState<Student[]>([]);
    const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);
    const [savedQrCode, setSavedQrCode] = useState<string | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Detect if this is a project or a school client
    const activeProject = Object.values(projectConfigs).find(
        p => p.projectDetails.projectName === selectedCollege
    );
    const isProject = !!activeProject;

    // Fetch participants (school students or project fittings)
    useEffect(() => {
        if (!user || !selectedCollege) return;
        setIsLoadingParticipants(true);

        if (isProject && activeProject) {
            // Fetch fittings from the project's subcollection
            const fittingsRef = collection(db, "projects", activeProject.id, "fittings");
            const unsub = onSnapshot(fittingsRef, (snapshot) => {
                const data = snapshot.docs.map(docSnap => {
                    const fitting = docSnap.data() as Fitting;
                    return {
                        id: docSnap.id,
                        userId: user.uid,
                        college: selectedCollege,
                        collegeId: activeProject.id,
                        name: fitting.personName,
                        sizes: fitting.sizes || {},
                        notes: fitting.email,
                        createdAt: fitting.createdAt,
                        sourceType: 'project' as const,
                        projectId: activeProject.id,
                    } as Student;
                });
                data.sort((a, b) => a.name.localeCompare(b.name));
                setParticipants(data);
                setIsLoadingParticipants(false);
            });
            return () => unsub();
        } else {
            // Fetch students from the students collection
            const q = query(
                collection(db, "students"),
                where("userId", "==", user.uid),
                where("college", "==", selectedCollege)
            );
            const unsub = onSnapshot(q, (snapshot) => {
                const data = snapshot.docs.map(docSnap => ({
                    id: docSnap.id,
                    ...docSnap.data(),
                    sourceType: 'school' as const,
                } as Student));
                data.sort((a, b) => a.name.localeCompare(b.name));
                setParticipants(data);
                setIsLoadingParticipants(false);
            });
            return () => unsub();
        }
    }, [user, db, selectedCollege, isProject, activeProject]);

    // Fetch saved QR code for cobros tab
    useEffect(() => {
        if (!user) return;
        const fetchQr = async () => {
            try {
                const d = await getDoc(doc(db, "settings", `workshop_${user.uid}`));
                if (d.exists()) setSavedQrCode(d.data().qrCodeUrl || null);
            } catch (e) { /* silently fail */ }
        };
        fetchQr();
    }, [user, db]);

    // Derived stats
    const totalVenta = orders.reduce((s, o) => s + (o.totalAmount || 0), 0);
    const totalCobrado = orders.reduce((s, o) => s + (o.paidAmount || 0), 0);
    const totalPendiente = orders.reduce((s, o) => s + (o.balance || 0), 0);
    const pendingOrders = orders.filter(o => (o.balance || 0) > 0);
    const paidOrders = orders.filter(o => (o.balance || 0) <= 0);

    // Get all garment names for the participants table header
    const allGarmentNames = activeProject
        ? (activeProject.lineItems?.map(li => li.name) || [])
        : Array.from(new Set(
            participants.flatMap(p => Object.keys(p.sizes || {}))
        )).sort();

    // Filters: Filter participants by searchTerm
    const filteredParticipants = participants.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Paginated participants
    const totalPages = Math.ceil(filteredParticipants.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedParticipants = filteredParticipants.slice(startIndex, startIndex + itemsPerPage);

    // Reset to page 1 when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    return (
        <Tabs defaultValue="produccion" className="w-full">
            <TabsList className="bg-white border p-1 h-auto mb-6">
                <TabsTrigger
                    value="produccion"
                    className="py-2 px-5 flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white group"
                >
                    <ClipboardList className="h-4 w-4" />
                    Resumen de Confeccionista
                </TabsTrigger>
                <TabsTrigger
                    value="detalles"
                    className="py-2 px-5 flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white group"
                >
                    <Users className="h-4 w-4" />
                    Lista de Tallas
                    <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white">
                        {filteredParticipants.length}
                    </span>
                </TabsTrigger>
                <TabsTrigger
                    value="cobros"
                    className="py-2 px-5 flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white group"
                >
                    <CreditCard className="h-4 w-4" />
                    Cobros
                    {pendingOrders.length > 0 && (
                        <span className="ml-1 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold group-data-[state=active]:bg-red-500 group-data-[state=active]:text-white">
                            {pendingOrders.length}
                        </span>
                    )}
                </TabsTrigger>
            </TabsList>

            {/* ─── TAB 1: RESUMEN DE CONFECCIÓN ─── */}
            <TabsContent value="produccion" className="mt-0">
                <ProductionSummary orders={orders} collegeName={selectedCollege} />
            </TabsContent>

            {/* ─── TAB 2: LISTA DE TALLAS ─── */}
            <TabsContent value="detalles" className="mt-0">
                <Card className="border shadow-sm">
                    <CardHeader className="pb-3 border-b">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <UserCheck className="h-4 w-4 text-primary" />
                                Lista de Participantes de {selectedCollege}
                            </CardTitle>
                            <Badge variant="outline">{searchTerm ? `${filteredParticipants.length} encontrados` : `${participants.length} registrados`}</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoadingParticipants ? (
                            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                                Cargando participantes...
                            </div>
                        ) : filteredParticipants.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                                <Users className="h-8 w-8 opacity-30" />
                                <p className="text-sm">{searchTerm ? "No se encontraron participantes que coincidan." : "No hay participantes registrados para este cliente."}</p>
                                {!searchTerm && <p className="text-xs">Ve al <strong>Taller</strong> para registrar participantes.</p>}
                            </div>
                        ) : (
                            <>
                                <ScrollArea className="max-h-none">
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="font-semibold bg-white">Participante</TableHead>
                                                    {allGarmentNames.map(g => (
                                                        <TableHead key={g} className="text-center whitespace-nowrap px-4">
                                                            <span className="flex items-center justify-center gap-1">
                                                                <Shirt className="h-3 w-3" />
                                                                {g}
                                                            </span>
                                                        </TableHead>
                                                    ))}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {paginatedParticipants.map((p) => {
                                                    const normalize = (s: string) => s ? s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
                                                    const pNameNormalized = normalize(p.name);
                                                    const studentOrder = orders.find(o => normalize(o.studentName) === pNameNormalized);
                                                    const isComplete = allGarmentNames.length > 0 && allGarmentNames.every(g => p.sizes?.[g]);

                                                    return (
                                                        <TableRow key={p.id} className="hover:bg-slate-50/50">
                                                            <TableCell className="bg-white">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${isComplete ? 'bg-green-500' : 'bg-slate-300'}`}>
                                                                        {p.name.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="font-medium text-sm whitespace-nowrap">{p.name}</p>
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            {allGarmentNames.map(g => {
                                                                const size = p.sizes?.[g];
                                                                
                                                                const matchingItems = studentOrder?.items.filter(i => {
                                                                    const pName = i.productName.toLowerCase().trim();
                                                                    const gName = g.toLowerCase().trim();
                                                                    const gSingular = gName.endsWith('s') ? gName.slice(0, -1) : gName;
                                                                    const pSingular = pName.endsWith('s') ? pName.slice(0, -1) : pName;
                                                                    
                                                                    return pName.includes(gName) || 
                                                                           gName.includes(pName) ||
                                                                           pSingular === gSingular ||
                                                                           pName.includes(gSingular);
                                                                });
                                                                
                                                                const qty = matchingItems?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 1;

                                                                return (
                                                                    <TableCell key={g} className="text-center px-4">
                                                                        {size ? (
                                                                            <div className="flex items-center justify-center gap-1.5">
                                                                                <Badge variant="secondary" className="text-xs font-bold whitespace-nowrap px-2">
                                                                                    {size}
                                                                                </Badge>
                                                                                {qty > 1 && (
                                                                                    <span className="text-xs font-black text-primary bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10 shadow-sm animate-in fade-in zoom-in duration-300">
                                                                                        ({qty})
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-muted-foreground/40 text-xs">—</span>
                                                                        )}
                                                                    </TableCell>
                                                                );
                                                            })}
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </ScrollArea>
                                
                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50/50">
                                        <div className="text-xs text-muted-foreground">
                                            Mostrando <span className="font-medium">{startIndex + 1}</span> a <span className="font-medium">{Math.min(startIndex + itemsPerPage, filteredParticipants.length)}</span> de <span className="font-medium">{filteredParticipants.length}</span> resultados
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                                disabled={currentPage === 1}
                                                className="h-8 w-8 p-0"
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <div className="text-xs font-medium">
                                                Página {currentPage} de {totalPages}
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                                disabled={currentPage === totalPages}
                                                className="h-8 w-8 p-0"
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>


            {/* ─── TAB 3: COBROS ─── */}
            <TabsContent value="cobros" className="mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left: Summary + List of pending */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Summary cards */}

                        {/* Pending payments list */}
                        {pendingOrders.length === 0 ? (
                            <Card className="border border-green-200 bg-green-50">
                                <CardContent className="flex items-center gap-3 p-6">
                                    <CheckCircle2 className="h-8 w-8 text-green-500 shrink-0" />
                                    <div>
                                        <p className="font-semibold text-green-800">¡Todo cobrado!</p>
                                        <p className="text-sm text-green-600">No hay saldos pendientes para este cliente.</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card className="border shadow-sm">
                                <CardHeader className="pb-2 border-b">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <AlertCircle className="h-4 w-4 text-red-500" />
                                        Cobros Pendientes ({pendingOrders.length})
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="divide-y">
                                        {pendingOrders.map(order => (
                                            <div key={order.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                                                <div className="space-y-0.5">
                                                    <p className="font-medium text-sm">{order.studentName}</p>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-muted-foreground">
                                                            Total: {order.totalAmount} Bs
                                                        </span>
                                                        <span className="text-[10px] text-slate-400">·</span>
                                                        <span className="text-xs text-green-600">
                                                            Pagado: {order.paidAmount || 0} Bs
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="text-right">
                                                        <p className="text-sm font-bold text-red-600">{order.balance} Bs</p>
                                                        <p className="text-[10px] text-muted-foreground">saldo</p>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                                                        onClick={() => onPaymentClick(order)}
                                                    >
                                                        <DollarSign className="h-3.5 w-3.5" />
                                                        Cobrar
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Right: QR Panel */}
                    <div className="space-y-4">
                        <Card className="border shadow-sm bg-primary/5 border-primary/20">
                            <CardHeader className="pb-3 border-b border-primary/10">
                                <CardTitle className="text-base flex items-center gap-2 text-primary">
                                    <QrCode className="h-4 w-4" />
                                    Página de Cobro Público
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Envía este enlace a tus clientes pour qu'ils puissent notifier leurs paiements et télécharger leurs reçus.
                                </p>
                                <Button 
                                    className="w-full gap-2 font-bold shadow-md"
                                    onClick={() => window.open(`/order/${user?.uid}`, '_blank')}
                                >
                                    <Upload className="h-4 w-4" />
                                    Abrir Página de Envío
                                </Button>
                                <div className="p-3 bg-white border rounded-md text-[10px] font-mono break-all text-muted-foreground">
                                    {typeof window !== 'undefined' ? `${window.location.origin}/order/${user?.uid}` : ''}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </TabsContent>
        </Tabs>
    );
}
