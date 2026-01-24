
'use client';

import { useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { Header } from '@/components/header';
import { Loader } from '@/components/ui/loader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, writeBatch, doc, Timestamp, serverTimestamp } from "firebase/firestore";
import { sendNewUserEmail } from '@/ai/flows/send-new-user-email';


export default function RedeemPage() {
    const [user, authLoading] = useAuthState(auth);
    const router = useRouter();
    const { toast } = useToast();

    const [code, setCode] = useState('');
    const [isRedeeming, setIsRedeeming] = useState(false);

    const handleRedeem = async () => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Debes iniciar sesión para canjear un código.' });
            router.push('/login?redirect=/redeem');
            return;
        }
        if (!code) {
            toast({ variant: 'destructive', title: 'Error', description: 'Por favor, introduce un código.' });
            return;
        }
        setIsRedeeming(true);
        
        const bonusCodesRef = collection(db, "bonusCodes");
        const q = query(bonusCodesRef, where("code", "==", code));

        try {
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                throw new Error('El código introducido no es válido.');
            }

            const codeDoc = querySnapshot.docs[0];
            const codeData = codeDoc.data();

            if (codeData.isUsed) {
                throw new Error('Este código ya ha sido utilizado.');
            }

            const userRef = doc(db, "users", user.uid);
            const batch = writeBatch(db);

            // Update bonus code status
            batch.update(codeDoc.ref, {
                isUsed: true,
                usedBy: user.uid,
                usedAt: serverTimestamp(),
            });

            // Update user's plan
            const premiumUntil = new Date();
            premiumUntil.setDate(premiumUntil.getDate() + codeData.durationDays);

            batch.update(userRef, {
                plan: 'Premium',
                premiumUntil: Timestamp.fromDate(premiumUntil),
            });

            await batch.commit();
            
            sendNewUserEmail({
                email: user.email!,
                uid: user.uid,
                name: `Usuario Premium por código: ${code}`
            }).catch(console.error);

            toast({
                title: '¡Felicidades!',
                description: `¡Tu plan Premium ha sido activado por ${codeData.durationDays} días!`,
                duration: 7000,
            });
            router.push('/dashboard');

        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error al Canjear',
                description: error.message || 'No se pudo canjear el código.',
            });
        } finally {
            setIsRedeeming(false);
        }
    };

    if (authLoading) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 p-4 md:p-8">
                    <Loader text="Cargando..." />
                </main>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 p-4 md:p-8 flex items-center justify-center">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Canjear Código Bonus</CardTitle>
                        <CardDescription>Introduce tu código para activar tu plan Premium.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="bonus-code">Código Bonus</Label>
                            <Input
                                id="bonus-code"
                                placeholder="XXXX-XXXX-XXXX"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                disabled={isRedeeming}
                            />
                        </div>
                        <Button onClick={handleRedeem} disabled={isRedeeming || !code} className="w-full">
                            {isRedeeming ? 'Canjeando...' : 'Canjear Código'}
                        </Button>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
