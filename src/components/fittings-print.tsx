
"use client";

import React from 'react';
import type { ProjectConfiguration, Fitting } from '@/lib/types';

interface FittingsPrintProps {
    project: ProjectConfiguration | null;
    fittings: Fitting[];
    sizeSummary: { [garmentName: string]: { [size: string]: number } };
}

export const FittingsPrint = React.forwardRef<HTMLDivElement, FittingsPrintProps>((props, ref) => {
    const { project, fittings, sizeSummary } = props;
    
    if (!project) {
        return <div ref={ref}></div>;
    }

    const printDate = new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const garments = project.lineItems;

    const renderSummaryTable = (garmentName: string) => {
        const sizes = sizeSummary[garmentName];
        if (!sizes || Object.keys(sizes).filter(size => sizes[size] > 0).length === 0) {
            return null;
        }

        const sortedSizes = Object.keys(sizes).sort();

        return (
            <div key={garmentName} className="p-4 border border-gray-300 rounded-lg break-inside-avoid">
                <h3 className="font-semibold capitalize mb-2">{garmentName}</h3>
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr>
                            <th className="p-1 font-semibold border-b border-gray-400">Talla</th>
                            <th className="p-1 font-semibold border-b border-gray-400 text-right">Cantidad</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedSizes.map(size => {
                            if (sizes[size] > 0) {
                                return (
                                    <tr key={size} className="border-b border-gray-200 last:border-0">
                                        <td className="p-1">{size}</td>
                                        <td className="p-1 text-right">{sizes[size]}</td>
                                    </tr>
                                );
                            }
                            return null;
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div ref={ref} className="bg-white text-gray-800 font-sans">
            {/* Page 1: List of Fittings */}
            <div className="p-12">
                <header className="text-center mb-8">
                    <h1 className="text-2xl font-bold">Lista de Medidas</h1>
                    <p className="text-gray-600 mt-2">
                        Proyecto: <span className="font-semibold">{project.projectDetails.projectName}</span>
                    </p>
                    <p className="text-sm text-gray-500">
                        Cliente: {project.projectDetails.clientName}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                        Fecha de impresión: {printDate}
                    </p>
                </header>
                
                <table className="w-full text-left border-collapse text-sm mb-12">
                    <thead>
                        <tr>
                            <th className="p-2 font-semibold text-left border-b-2 border-gray-800 w-[50px]">#</th>
                            <th className="p-2 font-semibold text-left border-b-2 border-gray-800">Nombre</th>
                            {garments.map(g => (
                                <th key={g.id} className="p-2 font-semibold text-left border-b-2 border-gray-800">{g.name}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {fittings.map((fitting, index) => (
                            <tr key={fitting.id} className="border-b border-gray-200">
                                <td className="p-2 align-top">{index + 1}</td>
                                <td className="p-2 align-top">{fitting.personName}</td>
                                {garments.map(g => (
                                    <td key={g.id} className="p-2 align-top">{fitting.sizes?.[g.id] || '-'}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Page 2: Summary */}
            <div className="break-before-page p-12">
                <h2 className="text-xl font-bold text-center mb-6">Resumen de Cantidades por Talla</h2>
                <div className="grid grid-cols-2 gap-6">
                    {project?.lineItems.map(garment => renderSummaryTable(garment.name))}
                </div>
            </div>
        </div>
    );
});

FittingsPrint.displayName = 'FittingsPrint';
