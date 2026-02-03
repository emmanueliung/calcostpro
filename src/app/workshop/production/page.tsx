"use client";

import { useEffect, useState } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Order, OrderStatus, ProjectConfiguration, PublicOrder } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader } from '@/components/ui/loader';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Trash2, DollarSign, ShoppingBag, ClipboardList, Search, ArrowRight, ArrowLeft, Image as ImageIcon, FileText, Pencil, Printer } from 'lucide-react';
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

export default function ProductionPage() {
    const { user, isUserLoading } = useUser();
    const db = useFirestore();
    const { toast } = useToast();
    const [orders, setOrders] = useState<Order[]>([]);
    const [publicOrders, setPublicOrders] = useState<PublicOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCollege, setSelectedCollege] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");

    // Payment Modal State
    const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
    const [contentOpen, setContentOpen] = useState(false);
    const [projectConfigs, setProjectConfigs] = useState<Record<string, ProjectConfiguration>>({});

    // Edit Paid Amount State
    const [editAmountOrder, setEditAmountOrder] = useState<Order | null>(null);
    const [isEditAmountDialogOpen, setIsEditAmountDialogOpen] = useState(false);
    const [tempPaidAmount, setTempPaidAmount] = useState<number>(0);

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
        return matchesCollege && matchesSearch;
    });

    const activeProject = Object.values(projectConfigs).find(p => p.projectDetails.projectName === selectedCollege);

    if (isLoading) return <Loader text="Cargando pedidos..." />;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Gestión de Pedidos</h1>
                    <p className="text-muted-foreground text-sm">Administra tus pedidos locales y pedidos recibidos en línea.</p>
                </div>
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative w-full md:w-[300px]">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar estudiante..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 bg-white"
                        />
                    </div>
                    <div className="w-full md:w-[250px] bg-white rounded-md shadow-sm border">
                        <Select value={selectedCollege} onValueChange={setSelectedCollege}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filtrar por Colegio" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los Colegios</SelectItem>
                                {uniqueColleges.map(c => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {selectedCollege !== 'all' && (
                <Card className="bg-slate-900 text-white overflow-hidden border-none shadow-lg">
                    <CardContent className="p-0">
                        <div className="flex flex-col md:flex-row">
                            <div className="p-6 md:w-2/3 space-y-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-slate-400 hover:text-white -ml-2 gap-1 px-2"
                                            onClick={() => setSelectedCollege('all')}
                                        >
                                            <ArrowLeft className="h-4 w-4" />
                                            <span>Volver</span>
                                        </Button>
                                        <Badge className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/30">
                                            {activeProject ? 'Proyecto Activo' : 'Colegio / Grupo'}
                                        </Badge>
                                        {activeProject?.status && (
                                            <Badge variant="outline" className="text-slate-400 border-slate-700">
                                                {activeProject.status}
                                            </Badge>
                                        )}
                                    </div>
                                    <h2 className="text-3xl font-black tracking-tight">{selectedCollege}</h2>
                                    {activeProject && (
                                        <p className="text-slate-400 font-medium">Cliente: <span className="text-white">{activeProject.projectDetails.clientName}</span></p>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-6 pt-2">
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Producción Directa</p>
                                        <p className="text-xl font-bold">{filteredOrders.filter(o => o.type !== 'project_fitting').length} <span className="text-sm font-normal text-slate-500">estudiantes</span></p>
                                    </div>
                                    <div className="space-y-1 border-l border-slate-800 pl-6">
                                        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Medidas registradas</p>
                                        <p className="text-xl font-bold">{filteredOrders.filter(o => o.type === 'project_fitting').length} <span className="text-sm font-normal text-slate-500">participantes</span></p>
                                    </div>
                                    <div className="space-y-1 border-l border-slate-800 pl-6">
                                        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Prendas Totales</p>
                                        <p className="text-xl font-bold text-primary">
                                            {filteredOrders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            {activeProject && (
                                <div className="bg-slate-800/50 p-6 md:w-1/3 border-l border-slate-700 space-y-4">
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Acciones del Proyecto</h4>
                                    <div className="grid grid-cols-1 gap-2">
                                        <Button
                                            variant="outline"
                                            className="justify-start bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-300 h-9"
                                            size="sm"
                                            onClick={() => window.open(`/product-sheet/${activeProject.id}`, '_blank')}
                                        >
                                            <ImageIcon className="w-4 h-4 mr-2" /> Ficha de Producto
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="justify-start bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-300 h-9"
                                            size="sm"
                                            onClick={() => window.open(`/materials/${activeProject.id}`, '_blank')}
                                        >
                                            <FileText className="w-4 h-4 mr-2" /> Resumen de Compra
                                        </Button>
                                    </div>
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
                                    publicOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
                                ).toLocaleString()} Bs
                            </p>
                            <p className="text-[10px] text-muted-foreground">Incluye pedido online</p>
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
                                    publicOrders.reduce((sum, o) => (o.status !== 'pending_payment' && o.status !== 'cancelled') ? sum + (o.totalAmount || 0) : sum, 0)
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
                                    publicOrders.reduce((sum, o) => (o.status === 'pending_payment') ? sum + (o.totalAmount || 0) : sum, 0)
                                ).toLocaleString()} Bs
                            </p>
                            <p className="text-[10px] text-muted-foreground">Por cobrar</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {selectedCollege === "all" && uniqueColleges.length > 0 && (
                <div className="space-y-4 mb-8">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-primary" />
                        Seleccione un Proyecto o Colegio para gestionar
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {uniqueColleges.map(c => {
                            const isProject = Object.values(projectConfigs).some(p => p.projectDetails.projectName === c);
                            const projectOrders = orders.filter(o => o.college === c);
                            const totalAmount = projectOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
                            const pendingBalance = projectOrders.reduce((sum, o) => sum + (o.balance || 0), 0);

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
                                            <span className="font-bold">{projectOrders.length}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">Venta:</span>
                                            <span className="font-bold">{totalAmount.toLocaleString()} Bs</span>
                                        </div>
                                        {pendingBalance > 0 && (
                                            <div className="flex justify-between text-xs text-red-600">
                                                <span>Pendiente:</span>
                                                <span className="font-bold">{pendingBalance.toLocaleString()} Bs</span>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}

            <Tabs defaultValue="local" className="w-full">
                <TabsList className="bg-white border p-1 h-auto mb-6">
                    <TabsTrigger value="local" className="py-2 px-6 flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
                        <ClipboardList className="h-4 w-4" />
                        Venta Directa (Local)
                    </TabsTrigger>
                    <TabsTrigger value="online" className="py-2 px-6 flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
                        <ShoppingBag className="h-4 w-4" />
                        Tienda Online
                        <OnlineOrdersBadge />
                    </TabsTrigger>
                    <TabsTrigger value="summary" className="py-2 px-6 flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
                        <Printer className="h-4 w-4" />
                        Resumen Confeccionista
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="local" className="space-y-6 p-0 mt-0">
                    {publicOrders.filter(o => o.status === 'pending_payment').length > 0 && (
                        <Alert className="bg-blue-50 border-blue-200 mb-4 animate-in fade-in slide-in-from-top-2">
                            <ShoppingBag className="h-4 w-4 text-blue-600" />
                            <AlertTitle className="text-blue-800 font-bold">Tienes pedidos online pendientes</AlertTitle>
                            <AlertDescription className="text-blue-700 flex justify-between items-center">
                                Hay {publicOrders.filter(o => o.status === 'pending_payment').length} pedidos esperando validación de pago.
                                <Button
                                    variant="link"
                                    className="text-blue-800 font-bold p-0 h-auto"
                                    onClick={() => {
                                        const onlineTab = document.querySelector('[value="online"]') as HTMLElement;
                                        if (onlineTab) onlineTab.click();
                                    }}
                                >
                                    Ver Tienda Online <ArrowRight className="ml-1 h-3 w-3" />
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}
                    <Card className="h-full border-none shadow-none bg-transparent">
                        <CardHeader className="px-0 pt-0 flex flex-row items-center justify-between">
                            <CardTitle className="text-xl">Tablero de Producción Local</CardTitle>
                            <Badge variant="outline" className="text-sm">
                                {filteredOrders.length} pedidos encontrados
                            </Badge>
                        </CardHeader>

                        <CardContent className="px-0">
                            <div className="rounded-md border bg-white overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Estudiante / Colegio</TableHead>
                                            <TableHead>Items</TableHead>
                                            <TableHead>Total / Saldo</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead>Estado de Pago</TableHead>
                                            <TableHead className="w-[100px] text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredOrders.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                                    No hay pedidos locales registrados
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredOrders.map((order) => {
                                                const isPaid = order.balance <= 0;
                                                return (
                                                    <TableRow key={order.id}>
                                                        <TableCell className="text-xs text-muted-foreground">
                                                            {format(order.createdAt, 'dd MMM HH:mm', { locale: es })}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="font-medium">{order.studentName}</div>
                                                            <div className="text-xs text-muted-foreground">{order.college}</div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-col gap-1">
                                                                {Object.entries(
                                                                    order.items.reduce((acc, item) => {
                                                                        acc[item.productName] = (acc[item.productName] || 0) + item.quantity;
                                                                        return acc;
                                                                    }, {} as Record<string, number>)
                                                                ).map(([name, qty], idx) => (
                                                                    <span key={idx} className="text-xs bg-slate-100 px-2 py-0.5 rounded-full w-fit">
                                                                        {name} ({qty})
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="text-sm font-medium">{order.totalAmount} Bs</div>
                                                            {order.balance > 0 && (
                                                                <div className="text-xs text-red-500 font-bold">Deben: {order.balance} Bs</div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Select
                                                                defaultValue={order.status}
                                                                onValueChange={(val) => handleStatusChange(order.id, val as OrderStatus)}
                                                            >
                                                                <SelectTrigger className="w-[140px] h-8 text-xs">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="pending">Pendiente</SelectItem>
                                                                    <SelectItem value="in_production">En Producción</SelectItem>
                                                                    <SelectItem value="ready">Listo</SelectItem>
                                                                    <SelectItem value="delivered">Entregado</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant={isPaid ? 'default' : 'destructive'} className={isPaid ? 'bg-green-600 hover:bg-green-700' : ''}>
                                                                {isPaid ? 'Pagado' : 'Pendiente'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-1">
                                                                {!isPaid && (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-8 border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
                                                                        onClick={() => {
                                                                            setPaymentOrder(order);
                                                                            setContentOpen(true);
                                                                        }}
                                                                    >
                                                                        <DollarSign className="w-4 h-4 mr-1" /> Cobrar
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="w-8 h-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                                                    onClick={() => {
                                                                        setEditAmountOrder(order);
                                                                        setTempPaidAmount(order.paidAmount || 0);
                                                                        setIsEditAmountDialogOpen(true);
                                                                    }}
                                                                >
                                                                    <Pencil className="w-4 h-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="w-8 h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                                    onClick={() => handleDeleteOrder(order.id)}
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="online" className="p-0 mt-0">
                    <OnlineOrdersView />
                </TabsContent>

                <TabsContent value="summary" className="space-y-6 p-0 mt-0">
                    <ProductionSummary
                        orders={filteredOrders}
                        collegeName={selectedCollege}
                    />
                </TabsContent>
            </Tabs>

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
