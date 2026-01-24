'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Loader } from '@/components/ui/loader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { collection, onSnapshot, query, orderBy, Timestamp, addDoc, serverTimestamp } from 'firebase/firestore';
import { ADMIN_UID } from '@/lib/roles';
import { v4 as uuidv4 } from 'uuid';
import { useFirestore, useUser } from '@/firebase';

interface BonusCode {
  id: string;
  code: string;
  isUsed: boolean;
  usedBy?: string;
  usedAt?: Timestamp | Date;
  createdAt: Timestamp | Date;
  durationDays: number;
}

// Helper to convert date
const toDate = (dateValue: any): Date | null => {
    if (!dateValue) return null;
    if (dateValue instanceof Date) return dateValue;
    if (dateValue instanceof Timestamp) return dateValue.toDate();
    if (typeof dateValue === 'object' && dateValue.seconds) {
        return new Date(dateValue.seconds * 1000);
    }
    return null;
}

// Helper to generate a new code
const createCode = () => {
    return uuidv4().substring(0, 13).replace(/-/g, '').toUpperCase()
        .match(/.{1,4}/g)!.join('-');
}

export default function BonusCodesAdminPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const db = useFirestore();
  
  const [codes, setCodes] = useState<BonusCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  
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

    const codesQuery = query(collection(db, 'bonusCodes'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(codesQuery, (snapshot) => {
        const codesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as BonusCode));
        setCodes(codesData);
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching bonus codes: ", error);
        setIsLoading(false);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'No se pudieron cargar los códigos de bonus.',
        });
    });

    return () => unsubscribe();
  }, [user, isUserLoading, router, toast, db]);

  const handleGenerateCode = async () => {
    if (!user || user.uid !== ADMIN_UID) {
         toast({
            variant: 'destructive',
            title: 'Error de Permiso',
            description: 'No tienes permiso para realizar esta acción.',
        });
        return;
    }
    setIsGenerating(true);
    
    const newCode = createCode();
    const codeData = {
        code: newCode,
        durationDays: 30,
        isUsed: false,
        usedBy: null,
        usedAt: null,
        createdAt: serverTimestamp(),
    };

    try {
        await addDoc(collection(db, "bonusCodes"), codeData);
        toast({
            title: 'Código Generado',
            description: `Se ha creado el nuevo código: ${newCode}`,
        });
    } catch (error: any) {
        console.error("Error generating bonus code:", error);
        toast({
            variant: 'destructive',
            title: 'Error de Generación',
            description: error.message || 'No se pudo generar el código.',
        });
    } finally {
        setIsGenerating(false);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: 'Copiado', description: `El código ${code} ha sido copiado al portapapeles.` });
  };

  if (isUserLoading || isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-4 md:p-8">
          <Loader text="Cargando códigos de bonus..." />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 p-4 md:p-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Gestión de Códigos Bonus</CardTitle>
              <CardDescription>Genera y visualiza los códigos para meses gratuitos.</CardDescription>
            </div>
            <Button onClick={handleGenerateCode} disabled={isGenerating}>
              <PlusCircle className="mr-2 h-4 w-4" />
              {isGenerating ? 'Generando...' : 'Generar Nuevo Código'}
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Usado por</TableHead>
                  <TableHead>Fecha de Creación</TableHead>
                  <TableHead>Duración</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{c.code}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(c.code)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.isUsed ? 'destructive' : 'secondary'}>
                        {c.isUsed ? 'Usado' : 'Disponible'}
                      </Badge>
                    </TableCell>
                    <TableCell>{c.usedBy || '-'}</TableCell>
                    <TableCell>{toDate(c.createdAt)?.toLocaleDateString() || 'N/A'}</TableCell>
                    <TableCell>{c.durationDays} días</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
             {codes.length === 0 && (
                <div className="text-center py-16 border-2 border-dashed rounded-lg mt-4">
                    <h2 className="text-xl font-semibold text-muted-foreground">No hay códigos bonus.</h2>
                    <p className="text-muted-foreground mt-2">¡Haz clic en "Generar Nuevo Código" para empezar!</p>
                </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
