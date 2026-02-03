"use client";

import { useEffect, useState } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';

export function OnlineOrdersBadge() {
    const { user } = useUser();
    const db = useFirestore();
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'public_orders'),
            where('userId', '==', user.uid),
            where('status', '==', 'pending_payment')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setCount(snapshot.size);
        });

        return () => unsubscribe();
    }, [user, db]);

    if (count === 0) return null;

    return (
        <Badge variant="destructive" className="ml-1 h-5 w-5 flex items-center justify-center p-0 rounded-full animate-pulse text-[10px]">
            {count}
        </Badge>
    );
}
