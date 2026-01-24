"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Printer, ArrowLeft, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ProjectConfiguration, UserProfileData, QuoteItem, Fitting } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { Header } from '@/components/header';
import { Loader } from '@/components/ui/loader';
import { useReactToPrint } from 'react-to-print';
import { MaterialPurchasePrint } from '@/components/material-purchase-print';
import { useQuoteCalculations } from '@/hooks/use-quote-calculations';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { FITTING_SIZE_FACTORS } from '@/lib/calculation-helpers';


interface MaterialSummary {
  name: string;
  totalQuantity: number;
  totalCost: number;
  unit: string;
}

const DifferenceIndicator = ({ value, unit }: { value: number, unit: string }) => {
    if (value === 0 || isNaN(value)) {
        return <span className="flex items-center text-xs text-muted-foreground"><Minus className="h-3 w-3 mr-1" />Sin cambios</span>;
    }
    const isPositive = value > 0;
    const displayValue = unit === '%' ? `${isPositive ? '+' : ''}${value.toFixed(2)}%` : value.toLocaleString('fr-FR', { style: 'currency', currency: 'BOB' });
    
    return (
        <span className={`flex items-center text-xs font-semibold ${isPositive ? 'text-red-500' : 'text-green-500'}`}>
            {isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
            {displayValue}
        </span>
    );
};


export default function MaterialSummaryPage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const params = useParams();
    const projectId = params.projectId as string;
    const { toast } = useToast();
    const db = useFirestore();

    const [project, setProject] = useState<ProjectConfiguration | null>(null);
    const [companyInfo, setCompanyInfo] = useState<UserProfileData | null>(null);
    const [fittings, setFittings] = useState<Fitting[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const calculatedData = useQuoteCalculations(project, companyInfo);

    const printRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `Resumen de Compra - ${project?.projectDetails.projectName || 'Proyecto'}`,
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
                if (!userSnap.exists()) {
                    throw new Error('Perfil de usuario no encontrado.');
                }
                const companyData = userSnap.data() as UserProfileData;
                
                const fittingsRef = collection(db, 'projects', projectId, 'fittings');
                const fittingsSnap = await getDocs(fittingsRef);
                const fittingsData = fittingsSnap.docs.map(doc => doc.data() as Fitting);

                setProject(projectData);
                setCompanyInfo(companyData);
                setFittings(fittingsData);

            } catch (err: any) {
                console.error("Error loading project details:", err);
                const errorMessage = err.message.includes('permission') 
                    ? 'No tienes permiso para acceder a este recurso.'
                    : err.message || 'No se pudieron cargar los datos.';
                setError(errorMessage);
                toast({
                    variant: 'destructive',
                    title: 'Error de Carga',
                    description: errorMessage,
                    duration: 9000
                });
            } finally {
                setIsLoading(false);
            }
        };

        if (projectId && user) {
            fetchData();
        }

    }, [user, isUserLoading, router, projectId, toast, db]);
    
    const { lineItemsWithCalculations } = calculatedData;
    
    const { 
        estimatedFabricCost, 
        estimatedFabricLength, 
    } = useMemo(() => {
        let fabricCost = 0;
        let fabricLength = 0;

        lineItemsWithCalculations.forEach(line => {
            const lineQuantity = project?.quoteMode === 'individual' ? 1 : line.quantity;
            line.items.forEach(item => {
                if (item.type === 'Fabric') {
                    fabricCost += item.total * lineQuantity;
                    fabricLength += item.quantity * lineQuantity;
                }
            });
        });

        return { 
            estimatedFabricCost: fabricCost, 
            estimatedFabricLength: fabricLength,
        };
    }, [lineItemsWithCalculations, project?.quoteMode]);

    const globalPurchaseList = useMemo((): MaterialSummary[] => {
        if (!project || fittings.length === 0) {
            return [];
        }
        
        const purchaseMap: { [key: string]: { totalQuantity: number; unit: string; totalCost: number } } = {};
        const baseLineItem = project.lineItems[0];
        if (!baseLineItem) return [];

        // First, process fittings to calculate total adjusted material quantities
        fittings.forEach(fitting => {
            const size = fitting.sizes?.[baseLineItem.id] || 'S, M, L';
            const factor = FITTING_SIZE_FACTORS[size] || 1.0;

            baseLineItem.items.forEach(item => {
                if (!purchaseMap[item.material.name]) {
                    purchaseMap[item.material.name] = { totalQuantity: 0, unit: item.material.unit, totalCost: 0 };
                }
                // Only fabric quantities are adjusted by size factor
                const quantityPerFitting = item.type === 'Fabric' ? item.quantity * factor : item.quantity;
                purchaseMap[item.material.name].totalQuantity += quantityPerFitting;
            });
        });

        // Now, calculate the total cost based on the total quantity and material price
        Object.keys(purchaseMap).forEach(materialName => {
            const materialInfo = baseLineItem.items.find(item => item.material.name === materialName)?.material;
            if (materialInfo) {
                purchaseMap[materialName].totalCost = purchaseMap[materialName].totalQuantity * materialInfo.price;
            }
        });

        return Object.entries(purchaseMap).map(([name, data]) => ({
            name, ...data
        }));

    }, [project, fittings]);
    
    const actualTotalCost = project?.coutTissuTotal ?? 0;
    const costDifference = actualTotalCost - estimatedFabricCost;

    const actualFabricLength = project?.surfaceTotale ?? 0;
    const fabricLengthDifferencePercentage = useMemo(() => {
        if (estimatedFabricLength === 0) return 0;
        return ((actualFabricLength - estimatedFabricLength) / estimatedFabricLength) * 100;
    }, [actualFabricLength, estimatedFabricLength]);

    const getUnitLabel = (unit: string) => {
        if (unit === 'm²') return 'm';
        return unit;
    };

    const realLaborCost = useMemo(() => {
        if (!project) return 0;
        return project.lineItems.reduce((total, line) => {
            const lineQuantity = project.quoteMode === 'individual' ? fittings.length : line.quantity;
            return total + (line.laborCosts.labor + line.laborCosts.cutting) * lineQuantity;
        }, 0);
    }, [project, fittings]);


    if (isLoading || isUserLoading) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 p-4 md:p-8">
                    <Loader text="Cargando resumen de compra..." />
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
    
    if (!project || !companyInfo) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 p-4 md:p-8">
                    <Loader text="Finalizando carga de datos..." />
                </main>
            </div>
        )
    }

    return (
        <>
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 p-4 md:p-8">
                    <div className="max-w-6xl mx-auto space-y-6">
                         <div className="flex items-center justify-between">
                            <Button variant="outline" onClick={() => router.back()}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Volver
                            </Button>
                            <Button onClick={handlePrint}>
                                <Printer className="mr-2 h-4 w-4" />
                                Imprimir Resumen
                            </Button>
                        </div>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-2xl">Análisis de Costos: {project.projectDetails.projectName}</CardTitle>
                                <CardDescription>
                                    Comparación entre la estimación inicial y los costos reales basados en las tallas ingresadas.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                     <Card>
                                        <CardHeader>
                                            <CardTitle className="text-lg">Consumo de Tela</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className="text-sm text-muted-foreground">Estimación Inicial</p>
                                                    <p className="text-2xl font-bold">{estimatedFabricLength.toFixed(2)} m</p>
                                                </div>
                                                <ArrowRight className="h-6 w-6 text-muted-foreground mx-4" />
                                                <div>
                                                    <p className="text-sm text-muted-foreground">Consumo Real</p>
                                                    <p className="text-2xl font-bold text-primary">{actualFabricLength.toFixed(2) || '0.00'} m</p>
                                                </div>
                                            </div>
                                             <Separator />
                                            <div className="flex justify-between items-center">
                                                <p className="text-sm font-medium">Diferencia de Consumo</p>
                                                <DifferenceIndicator value={fabricLengthDifferencePercentage} unit="%" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-lg">Costo de Tela</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                             <div className="flex justify-between items-center">
                                                 <div>
                                                    <p className="text-sm text-muted-foreground">Costo Estimado</p>
                                                    <p className="text-2xl font-bold">{estimatedFabricCost.toLocaleString('fr-FR', { style: 'currency', currency: 'BOB' })}</p>
                                                </div>
                                                <ArrowRight className="h-6 w-6 text-muted-foreground mx-4" />
                                                <div>
                                                    <p className="text-sm text-muted-foreground">Costo Real</p>
                                                    <p className="text-2xl font-bold text-primary">{actualTotalCost.toLocaleString('fr-FR', { style: 'currency', currency: 'BOB' })}</p>
                                                </div>
                                            </div>
                                            <Separator />
                                            <div className="flex justify-between items-center">
                                                <p className="text-sm font-medium">Diferencia de Costo</p>
                                                <DifferenceIndicator value={costDifference} unit="currency" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                                
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Lista de Compra Global (Basado en Tallas Reales)</CardTitle>
                                        <CardDescription>La cantidad total de cada material necesario para completar el proyecto.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Material</TableHead>
                                                    <TableHead>Cantidad a Comprar</TableHead>
                                                    <TableHead className="text-right">Costo Estimado</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                               {globalPurchaseList.map(item => (
                                                   <TableRow key={item.name}>
                                                       <TableCell className="font-medium">{item.name}</TableCell>
                                                       <TableCell>{item.totalQuantity.toFixed(2)} {getUnitLabel(item.unit)}</TableCell>
                                                       <TableCell className="text-right">{item.totalCost.toLocaleString('fr-FR', { style: 'currency', currency: 'BOB' })}</TableCell>
                                                   </TableRow>
                                               ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Desglose de Costos de Producción (Reales)</CardTitle>
                                        <CardDescription>Estos son los costos brutos reales de producción, sin incluir la ganancia.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4 text-sm">
                                            <div className="flex justify-between p-3 bg-muted/50 rounded-md">
                                                <span className="font-medium">Costo Real de Materiales</span>
                                                <span className="font-bold">{globalPurchaseList.reduce((acc, item) => acc + item.totalCost, 0).toLocaleString('fr-FR', { style: 'currency', currency: 'BOB' })}</span>
                                            </div>
                                            <div className="flex justify-between p-3 bg-muted/50 rounded-md">
                                                <span className="font-medium">Costo Total de Mano de Obra</span>
                                                <span className="font-bold">{realLaborCost.toLocaleString('fr-FR', { style: 'currency', currency: 'BOB' })}</span>
                                            </div>
                                             <Separator />
                                            <div className="flex justify-between p-3 text-base font-bold">
                                                <span>Costo de Producción Total Real</span>
                                                <span>{(globalPurchaseList.reduce((acc, item) => acc + item.totalCost, 0) + realLaborCost).toLocaleString('fr-FR', { style: 'currency', currency: 'BOB' })}</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </CardContent>
                        </Card>
                    </div>
                </main>
            </div>
             <div className="hidden">
                <div className="print-block">
                    <MaterialPurchasePrint 
                        ref={printRef} 
                        project={project} 
                        purchaseList={globalPurchaseList}
                        laborCost={realLaborCost}
                    />
                </div>
             </div>
        </>
    );
}
