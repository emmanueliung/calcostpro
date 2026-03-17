"use client";

import { useEffect, useState, Suspense } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { useSearchParams, useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Order, OrderStatus, ProjectConfiguration, PublicOrder } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader } from '@/components/ui/loader';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Trash2, DollarSign, ShoppingBag, ClipboardList, Search, ArrowRight, ArrowLeft, Image as ImageIcon, FileText, Pencil, Printer, Scissors, CreditCard, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PaymentPanel } from '@/components/workshop/payment-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OnlineOrdersView } from '@/components/workshop/online-orders-view';
import { ProductionSummary } from '@/components/workshop/production-summary';
import { OnlineOrdersBadge } from '@/components/workshop/online-orders-badge';
import { ClientUnifiedView } from '@/components/workshop/client-unified-view';

function ProductionPageContent() {
    const { user, isUserLoading } = useUser();
    const db = useFirestore();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [publicOrders, setPublicOrders] = useState<PublicOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCollege, setSelectedCollege] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");

    // Payment Modal State
    const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
    const [contentOpen, setContentOpen] = useState(false);
    const [projectConfigs, setProjectConfigs] = useState<Record<string, ProjectConfiguration>>({});
    const [showSummary, setShowSummary] = useState(false);
    const [filterPending, setFilterPending] = useState(false);

    // Read ?client= param from URL to pre-filter on load
    useEffect(() => {
        const clientParam = searchParams.get('client');
        if (clientParam) {
            setSelectedCollege(decodeURIComponent(clientParam));
        }
    }, [searchParams]);

    // Edit Paid Amount State
    const [editAmountOrder, setEditAmountOrder] = useState<Order | null>(null);
    const [isEditAmountDialogOpen, setIsEditAmountDialogOpen] = useState(false);
    const [tempPaidAmount, setTempPaidAmount] = useState<number>(0);
    const [participantsCount, setParticipantsCount] = useState<number>(0);

    useEffect(() => {
        if (!user || !db || selectedCollege === "all") {
            setParticipantsCount(0);
            return;
        }

        const activeProj = Object.values(projectConfigs).find(p => p.projectDetails.projectName === selectedCollege);
        
        if (activeProj) {
            const fittingsRef = collection(db, "projects", activeProj.id, "fittings");
            const unsub = onSnapshot(fittingsRef, (snapshot) => {
                setParticipantsCount(snapshot.size);
            });
            return () => unsub();
        } else {
            const q = query(
                collection(db, "students"),
                where("userId", "==", user.uid),
                where("college", "==", selectedCollege)
            );
            const unsub = onSnapshot(q, (snapshot) => {
                setParticipantsCount(snapshot.size);
            });
            return () => unsub();
        }
    }, [user, db, selectedCollege, projectConfigs]);

    useEffect(() => {
        const fetchProjects = async () => {
            const projectIds = new Set<string>();
            orders.forEach(o => {
                if (o.projectId) projectIds.add(o.projectId);
            });

            const newConfigs: Record<string, ProjectConfiguration> = { ...projectConfigs };
            let hasNew = false;
            for (const pid of Array.from(projectIds)) {
                if (!newConfigs[pid]) {
                    try {
                        const snap = await getDoc(doc(db, "projects", pid));
                        if (snap.exists()) {
                            newConfigs[pid] = { id: snap.id, ...snap.data() } as ProjectConfiguration;
                            hasNew = true;
                        }
                    } catch (e) {
                        console.error("Error fetching project", pid, e);
                    }
                }
            }
            if (hasNew) setProjectConfigs(newConfigs);
        };
        if (orders.length > 0) fetchProjects();
    }, [orders, db]);

    useEffect(() => {
        if (isUserLoading) return;

        if (!user) {
            setIsLoading(false);
            return;
        }

        const q = query(
            collection(db, "orders"),
            where("userId", "==", user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate() || new Date(),
            } as Order));

            data.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

            setOrders(data);
            setIsLoading(false);
        }, (error) => {
            console.error("Error loading orders:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user, isUserLoading, db]);

    useEffect(() => {
        if (isUserLoading || !user) return;

        const q = query(
            collection(db, "public_orders"),
            where("userId", "==", user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as PublicOrder));
            setPublicOrders(data);
        }, (error) => {
            console.error("Error loading public orders:", error);
        });

        return () => unsubscribe();
    }, [user, isUserLoading, db]);

    const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
        try {
            const orderRef = doc(db, "orders", orderId);
            await updateDoc(orderRef, { status: newStatus });
        } catch (error) {
            console.error("Error updating status:", error);
        }
    };

    const handleDeleteOrder = async (orderId: string) => {
        if (!confirm("¿Estás seguro de eliminar este pedido? Esta acción no se puede deshacer.")) return;
        try {
            await deleteDoc(doc(db, "orders", orderId));
        } catch (error) {
            console.error("Error deleting order:", error);
        }
    };

    const handleRegisterPayment = async (amount: number, method: 'cash' | 'qr', proof?: string | null) => {
        if (!paymentOrder || !user) return;

        try {
            await addDoc(collection(db, "transactions"), {
                userId: user.uid,
                orderId: paymentOrder.id,
                amount: amount,
                method: method,
                proofUrl: proof || null,
                date: serverTimestamp(),
            });

            const newPaidAmount = (paymentOrder.paidAmount || 0) + amount;
            const newBalance = (paymentOrder.totalAmount || 0) - newPaidAmount;

            const orderRef = doc(db, "orders", paymentOrder.id);
            await updateDoc(orderRef, {
                paidAmount: newPaidAmount,
                balance: newBalance,
                status: newBalance <= 0 ? 'ready' : paymentOrder.status
            });

            toast({ title: "Pago registrado", description: `Se cobraron ${amount} Bs.` });
            setContentOpen(false);
            setPaymentOrder(null);
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Error al registrar pago" });
        }
    };

    const handleUpdatePaidAmount = async () => {
        if (!editAmountOrder || !user) return;

        try {
            const newPaidAmount = tempPaidAmount;
            const newBalance = (editAmountOrder.totalAmount || 0) - newPaidAmount;

            const orderRef = doc(db, "orders", editAmountOrder.id);
            await updateDoc(orderRef, {
                paidAmount: newPaidAmount,
                balance: newBalance,
                status: newBalance <= 0 ? 'ready' : editAmountOrder.status,
                updatedAt: serverTimestamp()
            });

            toast({ title: "Acompte corrigé", description: `Monto pagado actualizado a ${newPaidAmount} Bs.` });
            setIsEditAmountDialogOpen(false);
            setEditAmountOrder(null);
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Error al corregir acompte" });
        }
    };

    const uniqueColleges = Array.from(new Set(orders.map(o => o.college).filter(Boolean))).sort();

    const filteredOrders = orders.filter(order => {
        const matchesCollege = selectedCollege === "all" || order.college === selectedCollege;
        const matchesSearch = order.studentName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesPending = !filterPending || order.balance > 0;
        return matchesCollege && matchesSearch && matchesPending;
    });

    const activeProject = Object.values(projectConfigs).find(p => p.projectDetails.projectName === selectedCollege);

    if (isLoading) return <Loader text="Cargando pedidos..." />;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-slate-500 hover:text-primary -ml-2"
                        onClick={() => router.push('/workshop')}
                    >
                        <Scissors className="h-4 w-4" />
                        Taller
                    </Button>
                    <ArrowRight className="h-4 w-4 text-slate-300" />
                    <div>
                        <h1 className="text-3xl font-bold">Gestión de Pedidos</h1>
                        <p className="text-muted-foreground text-sm">Administra tus pedidos locales y pedidos recibidos en línea.</p>
                    </div>
                </div>
                {selectedCollege !== 'all' && (
                    <div className="flex flex-col md:flex-row gap-3 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="relative w-full md:w-[300px]">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar participante..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8 bg-white"
                            />
                        </div>
                        <div className="flex bg-white rounded-md shadow-sm border p-1 h-10 items-center">
                            <Button
                                variant={filterPending ? "default" : "ghost"}
                                size="sm"
                                onClick={() => setFilterPending(!filterPending)}
                                className="h-8 text-xs gap-1"
                            >
                                <CreditCard className="h-3.5 w-3.5" />
                                {filterPending ? "Mostrando Pendientes" : "Todos los Pagos"}
                            </Button>
                        </div>
                        <div className="w-full md:w-[250px] bg-white rounded-md shadow-sm border">
                            <Select value={selectedCollege} onValueChange={setSelectedCollege}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Filtrar por Cliente" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los Clientes</SelectItem>
                                    {uniqueColleges.map(c => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}
            </div>

            {selectedCollege !== 'all' && (
                <Card 
                    className="text-white overflow-hidden border-none shadow-xl"
                    style={{ backgroundColor: '#033E8C' }}
                >
                    <CardContent className="p-0">
                        <div className="flex flex-col md:flex-row">
                            <div className="p-6 md:w-2/3 space-y-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-white/60 hover:text-white -ml-2 gap-1 px-2"
                                            onClick={() => setSelectedCollege('all')}
                                        >
                                            <ArrowLeft className="h-4 w-4" />
                                            <span>Volver</span>
                                        </Button>
                                        <Badge className="bg-secondary text-secondary-foreground border-none">
                                            {activeProject ? 'Proyecto Activo' : 'Colegio / Grupo'}
                                        </Badge>
                                        {activeProject?.status && (
                                            <Badge variant="outline" className="text-white/60 border-white/20">
                                                {activeProject.status}
                                            </Badge>
                                        )}
                                    </div>
                                    <h2 className="text-3xl font-black tracking-tight">{selectedCollege}</h2>
                                    {activeProject && (
                                        <p className="text-white/70 font-medium">Cliente: <span className="text-white font-bold">{activeProject.projectDetails.clientName}</span></p>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-6 pt-2">
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase tracking-widest text-white/60 font-bold">Total Participantes</p>
                                        <p className="text-xl font-bold text-white">{participantsCount} <span className="text-sm font-normal text-white/50">registrados</span></p>
                                    </div>
                                    <div className="space-y-1 border-l border-white/10 pl-6">
                                        <p className="text-[10px] uppercase tracking-widest text-white/60 font-bold">Pedidos Directos</p>
                                        <p className="text-xl font-bold text-white">{filteredOrders.filter(o => o.type !== 'project_fitting').length} <span className="text-sm font-normal text-white/50">confirmados</span></p>
                                    </div>
                                    <div className="space-y-1 border-l border-white/10 pl-6">
                                        <p className="text-[10px] uppercase tracking-widest text-white/60 font-bold">Prendas Totales</p>
                                        <p className="text-xl font-bold text-secondary">
                                            {filteredOrders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            {activeProject && (
                                <div className="bg-white/5 p-6 md:w-1/3 border-l border-white/10 space-y-4">
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-white/50">Acciones del Proyecto</h4>
                                    <div className="grid grid-cols-1 gap-2">
                                        <Button
                                            variant="outline"
                                            className="justify-start bg-white/10 border-white/10 hover:bg-white/20 text-white h-9"
                                            size="sm"
                                            onClick={() => window.open(`/product-sheet/${activeProject.id}`, '_blank')}
                                        >
                                            <ImageIcon className="w-4 h-4 mr-2" /> Ficha de Producto
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="justify-start bg-white/10 border-white/10 hover:bg-white/20 text-white h-9"
                                            size="sm"
                                            onClick={() => window.open(`/materials/${activeProject.id}`, '_blank')}
                                        >
                                            <FileText className="w-4 h-4 mr-2" /> Resumen de Compra
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="justify-start bg-white/10 border-white/10 hover:bg-white/20 text-white h-9"
                                            size="sm"
                                            onClick={() => setShowSummary(!showSummary)}
                                        >
                                            <Printer className="w-4 h-4 mr-2" /> 
                                            {showSummary ? 'Ocultar Resumen' : 'Resumen para Confección'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                            {!activeProject && (
                                <div className="bg-white/5 p-6 md:w-1/3 border-l border-white/10 flex items-center justify-center">
                                    <Button
                                        variant="outline"
                                        className="bg-white/10 border-white/10 hover:bg-white/20 text-white h-12 px-6"
                                        onClick={() => setShowSummary(!showSummary)}
                                    >
                                        <Printer className="w-5 h-5 mr-2" />
                                        {showSummary ? 'Ocultar Resumen' : 'Resumen Confeccionista'}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                <Card className="bg-white border shadow-sm">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-blue-50 rounded-full">
                            <ShoppingBag className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Venta Total</p>
                            <p className="text-2xl font-bold">
                                {(
                                    filteredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0) +
                                    publicOrders.filter(o => selectedCollege === "all" || o.college === selectedCollege)
                                        .reduce((sum, o) => sum + (o.totalAmount || 0), 0)
                                ).toLocaleString()} Bs
                            </p>
                            <p className="text-[10px] text-muted-foreground">Incluye local + online</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border shadow-sm">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-green-50 rounded-full">
                            <DollarSign className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Total Cobrado</p>
                            <p className="text-2xl font-bold text-green-600">
                                {(
                                    filteredOrders.reduce((sum, o) => sum + (o.paidAmount || 0), 0) +
                                    publicOrders.filter(o => (selectedCollege === "all" || o.college === selectedCollege) && (o.status !== 'pending_payment' && o.status !== 'cancelled'))
                                        .reduce((sum, o) => sum + (o.totalAmount || 0), 0)
                                ).toLocaleString()} Bs
                            </p>
                            <p className="text-[10px] text-muted-foreground">Pagos verificados</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border shadow-sm">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-red-50 rounded-full">
                            <ClipboardList className="h-6 w-6 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Saldo Pendiente</p>
                            <p className="text-2xl font-bold text-red-600">
                                {(
                                    filteredOrders.reduce((sum, o) => sum + (o.balance || 0), 0) +
                                    publicOrders.filter(o => (selectedCollege === "all" || o.college === selectedCollege) && o.status === 'pending_payment')
                                        .reduce((sum, o) => sum + (o.totalAmount || 0), 0)
                                ).toLocaleString()} Bs
                            </p>
                            <p className="text-[10px] text-muted-foreground">Por cobrar</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {selectedCollege === "all" && uniqueColleges.length > 0 && (
                <div className="space-y-4 mb-8">
                    <h3 className="text-xl font-black flex items-center gap-2 uppercase tracking-tight text-slate-800">
                        <Users className="h-5 w-5 text-primary" />
                        Resumen por Cliente
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {uniqueColleges.map(c => {
                            const isProject = Object.values(projectConfigs).some(p => p.projectDetails.projectName === c);
                            const projectOrders = orders.filter(o => o.college === c);
                            const projectPublicOrders = publicOrders.filter(o => o.college === c);

                            const totalLocalAmount = projectOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
                            const totalOnlineAmount = projectPublicOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
                            const totalAmount = totalLocalAmount + totalOnlineAmount;

                            const pendingLocalBalance = projectOrders.reduce((sum, o) => sum + (o.balance || 0), 0);
                            const pendingOnlineAmount = projectPublicOrders.filter(o => o.status === 'pending_payment').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
                            const totalPending = pendingLocalBalance + pendingOnlineAmount;

                            return (
                                <Card
                                    key={c}
                                    className="hover:shadow-md hover:border-primary/50 transition-all cursor-pointer group bg-white border-slate-200"
                                    onClick={() => setSelectedCollege(c)}
                                >
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <Badge variant={isProject ? "default" : "outline"} className={isProject ? "bg-slate-900" : ""}>
                                                {isProject ? 'Proyecto' : 'Colegio'}
                                            </Badge>
                                            <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-primary transition-colors" />
                                        </div>
                                        <CardTitle className="text-base pt-2 group-hover:text-primary transition-colors">{c}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">Pedidos:</span>
                                            <span className="font-bold">{projectOrders.length + projectPublicOrders.length}</span>
                                        </div>
                                        {projectPublicOrders.length > 0 && (
                                            <div className="text-[10px] text-muted-foreground -mt-1 flex gap-2">
                                                <span>{projectOrders.length} local</span>
                                                <span>{projectPublicOrders.length} online</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">Venta:</span>
                                            <span className="font-bold">{totalAmount.toLocaleString()} Bs</span>
                                        </div>
                                        {totalPending > 0 && (
                                            <div className="flex justify-between text-xs text-red-600">
                                                <span>Pendiente:</span>
                                                <span className="font-bold">{totalPending.toLocaleString()} Bs</span>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}

            {showSummary && selectedCollege !== 'all' && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                    <ProductionSummary
                        orders={filteredOrders}
                        collegeName={selectedCollege}
                    />
                </div>
            )}

            {selectedCollege !== 'all' && (
                /* ─── FICHA UNIFICADA: se activa cuando hay un cliente seleccionado ─── */
                <ClientUnifiedView
                    selectedCollege={selectedCollege}
                    orders={filteredOrders}
                    projectConfigs={projectConfigs}
                    onPaymentClick={(order) => { setPaymentOrder(order); setContentOpen(true); }}
                    onStatusChange={handleStatusChange}
                    onDeleteOrder={handleDeleteOrder}
                    onEditAmountClick={(order) => {
                        setEditAmountOrder(order);
                        setTempPaidAmount(order.paidAmount || 0);
                        setIsEditAmountDialogOpen(true);
                    }}
                />
            )}

            <Dialog open={contentOpen} onOpenChange={setContentOpen}>
                <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
                    {paymentOrder && (
                        <div className="flex h-full">
                            <div className="w-1/3 bg-slate-50 border-r p-6 space-y-4">
                                <div>
                                    <h3 className="font-bold text-lg">Resumen de Pedido</h3>
                                    <p className="text-sm text-muted-foreground">{paymentOrder.studentName}</p>
                                    <p className="text-xs text-muted-foreground">{paymentOrder.college}</p>
                                </div>
                                <div className="space-y-2">
                                    {Object.entries(
                                        paymentOrder.items.reduce((acc, item) => {
                                            acc[item.productName] = (acc[item.productName] || 0) + item.quantity;
                                            return acc;
                                        }, {} as Record<string, number>)
                                    ).map(([name, qty], i) => (
                                        <div key={i} className="flex justify-between text-sm">
                                            <span>{name} x{qty}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="border-t pt-4 space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span>Total</span>
                                        <span className="font-medium">{paymentOrder.totalAmount} Bs</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-green-600">
                                        <span>Pagado</span>
                                        <span>{paymentOrder.paidAmount} Bs</span>
                                    </div>
                                    <div className="flex justify-between text-base font-bold text-red-600">
                                        <span>Saldo a Pagar</span>
                                        <span>{paymentOrder.balance} Bs</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 p-6">
                                <PaymentPanel
                                    total={paymentOrder.balance}
                                    onProcessPayment={handleRegisterPayment}
                                    isProcessing={false}
                                />
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={isEditAmountDialogOpen} onOpenChange={setIsEditAmountDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Corregir Acompte</DialogTitle>
                        <DialogDescription>
                            Ajusta el monto pagado hasta ahora por <strong>{editAmountOrder?.studentName}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="paidAmount">Monto Pagado (Bs)</Label>
                            <Input
                                id="paidAmount"
                                type="number"
                                value={tempPaidAmount}
                                onChange={(e) => setTempPaidAmount(Number(e.target.value))}
                                className="bg-white"
                            />
                        </div>
                        <div className="bg-slate-50 p-4 rounded-md space-y-1 text-sm border">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Total del pedido:</span>
                                <span className="font-bold">{editAmountOrder?.totalAmount} Bs</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Nuevo Saldo:</span>
                                <span className="font-bold text-red-600">{(editAmountOrder?.totalAmount || 0) - tempPaidAmount} Bs</span>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditAmountDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleUpdatePaidAmount}>Guardar Cambios</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function ProductionPage() {
    return (
        <Suspense fallback={null}>
            <ProductionPageContent />
        </Suspense>
    );
}
