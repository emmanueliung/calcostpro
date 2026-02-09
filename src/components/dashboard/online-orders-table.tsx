"use client";

import { useState } from 'react';
import { PublicOrder, PublicOrderStatus } from '@/lib/types';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OrderDetailDialog } from './order-detail-dialog';
import { Eye, Phone, Mail, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface OnlineOrdersTableProps {
    orders: PublicOrder[];
    onStatusChange: (orderId: string, newStatus: PublicOrderStatus) => void;
    onDeleteOrder?: (orderId: string) => void;
}

const statusConfig: Record<PublicOrderStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending_payment: { label: 'Pendiente Pago', variant: 'outline' },
    payment_verified: { label: 'Pago Verificado', variant: 'default' },
    in_production: { label: 'En Producción', variant: 'secondary' },
    ready: { label: 'Listo', variant: 'default' },
    delivered: { label: 'Entregado', variant: 'secondary' },
    cancelled: { label: 'Cancelado', variant: 'destructive' },
};

export function OnlineOrdersTable({ orders, onStatusChange, onDeleteOrder }: OnlineOrdersTableProps) {
    const [selectedOrder, setSelectedOrder] = useState<PublicOrder | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    const handleViewDetails = (order: PublicOrder) => {
        setSelectedOrder(order);
        setDialogOpen(true);
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return '-';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return format(date, 'dd/MM/yyyy HH:mm');
    };

    return (
        <>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Pedido</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Colegio</TableHead>
                            <TableHead>Items</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.map((order) => (
                            <TableRow key={order.id}>
                                <TableCell className="font-mono text-sm">
                                    #{order.id.slice(0, 8)}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        <span className="font-medium">{order.customer.name}</span>
                                        <div className="flex gap-2 text-xs text-muted-foreground">
                                            <a
                                                href={`mailto:${order.customer.email}`}
                                                className="flex items-center gap-1 hover:text-primary"
                                            >
                                                <Mail className="h-3 w-3" />
                                                {order.customer.email}
                                            </a>
                                        </div>
                                        <a
                                            href={`https://wa.me/591${order.customer.phone.replace(/\D/g, '')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
                                        >
                                            <Phone className="h-3 w-3" />
                                            {order.customer.phone}
                                        </a>
                                    </div>
                                </TableCell>
                                <TableCell>{order.college}</TableCell>
                                <TableCell>
                                    <span className="text-sm text-muted-foreground">
                                        {order.items.length} {order.items.length === 1 ? 'prenda' : 'prendas'}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                    {order.totalAmount.toFixed(2)} Bs
                                </TableCell>
                                <TableCell>
                                    <Badge variant={statusConfig[order.status].variant}>
                                        {statusConfig[order.status].label}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {formatDate(order.createdAt)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleViewDetails(order)}
                                        >
                                            <Eye className="h-4 w-4 mr-1" />
                                            Ver
                                        </Button>
                                        {onDeleteOrder && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => {
                                                    if (window.confirm('¿Está seguro de eliminar este pedido? Esta acción no se puede deshacer.')) {
                                                        onDeleteOrder(order.id);
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {selectedOrder && (
                <OrderDetailDialog
                    order={selectedOrder}
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    onStatusChange={onStatusChange}
                />
            )}
        </>
    );
}
