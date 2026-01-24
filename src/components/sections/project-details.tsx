
"use client";

import type { ProjectConfiguration } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ProjectDetailsProps {
  details: ProjectConfiguration['projectDetails'];
  setDetails: (updater: (prev: ProjectConfiguration['projectDetails']) => ProjectConfiguration['projectDetails']) => void;
}

export function ProjectDetailsSection({ details, setDetails }: ProjectDetailsProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setDetails(prev => ({ ...prev, [id]: value }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl">Información General</CardTitle>
        <CardDescription>Define los detalles del cliente y del proyecto.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="clientName">Nombre del Cliente</Label>
              <Input id="clientName" placeholder="p. ej., Juan Pérez" value={details.clientName} onChange={handleChange} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="projectName">Nombre del Proyecto</Label>
                <Input id="projectName" placeholder="p. ej., Camisetas para evento Tech" value={details.projectName} onChange={handleChange} />
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
