"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, X } from 'lucide-react';
import { useUser, useFirestore } from '@/firebase';
import { Header } from '@/components/header';
import { Loader } from '@/components/ui/loader';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc, updateDoc, writeBatch, collection, query, where, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';


const PREMIUM_USERS = [
    'isabel.osinaga.molina@gmail.com',
    'amparoosinagamolina@gmail.com',
    'adrianaosinaga@gmail.com',
];

const ENTERPRISE_USERS = [
    'emmanuel.iung@gmail.com',
    'creacionesmolinao@gmail.com'
];

const GRATUITO_FEATURES = [
    { text: '5 cotizaciones', included: true },
    { text: 'Gestión de materiales', included: true },
    { text: 'Gestión de medidas', included: true },
    { text: 'Proyectos ilimitados', included: false },
    { text: 'Soporte prioritario', included: false },
];

const PREMIUM_FEATURES = [
    { text: 'Cotizaciones ilimitadas', included: true },
    { text: 'Gestión de materiales avanzada', included: true },
    { text: 'Gestión de medidas y confirmaciones', included: true },
    { text: 'Proyectos ilimitados', included: true },
    { text: 'Soporte prioritario por WhatsApp', included: true },
];

const ENTERPRISE_FEATURES = [
    { text: 'Toutes les fonctionnalités Premium', included: true },
    { text: "Module de gestion de l'atelier (Guichet)", included: true },
    { text: 'Analyse de rentabilité par projet', included: true },
    { text: 'Support technique dédié', included: true },
    { text: 'Accès multi-utilisateurs (bientôt)', included: true },
    { text: 'Exportation de données avancée', included: true },
];


export default function SubscriptionPage() {
    const { user, isUserLoading } = useUser();
    const db = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const [isClient, setIsClient] = useState(false);
    const [bonusCode, setBonusCode] = useState('');
    const [isRedeeming, setIsRedeeming] = useState(false);


    useEffect(() => {
        setIsClient(true);
    }, []);

    const currentPlan: 'Premium' | 'Gratuito' | 'Entreprise' = useMemo(() => {
        if (!user || !user.email) return 'Gratuito';
        if (ENTERPRISE_USERS.includes(user.email)) return 'Entreprise';
        if (PREMIUM_USERS.includes(user.email)) return 'Premium';
        return 'Gratuito';
    }, [user]);

    const handleRedeemCode = async () => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Debes iniciar sesión para canjear un código.' });
            return;
        }
        if (!bonusCode.trim()) {
            toast({ variant: 'destructive', title: 'Error', description: 'Por favor, introduce un código válido.' });
            return;
        }

        setIsRedeeming(true);

        const codesRef = collection(db, 'bonusCodes');
        const q = query(codesRef, where('code', '==', bonusCode.trim()));

        try {
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                toast({ variant: 'destructive', title: 'Código no válido', description: 'El código introducido no existe.' });
                setIsRedeeming(false);
                return;
            }

            const codeDoc = querySnapshot.docs[0];
            const codeData = codeDoc.data();

            if (codeData.isUsed) {
                toast({ variant: 'destructive', title: 'Código ya utilizado', description: 'Este código ya ha sido canjeado.' });
                setIsRedeeming(false);
                return;
            }

            // Batch write to ensure atomicity
            const batch = writeBatch(db);

            // Update bonus code
            const codeDocRef = doc(db, 'bonusCodes', codeDoc.id);
            batch.update(codeDocRef, {
                isUsed: true,
                usedBy: user.uid,
                usedAt: serverTimestamp()
            });

            // Update user's plan
            const userDocRef = doc(db, 'users', user.uid);
            batch.update(userDocRef, {
                plan: 'Premium',
                subscriptionType: 'bonus_code',
                subscriptionEndsAt: new Date(Date.now() + codeData.durationDays * 24 * 60 * 60 * 1000)
            });

            await batch.commit();

            toast({
                title: '¡Felicidades!',
                description: `Has activado el plan Premium por ${codeData.durationDays} días.`
            });

            // Refresh the page or user data to reflect the new plan
            router.refresh();

        } catch (error: any) {
            console.error("Error redeeming code:", error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'No se pudo canjear el código. Inténtalo de nuevo más tarde.'
            });
        } finally {
            setIsRedeeming(false);
            setBonusCode('');
        }
    };


    if (!isClient || isUserLoading) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 p-4 md:p-8">
                    <Loader text="Cargando información de suscripción..." />
                </main>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-7xl mx-auto space-y-12">
                    <div className="text-center">
                        <h1 className="text-4xl font-bold tracking-tight">Elige el Plan Perfecto para Ti</h1>
                        <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
                            Desde el inicio rápido hasta la escala profesional, tenemos un plan que se ajusta a tus necesidades de producción.
                        </p>
                    </div>

                    <Card className="w-full max-w-2xl mx-auto">
                        <CardHeader>
                            <CardTitle>¿Tienes un Código Bonus?</CardTitle>
                            <CardDescription>Introdúcelo aquí para activar tu plan Premium.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col sm:flex-row gap-4 items-end">
                            <div className="w-full space-y-2">
                                <Label htmlFor="bonus-code">Código Bonus</Label>
                                <Input
                                    id="bonus-code"
                                    placeholder="XXXX-XXXX-XXXX"
                                    value={bonusCode}
                                    onChange={(e) => setBonusCode(e.target.value)}
                                    disabled={isRedeeming}
                                />
                            </div>
                            <Button
                                className="w-full sm:w-auto"
                                onClick={handleRedeemCode}
                                disabled={isRedeeming}
                            >
                                {isRedeeming ? 'Canjeando...' : 'Canjear Código'}
                            </Button>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                        {/* Plan Gratuito */}
                        <Card className={currentPlan === 'Gratuito' ? 'border-primary border-2' : 'border-muted'}>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-2xl">Gratuito</CardTitle>
                                    {currentPlan === 'Gratuito' && <Badge variant="default">Plan Actual</Badge>}
                                </div>
                                <CardDescription>Para empezar y probar la plataforma.</CardDescription>
                                <div className="text-4xl font-bold">Bs. 0<span className="text-lg font-normal text-muted-foreground">/mes</span></div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <ul className="space-y-3">
                                    {GRATUITO_FEATURES.map(feature => (
                                        <li key={feature.text} className="flex items-center gap-3">
                                            {feature.included ? <Check className="h-5 w-5 text-green-500" /> : <X className="h-5 w-5 text-destructive" />}
                                            <span className="text-muted-foreground">{feature.text}</span>
                                        </li>
                                    ))}
                                </ul>
                                <Button className="w-full" variant={currentPlan !== 'Gratuito' ? 'outline' : 'default'} disabled={currentPlan === 'Gratuito'}>
                                    Estás en el Plan Gratuito
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Plan Premium */}
                        <Card className={currentPlan === 'Premium' ? 'border-primary border-2 shadow-lg' : 'border-muted'}>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-2xl">Premium</CardTitle>
                                    {currentPlan === 'Premium' && <Badge variant="default">Plan Actual</Badge>}
                                </div>
                                <CardDescription>Para profesionales y talleres en crecimiento.</CardDescription>
                                <div className="text-4xl font-bold">Bs. 99<span className="text-lg font-normal text-muted-foreground">/mes</span></div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <ul className="space-y-3">
                                    {PREMIUM_FEATURES.map(feature => (
                                        <li key={feature.text} className="flex items-center gap-3">
                                            <Check className="h-5 w-5 text-green-500" />
                                            <span>{feature.text}</span>
                                        </li>
                                    ))}
                                </ul>
                                {currentPlan === 'Premium' ? (
                                    <Button className="w-full" disabled>Ya eres Premium</Button>
                                ) : (
                                    <Button asChild className="w-full">
                                        <a href="https://wa.me/59177699920?text=Hola,%20estoy%20interesado%20en%20el%20plan%20Premium%20de%20CalcostPro." target="_blank" rel="noopener noreferrer">
                                            Contactar para Activar
                                        </a>
                                    </Button>
                                )}
                            </CardContent>
                        </Card>

                        {/* Plan Entreprise */}
                        <Card className={currentPlan === 'Entreprise' ? 'border-primary border-2' : 'border-muted'}>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-2xl">Entreprise</CardTitle>
                                    {currentPlan === 'Entreprise' && <Badge variant="default">Plan Actual</Badge>}
                                </div>
                                <CardDescription>Para empresas que buscan la máxima eficiencia.</CardDescription>
                                <div className="text-4xl font-bold">Bs. 119<span className="text-lg font-normal text-muted-foreground">/mes</span></div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <ul className="space-y-3">
                                    {ENTERPRISE_FEATURES.map(feature => (
                                        <li key={feature.text} className="flex items-center gap-3">
                                            <Check className="h-5 w-5 text-green-500" />
                                            <span>{feature.text}</span>
                                        </li>
                                    ))}
                                </ul>
                                {currentPlan === 'Entreprise' ? (
                                    <Button className="w-full" disabled>Ya estás en el plan Entreprise</Button>
                                ) : (
                                    <Button asChild className="w-full">
                                        <a href="https://wa.me/59177699920?text=Hola,%20estoy%20interesado%20en%20el%20plan%20Entreprise%20de%20CalcostPro." target="_blank" rel="noopener noreferrer">
                                            Contactar para Activar
                                        </a>
                                    </Button>
                                )}
                            </CardContent>
                        </Card>

                    </div>
                </div>
            </main>
        </div>
    );
}
