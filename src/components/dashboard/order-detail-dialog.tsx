"use client";

import { useState } from 'react';
import { PublicOrder, PublicOrderStatus } from '@/lib/types';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Phone, Mail, MapPin, Package, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';

interface OrderDetailDialogProps {
    order: PublicOrder;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onStatusChange: (orderId: string, newStatus: PublicOrderStatus) => void;
}

const statusOptions: { value: PublicOrderStatus; label: string }[] = [
    { value: 'pending_payment', label: 'Pendiente de Pago' },
    { value: 'payment_verified', label: 'Pago Verificado' },
    { value: 'in_production', label: 'En Producción' },
    { value: 'ready', label: 'Listo para Entrega' },
    { value: 'delivered', label: 'Entregado' },
    { value: 'cancelled', label: 'Cancelado' },
];

export function OrderDetailDialog({ order, open, onOpenChange, onStatusChange }: OrderDetailDialogProps) {
    const [selectedStatus, setSelectedStatus] = useState<PublicOrderStatus>(order.status);
    const [showProof, setShowProof] = useState(false);

    const formatDate = (timestamp: any) => {
        if (!timestamp) return '-';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return format(date, 'dd/MM/yyyy HH:mm');
    };

    const handleStatusUpdate = () => {
        if (selectedStatus !== order.status) {
            onStatusChange(order.id, selectedStatus);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Detalle del Pedido #{order.id.slice(0, 8)}
                    </DialogTitle>
                    <DialogDescription>
                        Pedido recibido el {formatDate(order.createdAt)}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Customer Info */}
                    <div>
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Información del Cliente
                        </h3>
                        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs text-muted-foreground">Nombre</Label>
                                    <p className="font-medium">{order.customer.name}</p>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Colegio</Label>
                                    <p className="font-medium">{order.college}</p>
                                </div>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Mail className="h-3 w-3" /> Email
                                    </Label>
                                    <a
                                        href={`mailto:${order.customer.email}`}
                                        className="text-sm text-primary hover:underline"
                                    >
                                        {order.customer.email}
                                    </a>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Phone className="h-3 w-3" /> WhatsApp
                                    </Label>
                                    <a
                                        href={`https://wa.me/591${order.customer.phone.replace(/\D/g, '')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-green-600 hover:underline font-medium"
                                    >
                                        {order.customer.phone}
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Order Items */}
                    <div>
                        <h3 className="font-semibold mb-3">Prendas Pedidas</h3>
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="text-left p-3">Prenda</th>
                                        <th className="text-center p-3">Cantidad</th>
                                        <th className="text-right p-3">Precio Unit.</th>
                                        <th className="text-right p-3">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {order.items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="p-3 font-medium">{item.productName}</td>
                                            <td className="p-3 text-center">{item.quantity}</td>
                                            <td className="p-3 text-right">{item.price.toFixed(2)} Bs</td>
                                            <td className="p-3 text-right font-semibold">
                                                {(item.price * item.quantity).toFixed(2)} Bs
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-muted/50 font-bold">
                                    <tr>
                                        <td colSpan={3} className="p-3 text-right">Total:</td>
                                        <td className="p-3 text-right text-lg text-primary">
                                            {order.totalAmount.toFixed(2)} Bs
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Payment Proof */}
                    {order.paymentProofUrl && (
                        <div>
                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                                <ImageIcon className="h-4 w-4" />
                                Comprobante de Pago
                            </h3>
                            <div className="border rounded-lg p-4 bg-muted/30">
                                {!showProof ? (
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowProof(true)}
                                        className="w-full"
                                    >
                                        <ImageIcon className="mr-2 h-4 w-4" />
                                        Ver Comprobante
                                    </Button>
                                ) : (
                                    <div className="space-y-2">
                                        <img
                                            src={order.paymentProofUrl}
                                            alt="Comprobante de pago"
                                            className="w-full max-h-96 object-contain rounded border"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowProof(false)}
                                            className="w-full"
                                        >
                                            Ocultar
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Status Management */}
                    <div>
                        <h3 className="font-semibold mb-3">Gestión del Pedido</h3>
                        <div className="space-y-4 bg-muted/30 p-4 rounded-lg">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Estado Actual</Label>
                                    <div className="mt-2">
                                        <Badge>{statusOptions.find(s => s.value === order.status)?.label}</Badge>
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="new-status">Cambiar Estado</Label>
                                    <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as PublicOrderStatus)}>
                                        <SelectTrigger id="new-status" className="mt-2">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {statusOptions.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {order.notes && (
                                <div>
                                    <Label>Notas</Label>
                                    <Textarea
                                        value={order.notes}
                                        readOnly
                                        className="mt-2 bg-white"
                                        rows={3}
                                    />
                                </div>
                            )}

                            <Button
                                onClick={handleStatusUpdate}
                                disabled={selectedStatus === order.status}
                                className="w-full"
                            >
                                Actualizar Estado
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
