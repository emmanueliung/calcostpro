"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUser } from '@/firebase';
import { Link2, Copy, CheckCircle2, QrCode as QrCodeIcon, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import QRCode from 'qrcode';
import { useEffect } from 'react';

export function PublicLinkSection() {
    const { user } = useUser();
    const { toast } = useToast();
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
    const [copied, setCopied] = useState(false);

    const publicUrl = user
        ? `${window.location.origin}/order/${user.uid}`
        : '';

    useEffect(() => {
        if (publicUrl) {
            QRCode.toDataURL(publicUrl, {
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#ffffff',
                },
            })
                .then(setQrCodeDataUrl)
                .catch(console.error);
        }
    }, [publicUrl]);

    const handleCopyLink = () => {
        navigator.clipboard.writeText(publicUrl);
        setCopied(true);
        toast({
            title: '¡Copiado!',
            description: 'El enlace ha sido copiado al portapapeles.',
        });
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownloadQR = () => {
        if (!qrCodeDataUrl) return;

        const link = document.createElement('a');
        link.download = 'qr-pedidos-online.png';
        link.href = qrCodeDataUrl;
        link.click();
    };

    if (!user) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Link2 className="h-5 w-5" />
                    Enlace de Pedidos en Línea
                </CardTitle>
                <CardDescription>
                    Comparte este enlace con tus clientes para que puedan hacer pedidos directamente
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

                {/* Public URL */}
                <div className="space-y-2">
                    <Label htmlFor="public-url">Tu Enlace Público</Label>
                    <div className="flex gap-2">
                        <Input
                            id="public-url"
                            value={publicUrl}
                            readOnly
                            className="font-mono text-sm"
                        />
                        <Button
                            variant={copied ? 'default' : 'outline'}
                            onClick={handleCopyLink}
                            className="shrink-0"
                        >
                            {copied ? (
                                <>
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Copiado
                                </>
                            ) : (
                                <>
                                    <Copy className="h-4 w-4 mr-2" />
                                    Copiar
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* QR Code */}
                <div className="space-y-3">
                    <Label>Código QR del Enlace</Label>
                    <div className="flex flex-col md:flex-row gap-4 items-start">
                        {qrCodeDataUrl && (
                            <div className="bg-white p-4 border rounded-lg shadow-sm">
                                <img
                                    src={qrCodeDataUrl}
                                    alt="QR Code para pedidos"
                                    className="w-48 h-48"
                                />
                            </div>
                        )}
                        <div className="flex-1 space-y-3">
                            <Alert className="bg-blue-50 border-blue-200">
                                <AlertDescription className="text-sm text-blue-900">
                                    <strong>💡 Cómo usar:</strong>
                                    <ul className="list-disc list-inside mt-2 space-y-1">
                                        <li>Comparte el enlace por WhatsApp o redes sociales</li>
                                        <li>Imprime el código QR y colócalo en tu taller</li>
                                        <li>Los clientes podrán hacer pedidos 24/7</li>
                                        <li>Recibirás notificaciones por email</li>
                                    </ul>
                                </AlertDescription>
                            </Alert>

                            <div className="flex flex-col gap-2">
                                <Button
                                    variant="outline"
                                    onClick={handleDownloadQR}
                                    disabled={!qrCodeDataUrl}
                                    className="w-full"
                                >
                                    <QrCodeIcon className="h-4 w-4 mr-2" />
                                    Descargar QR Code
                                </Button>

                                <Button
                                    variant="default"
                                    onClick={() => window.open(publicUrl, '_blank')}
                                    className="w-full"
                                >
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Abrir Página de Pedidos
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Instructions */}
                <Alert>
                    <AlertDescription className="text-sm">
                        <strong>📋 Próximos pasos:</strong>
                        <ol className="list-decimal list-inside mt-2 space-y-1">
                            <li>Asegúrate de haber configurado tu código QR de pago en la sección de arriba</li>
                            <li>Configura tus colegios y precios en el módulo Workshop</li>
                            <li>Comparte el enlace con tus clientes</li>
                            <li>Gestiona los pedidos en la sección "Commandes en Ligne" del dashboard</li>
                        </ol>
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    );
}
