
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
    <header 
      className="sticky top-0 z-10 w-full border-b border-white/10 no-print shadow-md" 
      style={{ backgroundColor: '#033E8C', color: 'white' }}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="bg-white/10 p-1.5 rounded-lg backdrop-blur-sm border border-white/20">
              <Image
                src="/logo-calcostpro.png"
                alt="CalcostPro Logo"
                width={110}
                height={45}
                className="object-contain brightness-0 invert"
              />
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-9 w-9 text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
            <Link href="/dashboard" aria-label="Escritorio">
              <Home className="h-5 w-5" />
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
