"use client";

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, onSnapshot } from "firebase/firestore";
import { AuthButton } from './auth-button';
import { Menu } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import Link from 'next/link';
import { Button } from './ui/button';
import { ADMIN_UID, ENTERPRISE_USERS } from '@/lib/roles';

interface ProfileData {
  name?: string;
  logoUrl?: string;
}

export function UserProfile() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const userDocRef = useMemoFirebase(() => user ? doc(db, "users", user.uid) : null, [db, user]);

  useEffect(() => {
    if (userDocRef) {
      setProfileLoading(true);
      const unsubscribe = onSnapshot(userDocRef, (userDocSnap) => {
        if (userDocSnap.exists()) {
          setProfileData(userDocSnap.data() as ProfileData);
        } else {
          setProfileData(null);
        }
        setProfileLoading(false);
      }, (error) => {
        console.error("Failed to fetch user profile:", error);
        setProfileLoading(false);
      });
      return () => unsubscribe();
    } else if (!isUserLoading) {
      setProfileData(null);
      setProfileLoading(false);
    }
  }, [userDocRef, isUserLoading]);

  const isAdmin = useMemo(() => {
    if (isUserLoading || !user) return false;
    return user.uid === ADMIN_UID;
  }, [user, isUserLoading]);

  const isEnterprise = useMemo(() => {
    if (isUserLoading || !user || !user.email) return false;
    return ENTERPRISE_USERS.includes(user.email);
  }, [user, isUserLoading]);

  if (isUserLoading || (profileLoading && user)) {
    return <Skeleton className="h-8 w-8 rounded-full" />;
  }

  if (!user) {
    return null;
  }

  const displayName = profileData?.name || user?.displayName || user?.email || 'Usuario';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-auto w-auto p-1">
          <Menu className="h-6 w-6" />
          <span className="sr-only">Abrir menú</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none truncate">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground truncate">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link href="/dashboard">Escritorio</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/materials">Materiales</Link></DropdownMenuItem>

        {isEnterprise && (
          <DropdownMenuItem asChild><Link href="/summaries">Resúmenes de Consumo</Link></DropdownMenuItem>
        )}

        {isAdmin && (
          <>
            <DropdownMenuItem asChild>
              <Link href="/admin">Admin</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/bonus-codes">Códigos Bonus</Link>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuItem asChild><Link href="/settings">Ajustes</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/subscription">Suscripción</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/support">Soporte</Link></DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <AuthButton mode="logout" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
