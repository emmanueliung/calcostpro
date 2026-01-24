"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QrCode, Upload, Trash2, CheckCircle2 } from 'lucide-react';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export function PaymentQrSection() {
    const { user } = useUser();
    const db = useFirestore();
    const { toast } = useToast();
    const [savedQrCode, setSavedQrCode] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (!user) return;
        const unsubscribe = onSnapshot(doc(db, "settings", `workshop_${user.uid}`), (docSnap) => {
            if (docSnap.exists()) {
                setSavedQrCode(docSnap.data().qrCodeUrl || null);
            }
        });
        return () => unsubscribe();
    }, [user, db]);

    if (!user) return null;

    const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        setIsUploading(true);
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result as string;

            try {
                await setDoc(doc(db, "settings", `workshop_${user.uid}`), {
                    qrCodeUrl: base64String,
                    updatedAt: serverTimestamp()
                }, { merge: true });

                toast({
                    title: "QR de Pago actualizado",
                    description: "Tus clientes ahora verán este código para pagar."
                });
            } catch (e) {
                console.error("Error saving QR:", e);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "No se pudo guardar le code QR."
                });
            } finally {
                setIsUploading(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const removeQr = async () => {
        if (!user) return;
        if (!confirm("¿Estás seguro de eliminar tu QR de pago?")) return;

        try {
            await setDoc(doc(db, "settings", `workshop_${user.uid}`), {
                qrCodeUrl: null,
                updatedAt: serverTimestamp()
            }, { merge: true });

            toast({
                title: "QR eliminado",
                description: "Se ha eliminado tu código QR de pago."
            });
        } catch (e) {
            console.error("Error removing QR:", e);
        }
    };

    return (
        <Card className="border-primary/20 shadow-md">
            <CardHeader className="pb-3 bg-primary/5">
                <div className="flex items-center gap-2">
                    <QrCode className="h-5 w-5 text-primary" />
                    <CardTitle className="text-xl">Configuración de Cobro (Tu QR Bancario)</CardTitle>
                </div>
                <CardDescription>
                    Sube el código QR de tu banco o Tigo Money. Este es el QR que tus clientes escanearán para pagarte.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-8 items-start">
                    <div className="flex-1 space-y-4">
                        <div className="bg-muted/30 p-4 rounded-lg border border-dashed border-muted-foreground/30">
                            <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ¿Cómo funciona?
                            </h4>
                            <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-4">
                                <li>Tus clientes verán este QR al terminar su pedido.</li>
                                <li>Podrán escanearlo desde su app bancaria.</li>
                                <li>Se les pedirá subir una foto del comprobante de transferencia.</li>
                                <li>Recibirás una notificación por email con cada nuevo pedido.</li>
                            </ul>
                        </div>

                        <div className="space-y-3">
                            <Label htmlFor="qr-upload" className="font-bold">Actualizar QR de Pago</Label>
                            <div className="flex gap-4">
                                <Input
                                    id="qr-upload"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleQrUpload}
                                    className="max-w-xs"
                                    disabled={isUploading}
                                />
                                {savedQrCode && (
                                    <Button variant="outline" size="icon" onClick={removeQr} className="text-destructive border-destructive hover:bg-destructive/10">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                            <p className="text-[10px] text-muted-foreground Sans control">
                                Formatos admitidos: PNG, JPG. Tamaño máx recomendado: 1MB.
                            </p>
                        </div>
                    </div>

                    <div className="w-full md:w-64 flex flex-col items-center gap-4">
                        <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tu QR de Banco (Pago)</Label>
                        <div className="relative aspect-square w-full max-w-[200px] bg-white border-2 border-dashed rounded-xl flex items-center justify-center overflow-hidden shadow-inner group">
                            {savedQrCode ? (
                                <>
                                    <img src={savedQrCode} alt="Tu QR de Pago" className="p-2 object-contain w-full h-full" />
                                    <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                        <QrCode className="h-12 w-12 text-primary/40" />
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center gap-2 text-muted-foreground p-4 text-center">
                                    <Upload className="h-8 w-8 opacity-20" />
                                    <p className="text-xs italic">Ningún QR seleccionado</p>
                                </div>
                            )}
                        </div>
                        {savedQrCode && (
                            <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                                <CheckCircle2 className="mr-1 h-3 w-3" /> Configurado
                            </Badge>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
