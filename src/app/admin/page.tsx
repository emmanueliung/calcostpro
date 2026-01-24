'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useFirestore, useUser } from '@/firebase';
import { Header } from '@/components/header';
import { Loader } from '@/components/ui/loader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { deleteUser } from '@/ai/flows/delete-user';
import { Button } from '@/components/ui/button';
import { Trash2, Users, Star, Building, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ADMIN_UID } from '@/lib/roles';


interface UserData {
  uid: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  createdAt: Timestamp | Date | string;
}

// Helper to convert date
const toDate = (dateValue: any): Date | null => {
    if (!dateValue) return null;
    if (dateValue instanceof Date) return dateValue;
    if (dateValue instanceof Timestamp) return dateValue.toDate();
    if (typeof dateValue === 'string') {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) return date;
    }
    if (typeof dateValue === 'object' && dateValue.seconds) {
        return new Date(dateValue.seconds * 1000);
    }
    return null;
}

const normalizePlan = (plan: string) => {
    if (!plan || plan.toLowerCase() === 'gratis') {
        return 'Gratuito';
    }
    return plan;
}

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.uid !== ADMIN_UID) {
        router.push('/dashboard');
        return;
    }

    // Admin should see ALL users. The query should not be filtered by userId.
    const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(usersQuery, (querySnapshot) => {
        const usersData = querySnapshot.docs.map(doc => ({
            uid: doc.id,
            ...doc.data()
        } as UserData));
        setUsers(usersData);
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching users: ", error);
        toast({
          variant: "destructive",
          title: "Error de Carga",
          description: "No se pudieron cargar los usuarios. Revisa las reglas de Firestore."
        })
        setIsLoading(false);
    });

    return () => unsubscribe();

  }, [user, isUserLoading, router, db, toast]);
  
  const userStats = useMemo(() => {
    const total = users.length;
    const gratuito = users.filter(u => normalizePlan(u.plan) === 'Gratuito').length;
    const premium = users.filter(u => u.plan === 'Premium').length;
    const enterprise = users.filter(u => u.plan === 'Entreprise').length;
    return { total, gratuito, premium, enterprise };
  }, [users]);

  const handleDeleteUser = async (uidToDelete: string) => {
    const result = await deleteUser(uidToDelete);
    if (result.status === 'success') {
        toast({
            title: 'User Firestore Document Deleted',
            description: result.message,
        });
    } else {
        toast({
            variant: 'destructive',
            title: 'Error Deleting User',
            description: result.message,
        });
    }
  };

  if (isUserLoading || isLoading) {
    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 p-4 md:p-8">
                <Loader text="Cargando panel de administración..." />
            </main>
        </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 p-4 md:p-8 space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Cuentas Totales</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{userStats.total}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Cuentas Gratuitas</CardTitle>
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{userStats.gratuito}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Cuentas Premium</CardTitle>
                    <Star className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{userStats.premium}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Cuentas Entreprise</CardTitle>
                    <Building className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{userStats.enterprise}</div>
                </CardContent>
            </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Administración de Usuarios</CardTitle>
            <CardDescription>
              Lista de todos los usuarios registrados en la plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Fecha de Creación</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users.map((u) => {
                        const plan = normalizePlan(u.plan);
                        return (
                        <TableRow key={u.uid}>
                            <TableCell>{u.name}</TableCell>
                            <TableCell>{u.email}</TableCell>
                            <TableCell>
                                <Badge 
                                    variant={plan === 'Gratuito' ? 'outline' : plan === 'Premium' ? 'secondary' : 'default'}
                                >
                                    {plan}
                                </Badge>
                            </TableCell>
                            <TableCell>{u.status}</TableCell>
                            <TableCell>{toDate(u.createdAt)?.toLocaleDateString() || 'N/A'}</TableCell>
                            <TableCell className="text-right">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="icon" disabled={u.email === user?.email}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esta acción eliminará el documento del usuario de Firestore, pero NO eliminará al usuario de Firebase Authentication. Debe hacerse manually desde la consola.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteUser(u.uid)}>Sí, Eliminar Documento</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </TableCell>
                        </TableRow>
                    )})}
                </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
