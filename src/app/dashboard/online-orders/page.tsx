"use client";

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, orderBy, doc, updateDoc } from 'firebase/firestore';
import { PublicOrder, PublicOrderStatus } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OnlineOrdersTable } from '@/components/dashboard/online-orders-table';
import { Loader2, ShoppingBag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function OnlineOrdersPage() {
    const { user } = useUser();
    const db = useFirestore();
    const { toast } = useToast();

    const [orders, setOrders] = useState<PublicOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<PublicOrderStatus | 'all'>('pending_payment');

    useEffect(() => {
        if (!user) return;

        const fetchOrders = async () => {
            try {
                const q = query(
                    collection(db, 'public_orders'),
                    where('userId', '==', user.uid),
                    orderBy('createdAt', 'desc')
                );

                const snapshot = await getDocs(q);
                const ordersData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as PublicOrder));

                setOrders(ordersData);
            } catch (error) {
                console.error('Error fetching orders:', error);
                toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: 'No se pudieron cargar las commandes.'
                });
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, [user, db, toast]);

    const handleStatusChange = async (orderId: string, newStatus: PublicOrderStatus) => {
        try {
            await updateDoc(doc(db, 'public_orders', orderId), {
                status: newStatus,
                updatedAt: new Date()
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

    const filteredOrders = activeTab === 'all'
        ? orders
        : orders.filter(order => order.status === activeTab);

    const getOrderCount = (status: PublicOrderStatus | 'all') => {
        if (status === 'all') return orders.length;
        return orders.filter(order => order.status === status).length;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <ShoppingBag className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">Commandes en Ligne</h1>
                        <p className="text-muted-foreground">
                            Gestiona los pedidos recibidos desde la página pública
                        </p>
                    </div>
                </div>
            </div>

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
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PublicOrderStatus | 'all')}>
                        <TabsList className="grid w-full grid-cols-6">
                            <TabsTrigger value="all">
                                Todos ({getOrderCount('all')})
                            </TabsTrigger>
                            <TabsTrigger value="pending_payment">
                                Pendiente ({getOrderCount('pending_payment')})
                            </TabsTrigger>
                            <TabsTrigger value="payment_verified">
                                Verificado ({getOrderCount('payment_verified')})
                            </TabsTrigger>
                            <TabsTrigger value="in_production">
                                Producción ({getOrderCount('in_production')})
                            </TabsTrigger>
                            <TabsTrigger value="ready">
                                Listo ({getOrderCount('ready')})
                            </TabsTrigger>
                            <TabsTrigger value="delivered">
                                Entregado ({getOrderCount('delivered')})
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </CardHeader>
                <CardContent>
                    {filteredOrders.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No hay pedidos en esta categoría</p>
                        </div>
                    ) : (
                        <OnlineOrdersTable
                            orders={filteredOrders}
                            onStatusChange={handleStatusChange}
                        />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
