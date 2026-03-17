"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirestore } from '@/firebase';
import { addDoc, collection, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { CheckCircle2, QrCode, Upload, Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { compressImage } from '@/lib/utils';
import { PublicOrder } from '@/lib/types';

export default function PublicPaymentPage() {
    const params = useParams();
    const userId = params.userId as string;
    const db = useFirestore();
    const { toast } = useToast();

    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [workshopName, setWorkshopName] = useState<string>('');
    const [note, setNote] = useState('');
    const [declaredAmount, setDeclaredAmount] = useState('');
    const [paymentProof, setPaymentProof] = useState<string>('');
    const [uploading, setUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [orderSubmitted, setOrderSubmitted] = useState(false);

    useEffect(() => {
        const fetchWorkshopSettings = async () => {
            try {
                const settingsDoc = await getDoc(doc(db, 'settings', `workshop_${userId}`));
                if (settingsDoc.exists()) {
                    setQrCodeUrl(settingsDoc.data().qrCodeUrl || null);
                }
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

    const handleProofCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploading(true);
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                try {
                    const compressed = await compressImage(base64);
                    setPaymentProof(compressed);
                } catch (err) {
                    console.error('Error compressing image:', err);
                    setPaymentProof(base64);
                }
                setUploading(false);
            };
            reader.readAsDataURL(file);
        }
    };

    const isFormValid = () => {
        return note.trim() !== '' && paymentProof !== '' && declaredAmount.trim() !== '';
    };

    const handleSubmitOrder = async () => {
        if (!isFormValid()) {
            toast({
                variant: 'destructive',
                title: 'Formulario incompleto',
                description: 'Por favor añade la nota, el monto y el comprobante de pago.'
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const orderData: Omit<PublicOrder, 'id'> = {
                userId: userId,
                status: 'pending_payment',
                totalAmount: Number(declaredAmount), // Mantenido por retrocompatibilidad
                declaredAmount: Number(declaredAmount),
                notes: note,
                paymentProofUrl: paymentProof,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            await addDoc(collection(db, 'public_orders'), orderData);
            setOrderSubmitted(true);

            toast({
                title: '¡Comprobante enviado!',
                description: 'Comprobante recibido exitosamente.',
            });

        } catch (error) {
            console.error('Error submitting order:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Hubo un problema al enviar. Por favor intenta de nuevo.',
            });
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
                    <div className="space-y-3">
                        <h1 className="text-2xl font-bold text-green-600">Comprobante recibido</h1>
                        <p className="text-muted-foreground">
                            Comprobante recibido. Te contactaremos por WhatsApp para confirmar tu pago.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg overflow-hidden border">
                {/* Header */}
                <div className="bg-primary/5 p-6 border-b text-center">
                    <h1 className="text-xl font-bold text-primary">Envío de Comprobante</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {workshopName || 'Cargando...'}
                    </p>
                </div>

                <div className="p-6 space-y-6">
                    {/* QR Code Display */}
                    {qrCodeUrl ? (
                        <div className="space-y-4">
                            <Alert className="bg-blue-50 border-blue-200">
                                <AlertDescription className="text-xs text-blue-900 flex gap-2 items-center justify-center font-medium">
                                    <QrCode className="w-4 h-4 text-blue-600" />
                                    Escanea o descarga el código QR para pagar
                                </AlertDescription>
                            </Alert>

                            <div className="flex justify-center bg-white p-4 border rounded-lg shadow-sm">
                                <img src={qrCodeUrl} alt="QR de Pago" className="h-48 w-48 object-contain" />
                            </div>

                            <div className="flex justify-center">
                                <a
                                    href={qrCodeUrl}
                                    download="qr-pago.png"
                                    className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
                                >
                                    <Download className="w-4 h-4" />
                                    Descargar QR
                                </a>
                            </div>
                        </div>
                    ) : (
                        <Alert className="bg-yellow-50 border-yellow-200">
                            <AlertDescription className="text-xs text-yellow-900">
                                El taller no ha configurado un código QR.
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Form Fields */}
                    <div className="space-y-4 pt-4 border-t">
                        <div className="space-y-2">
                            <Label htmlFor="note">¿Motivo del pago? *</Label>
                            <Input
                                id="note"
                                placeholder="Ej: Juan Pérez 6to A, Polera talla M Carlos Rojas..."
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="amount">Monto pagado (Bs) *</Label>
                            <Input
                                id="amount"
                                type="number"
                                placeholder="Ej: 150"
                                value={declaredAmount}
                                onChange={(e) => setDeclaredAmount(e.target.value)}
                                required
                                min="0"
                                step="0.1"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Comprobante de Pago *</Label>

                            <Input
                                id="proof-upload-input"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleProofCapture}
                                disabled={uploading || orderSubmitted}
                            />

                            {!paymentProof ? (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="w-full border-dashed border-2 h-14"
                                    onClick={() => document.getElementById('proof-upload-input')?.click()}
                                    disabled={uploading || orderSubmitted}
                                >
                                    <Upload className="mr-2 h-5 w-5" />
                                    {uploading ? 'Subiendo...' : 'Cargar un comprobante'}
                                </Button>
                            ) : (
                                <div className="relative h-40 w-full bg-slate-100 rounded-lg overflow-hidden group border-2 border-green-500">
                                    <img src={paymentProof} alt="Comprobante" className="h-full w-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => setPaymentProof('')}
                                            disabled={orderSubmitted}
                                        >
                                            Cambiar Comprobante
                                        </Button>
                                    </div>
                                    <div className="absolute bottom-2 right-2 bg-green-500 text-white text-xs px-3 py-1 rounded-full flex items-center shadow-lg">
                                        <CheckCircle2 className="w-4 h-4 mr-1" />
                                        Comprobante Cargado
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <Button
                        size="lg"
                        className="w-full h-14 text-lg"
                        onClick={handleSubmitOrder}
                        disabled={!isFormValid() || isSubmitting || orderSubmitted}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Enviando...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="mr-2 h-5 w-5" />
                                Enviar Comprobante
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
