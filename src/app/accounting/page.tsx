"use client";

import { useUser } from "@/firebase";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import AccountingDashboard from "@/components/accounting/accounting-dashboard";
import { Header } from "@/components/header";

const ENTERPRISE_USERS = [
    'emmanuel.iung@gmail.com',
    'creacionesmolinao@gmail.com'
];

export default function AccountingPage() {
    const { user } = useUser();
    const router = useRouter();

    useEffect(() => {
        const isEnterprise = user?.email && ENTERPRISE_USERS.includes(user.email);
        if (!user || !isEnterprise) {
            router.push("/login");
        }
    }, [user, router]);

    if (!user) {
        return <div className="p-8 flex justify-center items-center h-full">Cargando...</div>;
    }

    const isEnterprise = user.email && ENTERPRISE_USERS.includes(user.email);
    if (!isEnterprise) {
        return null; // Will redirect via useEffect
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1">
                <div className="container mx-auto p-6">
                    <h1 className="text-3xl font-bold mb-6">Comptabilité & Intelligence Fiscale</h1>
                    <AccountingDashboard />
                </div>
            </main>
        </div>
    );
}
