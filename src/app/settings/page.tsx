"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type { UserProfileData } from '@/lib/types';
import { Header } from '@/components/header';
import { Loader } from '@/components/ui/loader';
import { FileUpload } from '@/components/ui/file-upload';
import Image from 'next/image';
import { Upload, X } from 'lucide-react';
import Link from 'next/link';

const EMPTY_PROFILE: Partial<UserProfileData> = {
    name: '',
    address: '',
    phone: '',
    taxId: '',
    taxPercentage: 0,
    logoUrl: '',
};

export default function SettingsPage() {
    const { user, isUserLoading } = useUser();
    const db = useFirestore();
    const { toast } = useToast();
    const [profile, setProfile] = useState<Partial<UserProfileData>>(EMPTY_PROFILE);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const [logoFile, setLogoFile] = useState<File | null>(null);

    useEffect(() => {
        if (isUserLoading) return;
        if (!user) {
            setIsLoading(false);
            // Optionally, redirect to login page
            return;
        }

        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setProfile(docSnap.data());
            } else {
                setProfile(EMPTY_PROFILE); // Set to empty if no profile exists
            }
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching user profile:", error);
            toast({
                variant: "destructive",
                title: "Error de Carga",
                description: "No se pudo cargar el perfil de la empresa.",
            });
            setIsLoading(false);
        });

        return () => unsubscribe(); // Cleanup listener on component unmount
        
    }, [user, isUserLoading, toast, db]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setProfile(p => ({ ...p, [id]: id === 'taxPercentage' ? Number(value) : value }));
    };
    
    const removeLogo = async () => {
        if (!user) return;
        const userDocRef = doc(db, 'users', user.uid);
        try {
            await updateDoc(userDocRef, { logoUrl: '' });
            toast({ title: 'Logo Eliminado', description: 'El logo ha sido eliminado.' });
        } catch (error) {
             console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el logo.' });
        }
    }

    const handleSaveChanges = async () => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Debes iniciar sesión para guardar.' });
            return;
        }
        setIsSaving(true);
        try {
            let logoDownloadURL = profile.logoUrl || '';

            // 1. Handle logo upload if a new file is selected
            if (logoFile) {
                const storage = getStorage();
                const storageRef = ref(storage, `users/${user.uid}/logo/${logoFile.name}`);
                const snapshot = await uploadBytes(storageRef, logoFile);
                logoDownloadURL = await getDownloadURL(snapshot.ref);
            }

            // 2. Prepare profile data
            const profileToSave: Partial<UserProfileData> = {
                name: profile.name || '',
                address: profile.address || '',
                phone: profile.phone || '',
                taxId: profile.taxId || '',
                taxPercentage: profile.taxPercentage || 0,
                logoUrl: logoDownloadURL, // Use the new or existing URL
            };

            // 3. Save everything to Firestore
            const userDocRef = doc(db, 'users', user.uid);
            await setDoc(userDocRef, profileToSave, { merge: true });

            toast({ title: 'Ajustes Guardados', description: 'La información de tu empresa ha sido actualizada.' });
            setLogoFile(null); // Clear the selected file after saving

        } catch (error) {
            console.error("Error saving settings: ", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron guardar los ajustes.' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isUserLoading || isLoading) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 p-4 md:p-8">
                     <Loader text="Cargando ajustes..." />
                </main>
            </div>
        )
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 p-4 md:p-8">
                 <div className="max-w-4xl mx-auto space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-2xl">Ajustes de la Empresa</CardTitle>
                            <CardDescription>
                               Edita la información y el logo que aparecerá en tus cotizaciones.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Nombre de la Empresa</Label>
                                    <Input id="name" value={profile.name || ''} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="taxId">NIT / Cédula de Identidad</Label>
                                    <Input id="taxId" value={profile.taxId || ''} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="address">Dirección</Label>
                                    <Input id="address" value={profile.address || ''} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Teléfono</Label>
                                    <Input id="phone" value={profile.phone || ''} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="taxPercentage">Porcentaje de Impuesto (p. ej., 14.94 para IVA+IT)</Label>
                                    <Input id="taxPercentage" type="number" value={profile.taxPercentage || 0} onChange={handleInputChange} />
                                </div>
                            </div>
                            
                            <div className="space-y-4 pt-6 border-t">
                                <Label>Logo de la Empresa</Label>
                                {profile.logoUrl && !logoFile ? (
                                    <div className="relative w-full h-32 rounded-md overflow-hidden border bg-white flex items-center justify-center">
                                        <Image src={profile.logoUrl} alt="Logo" layout="fill" objectFit="contain" className="p-2"/>
                                        <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7 z-10" onClick={removeLogo}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <FileUpload onFileSelect={setLogoFile} currentFile={logoFile} />
                                )}
                            </div>
                            
                             <Button onClick={handleSaveChanges} disabled={isSaving} className="w-full md:w-auto">
                                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Condiciones Comerciales</CardTitle>
                             <CardDescription>Edita los términos y condiciones que aparecen al final de tus cotizaciones.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <Button asChild>
                                <Link href="/conditions">Editar Condiciones</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
