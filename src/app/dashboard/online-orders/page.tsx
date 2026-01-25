"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader } from '@/components/ui/loader';

export default function OnlineOrdersRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/workshop/production');
    }, [router]);

    return <Loader text="Redirigiendo a Gestión de Pedidos..." />;
}
