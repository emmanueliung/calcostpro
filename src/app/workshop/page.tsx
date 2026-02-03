"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Student, OrderItem, OrderType, Order, Transaction } from '@/lib/types';
import { StudentSelector } from '@/components/workshop/student-selector';
import { OrderPanel } from '@/components/workshop/order-panel';
import { PaymentPanel } from '@/components/workshop/payment-panel';
import { useFirestore, useUser } from '@/firebase';
import { addDoc, collection, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function WorkshopPage() {
    const { user } = useUser();
    const db = useFirestore();
    const { toast } = useToast();

    // Global State
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [currentItems, setCurrentItems] = useState<OrderItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    // Derived State
    const totalAmount = currentItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const handleAddItem = (item: OrderItem) => {
        setCurrentItems([...currentItems, item]);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = [...currentItems];
        newItems.splice(index, 1);
        setCurrentItems(newItems);
    };

    const handleProcessPayment = async (amount: number, method: 'cash' | 'qr', proof?: string | null) => {
        if (!user || !selectedStudent || currentItems.length === 0) return;

        setIsProcessing(true);
        try {
            // 1. Create Order
            const orderRef = await addDoc(collection(db, "orders"), {
                userId: user.uid,
                studentId: selectedStudent.id,
                studentName: selectedStudent.name,
                studentGender: selectedStudent.gender || 'Hombre',
                college: selectedStudent.college,
                items: currentItems,
                status: 'in_production', // Default starting status
                totalAmount: totalAmount,
                paidAmount: amount,
                balance: totalAmount - amount,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            // 2. Create Transaction
            await addDoc(collection(db, "transactions"), {
                userId: user.uid,
                orderId: orderRef.id,
                amount: amount,
                method: method,
                proofUrl: proof || null, // Saving Base64 proof directly for now (small optimization possible later)
                date: serverTimestamp(),
            });

            toast({ title: '¡Éxito!', description: 'Pedido y pago registrados correctamente.' });

            // 3. Reset State
            setCurrentItems([]);
            setSelectedStudent(null);

        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Ocurrió un error al guardar el pedido.' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveProjectOrder = async () => {
        if (!user || !selectedStudent || currentItems.length === 0) return;
        if (selectedStudent.sourceType !== 'project' || !selectedStudent.projectId) return;

        setIsProcessing(true);
        try {
            // 1. Update Fitting (Sizes)
            const sizes: Record<string, string> = {};
            currentItems.forEach(item => {
                if (item.size) sizes[item.productName] = item.size;
            });

            await updateDoc(doc(db, "projects", selectedStudent.projectId, "fittings", selectedStudent.id), {
                sizes: sizes,
                confirmed: true,
                confirmedAt: serverTimestamp() // Mark timestamp
            });

            // 2. Create "Shadow Order" for Production Summary
            // Check if order already exists? Ideally yes, but multiple orders allowed.
            // For now, create new one.
            await addDoc(collection(db, "orders"), {
                userId: user.uid,
                studentId: selectedStudent.id,
                studentName: selectedStudent.name,
                studentGender: selectedStudent.gender || 'Hombre',
                college: selectedStudent.college, // Project Name
                items: currentItems,
                status: 'in_production',
                totalAmount: 0, // Project billing
                paidAmount: 0,
                balance: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                type: 'project_fitting',
                projectId: selectedStudent.projectId
            });

            toast({ title: '¡Guardado!', description: 'Medidas guardadas y enviadas a producción.' });

            // 3. Reset State
            setCurrentItems([]);
            setSelectedStudent(null);

        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Ocurrió un error al guardar el proyecto.' });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full min-h-[calc(100vh-8rem)]">

            {/* Column 1: Identification (3 cols) */}
            <div className="md:col-span-3 flex flex-col gap-4">
                <Card className="h-full flex flex-col">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Identificación</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col p-3 pt-0">
                        <StudentSelector
                            onSelectStudent={setSelectedStudent}
                            selectedStudentId={selectedStudent?.id}
                        />
                    </CardContent>
                </Card>
            </div>

            {/* Column 2: Order/Action (5 cols) */}
            <div className="md:col-span-6 flex flex-col gap-4">
                <OrderPanel
                    student={selectedStudent}
                    items={currentItems}
                    onAddItem={handleAddItem}
                    onRemoveItem={handleRemoveItem}
                />
            </div>

            {/* Column 3: Payment (4 cols) */}
            <div className="md:col-span-3 flex flex-col gap-4">
                {selectedStudent?.sourceType === 'project' ? (
                    <Card className="h-full flex flex-col border-blue-200 bg-blue-50/30">
                        <CardHeader className="pb-3 border-b border-blue-100">
                            <CardTitle className="text-lg text-blue-900">Confirmar Medidas</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col justify-between p-6">
                            <div className="space-y-4">
                                <p className="text-sm text-blue-800">
                                    Estás registrando las medidas para el proyecto <strong>{selectedStudent.college}</strong>.
                                </p>
                                <div className="bg-white p-4 rounded-md border border-blue-100">
                                    <ul className="text-sm space-y-2">
                                        {currentItems.map((item, idx) => (
                                            <li key={idx} className="flex justify-between">
                                                <span>{item.productName}</span>
                                                <span className="font-bold">{item.size}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                            <Button
                                className="w-full mt-6 bg-blue-600 hover:bg-blue-700"
                                size="lg"
                                onClick={handleSaveProjectOrder}
                                disabled={isProcessing || currentItems.length === 0}
                            >
                                <Save className="mr-2 h-5 w-5" />
                                {isProcessing ? 'Guardando...' : 'Confirmar y Enviar a Producción'}
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <PaymentPanel
                        total={totalAmount}
                        onProcessPayment={handleProcessPayment}
                        isProcessing={isProcessing}
                    />
                )}
            </div>
        </div>
    );
}
