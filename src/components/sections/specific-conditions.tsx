
"use client";

import type { ProjectConfiguration } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SpecificConditionsProps {
  conditions: ProjectConfiguration['quoteSpecificConditions'];
  setConditions: (updater: (prev: ProjectConfiguration['quoteSpecificConditions']) => ProjectConfiguration['quoteSpecificConditions']) => void;
}

export function SpecificConditionsSection({ conditions, setConditions }: SpecificConditionsProps) {

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setConditions(prev => ({ ...prev, [id]: value }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl">Condiciones Específicas del Devis</CardTitle>
        <CardDescription>Ajuste los detalles de validez, entrega y fecha para esta cotización específica.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="validity">Validez de la oferta</Label>
              <Input id="validity" placeholder="p. ej., 15 días" value={conditions?.validity || ''} onChange={handleChange} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="deliveryTime">Tiempo de entrega</Label>
                <Input id="deliveryTime" placeholder="p. ej., 30 días hábiles" value={conditions?.deliveryTime || ''} onChange={handleChange} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="deliveryPlace">Lugar de entrega</Label>
                <Input id="deliveryPlace" placeholder="p. ej., Nuestros talleres" value={conditions?.deliveryPlace || ''} onChange={handleChange} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="quoteDate">Date du devis (opcional)</Label>
                <Input id="quoteDate" type="date" value={conditions?.quoteDate || ''} onChange={handleChange} />
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
