
"use client";

import React from 'react';
import type { ProjectConfiguration, UserProfileData, LineItem } from '@/lib/types';

// Reusable Header Component
const MinimalHeader = ({ company }: { company?: UserProfileData | null }) => (
    <div style={{ paddingBottom: '1.5rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>
        {company?.logoUrl && (
            <img src={company.logoUrl} alt="Logo" style={{ height: '4rem', objectFit: 'contain', margin: '0 auto 1rem' }} />
        )}
        <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', letterSpacing: '0.1em' }}>FICHAS DE PRODUCTOS</h3>
    </div>
);

// Reusable Footer Component
const MinimalFooter = ({ company }: { company?: UserProfileData | null }) => (
    <div style={{ fontSize: '0.75rem', color: '#6b7280', textAlign: 'center', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
        <p>
            {company?.name || "Creaciones Molina"} - NIT {company?.taxId || "3791119016"}
        </p>
        <p>
            {company?.address || "Dirección"} - TELF: {company?.phone || "+591 77699920"} - EMAIL: {company?.email || "email@empresa.com"}
        </p>
    </div>
);

export const ProductSheetDocument = React.forwardRef<HTMLDivElement, { project: ProjectConfiguration | null, company: UserProfileData | null }>(({ project, company }, ref) => {
    if (!project) {
        return <div ref={ref}></div>;
    }

    const renderItemImages = (item: LineItem) => {
        const images = (item.productImageUrls || []).slice(0, 4); // Take max 4 images
        if (images.length === 0) return null;

        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
                <div style={{ width: '90%', maxWidth: '800px', margin: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '1.5rem' }}>
                        {images.map(url => (
                             <div key={url} style={{
                                position: 'relative',
                                border: '1px solid #e5e7eb',
                                borderRadius: '0.5rem',
                                overflow: 'hidden',
                                width: '100%',
                                aspectRatio: '1 / 1'
                            }}>
                                <img src={url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div ref={ref} style={{ fontFamily: 'sans-serif', color: '#1f2937' }}>
            {project.lineItems.map((item, index) => (
                 <div key={item.id} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '3rem', pageBreakBefore: index > 0 ? 'always' : 'auto' }}>
                    <MinimalHeader company={company} />
                    
                    <main style={{ flexGrow: 1, paddingTop: '2rem', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ width: '100%' }}>
                            <h4 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{item.name}</h4>
                            {item.description && (
                                <p style={{ fontSize: '0.875rem', color: '#4b5563', whiteSpace: 'pre-wrap', marginTop: '0.25rem', width: '100%' }}>
                                    {item.description}
                                </p>
                            )}
                        </div>
                        
                        {renderItemImages(item)}
                    </main>

                    <MinimalFooter company={company} />
                </div>
            ))}
        </div>
    );
});

ProductSheetDocument.displayName = 'ProductSheetDocument';
