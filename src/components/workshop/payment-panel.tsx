"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HandCoins, QrCode, CheckCircle2, Camera, Upload } from 'lucide-react';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'; // Import needed firestore functions
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PaymentPanelProps {
    total: number;
    onProcessPayment: (amount: number, method: 'cash' | 'qr', proof?: string | null) => void;
    isProcessing: boolean;
}

export function PaymentPanel({ total, onProcessPayment, isProcessing }: PaymentPanelProps) {

    const [amountToPay, setAmountToPay] = useState<string>('');
    const [method, setMethod] = useState<'cash' | 'qr'>('cash');

    const [savedQrCode, setSavedQrCode] = useState<string | null>(null);
    const [proofImage, setProofImage] = useState<string | null>(null);

    // Fetch Saved QR
    useEffect(() => {
        // We need user ID to fetch settings. 
        // NOTE: We don't have 'user' object here unless we use hook.
        // Assuming PaymentPanel is child of WorkshopPage which has auth, but let's just use the hook for simplicity.
        const fetchQr = async () => {
            // Dynamic import to avoid SSR issues if any, but standard hook is fine
            // For now, let's assume we can't easily access user ID without hook
        };
    }, []);

    // Better: useUser hook
    const { user } = useUser(); // We need to import this if not present
    const db = useFirestore(); // Import this

    useEffect(() => {
        if (!user) return;
        const fetchSettings = async () => {
            const { doc, getDoc } = await import('firebase/firestore');
            const d = await getDoc(doc(db, "settings", `workshop_${user.uid}`));
            if (d.exists()) {
                setSavedQrCode(d.data().qrCodeUrl);
            }
        };
        fetchSettings();
    }, [user, db]);

    // Handle Upload QR from Panel
    const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result as string;
            setSavedQrCode(base64String);

            try {
                // Save immediately
                await setDoc(doc(db, "settings", `workshop_${user.uid}`), {
                    qrCodeUrl: base64String,
                    updatedAt: serverTimestamp()
                }, { merge: true });
            } catch (e) {
                console.error("Error saving QR:", e);
            }
        };
        reader.readAsDataURL(file);
    };


    // Auto-fill amount to pay with 50% or Total when total changes
    useEffect(() => {
        if (total > 0 && !amountToPay) {
            setAmountToPay((total * 0.5).toString());
        }
    }, [total, amountToPay]);

    const handlePay = () => {
        let amount = parseFloat(amountToPay);
        if (isNaN(amount)) amount = 0;
        if (amount < 0) return;

        // Pass the proof image if QR
        // @ts-ignore
        onProcessPayment(amount, method, proofImage);
    };

    const setFullPayment = () => setAmountToPay(total.toString());
    const setHalfPayment = () => setAmountToPay((total * 0.5).toString());

    const handleProofCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProofImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <Card className="h-full flex flex-col bg-slate-50 border-slate-200">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg">Caja / Pagos</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between p-4 pt-0">

                {/* Visual Summary */}
                <div className="space-y-6">
                    <div className="bg-white p-4 rounded-lg border shadow-sm space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Total a Pagar</p>
                        <p className="text-3xl font-bold text-primary">{total.toFixed(2)} <span className="text-lg font-normal text-muted-foreground">Bs</span></p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label>Monto del Pago</Label>
                                <div className="flex gap-2">
                                    <Badge variant="outline" className="cursor-pointer hover:bg-secondary" onClick={setHalfPayment}>50%</Badge>
                                    <Badge variant="outline" className="cursor-pointer hover:bg-secondary" onClick={setFullPayment}>100%</Badge>
                                </div>
                            </div>
                            <Input
                                type="number"
                                className="text-lg font-bold"
                                value={amountToPay}
                                onChange={(e) => setAmountToPay(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Método de Pago</Label>
                            <Tabs value={method} onValueChange={(v) => setMethod(v as 'cash' | 'qr')} className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="cash">
                                        <HandCoins className="mr-2 h-4 w-4" /> Efectivo
                                    </TabsTrigger>
                                    <TabsTrigger value="qr">
                                        <QrCode className="mr-2 h-4 w-4" /> QR
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        <Button
                            className="w-full text-lg h-12 shadow-sm font-bold"
                            size="lg"
                            onClick={handlePay}
                            disabled={isProcessing}
                        >
                            {isProcessing ? 'Procesando...' : `Cobrar ${amountToPay || '0'} Bs`}
                        </Button>

                        {/* QR Display and Proof Upload */}
                        {method === 'qr' && (
                            <div className="bg-white p-3 rounded-lg border space-y-3 animate-in fade-in slide-in-from-top-2">
                                <Alert className="bg-blue-50 border-blue-200">
                                    <AlertDescription className="text-xs text-blue-900 flex gap-2 items-center">
                                        <QrCode className="w-4 h-4" /> Muestra este código al cliente
                                    </AlertDescription>
                                </Alert>

                                {savedQrCode ? (
                                    <div className="flex justify-center bg-white p-2 border rounded">
                                        <img src={savedQrCode} alt="QR Banco" className="h-40 w-40 object-contain" />
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg bg-slate-50 gap-2">
                                        <p className="text-xs text-center text-muted-foreground mb-2">
                                            No has configurado tu QR de Cobro.
                                        </p>
                                        <Input
                                            id="qr-upload-input"
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleQrUpload}
                                        />
                                        <Button size="sm" variant="outline" onClick={() => document.getElementById('qr-upload-input')?.click()}>
                                            <Upload className="mr-2 h-4 w-4" /> Subir QR Ahora
                                        </Button>
                                    </div>
                                )}

                                <div className="space-y-2 pt-2 border-t">
                                    <Label className="text-xs font-semibold">Comprobante de Pago</Label>

                                    <Input
                                        id="proof-upload-input"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleProofCapture}
                                    />

                                    {!proofImage ? (
                                        <Button
                                            variant="secondary"
                                            className="w-full border-dashed border-2 h-12"
                                            onClick={() => document.getElementById('proof-upload-input')?.click()}
                                        >
                                            <Upload className="mr-2 h-4 w-4" /> Cargar un comprobante
                                        </Button>
                                    ) : (
                                        <div className="relative h-32 w-full bg-slate-100 rounded-lg overflow-hidden group">
                                            <img src={proofImage} alt="Preview" className="h-full w-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button size="sm" variant="destructive" onClick={() => setProofImage(null)}>
                                                    Eliminar Comprobante
                                                </Button>
                                            </div>
                                            <div className="absolute bottom-2 right-2 bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center shadow-sm">
                                                <CheckCircle2 className="w-3 h-3 mr-1" /> Cargado
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Action */}
                {/* Bottom QR/Proof Info */}
                <div className="mt-4 space-y-3">
                    {method === 'qr' && !proofImage && (
                        <div className="bg-yellow-50 text-yellow-700 p-2 rounded-md text-xs flex gap-2 items-start">
                            <p>⚠️ Se recomienda subir foto del comprobante.</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
