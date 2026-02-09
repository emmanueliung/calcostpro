
"use client";

import { useState, useEffect, useId, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import type { ProjectConfiguration, LineItem, Material, UserProfileData, Fitting } from '@/lib/types';

import { ProjectDetailsSection } from "@/components/sections/project-details";
import { QuoteModeSelection } from "@/components/sections/quote-mode-selection";
import { MaterialCostsSection } from "@/components/sections/material-costs";
import { QuoteSummarySection } from "@/components/sections/quote-summary";
import { Button } from "@/components/ui/button";
import { Save, PlusCircle, Printer, Scissors } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp, onSnapshot, query, where, getDocs, Timestamp } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import ReactToPrint, { useReactToPrint } from "react-to-print";
import QuoteDocument from "@/components/quote-document";
import { MaterialPurchasePrint } from "./material-purchase-print";
import Link from 'next/link';
import { SpecificConditionsSection } from "./sections/specific-conditions";
import { useQuoteCalculations } from "@/hooks/use-quote-calculations";
import { FITTING_SIZE_FACTORS } from "@/lib/calculation-helpers";
import { getDefaultMaterials } from "@/lib/default-materials";
import { TemplateSelector } from "./quote/template-selector";
import { TechnicalSheet } from "@/lib/types";
import { v4 as uuidv4 } from 'uuid';

type MaterialsState = { fabrics: Material[], accessories: Material[], prints: Material[] };
const EMPTY_CATALOG: MaterialsState = { fabrics: [], accessories: [], prints: [] };

const PREMIUM_USERS = [
  'emmanuel.iung@gmail.com',
  'adrianaosinaga@gmail.com',
  'isabel.osinaga.molina@gmail.com',
  'amparoosinagamolina@gmail.com',
  'creacionesmolinao@gmail.com'
];

const EMPTY_LINE_ITEM: Omit<LineItem, 'id'> = {
  name: 'Nueva Prenda',
  quantity: 1,
  profitMargin: 50,
  items: [],
  laborCosts: { labor: 0, cutting: 0, other: 0 },
  sizePrices: [
    { size: "S, M, L", price: 0, isSelected: true },
  ],
  productImageUrls: [],
  description: ''
};

const getInitialProjectConfig = (): Omit<ProjectConfiguration, 'id' | 'createdAt'> => ({
  userId: '',
  projectDetails: {
    clientName: '',
    projectName: 'Nuevo Proyecto',
  },
  quoteMode: 'individual',
  lineItems: [{ id: `li-${Date.now()}`, ...EMPTY_LINE_ITEM }],
  individualQuoteItems: [],
  individualLaborCosts: { labor: 0, cutting: 0, other: 0 },
  sizePrices: [],
  groupLineItems: [],
  status: 'En espera',
  quoteSpecificConditions: {
    validity: '15 días',
    deliveryTime: '30 días hábiles',
    deliveryPlace: 'Nuestros talleres',
    quoteDate: '',
  }
});


export default function QuoteBuilder() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();

  const projectIdFromUrl = searchParams.get('projectId');

  const [projectConfig, setProjectConfig] = useState<ProjectConfiguration | null>(null);
  const [materials, setMaterials] = useState<MaterialsState>(EMPTY_CATALOG);
  const [companyInfo, setCompanyInfo] = useState<UserProfileData | null>(null);
  const [fittings, setFittings] = useState<Fitting[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTemplateSelectorOpen, setIsTemplateSelectorOpen] = useState(false);

  const quoteDocRef = useRef<HTMLDivElement>(null);
  const purchaseSummaryRef = useRef<HTMLDivElement>(null);

  const calculatedData = useQuoteCalculations(projectConfig, companyInfo);

  const realPurchaseData = useMemo(() => {
    if (!projectConfig || fittings.length === 0) {
      return { purchaseList: [], laborCost: 0 };
    }

    const purchaseMap: { [key: string]: { totalQuantity: number; unit: string; totalCost: number } } = {};
    const baseLineItem = projectConfig.lineItems[0];
    if (!baseLineItem) return { purchaseList: [], laborCost: 0 };

    fittings.forEach(fitting => {
      const size = fitting.sizes?.[baseLineItem.id] || 'S, M, L';
      const factor = FITTING_SIZE_FACTORS[size] || 1.0;

      baseLineItem.items.forEach(item => {
        if (!purchaseMap[item.material.name]) {
          purchaseMap[item.material.name] = { totalQuantity: 0, unit: item.material.unit, totalCost: 0 };
        }
        const quantityPerFitting = item.type === 'Fabric' ? item.quantity * factor : item.quantity;
        purchaseMap[item.material.name].totalQuantity += quantityPerFitting;
      });
    });

    Object.keys(purchaseMap).forEach(materialName => {
      const materialInfo = baseLineItem.items.find(item => item.material.name === materialName)?.material;
      if (materialInfo) {
        purchaseMap[materialName].totalCost = purchaseMap[materialName].totalQuantity * materialInfo.price;
      }
    });

    const laborCost = projectConfig.lineItems.reduce((total, line) => {
      const lineQuantity = projectConfig.quoteMode === 'individual' ? fittings.length : line.quantity;
      return total + (line.laborCosts.labor + line.laborCosts.cutting) * lineQuantity;
    }, 0);

    return {
      purchaseList: Object.entries(purchaseMap).map(([name, data]) => ({ name, ...data })),
      laborCost
    };
  }, [projectConfig, fittings]);

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      setIsLoading(false);
      router.push('/login?redirect=/quote');
      return;
    };

    const unsubscribes: (() => void)[] = [];

    const loadData = async () => {
      setIsLoading(true);

      const userDocRef = doc(db, 'users', user.uid);
      try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCompanyInfo(data as UserProfileData);
          setMaterials(data.materialsCatalog || getDefaultMaterials());
        }
      } catch (error) {
        console.error("Error getting user document:", error);
      }

      if (projectIdFromUrl) {
        try {
          const projectDocRef = doc(db, "projects", projectIdFromUrl);
          const projectSnap = await getDoc(projectDocRef);
          if (projectSnap.exists()) {
            const data = projectSnap.data() as any;
            if (data.userId !== user.uid) {
              toast({ variant: 'destructive', title: 'Acceso denegado', description: 'No tienes permiso para ver este proyecto.' });
              router.push('/dashboard');
              return;
            }

            if (data.profitMargin && !data.lineItems[0].profitMargin) {
              data.lineItems.forEach((li: LineItem) => {
                li.profitMargin = data.profitMargin;
              });
              delete data.profitMargin;
            }
            if (!data.quoteSpecificConditions) {
              data.quoteSpecificConditions = {
                validity: '15 días',
                deliveryTime: '30 días hábiles',
                deliveryPlace: 'Nuestros talleres',
                quoteDate: ''
              }
            }

            if (data.lineItems.some((li: any) => li.productImageUrl && !li.productImageUrls)) {
              data.lineItems.forEach((li: any) => {
                if (li.productImageUrl) {
                  li.productImageUrls = [li.productImageUrl];
                  delete li.productImageUrl;
                }
              });
            }
            setProjectConfig({ id: projectSnap.id, ...data } as ProjectConfiguration);

            const fittingsRef = collection(db, 'projects', projectIdFromUrl, 'fittings');
            const fittingsSnap = await getDocs(fittingsRef);
            setFittings(fittingsSnap.docs.map(d => d.data() as Fitting));

          } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Proyecto no encontrado. Creando uno nuevo.' });
            router.push('/quote');
          }
        } catch (error) {
          console.error("Error fetching project: ", error);
          toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los datos del proyecto." });
        }
      } else {
        setProjectConfig({ id: '', createdAt: null, ...getInitialProjectConfig() });
      }

      setIsLoading(false);
    }

    loadData();

    const userDocRef = doc(db, 'users', user.uid);
    const unsubUser = onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setCompanyInfo(data as UserProfileData);
        if (data.materialsCatalog) {
          setMaterials(data.materialsCatalog);
        }
      }
    });
    unsubscribes.push(unsubUser);

    return () => unsubscribes.forEach(unsub => unsub());

  }, [projectIdFromUrl, user, isUserLoading, toast, router, db]);

  const updateProjectConfigState = (updater: (prev: ProjectConfiguration) => ProjectConfiguration) => {
    setProjectConfig(prev => prev ? updater(prev) : prev);
  };

  const updateLineItem = (lineItemId: string, updater: (prev: LineItem) => LineItem) => {
    if (!projectConfig) return;
    updateProjectConfigState(p => ({
      ...p,
      lineItems: p.lineItems.map(li => li.id === lineItemId ? updater(li) : li)
    }));
  };

  const addLineItem = () => {
    if (!projectConfig) return;
    updateProjectConfigState(p => ({
      ...p,
      lineItems: [...p.lineItems, { id: `li-${Date.now()}`, ...EMPTY_LINE_ITEM }]
    }));
  };

  const removeLineItem = (lineItemId: string) => {
    if (!projectConfig || projectConfig.lineItems.length <= 1) {
      toast({ variant: 'destructive', title: 'Acción no permitida', description: 'Debe haber al menos una prenda en la cotización.' });
      return;
    }
    updateProjectConfigState(p => ({
      ...p,
      lineItems: p.lineItems.filter(li => li.id !== lineItemId)
    }))
  };

  const handleAddFromTemplate = (template: TechnicalSheet) => {
    if (!projectConfig) return;

    // Convert components to QuoteItems
    const newItems = template.components.map(comp => {
      // Try to find matching material in catalog
      let material = materials.fabrics.find(m => m.name.toLowerCase() === comp.name.toLowerCase()) ||
        materials.accessories.find(m => m.name.toLowerCase() === comp.name.toLowerCase()) ||
        materials.prints.find(m => m.name.toLowerCase() === comp.name.toLowerCase());

      // Helper to guess unit if not found
      const mapUnit = (u: string) => {
        if (u === 'm') return 'm';
        if (u === 'u' || u === 'ud' || u === 'unid') return 'piece';
        return 'piece';
      };

      if (!material) {
        // Create a temporary material if not found
        // We assume price 0 if not found, user will have to input it
        material = {
          id: `temp-${uuidv4()}`,
          name: comp.name,
          price: 0,
          unit: mapUnit(comp.unit) as any,
        };
      }

      const typeMap: any = { 'tissu': 'Fabric', 'accessoire': 'Accessory', 'main_d_oeuvre': 'Labor' }; // 'Labor' isn't a QuoteItem type yet but checking... QuoteItem type is 'Fabric' | 'Accessory' | 'Print'
      // If it's labor, we should add to labor costs, but components are usually materials.
      // Let's assume components are materials.

      const mappedType: 'Fabric' | 'Accessory' | 'Print' = comp.type === 'tissu' ? 'Fabric' : 'Accessory'; // Default to accessory if not fabric

      return {
        id: uuidv4(),
        material: material,
        quantity: comp.consumptionBase,
        total: comp.consumptionBase * material.price,
        type: mappedType
      };
    });

    const newLineItem: LineItem = {
      id: `li-${Date.now()}`,
      name: template.name,
      description: template.category, // Or description from template if it existed
      quantity: 1, // Default quantity
      profitMargin: 50,
      items: newItems,
      laborCosts: {
        labor: 0, // We could try to map template.totalLaborMinutes * rate if we had one
        cutting: 0,
        other: 0
      },
      sizePrices: projectConfig.lineItems[0]?.sizePrices || [{ size: "S, M, L", price: 0, isSelected: true }],
      productImageUrls: template.imageUrl ? [template.imageUrl] : [],
      templateId: template.id,
      sourceTemplateName: template.name
    };

    updateProjectConfigState(p => ({
      ...p,
      lineItems: [...p.lineItems, newLineItem]
    }));

    toast({
      title: "Modelo añadido",
      description: `Se ha añadido "${template.name}" a la cotización.`
    });
  };

  const canCreateMoreProjects = useCallback(async () => {
    if (!user || (user.email && PREMIUM_USERS.includes(user.email))) {
      return true;
    }
    const projectsRef = collection(db, "projects");
    const q = query(projectsRef, where("userId", "==", user.uid));
    const snapshot = await getDocs(q);
    return snapshot.size < 5;
  }, [user, db]);

  const handleSaveProject = async (): Promise<{ success: boolean, newId?: string }> => {
    if (!user || !projectConfig) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pueden guardar los datos.' });
      return { success: false };
    }

    setIsSaving(true);

    try {
      let currentProjectId = projectConfig.id;
      const isNewProject = !currentProjectId;

      if (isNewProject) {
        const canCreate = await canCreateMoreProjects();
        if (!canCreate) {
          toast({
            variant: 'destructive',
            title: 'Límite alcanzado',
            description: 'Has alcanzado el límite de 5 cotizaciones para el plan gratuito. Pásate a Premium para crear cotizaciones ilimitadas.',
            action: <Button asChild variant="secondary" size="sm"><Link href="/subscription">Pasar a Premium</Link></Button>,
            duration: 7000
          });
          setIsSaving(false);
          return { success: false };
        }
      }

      const cleanLineItems = projectConfig.lineItems.map(li => ({
        ...li,
        items: li.items.map(item => ({
          ...item,
          material: {
            id: item.material.id,
            name: item.material.name,
            price: item.material.price,
            unit: item.material.unit,
            ...(item.material.grammage && { grammage: item.material.grammage }),
            ...(item.material.ancho && { ancho: item.material.ancho }),
          }
        }))
      }));

      const projectData = {
        userId: user.uid,
        projectDetails: projectConfig.projectDetails,
        quoteMode: projectConfig.quoteMode,
        lineItems: cleanLineItems,
        status: projectConfig.status || 'En espera',
        quoteSpecificConditions: projectConfig.quoteSpecificConditions,
        ...(projectConfig.surfaceTotale && { surfaceTotale: projectConfig.surfaceTotale }),
        ...(projectConfig.coutTissuTotal && { coutTissuTotal: projectConfig.coutTissuTotal }),
      };

      if (isNewProject) {
        const docRef = await addDoc(collection(db, "projects"), {
          ...projectData,
          createdAt: serverTimestamp(),
        });
        currentProjectId = docRef.id;
        toast({ title: 'Proyecto Creado', description: 'Tu nuevo proyecto ha sido guardado. Redirigiendo...' });
        router.push(`/quote?projectId=${currentProjectId}`);
        return { success: true, newId: currentProjectId };
      } else {
        const projectDocRef = doc(db, "projects", currentProjectId);
        await setDoc(projectDocRef, projectData, { merge: true });
        toast({ title: 'Proyecto Guardado', description: 'Tu cotización ha sido actualizada.' });
        return { success: true, newId: currentProjectId };
      }

    } catch (error) {
      console.error("Error saving project: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar el proyecto.' });
      return { success: false };
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = useReactToPrint({
    content: () => quoteDocRef.current,
    documentTitle: projectConfig?.projectDetails.projectName || "Cotización",
  });

  const triggerPrint = async () => {
    if (!projectConfig) return;

    if (!projectConfig.id) {
      const saveResult = await handleSaveProject();
      if (!saveResult.success) {
        toast({
          variant: 'destructive',
          title: 'Impresión cancelada',
          description: 'El proyecto no pudo ser guardado, por lo que la impresión fue cancelada.',
        });
      }
    } else {
      handlePrint();
    }
  };


  const handleUpdateMaterials = async (newMaterials: MaterialsState) => {
    if (!user) return;
    setMaterials(newMaterials);
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(userDocRef, { materialsCatalog: newMaterials }, { merge: true });
  }

  if (isLoading || isUserLoading || !projectConfig) {
    return (
      <div className="p-4 md:p-8 space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <>
      <div className="p-4 md:p-8 space-y-6 no-print">
        <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {projectIdFromUrl ? "Editar Cotización" : "Crear Cotización"}
          </h1>
        </div>

        <ProjectDetailsSection
          details={projectConfig.projectDetails}
          setDetails={(updater) => updateProjectConfigState(p => ({ ...p, projectDetails: updater(p.projectDetails) }))}
        />

        <QuoteModeSelection
          quoteMode={projectConfig.quoteMode}
          setQuoteMode={(mode) => updateProjectConfigState(p => ({ ...p, quoteMode: mode }))}
        />

        {projectConfig.lineItems.map((lineItem) => (
          <MaterialCostsSection
            key={lineItem.id}
            lineItem={lineItem}
            updateLineItem={(updater) => updateLineItem(lineItem.id, updater)}
            removeLineItem={() => removeLineItem(lineItem.id)}
            materials={materials}
            updateMaterials={handleUpdateMaterials}
            isOnlyLineItem={projectConfig.lineItems.length === 1}
            isIndividualMode={projectConfig.quoteMode === 'individual'}
          />
        ))}


        <div className="flex gap-4">
          <Button variant="outline" onClick={addLineItem} className="flex-1">
            <PlusCircle className="mr-2 h-4 w-4" />
            Añadir prenda vacía
          </Button>
          <Button variant="default" onClick={() => setIsTemplateSelectorOpen(true)} className="flex-1 bg-slate-800 hover:bg-slate-700">
            <Scissors className="mr-2 h-4 w-4" />
            Añadir desde Modelo
          </Button>
        </div>

        <QuoteSummarySection
          projectConfig={projectConfig}
          updateProjectConfig={updateProjectConfigState}
          calculatedData={calculatedData}
        />

        <SpecificConditionsSection
          conditions={projectConfig.quoteSpecificConditions}
          setConditions={(updater) => updateProjectConfigState(p => ({ ...p, quoteSpecificConditions: updater(p.quoteSpecificConditions) }))}
        />

        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <Button onClick={triggerPrint}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir Cotización
            </Button>
            {projectIdFromUrl && (
              <ReactToPrint
                trigger={() => (
                  <Button variant="outline">
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimir Desglose de Costos
                  </Button>
                )}
                content={() => purchaseSummaryRef.current}
                documentTitle={`${projectConfig.projectDetails.projectName} - Desglose de Costos`}
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSaveProject} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Guardando..." : "Guardar"}
            </Button>
            <Button onClick={() => router.push('/dashboard')}>
              Volver al Escritorio
            </Button>
          </div>
        </div>
      </div>

      <div className="hidden">
        <div className="print-block">
          <QuoteDocument ref={quoteDocRef} project={projectConfig} company={companyInfo} costs={calculatedData} />
        </div>
        <div className="print-block">
          <MaterialPurchasePrint ref={purchaseSummaryRef} project={projectConfig} purchaseList={realPurchaseData.purchaseList} laborCost={realPurchaseData.laborCost} />
        </div>
      </div>
      <TemplateSelector
        open={isTemplateSelectorOpen}
        onOpenChange={setIsTemplateSelectorOpen}
        onSelect={handleAddFromTemplate}
      />
    </>
  );
}
