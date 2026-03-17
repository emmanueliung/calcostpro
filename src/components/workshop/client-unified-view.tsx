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
import { DollarSign, Users, ClipboardList, CreditCard, QrCode, Pencil, Trash2, CheckCircle2, AlertCircle, UserCheck, Shirt } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ClientUnifiedViewProps {
    selectedCollege: string;
    orders: Order[];
    projectConfigs: Record<string, ProjectConfiguration>;
    onPaymentClick: (order: Order) => void;
    onStatusChange: (orderId: string, status: OrderStatus) => void;
    onDeleteOrder: (orderId: string) => void;
    onEditAmountClick: (order: Order) => void;
}

export function ClientUnifiedView({
    selectedCollege,
    orders,
    projectConfigs,
    onPaymentClick,
    onStatusChange,
    onDeleteOrder,
    onEditAmountClick,
}: ClientUnifiedViewProps) {
    const { user } = useUser();
    const db = useFirestore();

    // Participants state
    const [participants, setParticipants] = useState<Student[]>([]);
    const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);
    const [savedQrCode, setSavedQrCode] = useState<string | null>(null);

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

    return (
        <Tabs defaultValue="produccion" className="w-full">
            <TabsList className="bg-white border p-1 h-auto mb-6">
                <TabsTrigger
                    value="participantes"
                    className="py-2 px-5 flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white group"
                >
                    <Users className="h-4 w-4" />
                    Participantes
                    <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white">
                        {participants.length}
                    </span>
                </TabsTrigger>
                <TabsTrigger
                    value="produccion"
                    className="py-2 px-5 flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white group"
                >
                    <ClipboardList className="h-4 w-4" />
                    Producción
                    <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white">
                        {orders.length}
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

            {/* ─── TAB 1: PARTICIPANTES ─── */}
            <TabsContent value="participantes" className="mt-0">
                <Card className="border shadow-sm">
                    <CardHeader className="pb-3 border-b">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <UserCheck className="h-4 w-4 text-primary" />
                                Participantes de {selectedCollege}
                            </CardTitle>
                            <Badge variant="outline">{participants.length} registrados</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoadingParticipants ? (
                            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                                Cargando participantes...
                            </div>
                        ) : participants.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                                <Users className="h-8 w-8 opacity-30" />
                                <p className="text-sm">No hay participantes registrados para este cliente.</p>
                                <p className="text-xs">Ve al <strong>Taller</strong> para registrar participantes.</p>
                            </div>
                        ) : (
                            <ScrollArea className="max-h-[800px]">
                                <Table>
                                    <TableHeader>
                                            <TableHead className="font-semibold">Participante</TableHead>
                                            <TableHead className="text-center">Pedido</TableHead>
                                            {allGarmentNames.map(g => (
                                                <TableHead key={g} className="text-center">
                                                    <span className="flex items-center justify-center gap-1">
                                                        <Shirt className="h-3 w-3" />
                                                        {g}
                                                    </span>
                                                </TableHead>
                                            ))}
                                            <TableHead className="text-center font-semibold">Tallas</TableHead>
                                    </TableHeader>
                                    <TableBody>
                                        {participants.map((p) => {
                                            const hasSizes = Object.keys(p.sizes || {}).length > 0;
                                            const completedCount = allGarmentNames.filter(g => p.sizes?.[g]).length;
                                            const isComplete = allGarmentNames.length > 0 && completedCount === allGarmentNames.length;
                                            return (
                                                <TableRow key={p.id} className="hover:bg-slate-50/50">
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${isComplete ? 'bg-green-500' : 'bg-slate-300'}`}>
                                                                {p.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-sm">{p.name}</p>
                                                                {p.notes && <p className="text-[10px] text-muted-foreground">{p.notes}</p>}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {orders.some(o => o.studentName.toLowerCase() === p.name.toLowerCase()) ? (
                                                            <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none text-[10px]">
                                                                Confirmado
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50 animate-pulse text-[10px]">
                                                                Falta Pedido
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    {allGarmentNames.map(g => (
                                                        <TableCell key={g} className="text-center">
                                                            {p.sizes?.[g] ? (
                                                                <Badge variant="secondary" className="text-xs font-bold">
                                                                    {p.sizes[g]}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-muted-foreground/40 text-xs">—</span>
                                                            )}
                                                        </TableCell>
                                                    ))}
                                                    <TableCell className="text-center">
                                                        {allGarmentNames.length === 0 ? (
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                        ) : isComplete ? (
                                                            <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                                                        ) : (
                                                            <span className="text-xs text-amber-600 font-medium">
                                                                {completedCount}/{allGarmentNames.length}
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>

            {/* ─── TAB 2: PRODUCCIÓN ─── */}
            <TabsContent value="produccion" className="mt-0">
                <Card className="border-none shadow-none bg-transparent">
                    <CardHeader className="px-0 pt-0 flex flex-row items-center justify-between">
                        <CardTitle className="text-xl">Tablero de Producción</CardTitle>
                        <Badge variant="outline" className="text-sm">{orders.length} pedidos</Badge>
                    </CardHeader>
                    <CardContent className="px-0">
                        <div className="rounded-md border bg-white overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Participante / Cliente</TableHead>
                                        <TableHead>Items</TableHead>
                                        <TableHead>Total / Saldo</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead>Estado de Pago</TableHead>
                                        <TableHead className="w-[100px] text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {orders.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                                No hay pedidos registrados para este cliente
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        orders.map((order) => {
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
                                                            onValueChange={(val) => onStatusChange(order.id, val as OrderStatus)}
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
                                                                    onClick={() => onPaymentClick(order)}
                                                                >
                                                                    <DollarSign className="w-4 h-4 mr-1" /> Cobrar
                                                                </Button>
                                                            )}
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="w-8 h-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                                                onClick={() => onEditAmountClick(order)}
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="w-8 h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                                onClick={() => onDeleteOrder(order.id)}
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

            {/* ─── TAB 3: COBROS ─── */}
            <TabsContent value="cobros" className="mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left: Summary + List of pending */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Summary cards */}
                        <div className="grid grid-cols-3 gap-3">
                            <Card className="bg-slate-50 border">
                                <CardContent className="p-4">
                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Venta Total</p>
                                    <p className="text-2xl font-bold">{totalVenta.toLocaleString()}</p>
                                    <p className="text-xs text-muted-foreground">Bs</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-green-50 border-green-100">
                                <CardContent className="p-4">
                                    <p className="text-[10px] uppercase tracking-widest text-green-600 font-bold mb-1">Cobrado</p>
                                    <p className="text-2xl font-bold text-green-700">{totalCobrado.toLocaleString()}</p>
                                    <p className="text-xs text-green-600">Bs · {paidOrders.length} pagados</p>
                                </CardContent>
                            </Card>
                            <Card className={totalPendiente > 0 ? "bg-red-50 border-red-100" : "bg-green-50 border-green-100"}>
                                <CardContent className="p-4">
                                    <p className={`text-[10px] uppercase tracking-widest font-bold mb-1 ${totalPendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>Saldo Pendiente</p>
                                    <p className={`text-2xl font-bold ${totalPendiente > 0 ? 'text-red-700' : 'text-green-700'}`}>{totalPendiente.toLocaleString()}</p>
                                    <p className={`text-xs ${totalPendiente > 0 ? 'text-red-500' : 'text-green-500'}`}>Bs · {pendingOrders.length} pendientes</p>
                                </CardContent>
                            </Card>
                        </div>

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
                        <Card className="border shadow-sm">
                            <CardHeader className="pb-3 border-b">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <QrCode className="h-4 w-4 text-primary" />
                                    QR de Cobro
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-3">
                                {savedQrCode ? (
                                    <>
                                        <div className="flex justify-center bg-white p-3 border rounded-lg">
                                            <img src={savedQrCode} alt="QR Bancario" className="h-44 w-44 object-contain" />
                                        </div>
                                        <p className="text-xs text-center text-muted-foreground">
                                            Muestra este QR al cliente para que realice el pago bancario.
                                        </p>
                                        {totalPendiente > 0 && (
                                            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-center">
                                                <p className="text-xs text-amber-700 font-medium">Monto a cobrar</p>
                                                <p className="text-2xl font-black text-amber-800">{totalPendiente.toLocaleString()} Bs</p>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg bg-slate-50 gap-3 text-center">
                                        <QrCode className="h-10 w-10 text-muted-foreground/30" />
                                        <p className="text-sm text-muted-foreground">
                                            No has configurado tu QR de cobro.
                                        </p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => window.open('/workshop/settings', '_blank')}
                                        >
                                            Configurar QR
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </TabsContent>
        </Tabs>
    );
}
