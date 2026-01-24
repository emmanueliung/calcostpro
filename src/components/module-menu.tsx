"use client";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LayoutGrid, Scissors, ClipboardList, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function ModuleMenu() {
    const router = useRouter();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9">
                    <LayoutGrid className="h-5 w-5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">Módulos</p>
                        <p className="text-xs leading-none text-muted-foreground">
                            Herramientas adicionales
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => router.push('/workshop')}>
                        <Scissors className="mr-2 h-4 w-4" />
                        <span>Taller (Guichet)</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/workshop/production')}>
                        <ClipboardList className="mr-2 h-4 w-4" />
                        <span>Producción</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push('/workshop/settings')}>
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Configuración</span>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
