
"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2, Copy, FileText, Users, Image as ImageIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore } from '@/firebase';
import { deleteDoc, doc, getDoc, addDoc, collection, serverTimestamp, writeBatch } from "firebase/firestore";
import type { ProjectConfiguration, LineItem, QuoteItem } from "@/lib/types";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import Link from "next/link";
import { v4 as uuidv4 } from 'uuid';

interface ProjectActionsProps {
  project: ProjectConfiguration;
  onProjectDeleted: (projectId: string) => void;
  isEnterpriseUser: boolean;
  isPremiumUser: boolean;
}

export function ProjectActions({ project, onProjectDeleted, isEnterpriseUser, isPremiumUser }: ProjectActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();

  const handleEdit = () => {
    router.push(`/quote?projectId=${project.id}`);
  };

  const handleDuplicate = async () => {
    if (!user) return;
    
    try {
        const originalProjectSnap = await getDoc(doc(db, "projects", project.id));
        if (!originalProjectSnap.exists()) {
            throw new Error("El proyecto original no existe.");
        }

        const originalData = originalProjectSnap.data();

        // Build a clean data object to avoid Firestore data validation errors.
        const cleanData = {
          userId: user.uid,
          projectDetails: {
            clientName: originalData.projectDetails?.clientName || '',
            projectName: `[Copia] ${originalData.projectDetails?.projectName || 'Sin Nombre'}`,
          },
          quoteMode: originalData.quoteMode || 'individual',
          lineItems: (originalData.lineItems || []).map((li: any) => ({
            id: uuidv4(),
            name: li.name || 'Nueva Prenda',
            quantity: li.quantity || 1,
            profitMargin: li.profitMargin || 50,
            description: li.description || '',
            productImageUrls: li.productImageUrls || [],
            laborCosts: {
              labor: li.laborCosts?.labor || 0,
              cutting: li.laborCosts?.cutting || 0,
              other: li.laborCosts?.other || 0,
            },
            sizePrices: (li.sizePrices || []).map((sp: any) => ({
              size: sp.size,
              price: sp.price,
              isSelected: sp.isSelected,
            })),
            items: (li.items || []).map((item: any) => ({
              id: uuidv4(),
              type: item.type,
              quantity: item.quantity,
              total: item.total,
              material: {
                id: item.material.id,
                name: item.material.name,
                price: item.material.price,
                unit: item.material.unit,
                ...(item.material.ancho && { ancho: item.material.ancho }),
                ...(item.material.grammage && { grammage: item.material.grammage }),
              }
            })),
          })),
          status: 'En espera',
          quoteSpecificConditions: originalData.quoteSpecificConditions || {
            validity: '15 días',
            deliveryTime: '30 días hábiles',
            deliveryPlace: 'Nuestros talleres',
            quoteDate: '',
          },
          createdAt: serverTimestamp(),
        };

        const docRef = await addDoc(collection(db, "projects"), cleanData);
        
        toast({
            title: "Proyecto Duplicado",
            description: "El proyecto ha sido duplicado exitosamente. Redirigiendo...",
        });

        router.push(`/quote?projectId=${docRef.id}`);

    } catch (error: any) {
        console.error("Error duplicating project: ", error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: `No se pudo duplicar el proyecto. ${error.message}`,
        });
    }
  };


  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, "projects", project.id));
      onProjectDeleted(project.id);
    } catch (error) {
      console.error("Error deleting project:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar el proyecto.",
      });
    }
  };

  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Abrir menú</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/product-sheet/${project.id}`}>
              <ImageIcon className="mr-2 h-4 w-4" />
              Ficha de Producto
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild disabled={!isPremiumUser && !isEnterpriseUser}>
            <Link href={`/fittings/${project.id}/details`}>
              <Users className="mr-2 h-4 w-4" />
              Gestionar Medidas
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDuplicate}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicar
          </DropdownMenuItem>
          <DropdownMenuItem asChild disabled={!isEnterpriseUser}>
            <Link href={`/materials/${project.id}`}>
              <FileText className="mr-2 h-4 w-4" />
              Ver Resumen de Compra
            </Link>
          </DropdownMenuItem>
          <AlertDialogTrigger asChild>
            <DropdownMenuItem
              className="text-destructive"
              onSelect={(e) => e.preventDefault()}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </AlertDialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Estás realmente seguro?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción es irreversible y eliminará permanentemente el proyecto
            <span className="font-bold"> {project.projectDetails.projectName}</span>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/80"
            onClick={handleDelete}
          >
            Sí, eliminar proyecto
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
