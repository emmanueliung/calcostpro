"use client";

import { Header } from '@/components/header';
import { useAuth, useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader } from '@/components/ui/loader';

const ENTERPRISE_USERS = [
    'emmanuel.iung@gmail.com',
    'creacionesmolinao@gmail.com'
];

export default function WorkshopLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, isUserLoading: loading } = useUser();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push('/login');
            } else if (user.email && !ENTERPRISE_USERS.includes(user.email)) {
                router.push('/');
            }
        }
    }, [user, loading, router]);

    if (loading) {
        return <Loader text="Cargando taller..." />;
    }

    if (!user || (user.email && !ENTERPRISE_USERS.includes(user.email))) {
        return null; // Will redirect
    }

    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            <Header />
            <main className="flex-1 p-4 md:p-6 overflow-hidden flex flex-col">
                {children}
            </main>
        </div>
    );
}
