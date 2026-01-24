
import React from 'react';
import { Home } from 'lucide-react';
import { UserProfile } from './user-profile';
import Link from 'next/link';
import { Button } from './ui/button';
import Image from 'next/image';

import { ModuleMenu } from './module-menu';

// This is now a simple server component that just structures the header.
export function Header() {
  return (
    <header className="sticky top-0 z-10 w-full bg-background/80 backdrop-blur-sm border-b no-print">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/logo-calcostpro.png"
              alt="CalcostPro Logo"
              width={100}
              height={50}
              className="object-contain"
            />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="h-auto w-auto p-1">
            <Link href="/dashboard" aria-label="Escritorio">
              <Home className="h-6 w-6" />
            </Link>
          </Button>
          <ModuleMenu />
          {/* UserProfile is the only client component here */}
          <UserProfile />
        </div>
      </div>
    </header>
  );
}
