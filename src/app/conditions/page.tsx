"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Loader } from '@/components/ui/loader';
import { Header } from '@/components/header';

export default function ConditionsPage() {
    const { user, isUserLoading } = useUser();
    const db = useFirestore();
    const { toast } = useToast();
    const [conditions, setConditions] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!user && !isUserLoading) {
            setIsLoading(false);
            // Optionally, redirect to login
            return;
        }

        if (user) {
            const userDocRef = doc(db, 'users', user.uid);
            getDoc(userDocRef).then((docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setConditions(data.conditions || '1. **Validez de la oferta:** La presente cotización es válida por 30 días a partir de la fecha de emisión.\n2. **Adelanto:** Se requiere un adelanto del 50% del total para iniciar la producción. El 50% restante deberá ser cancelado contra entrega.\n3. **Plazo de entrega:** El plazo de entrega estimado es de 15 a 20 días hábiles a partir de la confirmación del pedido y la recepción del adelanto.\n4. **Tolerancia de producción:** Se contempla una tolerancia de producción de +/- 3% sobre la cantidad total solicitada.\n5. **Aprobación de muestras:** Cualquier producción en masa requiere la aprobación previa de una muestra física por parte del cliente. Cambios solicitados después de la aprobación de la muestra podrían incurrir en costos adicionales.\n6. **Transporte:** El costo de envío no está incluido en esta cotización, salvo que se especifique lo contrario. El envío corre por cuenta y riesgo del cliente.\n7. **Cancelaciones:** En caso de cancelación del pedido una vez iniciada la producción, el adelanto no será reembolsable para cubrir los costos de materiales y mano de obra incurridos.');
                }
                setIsLoading(false);
            });
        }
    }, [user, isUserLoading, db]);

    const handleSaveChanges = async () => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Debes iniciar sesión para guardar.' });
            return;
        }
        setIsSaving(true);
        try {
            const userDocRef = doc(db, 'users', user.uid);
            await setDoc(userDocRef, { conditions: conditions }, { merge: true });
            toast({ title: 'Condiciones Guardadas', description: 'Tus condiciones comerciales han sido actualizadas.' });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron guardar las condiciones.' });
        } finally {
            setIsSaving(false);
        }
    };
    
    if (isUserLoading || isLoading) {
        return <Loader text="Cargando condiciones..." />;
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 p-4 md:p-8">
                 <div className="max-w-4xl mx-auto">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-2xl">Condiciones Comerciales del Devis</CardTitle>
                            <CardDescription>
                                Edita el texto que aparecerá en la sección "Condiciones" de tus cotizaciones. 
                                Puedes usar Markdown para dar formato (p. ej., **texto en negrita** o `1. ` para listas).
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Textarea
                                value={conditions}
                                onChange={(e) => setConditions(e.target.value)}
                                rows={15}
                                placeholder="Escribe aquí tus condiciones comerciales..."
                            />
                            <Button onClick={handleSaveChanges} disabled={isSaving}>
                                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
