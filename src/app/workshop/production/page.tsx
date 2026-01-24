"use client";

import { useEffect, useState } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Order, OrderStatus } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader } from '@/components/ui/loader';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Trash2, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { PaymentPanel } from '@/components/workshop/payment-panel';
import { addDoc, serverTimestamp } from 'firebase/firestore';

// ... (existing constants)

export default function ProductionPage() {
    const { user, isUserLoading } = useUser();
    const db = useFirestore();
    const { toast } = useToast(); // Added usage
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCollege, setSelectedCollege] = useState<string>("all");

    // Payment Modal State
    const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
    const [contentOpen, setContentOpen] = useState(false);

    useEffect(() => {
        if (isUserLoading) return; // Wait for auth check

        if (!user) {
            setIsLoading(false); // Stop loading if no user
            return;
        }

        // Query active orders (not delivered, or all?)
        // Let's show all for now, maybe filter by status later
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

            // Client-side sort
            data.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

            setOrders(data);
            setIsLoading(false);
        }, (error) => {
            console.error("Error loading orders:", error);
            setIsLoading(false);
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
            // 1. Create Transaction
            await addDoc(collection(db, "transactions"), {
                userId: user.uid,
                orderId: paymentOrder.id,
                amount: amount,
                method: method,
                proofUrl: proof || null,
                date: serverTimestamp(),
            });

            // 2. Update Order
            const newPaidAmount = (paymentOrder.paidAmount || 0) + amount;
            const newBalance = (paymentOrder.totalAmount || 0) - newPaidAmount;

            const orderRef = doc(db, "orders", paymentOrder.id);
            await updateDoc(orderRef, {
                paidAmount: newPaidAmount,
                balance: newBalance,
                status: newBalance <= 0 ? 'ready' : paymentOrder.status // Optional: Auto update status? Maybe not.
            });

            toast({ title: "Pago registrado", description: `Se cobraron ${amount} Bs.` });
            setContentOpen(false);
            setPaymentOrder(null);
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Error al registrar pago" });
        }
    };

    // ... (Filter Logic)
    const uniqueColleges = Array.from(new Set(orders.map(o => o.college).filter(Boolean))).sort();

    const filteredOrders = orders.filter(order => {
        return selectedCollege === "all" || order.college === selectedCollege;
    });

    if (isLoading) return <Loader text="Cargando producción..." />;

    return (
        <Card className="h-full border-none shadow-none bg-transparent">
            {/* ... Header ... */}
            <CardHeader className="px-0 pt-0 flex flex-row items-center justify-between">
                <CardTitle className="text-2xl">Tablero de Producción</CardTitle>
                <div className="w-[250px]">
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
            </CardHeader>

            <CardContent className="px-0">
                <div className="rounded-md border bg-white">
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
                                        No hay pedidos registrados
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
                                                    {order.items.map((item, idx) => (
                                                        <span key={idx} className="text-xs bg-slate-100 px-2 py-0.5 rounded-full w-fit">
                                                            {item.productName} ({item.quantity})
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
                                    {paymentOrder.items.map((item, i) => (
                                        <div key={i} className="flex justify-between text-sm">
                                            <span>{item.productName} x{item.quantity}</span>
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
        </Card>
    );
}
