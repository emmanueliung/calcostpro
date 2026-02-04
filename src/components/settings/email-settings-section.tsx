"use client";

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Mail, Save, User, Reply } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EmailSettings, UserProfileData } from '@/lib/types';

export function EmailSettingsSection() {
    const { user } = useUser();
    const db = useFirestore();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [settings, setSettings] = useState<EmailSettings>({
        senderName: '',
        replyTo: '',
        notifyWorkshopOnNewOrder: true,
        sendConfirmationToCustomer: true,
    });

    useEffect(() => {
        if (!user) return;

        const fetchSettings = async () => {
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    const data = userDoc.data() as UserProfileData;
                    if (data.emailSettings) {
                        setSettings(data.emailSettings);
                    } else {
                        // Initialize with defaults if not present
                        setSettings({
                            senderName: data.name || '',
                            replyTo: data.email || '',
                            notifyWorkshopOnNewOrder: true,
                            sendConfirmationToCustomer: true,
                        });
                    }
                }
            } catch (error) {
                console.error("Error fetching email settings:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, [user, db]);

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, "users", user.uid), {
                emailSettings: settings
            });
            toast({
                title: "Configuración guardada",
                description: "Los ajustes de email han sido actualizados.",
            });
        } catch (error) {
            console.error("Error saving email settings:", error);
            toast({
                variant: "destructive",
                title: "Error al guardar",
                description: "No se pudieron actualizar les ajustes de email.",
            });
        } finally {
            setSaving(false);
        }
    };

    const handleTestEmail = async () => {
        if (!user || !user.email) return;
        setTesting(true);
        try {
            const response = await fetch('/api/send-test-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: user.email,
                    name: settings.senderName || user.displayName || 'Usuario'
                }),
            });
            const data = await response.json();
            if (data.success) {
                toast({
                    title: "Email enviado",
                    description: `Se ha enviado un correo de prueba a ${user.email}`,
                });
            } else {
                throw new Error(data.error);
            }
        } catch (error: any) {
            console.error("Error testing email:", error);
            toast({
                variant: "destructive",
                title: "Error de envío",
                description: error.message || "No se pudo enviar el email de prueba. Verifica la configuración.",
            });
        } finally {
            setTesting(false);
        }
    };

    if (loading) return null;

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <Mail className="h-5 w-5 text-primary" />
                            Configuración de Emails
                        </CardTitle>
                        <CardDescription>
                            Personaliza cómo se envían las notificaciones de pedidos.
                        </CardDescription>
                    </div>
                    <Button onClick={handleSave} disabled={saving} size="sm">
                        {saving ? "Guardando..." : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                Guardar
                            </>
                        )}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="senderName" className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                Nombre del Remitente
                            </Label>
                            <Input
                                id="senderName"
                                placeholder="Ej: Taller de Confección"
                                value={settings.senderName}
                                onChange={(e) => setSettings({ ...settings, senderName: e.target.value })}
                            />
                            <p className="text-xs text-muted-foreground">
                                Este nombre aparecerá como el remitente de los correos.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="replyTo" className="flex items-center gap-2">
                                <Reply className="h-4 w-4" />
                                Email de Respuesta (Reply-To)
                            </Label>
                            <Input
                                id="replyTo"
                                type="email"
                                placeholder="tu@email.com"
                                value={settings.replyTo}
                                onChange={(e) => setSettings({ ...settings, replyTo: e.target.value })}
                            />
                            <p className="text-xs text-muted-foreground">
                                Si el cliente responde al correo, llegará a esta dirección.
                            </p>
                        </div>

                        <div className="pt-4">
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={handleTestEmail}
                                disabled={testing}
                            >
                                {testing ? "Enviando..." : "Enviar Email de Prueba"}
                            </Button>
                            <p className="text-[10px] text-muted-foreground mt-2 italic text-center">
                                Usa esto para verificar que las notificaciones funcionen correctamente.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-6 border-l pl-6">
                        <div className="flex items-center justify-between space-x-2">
                            <div className="space-y-0.5">
                                <Label className="text-base">Notificaciones al Taller</Label>
                                <p className="text-sm text-muted-foreground">
                                    Recibir un email cada vez que haya un nuevo pedido.
                                </p>
                            </div>
                            <Switch
                                checked={settings.notifyWorkshopOnNewOrder}
                                onCheckedChange={(checked) => setSettings({ ...settings, notifyWorkshopOnNewOrder: checked })}
                            />
                        </div>

                        <div className="flex items-center justify-between space-x-2">
                            <div className="space-y-0.5">
                                <Label className="text-base">Confirmación al Cliente</Label>
                                <p className="text-sm text-muted-foreground">
                                    Enviar automáticamente un email de confirmación al cliente.
                                </p>
                            </div>
                            <Switch
                                checked={settings.sendConfirmationToCustomer}
                                onCheckedChange={(checked) => setSettings({ ...settings, sendConfirmationToCustomer: checked })}
                            />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
