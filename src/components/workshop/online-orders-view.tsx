"use client";

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { PublicOrder, PublicOrderStatus } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OnlineOrdersTable } from '@/components/dashboard/online-orders-table';
import { Loader2, ShoppingBag, AlertCircle, Calculator } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MaterialNeeds } from './material-needs';

export function OnlineOrdersView() {
    const { user } = useUser();
    const db = useFirestore();
    const { toast } = useToast();

    const [orders, setOrders] = useState<PublicOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<PublicOrderStatus | 'all' | 'needs'>('pending_payment');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'public_orders'),
            where('userId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            try {
                const ordersData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as PublicOrder)).sort((a, b) => {
                    const getTime = (timestamp: any) => {
                        if (!timestamp) return 0;
                        if (timestamp.toDate) return timestamp.toDate().getTime();
                        return new Date(timestamp).getTime() || 0;
                    };
                    return getTime(b.createdAt) - getTime(a.createdAt);
                });

                setOrders(ordersData);
                setError(null);
            } catch (err) {
                console.error('Error processing orders:', err);
                setError('Error al procesar los datos de los pedidos.');
            } finally {
                setLoading(false);
            }
        }, (err) => {
            console.error('Error fetching orders:', err);
            setError(`No se pudieron cargar los pedidos: ${err.message}`);
            setLoading(false);
            toast({
                variant: 'destructive',
                title: 'Error de conexión',
                description: 'No tienes permisos o hubo un error al conectar con la base de datos.'
            });
        });

        return () => unsubscribe();
    }, [user, db, toast]);

    const handleStatusChange = async (orderId: string, newStatus: PublicOrderStatus) => {
        try {
            await updateDoc(doc(db, 'public_orders', orderId), {
                status: newStatus,
                updatedAt: serverTimestamp()
            });

            setOrders(orders.map(order =>
                order.id === orderId ? { ...order, status: newStatus } : order
            ));

            toast({
                title: 'Estado actualizado',
                description: 'El estado del pedido ha sido actualizado correctamente.'
            });
        } catch (error) {
            console.error('Error updating status:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'No se pudo actualizar el estado.'
            });
        }
    };

    const handleDeleteOrder = async (orderId: string) => {
        try {
            await deleteDoc(doc(db, 'public_orders', orderId));
            setOrders(orders.filter(order => order.id !== orderId));
            toast({
                title: 'Pedido eliminado',
                description: 'El pedido ha sido eliminado correctamente.'
            });
        } catch (error) {
            console.error('Error deleting order:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'No se pudo eliminar el pedido.'
            });
        }
    };

    const filteredOrders = activeTab === 'all'
        ? orders
        : orders.filter(order => order.status === activeTab);

    const getOrderCount = (status: PublicOrderStatus | 'all') => {
        if (status === 'all') return orders.length;
        return orders.filter(order => order.status === status).length;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => window.location.reload()}
                >
                    Reintentar
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Pendientes de Pago
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">
                            {getOrderCount('pending_payment')}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Pago Verificado
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                            {getOrderCount('payment_verified')}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            En Producción
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-600">
                            {getOrderCount('in_production')}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Pedidos
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">
                            {orders.length}
                        </div>
                    </CardContent>
                </Card>
            </div>


            {/* Orders Table */}
            <Card>
                <CardHeader>
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                        <TabsList className="grid w-full grid-cols-7 h-auto p-1 bg-muted/30">
                            <TabsTrigger value="all" className="text-xs py-2">
                                Todos ({getOrderCount('all')})
                            </TabsTrigger>
                            <TabsTrigger value="pending_payment" className="text-xs py-2">
                                Pendiente ({getOrderCount('pending_payment')})
                            </TabsTrigger>
                            <TabsTrigger value="payment_verified" className="text-xs py-2">
                                Verificado ({getOrderCount('payment_verified')})
                            </TabsTrigger>
                            <TabsTrigger value="in_production" className="text-xs py-2">
                                Producción ({getOrderCount('in_production')})
                            </TabsTrigger>
                            <TabsTrigger value="ready" className="text-xs py-2">
                                Listo ({getOrderCount('ready')})
                            </TabsTrigger>
                            <TabsTrigger value="delivered" className="text-xs py-2">
                                Entregado ({getOrderCount('delivered')})
                            </TabsTrigger>
                            <TabsTrigger value="needs" className="text-xs py-2 font-bold text-primary">
                                <Calculator className="h-3 w-3 mr-1" /> Cálculo Insumos
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </CardHeader>
                <CardContent>
                    {activeTab === 'needs' ? (
                        <MaterialNeeds orders={orders.filter(o => o.status !== 'cancelled')} />
                    ) : filteredOrders.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No hay pedidos en esta categoría</p>
                            <p className="text-xs mt-2">Asegúrate de que tus clientes estén usando tu enlace público de la sección de Configuración.</p>
                        </div>
                    ) : (
                        <OnlineOrdersTable
                            orders={filteredOrders}
                            onStatusChange={handleStatusChange}
                            onDeleteOrder={handleDeleteOrder}
                        />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
