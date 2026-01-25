"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { QrCode, Camera, CheckCircle2, Upload } from 'lucide-react';

interface QrPaymentDisplayProps {
    qrCodeUrl: string | null;
    totalAmount: number;
    onProofUpload: (proofUrl: string) => void;
    proofUrl: string | null;
}

export function QrPaymentDisplay({ qrCodeUrl, totalAmount, onProofUpload, proofUrl }: QrPaymentDisplayProps) {
    const [uploading, setUploading] = useState(false);

    const handleProofCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploading(true);
            const reader = new FileReader();
            reader.onloadend = () => {
                onProofUpload(reader.result as string);
                setUploading(false);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <QrCode className="h-5 w-5" />
                    Pago por QR
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

                {/* Amount to Pay */}
                <div className="bg-white p-4 rounded-lg border shadow-sm">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Monto a Pagar</p>
                    <p className="text-3xl font-bold text-primary">
                        {totalAmount.toFixed(2)} <span className="text-lg font-normal text-muted-foreground">Bs</span>
                    </p>
                </div>

                {/* QR Code Display */}
                {qrCodeUrl ? (
                    <div className="space-y-3">
                        <Alert className="bg-blue-50 border-blue-200">
                            <AlertDescription className="text-xs text-blue-900 flex gap-2 items-center">
                                <QrCode className="w-4 h-4" />
                                Escanea este código QR para realizar el pago
                            </AlertDescription>
                        </Alert>

                        <div className="flex justify-center bg-white p-4 border rounded-lg shadow-sm">
                            <img src={qrCodeUrl} alt="QR de Pago" className="h-48 w-48 object-contain" />
                        </div>
                    </div>
                ) : (
                    <Alert className="bg-yellow-50 border-yellow-200">
                        <AlertDescription className="text-xs text-yellow-900">
                            El taller no ha configurado un código QR. Por favor contacta directamente para coordinar el pago.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Proof Upload */}
                <div className="space-y-3 pt-3 border-t">
                    <Label className="text-sm font-semibold">Comprobante de Pago *</Label>
                    <Alert className="bg-amber-50 border-amber-200">
                        <AlertDescription className="text-xs text-amber-900">
                            Después de pagar, toma una captura de pantalla del comprobante y súbela aquí
                        </AlertDescription>
                    </Alert>

                    <Input
                        id="proof-upload-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleProofCapture}
                        disabled={uploading}
                    />

                    {!proofUrl ? (
                        <Button
                            variant="secondary"
                            className="w-full border-dashed border-2 h-14"
                            onClick={() => document.getElementById('proof-upload-input')?.click()}
                            disabled={uploading}
                        >
                            <Upload className="mr-2 h-5 w-5" />
                            {uploading ? 'Subiendo...' : 'Cargar un comprobante'}
                        </Button>
                    ) : (
                        <div className="relative h-40 w-full bg-slate-100 rounded-lg overflow-hidden group border-2 border-green-500">
                            <img src={proofUrl} alt="Comprobante" className="h-full w-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => onProofUpload('')}
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
            </CardContent>
        </Card>
    );
}
