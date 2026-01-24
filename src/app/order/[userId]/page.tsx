"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CustomerInfo, OrderItem, College, PublicOrder } from '@/lib/types';
import { CollegeSelector } from '@/components/public/college-selector';
import { CustomerForm } from '@/components/public/customer-form';
import { PublicOrderPanel } from '@/components/public/public-order-panel';
import { QrPaymentDisplay } from '@/components/public/qr-payment-display';
import { useFirestore } from '@/firebase';
import { addDoc, collection, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { CheckCircle2, ShoppingCart, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function PublicOrderPage() {
    const params = useParams();
    const router = useRouter();
    const userId = params.userId as string;
    const db = useFirestore();
    const { toast } = useToast();

    // State
    const [selectedCollege, setSelectedCollege] = useState<College | null>(null);
    const [customer, setCustomer] = useState<CustomerInfo>({ name: '', email: '', phone: '' });
    const [items, setItems] = useState<OrderItem[]>([]);
    const [paymentProof, setPaymentProof] = useState<string>('');
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [orderSubmitted, setOrderSubmitted] = useState(false);
    const [orderId, setOrderId] = useState<string>('');
    const [workshopName, setWorkshopName] = useState<string>('');

    // Fetch workshop QR code and name
    useEffect(() => {
        const fetchWorkshopSettings = async () => {
            try {
                // Fetch QR code
                const settingsDoc = await getDoc(doc(db, 'settings', `workshop_${userId}`));
                if (settingsDoc.exists()) {
                    setQrCodeUrl(settingsDoc.data().qrCodeUrl || null);
                }

                // Fetch workshop name from user profile
                const userDoc = await getDoc(doc(db, 'users', userId));
                if (userDoc.exists()) {
                    setWorkshopName(userDoc.data().name || 'Taller');
                }
            } catch (error) {
                console.error('Error fetching workshop settings:', error);
            }
        };

        fetchWorkshopSettings();
    }, [userId, db]);

    const handleAddItem = (item: OrderItem) => {
        setItems([...items, item]);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const isFormValid = () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^(\+591)?[67]\d{7}$/;

        return (
            customer.name.trim() !== '' &&
            emailRegex.test(customer.email) &&
            phoneRegex.test(customer.phone.replace(/\s/g, '')) &&
            selectedCollege !== null &&
            items.length > 0 &&
            paymentProof !== ''
        );
    };

    const handleSubmitOrder = async () => {
        if (!isFormValid()) {
            toast({
                variant: 'destructive',
                title: 'Formulario incompleto',
                description: 'Por favor completa todos los campos y sube el comprobante de pago.'
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const orderData: Omit<PublicOrder, 'id'> = {
                userId: userId,
                customer: customer,
                college: selectedCollege!.name,
                items: items,
                status: 'pending_payment',
                totalAmount: totalAmount,
                paymentProofUrl: paymentProof,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            const orderRef = await addDoc(collection(db, 'public_orders'), orderData);
            setOrderId(orderRef.id);
            setOrderSubmitted(true);

            // Send notification email
            try {
                await fetch('/api/send-order-notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        orderId: orderRef.id,
                        customer: customer,
                        items: items,
                        totalAmount: totalAmount,
                        college: selectedCollege!.name,
                        workshopUserId: userId,
                    }),
                });
            } catch (emailError) {
                console.error('Error sending notification:', emailError);
                // Don't fail the order if email fails
            }

            toast({
                title: '¡Pedido enviado!',
                description: 'Recibirás una confirmación por email y WhatsApp pronto.',
            });

        } catch (error) {
            console.error('Error submitting order:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Hubo un problema al enviar tu pedido. Por favor intenta de nuevo.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (orderSubmitted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center space-y-6">
                    <div className="flex justify-center">
                        <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="h-12 w-12 text-green-600" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold text-green-600">¡Pedido Recibido!</h1>
                        <p className="text-muted-foreground">
                            Tu pedido ha sido enviado exitosamente.
                        </p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-lg border space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Número de pedido:</span>
                            <span className="font-mono font-semibold">#{orderId.slice(0, 8)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Total:</span>
                            <span className="font-bold">{totalAmount.toFixed(2)} Bs</span>
                        </div>
                    </div>

                    <Alert className="bg-blue-50 border-blue-200 text-left">
                        <AlertDescription className="text-sm text-blue-900">
                            <strong>Próximos pasos:</strong>
                            <ul className="list-disc list-inside mt-2 space-y-1">
                                <li>Recibirás un email de confirmación</li>
                                <li>El taller validará tu pago</li>
                                <li>Te contactaremos por WhatsApp para coordinar la entrega</li>
                            </ul>
                        </AlertDescription>
                    </Alert>

                    <p className="text-xs text-muted-foreground">
                        Si tienes preguntas, contáctanos al número que aparece en el email de confirmación.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10">
            {/* Header */}
            <div className="bg-white border-b shadow-sm">
                <div className="container mx-auto px-4 py-6">
                    <div className="flex items-center gap-3">
                        <ShoppingCart className="h-8 w-8 text-primary" />
                        <div>
                            <h1 className="text-2xl font-bold">Pedido de Uniformes</h1>
                            <p className="text-sm text-muted-foreground">
                                {workshopName || 'Cargando...'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* Left Column: College + Customer Info */}
                    <div className="lg:col-span-4 space-y-6">
                        <CollegeSelector
                            userId={userId}
                            onSelectCollege={setSelectedCollege}
                            selectedCollege={selectedCollege}
                        />
                        <CustomerForm
                            customer={customer}
                            onCustomerChange={setCustomer}
                        />
                    </div>

                    {/* Middle Column: Order Panel */}
                    <div className="lg:col-span-5">
                        <PublicOrderPanel
                            college={selectedCollege}
                            items={items}
                            onAddItem={handleAddItem}
                            onRemoveItem={handleRemoveItem}
                        />
                    </div>

                    {/* Right Column: Payment */}
                    <div className="lg:col-span-3">
                        <QrPaymentDisplay
                            qrCodeUrl={qrCodeUrl}
                            totalAmount={totalAmount}
                            onProofUpload={setPaymentProof}
                            proofUrl={paymentProof}
                        />
                    </div>
                </div>

                {/* Submit Button */}
                <div className="mt-8 max-w-2xl mx-auto">
                    <Button
                        size="lg"
                        className="w-full h-14 text-lg"
                        onClick={handleSubmitOrder}
                        disabled={!isFormValid() || isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Enviando Pedido...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="mr-2 h-5 w-5" />
                                Enviar Pedido ({totalAmount.toFixed(2)} Bs)
                            </>
                        )}
                    </Button>

                    {!isFormValid() && items.length > 0 && (
                        <p className="text-xs text-center text-muted-foreground mt-2">
                            Completa todos los campos y sube el comprobante de pago para continuar
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
