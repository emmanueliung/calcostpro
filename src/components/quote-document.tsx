
"use client";

import React, { useMemo } from "react";
import type { ProjectConfiguration, UserProfileData } from "@/lib/types";
import { CalculatedData } from "@/hooks/use-quote-calculations";
import Image from "next/image";
import { marked } from 'marked';


interface QuoteDocumentProps {
  project?: ProjectConfiguration;
  company?: UserProfileData | null;
  costs?: CalculatedData;
}

// Reusable Header Component
export const QuoteHeader = ({ company, date }: { company?: UserProfileData | null, date: string }) => (
    <header>
        <div className="text-center mb-12">
            {company?.logoUrl ? (
                <img src={company.logoUrl} alt="Logo de la Empresa" className="h-20 mx-auto mb-4 object-contain" />
            ) : (
                 <h1 className="text-xl font-semibold">{company?.name || "Creaciones Molina"}</h1>
            )}
            <h2 className="text-4xl font-bold tracking-wider mt-2">COTIZACIÓN</h2>
        </div>
        <div className="flex justify-end mb-12">
            <p>{date}</p>
        </div>
    </header>
);

// Reusable Footer Component
export const QuoteFooter = ({ company }: { company?: UserProfileData | null }) => (
     <footer className="text-center text-xs text-gray-600 absolute bottom-12 left-12 right-12">
        <p>
            {company?.name || "Creaciones Molina"} - NIT {company?.taxId || "3791119016"}
        </p>
        <p>
            {company?.address || "Dirección"} - TELF: {company?.phone || "+591 77699920"} - EMAIL: {company?.email || "email@empresa.com"}
        </p>
    </footer>
);

const SpecificConditionsBlock = ({ project }: { project?: ProjectConfiguration }) => {
    if (!project?.quoteSpecificConditions) {
        return null;
    }
    const { validity, deliveryTime, deliveryPlace } = project.quoteSpecificConditions;

    // Only render the block if at least one condition is present
    if (!validity && !deliveryTime && !deliveryPlace) {
        return null;
    }

    return (
        <div className="flex justify-end mt-4">
            <div className="text-sm w-full max-w-sm space-y-0">
                {validity && (
                    <div className="flex justify-between">
                        <span className="font-semibold">Validez de la oferta:</span>
                        <span>{validity}</span>
                    </div>
                )}
                {deliveryTime && (
                    <div className="flex justify-between">
                        <span className="font-semibold">Tiempo de entrega:</span>
                        <span>{deliveryTime}</span>
                    </div>
                )}
                {deliveryPlace && (
                     <div className="flex justify-between">
                        <span className="font-semibold">Lugar de entrega:</span>
                        <span>{deliveryPlace}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

const ConditionsSection = ({ company }: { company?: UserProfileData | null }) => {
    const defaultConditions = '1. **Validez de la oferta:** La presente cotización es válida por 30 días a partir de la fecha de emisión.\\n2. **Adelanto:** Se requiere un adelanto del 50% del total para iniciar la producción. El 50% restante deberá ser cancelado contra entrega.\\n3. **Plazo de entrega:** El plazo de entrega estimado es de 15 a 20 días hábiles a partir de la confirmación del pedido y la recepción del adelanto.\\n4. **Tolerancia de producción:** Se contempla una tolerancia de producción de +/- 3% sobre la cantidad total solicitada.\\n5. **Aprobación de muestras:** Cualquier producción en masa requiere la aprobación previa de una muestra física por parte del cliente. Cambios solicitados después de la aprobación de la muestra podrían incurrir en costos adicionales.\\n6. **Transporte:** El costo de envío no está incluido en esta cotización, salvo que se especifique lo contrario. El envío corre por cuenta y riesgo del cliente.\\n7. **Cancelaciones:** En caso de cancelación del pedido una vez iniciada la producción, el adelanto no será reembolsable para cubrir los costos de materiales y mano de obra incurridos.';
    const conditionsMarkdown = company?.conditions || defaultConditions;

    // A simple parser for Markdown-like lists to HTML lists
    const parsedHtml = conditionsMarkdown.split('\\n').map(line => {
        line = line.trim();
        // Handle bold text
        line = line.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
        
        // Basic numbered list item
        if (line.match(/^\\d+\\.\\s/)) {
            return `<li style="margin-left: 20px; padding-left: 5px;">${line.substring(line.indexOf(' ') + 1)}</li>`;
        }
        // Basic bulleted list item
        if (line.startsWith('* ') || line.startsWith('- ')) {
            return `<li style="margin-left: 20px; padding-left: 5px;">${line.substring(2)}</li>`;
        }
        return `<p>${line}</p>`;
    }).join('');

    const listWrapper = (htmlContent: string) => {
        if (htmlContent.includes('<li>')) {
            return `<ol style="list-style-type: decimal; padding-left: 20px;">${htmlContent.replace(/<p>|<\/p>/g, '')}</ol>`;
        }
        return htmlContent;
    };


    return (
        <div className="bg-white text-gray-800 font-sans p-12 break-before-page" style={{ minHeight: '100vh', position: 'relative' }}>
             <h3 className="text-2xl font-bold text-center mb-8">CONDICIONES GENERALES</h3>
             <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: listWrapper(parsedHtml) }}></div>
             <div className="absolute bottom-40 left-1/2 -translate-x-1/2 text-center w-full">
                <div className="border-t border-gray-800 w-64 mb-2 mx-auto"></div>
                <p>{company?.name || "Creaciones Molina"}</p>
            </div>
             <QuoteFooter company={company} />
        </div>
    );
}


const QuoteDocument = React.forwardRef<HTMLDivElement, QuoteDocumentProps>((props, ref) => {
    const { project, company, costs } = props;

    const isIndividualMode = project?.quoteMode === 'individual';
    
    const quoteDate = useMemo(() => {
        const customDateStr = project?.quoteSpecificConditions?.quoteDate;
        if (customDateStr) {
            const [year, month, day] = customDateStr.split('-');
            const date = new Date(Number(year), Number(month) - 1, Number(day));
            if (!isNaN(date.getTime())) {
                return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
            }
        }
        const createDate = project?.createdAt;
        if (createDate && !isNaN(new Date(createDate).getTime())) {
            return new Date(createDate).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
        }
        return new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    }, [project?.quoteSpecificConditions?.quoteDate, project?.createdAt]);


    // Individual Mode Component
    const IndividualQuote = () => (
        <>
            {costs?.lineItemsWithCalculations.map((lineItem, index) => (
                <div key={lineItem.id} className={`bg-white text-gray-800 font-sans px-16 py-12 relative ${index > 0 ? 'break-before-page' : ''}`} style={{ minHeight: '100vh' }}>
                    <QuoteHeader company={company} date={quoteDate} />

                    <div className="mb-8">
                        <p className="mb-1">Señores:</p>
                        <p className="font-semibold">{project?.projectDetails?.clientName || "N/A"}</p>
                        <p>Presente,</p>
                    </div>

                    <div className="text-center mb-8">
                        <h3 className="text-lg font-bold">{lineItem.name}</h3>
                        {lineItem.description && <p className="mt-2 text-sm max-w-2xl mx-auto">{lineItem.description}</p>}
                    </div>

                     <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className="border-b-2 border-gray-800 p-2 text-left font-bold w-[120px]">IMAGEN</th>
                                <th className="border-b-2 border-gray-800 p-2 text-left font-bold">DESCRIPCIÓN</th>
                                <th className="border-b-2 border-gray-800 p-2 text-right font-bold w-1/4">P. UNITARIO</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lineItem.calculatedSizePrices.filter(sp => sp.isSelected).map((sizePrice, sizeIndex) => (
                                <tr key={sizePrice.size}>
                                    {sizeIndex === 0 && lineItem.productImageUrls && lineItem.productImageUrls.length > 0 && (
                                        <td className="p-2 align-top" rowSpan={lineItem.calculatedSizePrices.filter(sp => sp.isSelected).length}>
                                            <img src={lineItem.productImageUrls[0]} alt={lineItem.name} className="w-24 h-32 object-cover" />
                                        </td>
                                    )}
                                    {sizeIndex === 0 && (!lineItem.productImageUrls || lineItem.productImageUrls.length === 0) && (
                                        <td className="p-2 align-top" rowSpan={lineItem.calculatedSizePrices.filter(sp => sp.isSelected).length}></td>
                                    )}
                                    <td className="border-b border-gray-300 p-2">Talla: {sizePrice.size}</td>
                                    <td className="border-b border-gray-300 p-2 text-right">Bs. {sizePrice.price.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="absolute bottom-40 left-1/2 -translate-x-1/2 text-center w-full">
                        <div className="border-t border-gray-800 w-64 mb-2 mx-auto"></div>
                        <p>{company?.name || "Creaciones Molina"}</p>
                    </div>
                    <QuoteFooter company={company} />
                </div>
            ))}
            
            <ConditionsSection company={company} />
        </>
    );

    // Group (Batch) Mode Component
    const GroupQuote = () => (
         <>
            <div className="bg-white text-gray-800 font-sans px-16 py-12 relative" style={{ minHeight: '100vh' }}>
                <QuoteHeader company={company} date={quoteDate} />

                <div className="mb-8">
                    <p className="mb-1">Señores:</p>
                    <p className="font-semibold">{project?.projectDetails?.clientName || "N/A"}</p>
                    <p>Presente,</p>
                </div>
                <div className="mb-8">
                    <h2 className="text-lg font-semibold text-gray-700">Proyecto: <span className="font-normal">{project?.projectDetails?.projectName || "N/A"}</span></h2>
                </div>


                <table className="w-full text-left border-collapse mb-8 table-fixed">
                    <thead>
                    <tr>
                        <th className="p-3 font-semibold text-left border-b-2 border-gray-800 w-1/2">Descripción</th>
                        <th className="p-3 font-semibold text-center border-b-2 border-gray-800 w-[15%]">Cantidad</th>
                        <th className="p-3 font-semibold text-right border-b-2 border-gray-800 w-[20%]">Precio Unit.</th>
                        <th className="p-3 font-semibold text-right border-b-2 border-gray-800 w-[15%]">Total</th>
                    </tr>
                    </thead>
                    <tbody>
                    {costs?.lineItemsWithCalculations && costs.lineItemsWithCalculations.length > 0 ? (
                        costs.lineItemsWithCalculations.map(item => (
                            <tr key={item.id} className="border-b border-gray-200">
                                <td className="p-3 align-top break-words">
                                    <p className="font-medium">{item.name}</p>
                                    {item.description && <p className="text-xs text-gray-600 mt-1">{item.description}</p>}
                                </td>
                                <td className="p-3 text-center align-top">{item.quantity}</td>
                                <td className="p-3 text-right align-top">Bs. {item.finalPricePerUnit_Base.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                                <td className="p-3 text-right align-top">Bs. {Math.ceil(item.finalPricePerUnit_Base * item.quantity).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td className="p-3" colSpan={4}>No hay artículos en esta cotización.</td>
                        </tr>
                    )}
                    </tbody>
                </table>

                <div className="flex justify-end mt-auto">
                    <div className="w-full max-w-sm space-y-2">
                        <div className="flex justify-between py-3 text-xl bg-gray-200 px-3 mt-2 rounded-lg">
                            <span className="font-bold">Total</span>
                            <span className="font-bold">Bs. {costs?.grandTotal.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || '0'}</span>
                        </div>
                    </div>
                </div>

                <SpecificConditionsBlock project={project} />
                
                <div className="absolute bottom-40 left-1/2 -translate-x-1/2 text-center w-full">
                    <div className="border-t border-gray-800 w-64 mb-2 mx-auto"></div>
                    <p>{company?.name || "Creaciones Molina"}</p>
                </div>
                <QuoteFooter company={company} />
            </div>
            <ConditionsSection company={company} />
         </>
    );

    return (
        <div ref={ref} className="print-container">
            {isIndividualMode ? <IndividualQuote /> : <GroupQuote />}
        </div>
    );
});

QuoteDocument.displayName = "QuoteDocument";
export default QuoteDocument;

    
