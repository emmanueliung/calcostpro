"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Student, OrderItem, OrderType, Order, Transaction } from '@/lib/types';
import { StudentSelector } from '@/components/workshop/student-selector';
import { OrderPanel } from '@/components/workshop/order-panel';
import { PaymentPanel } from '@/components/workshop/payment-panel';
import { useFirestore, useUser } from '@/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
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
                <PaymentPanel
                    total={totalAmount}
                    onProcessPayment={handleProcessPayment}
                    isProcessing={isProcessing}
                />
            </div>
        </div>
    );
}
