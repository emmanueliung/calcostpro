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
import { Eye, Trash2, Check, X, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';

interface OnlineOrdersTableProps {
    orders: PublicOrder[];
    onStatusChange: (orderId: string, newStatus: PublicOrderStatus) => void;
    onDeleteOrder?: (orderId: string) => void;
}

const statusConfig: Record<PublicOrderStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending_payment: { label: 'Pendiente', variant: 'outline' },
    payment_verified: { label: 'Verificado', variant: 'default' },
    in_production: { label: 'En Producción', variant: 'secondary' },
    ready: { label: 'Listo', variant: 'default' },
    delivered: { label: 'Entregado', variant: 'secondary' },
    cancelled: { label: 'Rachazado', variant: 'destructive' },
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
                            <TableHead>Fecha</TableHead>
                            <TableHead>Nota / Identificación</TableHead>
                            <TableHead>Monto Declarado</TableHead>
                            <TableHead>Comprobante</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.map((order) => (
                            <TableRow key={order.id}>
                                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                    {formatDate(order.createdAt)}
                                </TableCell>
                                <TableCell>
                                    <div className="font-medium text-primary">
                                        {order.notes || order.customer?.name || 'Sin Nota'}
                                    </div>
                                    {order.college && (
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {order.college} {order.items && order.items.length > 0 && `(${order.items.length} items)`}
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="font-semibold">
                                    {(order.declaredAmount || order.totalAmount || 0).toFixed(2)} Bs
                                </TableCell>
                                <TableCell>
                                    {order.paymentProofUrl ? (
                                        <div 
                                            className="w-12 h-12 bg-gray-100 rounded border cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center overflow-hidden"
                                            onClick={() => handleViewDetails(order)}
                                        >
                                            <img src={order.paymentProofUrl} alt="Comprobante" className="w-full h-full object-cover" />
                                        </div>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">Sin imagen</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Badge variant={statusConfig[order.status]?.variant || 'default'}>
                                        {statusConfig[order.status]?.label || order.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        {order.status === 'pending_payment' && (
                                            <>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                                    onClick={() => onStatusChange(order.id, 'payment_verified')}
                                                    title="Verificar"
                                                >
                                                    <Check className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => onStatusChange(order.id, 'cancelled')}
                                                    title="Rechazar"
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleViewDetails(order)}
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        {onDeleteOrder && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => {
                                                    if (window.confirm('¿Está seguro de eliminar este comprobante?')) {
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
