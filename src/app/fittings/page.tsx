"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import type { ProjectConfiguration } from '@/lib/types';
import { Loader } from '@/components/ui/loader';
import { Header } from '@/components/header';

// Helper function to safely convert various date formats to a Date object
const toDate = (dateValue: any): Date | null => {
    if (!dateValue) return null;
    if (dateValue instanceof Date) return dateValue;
    if (dateValue instanceof Timestamp) return dateValue.toDate();
    if (typeof dateValue === 'string') {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }
    // Handle Firestore serverTimestamp which might be pending
    if (typeof dateValue === 'object' && dateValue.seconds) {
        return new Date(dateValue.seconds * 1000);
    }
    return null;
}

export default function FittingsLandingPage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const db = useFirestore();
    const [projects, setProjects] = useState<ProjectConfiguration[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isUserLoading) return;
        if (!user) {
            router.push('/login');
            return;
        }

        const fetchProjects = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const projectsRef = collection(db, "projects");
                const q = query(projectsRef, where("userId", "==", user.uid));
                const querySnapshot = await getDocs(q);
                
                const projectsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectConfiguration));
                
                projectsData.sort((a, b) => {
                    const dateA = toDate(a.createdAt);
                    const dateB = toDate(b.createdAt);
                    // Treat invalid or missing dates as older
                    const timeA = dateA ? dateA.getTime() : 0;
                    const timeB = dateB ? dateB.getTime() : 0;
                    return timeB - timeA;
                });
                
                setProjects(projectsData);
            } catch (error: any) {
                 console.error("Error fetching projects: ", error);
                 setError("Error al cargar los proyectos. Verifique los permisos de Firestore.");
            } finally {
                setIsLoading(false);
            }
        };
        
        fetchProjects();

    }, [user, isUserLoading, router, db]);

    if (isUserLoading || isLoading) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 p-4 md:p-8">
                    <Loader text="Cargando proyectos..." />
                </main>
            </div>
        );
    }
    
    if (error) {
        return (
             <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 p-4 md:p-8 text-center">
                    <h2 className="text-xl text-destructive">Error</h2>
                    <p>{error}</p>
                    <Button onClick={() => router.push('/dashboard')} className="mt-4">Volver al escritorio</Button>
                </main>
            </div>
        )
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-4xl mx-auto">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-2xl">Gestión de Medidas</CardTitle>
                            <CardDescription>
                                Seleccione un proyecto para ver, añadir o gestionar las medidas de los participantes.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {projects.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Proyecto</TableHead>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead className="text-right">Acción</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {projects.map(project => (
                                            <TableRow key={project.id}>
                                                <TableCell className="font-medium">{project.projectDetails.projectName}</TableCell>
                                                <TableCell>{project.projectDetails.clientName}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button asChild variant="outline" size="sm">
                                                        <Link href={`/fittings/${project.id}/details`}>
                                                            Gestionar Medidas <ArrowRight className="ml-2 h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <div className="text-center py-10 border-2 border-dashed rounded-lg">
                                    <h3 className="text-lg font-medium text-muted-foreground">No hay proyectos todavía.</h3>
                                    <p className="text-sm text-muted-foreground mt-2">Cree una cotización para empezar a gestionar las medidas.</p>
                                    <Button asChild className="mt-4">
                                        <Link href="/quote">
                                            <PlusCircle className="mr-2 h-4 w-4" />
                                            Crear Cotización
                                        </Link>
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}

    
