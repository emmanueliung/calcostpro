"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import type { ProjectConfiguration, UserProfileData, LineItem } from '@/lib/types';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Header } from '@/components/header';
import { Loader } from '@/components/ui/loader';
import { useReactToPrint } from 'react-to-print';
import { ProductSheetDocument } from '@/components/product-sheet-document';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';

export default function ProductSheetPage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const params = useParams();
    const projectId = params.projectId as string;
    const db = useFirestore();

    const [project, setProject] = useState<ProjectConfiguration | null>(null);
    const [companyInfo, setCompanyInfo] = useState<UserProfileData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const printRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `Fiche Produit - ${project?.projectDetails.projectName || 'Proyecto'}`,
    });

    useEffect(() => {
        if (isUserLoading) return;
        if (!user) {
            router.push('/login');
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const projectRef = doc(db, 'projects', projectId);
                const projectSnap = await getDoc(projectRef);

                if (!projectSnap.exists() || projectSnap.data().userId !== user.uid) {
                    throw new Error('Proyecto no encontrado o sin permisos de acceso.');
                }
                const projectData = { id: projectSnap.id, ...projectSnap.data() } as ProjectConfiguration;

                const userRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userRef);
                const companyData = userSnap.exists() ? userSnap.data() as UserProfileData : null;
                
                setProject(projectData);
                setCompanyInfo(companyData);

            } catch (err: any) {
                console.error("Error loading project details:", err);
                const errorMessage = err.message || 'No se pudieron cargar los datos.';
                setError(errorMessage);
                toast({
                    variant: 'destructive',
                    title: 'Error de Carga',
                    description: errorMessage,
                });
            } finally {
                setIsLoading(false);
            }
        };

        if (projectId && user) {
            fetchData();
        }

    }, [user, isUserLoading, router, projectId, toast, db]);

    if (isLoading || isUserLoading) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 p-4 md:p-8">
                    <Loader text="Cargando ficha de producto..." />
                </main>
            </div>
        );
    }
    
    if (error) {
        return (
             <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 p-4 md:p-8 text-center">
                    <h2 className="text-xl text-destructive">Error al Cargar</h2>
                    <p className="mt-2">{error}</p>
                    <Button onClick={() => router.push('/dashboard')} className="mt-4">
                        Volver al Escritorio
                    </Button>
                </main>
            </div>
        )
    }

    return (
        <>
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 p-4 md:p-8">
                    <div className="max-w-4xl mx-auto space-y-6">
                         <div className="flex items-center justify-between no-print">
                            <Button variant="outline" onClick={() => router.back()}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Volver
                            </Button>
                            <Button onClick={handlePrint}>
                                <Printer className="mr-2 h-4 w-4" />
                                Imprimir Ficha
                            </Button>
                        </div>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-2xl">Ficha de Producto: {project?.projectDetails.projectName}</CardTitle>
                                <CardDescription>
                                    Este es un resumen visual de los productos a fabricar para el proyecto. Haga clic en "Imprimir Ficha" para generar el documento para su cliente.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-8">
                                {project?.lineItems.map((item) => (
                                    <div key={item.id}>
                                        <h3 className="text-xl font-semibold mb-4">{item.name}</h3>
                                        <div className="space-y-4">
                                            {item.description && (
                                                <div>
                                                    <h4 className="font-medium">Descripción</h4>
                                                    <p className="text-muted-foreground whitespace-pre-wrap">{item.description}</p>
                                                </div>
                                            )}
                                             <div>
                                                <h4 className="font-medium mb-2">Imágenes</h4>
                                                {item.productImageUrls && item.productImageUrls.length > 0 ? (
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                                        {item.productImageUrls.map((url) => (
                                                            <div key={url} className="relative aspect-square w-full rounded-lg overflow-hidden border">
                                                                <Image src={url} alt={item.name} fill className="object-cover" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                                                        <ImageIcon className="h-8 w-8 mb-2" />
                                                        <p>No hay imágenes para este producto.</p>
                                                    </div>
                                                )}
                                             </div>
                                        </div>
                                        <Separator className="my-8" />
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                </main>
            </div>
             {/* This part is only for printing */}
             <div className="hidden">
                <div className="print-block">
                    <ProductSheetDocument ref={printRef} project={project} company={companyInfo} />
                </div>
             </div>
        </>
    );
}
