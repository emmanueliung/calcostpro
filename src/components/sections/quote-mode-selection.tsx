
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { QuoteMode } from "@/lib/types";
import { Users, User } from "lucide-react";

interface QuoteModeSelectionProps {
  quoteMode: QuoteMode;
  setQuoteMode: (mode: QuoteMode) => void;
}

export function QuoteModeSelection({ quoteMode, setQuoteMode }: QuoteModeSelectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl">Tipo de Cotización</CardTitle>
        <CardDescription>Elige el modelo que mejor se adapte a tu cliente.</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={quoteMode}
          onValueChange={(value: string) => setQuoteMode(value as QuoteMode)}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <Label htmlFor="individual" className={`flex flex-col items-start gap-4 rounded-lg border p-4 cursor-pointer transition-colors ${quoteMode === 'individual' ? 'bg-primary/10 border-primary' : 'hover:bg-accent/50'}`}>
            <div className="flex items-center gap-3">
              <RadioGroupItem value="individual" id="individual" />
              <div className="font-bold flex items-center gap-2">
                <User className="h-5 w-5" />
                Individual (por Talla)
              </div>
            </div>
            <p className="text-sm text-muted-foreground ml-7">
              Ideal para ventas a clientes finales, como en colegios, donde cada persona elige su talla y paga un precio por prenda.
            </p>
          </Label>
          
          <Label htmlFor="group" className={`flex flex-col items-start gap-4 rounded-lg border p-4 cursor-pointer transition-colors ${quoteMode === 'group' ? 'bg-primary/10 border-primary' : 'hover:bg-accent/50'}`}>
            <div className="flex items-center gap-3">
              <RadioGroupItem value="group" id="group" />
               <div className="font-bold flex items-center gap-2">
                <Users className="h-5 w-5" />
                Por Lote (Empresas)
              </div>
            </div>
             <p className="text-sm text-muted-foreground ml-7">
              Perfecto para clientes corporativos que piden un lote de varios productos (ej. 50 poleras, 30 pantalones) y necesitan un costo total.
            </p>
          </Label>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
