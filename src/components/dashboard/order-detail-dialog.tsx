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
import { Phone, Mail, MapPin, FileText, Image as ImageIcon, Banknote } from 'lucide-react';
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
    { value: 'cancelled', label: 'Rechazado / Cancelado' },
];

export function OrderDetailDialog({ order, open, onOpenChange, onStatusChange }: OrderDetailDialogProps) {
    const [selectedStatus, setSelectedStatus] = useState<PublicOrderStatus>(order.status);
    const [showProof, setShowProof] = useState(true);

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
                        <FileText className="h-5 w-5" />
                        Comprobante #{order.id.slice(0, 8)}
                    </DialogTitle>
                    <DialogDescription>
                        Recibido el {formatDate(order.createdAt)}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Header Info (Note & Amount) */}
                    <div className="bg-slate-50 p-4 rounded-lg border space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                    <FileText className="h-3 w-3" /> Nota / Identificación
                                </Label>
                                <p className="font-medium text-lg mt-1 whitespace-pre-wrap">
                                    {order.notes || order.customer?.name || 'Sin Nota'}
                                </p>
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Banknote className="h-3 w-3" /> Monto Declarado
                                </Label>
                                <p className="font-bold text-2xl text-primary mt-1">
                                    {(order.declaredAmount || order.totalAmount || 0).toFixed(2)} Bs
                                </p>
                            </div>
                        </div>

                        {/* Legacy Customer Info */}
                        {order.customer && (
                            <>
                                <Separator />
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {order.customer.name && (
                                        <div>
                                            <Label className="text-xs text-muted-foreground">Cliente (Legacy)</Label>
                                            <p className="font-medium text-sm">{order.customer.name}</p>
                                        </div>
                                    )}
                                    {order.customer.email && (
                                        <div>
                                            <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Mail className="h-3 w-3" /> Email
                                            </Label>
                                            <a href={`mailto:${order.customer.email}`} className="text-sm text-primary hover:underline">
                                                {order.customer.email}
                                            </a>
                                        </div>
                                    )}
                                    {order.customer.phone && (
                                        <div>
                                            <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Phone className="h-3 w-3" /> WhatsApp
                                            </Label>
                                            <a href={`https://wa.me/591${order.customer.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-sm text-green-600 hover:underline">
                                                {order.customer.phone}
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Payment Proof */}
                    {order.paymentProofUrl && (
                        <div>
                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                                <ImageIcon className="h-4 w-4" />
                                Imagen del Comprobante
                            </h3>
                            <div className="border rounded-lg p-4 bg-muted/30">
                                {!showProof ? (
                                    <Button variant="outline" onClick={() => setShowProof(true)} className="w-full">
                                        <ImageIcon className="mr-2 h-4 w-4" /> Ver Comprobante
                                    </Button>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex justify-center bg-white p-2 rounded border">
                                            <img
                                                src={order.paymentProofUrl}
                                                alt="Comprobante de pago"
                                                className="w-full max-h-[50vh] object-contain rounded"
                                            />
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => setShowProof(false)} className="w-full">
                                            Ocultar
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Legacy Order Items */}
                    {order.items && order.items.length > 0 && (
                        <div>
                            <h3 className="font-semibold mb-3">Prendas Pedidas (Legacy)</h3>
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50">
                                        <tr>
                                            <th className="text-left p-3">Prenda</th>
                                            <th className="text-center p-3">Cantidad</th>
                                            <th className="text-right p-3">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {order.items.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="p-3 font-medium">{item.productName}</td>
                                                <td className="p-3 text-center">{item.quantity}</td>
                                                <td className="p-3 text-right font-semibold">
                                                    {(item.price * item.quantity).toFixed(2)} Bs
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Status Management */}
                    <div>
                        <h3 className="font-semibold mb-3">Gestión de Verificación</h3>
                        <div className="space-y-4 bg-muted/30 p-4 rounded-lg">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Estado Actual</Label>
                                    <div className="mt-2">
                                        <Badge variant={order.status === 'pending_payment' ? 'outline' : order.status === 'cancelled' ? 'destructive' : 'default'} className="text-base py-1">
                                            {statusOptions.find(s => s.value === order.status)?.label || order.status}
                                        </Badge>
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

                            <Button
                                onClick={handleStatusUpdate}
                                disabled={selectedStatus === order.status}
                                className="w-full mt-2"
                                size="lg"
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
