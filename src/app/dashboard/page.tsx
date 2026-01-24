"use client";

import { useEffect, useMemo, useState, useCallback } from 'react';
import type { ProjectConfiguration, UserProfileData } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, FileText, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, onSnapshot, doc, Unsubscribe, Timestamp } from "firebase/firestore";
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { User } from 'firebase/auth';
import { Loader } from '@/components/ui/loader';
import { ProjectActions } from '@/components/dashboard/project-actions';
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


export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectConfiguration[]>([]);
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
        setIsLoading(false);
        router.push('/login');
    }
  }, [isUserLoading, user, router]);

  const userDocRef = useMemoFirebase(() => user ? doc(db, "users", user.uid) : null, [db, user]);

  useEffect(() => {
    if (!userDocRef) return;

    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfileData);
        } else {
            setUserProfile(null);
        }
    }, (error) => {
        console.error("Error fetching user profile:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar tu perfil.' });
    });

    return () => unsubscribe();
  }, [userDocRef, toast]);


  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    const projectsRef = collection(db, "projects");
    const q = query(projectsRef, where("userId", "==", user.uid));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
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
        setIsLoading(false);
    }, (error) => {
        console.error("Error al cargar proyetos: ", error);
        toast({
            variant: 'destructive',
            title: 'Error al Cargar Proyectos',
            description: "No se pudieron cargar los proyectos. Si el problema persiste, contacte a soporte."
        });
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, db, toast]);
  
  const currentPlan = useMemo(() => userProfile?.plan || 'Gratuito', [userProfile]);

  const isPremiumOrEnterprise = useMemo(() => {
      return currentPlan === 'Premium' || currentPlan === 'Entreprise';
  }, [currentPlan]);
  
  const canCreateMoreProjects = useMemo(() => isPremiumOrEnterprise || projects.length < 5, [isPremiumOrEnterprise, projects.length]);
  
  const handleCreateNew = () => {
    if (!user) {
        toast({ variant: 'destructive', title: 'Error', description: 'Debes iniciar sesión.' });
        return;
    }
    
    if (!canCreateMoreProjects) {
        toast({
            variant: 'destructive',
            title: 'Límite alcanzado',
            description: 'Has alcanzado el límite de 5 cotizaciones para el plan gratuito. Pásate a Premium para crear cotizaciones ilimitadas.',
            action: (
                <Button asChild variant="secondary" size="sm">
                    <Link href="/subscription">Pasar a Premium</Link>
                </Button>
            )
        });
        return;
    }
    router.push(`/quote`);
  };

  const handleProjectDeleted = useCallback((deletedProjectId: string) => {
    setProjects(prevProjects => prevProjects.filter(p => p.id !== deletedProjectId));
    toast({
        title: "Proyecto Eliminado",
        description: "El proyecto ha sido eliminado exitosamente.",
    });
  }, [toast]);
  
  const displayName = !isLoading && user ? (userProfile?.name || user?.displayName?.split(' ')[0] || 'Bienvenido') : '';
  
  if (isLoading || isUserLoading || !user) {
    return <Loader text="Cargando tu escritorio..." />;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">
        <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Hola {displayName}</h1>
                <Button onClick={handleCreateNew}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Crear cotización
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-2">
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Cotizaciones</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{projects.length}</div>
                        <p className="text-xs text-muted-foreground">
                            {!isPremiumOrEnterprise && `de 5 en el plan gratuito. (${5 - projects.length} restantes)`}
                            {isPremiumOrEnterprise && "Total de proyectos creados"}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Plan Actual</CardTitle>
                        <CardDescription>
                            {currentPlan === 'Gratuito'
                            ? "Actualmente estás en el plan gratuito."
                            : "Disfrutas de todas las funcionalidades sin límites."
                            }
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between">
                        <Badge variant={currentPlan === 'Gratuito' ? "outline" : "default"}>
                            {currentPlan !== 'Gratuito' && <Check className="mr-1 h-3 w-3" />}
                            Plan {currentPlan}
                        </Badge>
                        {currentPlan === 'Gratuito' && (
                            <Button size="sm" asChild>
                                <Link href="/subscription">Pasar a Premium</Link>
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Mis Proyectos / Cotizaciones Recientes</CardTitle>
                    <CardDescription>Gestiona tus proyectos y cotizaciones existentes.</CardDescription>
                </CardHeader>
                <CardContent>
                     {projects.length === 0 && !isLoading ? (
                        <div className="text-center py-16 border-2 border-dashed rounded-lg">
                            <h2 className="text-xl font-semibold text-muted-foreground">No hay proyectos por el momento.</h2>
                            <p className="text-muted-foreground mt-2">¡Haz clic en "Crear cotización" para empezar!</p>
                        </div>
                     ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Proyecto</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {projects.map(project => {
                                const projectDate = toDate(project.createdAt);
                                return (
                                <TableRow key={project.id}>
                                  <TableCell className="font-medium">
                                    <Link href={`/quote?projectId=${project.id}`} className="hover:underline">
                                        {project.projectDetails.projectName}
                                    </Link>
                                  </TableCell>
                                  <TableCell>{project.projectDetails.clientName || "N/A"}</TableCell>
                                  <TableCell>{projectDate ? projectDate.toLocaleDateString() : 'N/A'}</TableCell>
                                  <TableCell className="text-right">
                                    <ProjectActions 
                                        project={project} 
                                        onProjectDeleted={handleProjectDeleted} 
                                        isEnterpriseUser={currentPlan === 'Entreprise'}
                                        isPremiumUser={isPremiumOrEnterprise}
                                    />
                                  </TableCell>
                                </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                     )}
                </CardContent>
            </Card>
        </div>
      </main>
    </div>
  );
}
