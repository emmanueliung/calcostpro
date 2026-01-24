"use client";

import { useEffect, useState } from 'react';
import { useFirestore, useFirebaseApp } from '@/firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, getStorage } from 'firebase/storage';
import { Order, OrderItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/loader';
import { UploadCloud, CheckCircle, Smartphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function PublicPaymentPage({ params }: { params: { orderId: string } }) {
    const db = useFirestore();
    const app = useFirebaseApp();
    const storage = getStorage(app);
    const { toast } = useToast();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [success, setSuccess] = useState(false);
    const [amount, setAmount] = useState<string>('');

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                const docRef = doc(db, "orders", params.orderId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const orderData = { id: docSnap.id, ...docSnap.data() } as Order;
                    setOrder(orderData);
                    setAmount(orderData.balance.toString()); // Default to full balance
                }
            } catch (error) {
                console.error("Error fetching order:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchOrder();
    }, [db, params.orderId]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async () => {
        if (!file || !order || !storage) return;

        setUploading(true);
        try {
            // 1. Upload File
            const storageRef = ref(storage, `payment_proofs/${order.id}/${Date.now()}_${file.name}`);
            const uploadResult = await uploadBytes(storageRef, file);
            const downloadUrl = await getDownloadURL(uploadResult.ref);

            // 2. Create Transaction Request
            await addDoc(collection(db, "transactions"), {
                userId: order.userId, // Link to owner
                orderId: order.id,
                amount: parseFloat(amount),
                method: 'qr_remote',
                proofUrl: downloadUrl,
                status: 'pending_approval',
                date: serverTimestamp(),
            });

            setSuccess(true);
            toast({ title: 'Enviado', description: 'Tu comprobante ha sido enviado para validación.' });

        } catch (error) {
            console.error("Error uploading:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo subir el comprobante. Intenta nuevamente.' });
        } finally {
            setUploading(false);
        }
    };

    if (loading) return <div className="h-screen flex items-center justify-center"><Loader text="Cargando pedido..." /></div>;

    if (!order) return (
        <div className="h-screen flex items-center justify-center bg-gray-50 text-gray-500">
            Pedido no encontrado o enlace expirado.
        </div>
    );

    if (success) return (
        <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
            <Card className="max-w-md w-full text-center py-10">
                <CardContent className="flex flex-col items-center gap-4">
                    <CheckCircle className="h-16 w-16 text-green-500" />
                    <h2 className="text-2xl font-bold text-green-700">¡Comprobante Enviado!</h2>
                    <p className="text-gray-600">
                        El taller verificará tu pago y te notificará cuando tu pedido esté listo.
                    </p>
                </CardContent>
            </Card>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-100 py-10 px-4 flex justify-center">
            <Card className="max-w-md w-full h-fit">
                <CardHeader className="text-center border-b bg-gray-50/50">
                    <CardTitle className="text-xl">Pago de Pedido</CardTitle>
                    <CardDescription>{order.college}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">

                    {/* Student Info */}
                    <div className="text-center">
                        <p className="text-sm text-muted-foreground">Estudiante</p>
                        <p className="font-semibold text-lg">{order.studentName}</p>
                    </div>

                    {/* Order Summary */}
                    <div className="bg-slate-50 p-4 rounded-lg space-y-2 text-sm border">
                        {order.items.map((item, i) => (
                            <div key={i} className="flex justify-between">
                                <span>{item.quantity} x {item.productName}</span>
                                <span className="font-medium">{item.price * item.quantity} Bs</span>
                            </div>
                        ))}
                        <div className="border-t pt-2 mt-2 flex justify-between font-bold text-base">
                            <span>Total</span>
                            <span>{order.totalAmount} Bs</span>
                        </div>
                        <div className="flex justify-between text-red-500 font-bold">
                            <span>Saldo Pendiente</span>
                            <span>{order.balance} Bs</span>
                        </div>
                    </div>

                    {/* QR Code Section (Mock) */}
                    <div className="flex flex-col items-center gap-2 p-4 border-2 border-dashed rounded-xl bg-white">
                        <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Escanea para pagar</p>
                        {/* 
                           Ideally, this QR URL should be dynamic or pulled from UserProfile. 
                           For now, we use a placeholder or assume the parent has the code.
                           Let's use a generic QR placeholder for the demo.
                        */}
                        <div className="w-48 h-48 bg-gray-200 flex items-center justify-center rounded-lg">
                            <Smartphone className="h-12 w-12 text-gray-400" />
                            <span className="ml-2 text-gray-500 text-xs">QR del Taller</span>
                        </div>
                        <p className="text-xs text-center text-muted-foreground mt-2">
                            Realiza la transferencia por el monto indicado.
                        </p>
                    </div>

                    {/* Upload Section */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Monto Transferido</Label>
                            <Input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Subir Comprobante</Label>
                            <Input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="cursor-pointer"
                            />
                        </div>
                    </div>

                </CardContent>
                <CardFooter>
                    <Button
                        className="w-full"
                        size="lg"
                        onClick={handleSubmit}
                        disabled={uploading || !file || !amount}
                    >
                        {uploading ? (
                            <>Enviando...</>
                        ) : (
                            <>
                                <UploadCloud className="mr-2 h-4 w-4" /> Enviar Comprobante
                            </>
                        )}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
