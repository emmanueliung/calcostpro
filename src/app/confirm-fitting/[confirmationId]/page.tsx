"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { doc, updateDoc, getDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import type { Fitting } from '@/lib/types';
import { FITTING_SIZE_FACTORS, recalculateProjectConsumption } from '@/lib/calculation-helpers';

type TokenStatus = 'cargando' | 'confirmado' | 'invalido' | 'ya_confirmado' | 'error' | 'no_encontrado';

type TransactionResult = {
    status: 'success' | 'already_confirmed' | 'not_found' | 'error';
    message: string;
    personName?: string;
    projectName?: string;
};


export default function ConfirmFittingPage() {
    const params = useParams();
    const confirmationId = params.confirmationId as string;
    const { firestore: db } = initializeFirebase();

    const [status, setStatus] = useState<TokenStatus>('cargando');
    const [projectName, setProjectName] = useState('');
    const [personName, setPersonName] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (!confirmationId || !confirmationId.includes('_')) {
            setStatus('invalido');
            setErrorMessage('El formato del token de confirmación es inválido.');
            return;
        }

        const [projectId, fittingId] = confirmationId.split('_');

        if (!projectId || !fittingId) {
            setStatus('invalido');
            setErrorMessage('El ID del proyecto o de la medida falta en el token.');
            return;
        }

        const executeConfirmation = async () => {
            try {
                const fittingRef = doc(db, 'projects', projectId, 'fittings', fittingId);
                
                const result: TransactionResult = await runTransaction(db, async (transaction) => {
                    const fittingSnap = await transaction.get(fittingRef);

                    if (!fittingSnap.exists()) {
                         return { status: 'not_found', message: 'El registro de medidas no fue encontrado.' };
                    }
                    
                    const fittingData = fittingSnap.data() as Fitting;
                    const personName = fittingData.personName;
                    
                    let projectName = 'su proyecto';
                    try {
                        const projectRef = doc(db, 'projects', projectId);
                        const projectSnap = await transaction.get(projectRef);
                        if (projectSnap.exists()) {
                            projectName = projectSnap.data()!.projectDetails?.projectName || 'su proyecto';
                        }
                    } catch (projectError) {
                         console.warn(`Could not fetch project name for ${projectId}:`, projectError)
                    }

                    if (fittingData.confirmed) {
                        return { 
                            status: 'already_confirmed', 
                            message: 'Este registro ya ha sido confirmado.', 
                            personName, 
                            projectName 
                        };
                    }

                    transaction.update(fittingRef, { 
                        confirmed: true,
                        confirmedAt: serverTimestamp()
                    });
                    
                    return { 
                        status: 'success', 
                        message: '¡Confirmación exitosa!', 
                        personName, 
                        projectName 
                    };
                });

                setPersonName(result.personName || '');
                setProjectName(result.projectName || '');

                switch (result.status) {
                    case 'success':
                        setStatus('confirmado');
                        // Trigger recalculation in the background
                        await recalculateProjectConsumption(projectId);
                        break;
                    case 'already_confirmed':
                        setStatus('ya_confirmado');
                        break;
                    case 'not_found':
                        setStatus('no_encontrado');
                        setErrorMessage(result.message);
                        break;
                    default:
                        setStatus('error');
                        setErrorMessage(result.message || 'Ocurrió un error inesperado.');
                }
            } catch (e: any) {
                console.error("Error executing confirmation:", e);
                setStatus('error');
                if (e.code === 'permission-denied') {
                     setErrorMessage("Error de permiso. Las reglas de seguridad de Firestore podrían estar bloqueando la actualización. Asegúrese de que la colección 'fittings' permite escrituras públicas para la confirmación.");
                } else {
                    setErrorMessage(e.message || "Ha ocurrido un error inesperado.");
                }
            }
        };

        executeConfirmation();
    }, [confirmationId, db]);
    
    const renderContent = () => {
        switch (status) {
            case 'cargando':
                return <h1>Verificando su confirmación...</h1>;
            case 'confirmado':
                return (
                    <div>
                        <h1 style={{ color: 'green' }}>¡Confirmación Exitosa!</h1>
                        <p>
                            Gracias, {personName}. Sus tallas para el proyecto "{projectName}" han sido confirmadas.
                        </p>
                    </div>
                );
            case 'ya_confirmado':
                 return (
                    <div>
                        <h1 style={{ color: 'blue' }}>Tallas ya Confirmadas</h1>
                        <p>
                            El registro de tallas de {personName} para el proyecto "{projectName}" ya había sido confirmado anteriormente. No se requiere ninguna otra acción.
                        </p>
                    </div>
                );
            case 'invalido':
            case 'no_encontrado':
                 return (
                    <div>
                        <h1 style={{ color: 'red' }}>Enlace Inválido o Expirado</h1>
                        <p>{errorMessage || "Este enlace de confirmación no es válido o el registro ya no existe. Por favor, contacte a su administrador."}</p>
                    </div>
                );
            case 'error':
                 return (
                     <div>
                        <h1 style={{ color: 'red' }}>Error de Confirmación</h1>
                        <p>{errorMessage || "No se pudo completar la confirmación."}</p>
                    </div>
                );
            default:
                return null;
        }
    }

    return (
        <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', padding: '20px' }}>
            <div style={{ background: 'white', padding: '40px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '500px', width: '100%' }}>
                {renderContent()}
            </div>
        </div>
    );
}
