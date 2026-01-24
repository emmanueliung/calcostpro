
"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/header';
import { LifeBuoy, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SupportPage() {

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-2xl mx-auto">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-2xl flex items-center gap-2">
                                <LifeBuoy className="h-6 w-6" />
                                Soporte Técnico
                            </CardTitle>
                            <CardDescription>
                                ¿Necesitas ayuda o tienes alguna sugerencia? Estamos aquí para escucharte.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <p>
                                Tu opinión es muy importante para nosotros. Si encuentras un error, tienes una idea para mejorar CalcostPro, o simplemente necesitas ayuda con alguna función, no dudes en contactarnos.
                            </p>
                            
                            <div className="p-6 bg-primary/10 rounded-lg text-center">
                                <h3 className="font-semibold mb-3">La mejor forma de obtener ayuda</h3>
                                <a
                                  href="mailto:contact@calcostpro.com"
                                  className={cn(
                                    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                                    "bg-primary text-primary-foreground hover:bg-primary/90",
                                    "h-11 rounded-md px-8" // Corresponds to size="lg"
                                  )}
                                >
                                    <Mail className="mr-2 h-5 w-5" />
                                    Enviar un email a contact@calcostpro.com
                                </a>
                                <p className="text-xs text-muted-foreground mt-3">
                                    Normalmente respondemos en menos de 24 horas.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
