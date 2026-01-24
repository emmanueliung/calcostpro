

"use client";

import React from 'react';
import type { ProjectConfiguration } from '@/lib/types';

interface MaterialSummary {
  name: string;
  totalQuantity: number;
  totalCost: number;
  unit: string;
}

interface MaterialPurchasePrintProps {
    project: ProjectConfiguration | null;
    purchaseList: MaterialSummary[];
    laborCost: number;
}

const getUnitLabel = (unit: string) => {
    if (unit === 'm²') return 'm';
    return unit;
};


export const MaterialPurchasePrint = React.forwardRef<HTMLDivElement, MaterialPurchasePrintProps>((props, ref) => {
    const { project, purchaseList, laborCost } = props;
    
    if (!project) {
        return <div ref={ref}></div>;
    }

    const quoteDate = project.createdAt 
        ? new Date(project.createdAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
        : new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

    const totalMaterialsCost = purchaseList.reduce((acc, item) => acc + item.totalCost, 0);
    const totalProductionCost = totalMaterialsCost + laborCost;


    return (
        <div ref={ref} className="bg-white text-gray-800 font-sans p-12">
            <div className="text-center mb-8">
                <h1 className="text-2xl font-bold">Resumen de Compra y Producción</h1>
                <p className="text-gray-600 mt-2">
                    Proyecto: <span className="font-semibold">{project.projectDetails.projectName}</span>
                </p>
                <p className="text-sm text-gray-500">
                    Cliente: {project.projectDetails.clientName}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                    Fecha de Impresión: {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
            </div>
            
            <div className="mb-8">
                 <p className="text-sm text-gray-600">
                    Este es un resumen de los costos de producción y la lista de materiales necesarios, basado en las tallas reales ingresadas.
                </p>
            </div>

            <div className="mb-12">
                <h2 className="text-xl font-semibold mb-4 border-b pb-2">Lista de Compra Global</h2>
                 <table className="w-full text-left border-collapse text-sm">
                    <thead>
                        <tr>
                            <th className="p-2 font-semibold text-left border-b-2 border-gray-800">Material</th>
                            <th className="p-2 font-semibold text-left border-b-2 border-gray-800">Cantidad a Comprar</th>
                            <th className="p-2 font-semibold text-right border-b-2 border-gray-800">Costo Estimado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {purchaseList.map(item => (
                           <tr key={item.name} className="border-b border-gray-200">
                               <td className="p-2 font-medium">{item.name}</td>
                               <td className="p-2">{item.totalQuantity.toFixed(2)} {getUnitLabel(item.unit)}</td>
                               <td className="p-2 text-right">{item.totalCost.toLocaleString('fr-FR', { style: 'currency', currency: 'BOB' })}</td>
                           </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div>
                <h2 className="text-xl font-semibold mb-4 border-b pb-2">Desglose de Costos de Producción</h2>
                 <div className="flex justify-end mt-4">
                    <div className="w-full max-w-sm space-y-3">
                        <div className="flex justify-between py-2 text-base">
                            <span className="font-semibold">Costo Total de Materiales</span>
                            <span className="font-semibold">{totalMaterialsCost.toLocaleString('fr-FR', { style: 'currency', currency: 'BOB' })}</span>
                        </div>
                        <div className="flex justify-between py-2 text-base">
                            <span className="font-semibold">Costo Total de Mano de Obra</span>
                            <span className="font-semibold">{laborCost.toLocaleString('fr-FR', { style: 'currency', currency: 'BOB' })}</span>
                        </div>
                        <div className="flex justify-between py-2 border-t-2 border-gray-800 text-lg">
                            <span className="font-bold">Costo de Producción Total</span>
                            <span className="font-bold">{totalProductionCost.toLocaleString('fr-FR', { style: 'currency', currency: 'BOB' })}</span>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
});

MaterialPurchasePrint.displayName = 'MaterialPurchasePrint';
