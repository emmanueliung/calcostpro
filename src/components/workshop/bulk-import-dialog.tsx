"use client";

import { useState } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { College, StudentMeasurements } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


interface BulkImportDialogProps {
    defaultCollege?: string;
    availableColleges: College[];
    onSuccess: () => void;
}

export function BulkImportDialog({ defaultCollege, availableColleges, onSuccess }: BulkImportDialogProps) {
    const { user } = useUser();
    const db = useFirestore();
    const { toast } = useToast();

    const [open, setOpen] = useState(false);
    // defaultCollege might be an ID or a name. Find the config.
    const initialCollegeConfig = availableColleges.find(c => c.id === defaultCollege || c.name === defaultCollege);
    const [college, setCollege] = useState(initialCollegeConfig?.id || defaultCollege || '');
    const [inputText, setInputText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [previewList, setPreviewList] = useState<string[]>([]);
    const [step, setStep] = useState<'input' | 'preview'>('input');
    const [importGender, setImportGender] = useState<'Hombre' | 'Mujer'>('Hombre');

    const handlePreview = () => {
        if (!college) {
            toast({ variant: 'destructive', title: 'Falta el colegio', description: 'Debes especificar el nombre del colegio.' });
            return;
        }

        // Split by new line, trim, and filter empty
        const lines = inputText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

        if (lines.length === 0) {
            toast({ variant: 'destructive', title: 'Lista vacía', description: 'Ingresa al menos un nombre.' });
            return;
        }

        setPreviewList(lines);
        setStep('preview');
    };

    const handleImport = async () => {
        if (!user || previewList.length === 0) return;

        setIsProcessing(true);
        try {
            const batch = writeBatch(db);
            const studentsRef = collection(db, "students");

            // Find the config for the selected college value (which could be ID or name)
            const matchedConfig = availableColleges.find(c => c.id === college || c.name === college);
            const collegeName = matchedConfig?.name || college;
            const collegeId = matchedConfig?.id || '';
            const classroom = matchedConfig?.course || '';

            const defaultMeasurements: StudentMeasurements = {
                height: 0, chest: 0, waist: 0, hips: 0, sleeve: 0, leg: 0, shoulder: 0, neck: 0
            };

            previewList.forEach(name => {
                const newDocRef = doc(studentsRef); // Generate ID automatically
                batch.set(newDocRef, {
                    userId: user.uid,
                    name: name,
                    college: collegeName,
                    collegeId: collegeId,
                    classroom: classroom,
                    gender: importGender,
                    measurements: defaultMeasurements,
                    createdAt: serverTimestamp()
                });
            });

            await batch.commit();

            toast({
                title: 'Importación Exitosa',
                description: `Se han creado ${previewList.length} estudiantes en "${college}".`
            });

            setOpen(false);
            onSuccess();
            // Reset
            setInputText('');
            setPreviewList([]);
            setStep('input');

        } catch (error) {
            console.error("Bulk import error:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Ocurrió un error al importar.' });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <UploadCloud className="h-4 w-4" /> Importar Lista
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Importar Estudiantes Masivamente</DialogTitle>
                    <DialogDescription>
                        Copia y pega una lista de nombres (uno por línea) para agilizar el registro.
                    </DialogDescription>
                </DialogHeader>

                {step === 'input' ? (
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Colegio *</Label>
                            {availableColleges.length > 0 ? (
                                <Select value={college} onValueChange={setCollege}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar Colegio" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableColleges.map(c => (
                                            <SelectItem key={c.id} value={c.id}>
                                                {c.name} {c.course ? `(${c.course})` : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    placeholder="Ej: La Salle"
                                    value={college}
                                    onChange={(e) => setCollege(e.target.value)}
                                />
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Género para esta lista</Label>
                            <Select value={importGender} onValueChange={(val: any) => setImportGender(val)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Hombre">Hombre (Varones)</SelectItem>
                                    <SelectItem value="Mujer">Mujer (Damas)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Lista de Nombres (Uno por línea)</Label>
                            <Textarea
                                placeholder={`Juan Perez\nMaria Gomez\nPedro Almodovar`}
                                className="min-h-[200px]"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground w-full text-right">{inputText.split(/\r?\n/).filter(x => x.trim()).length} nombres detectados</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 py-4">
                        <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-800 rounded-md text-sm">
                            <AlertCircle className="h-4 w-4" />
                            <span>Se crearán <strong>{previewList.length}</strong> estudiantes en <strong>{college}</strong>.</span>
                        </div>
                        <div className="border rounded-md">
                            <ScrollArea className="h-[200px] w-full p-2">
                                {previewList.map((name, i) => (
                                    <div key={i} className="py-1 px-2 border-b last:border-0 text-sm flex items-center gap-2">
                                        <span className="text-muted-foreground text-xs w-6">{i + 1}.</span>
                                        {name}
                                    </div>
                                ))}
                            </ScrollArea>
                        </div>
                    </div>
                )}

                <DialogFooter className="gap-2 sm:justify-between">
                    {step === 'input' ? (
                        <>
                            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                            <Button onClick={handlePreview} disabled={!college || !inputText}>Revisar</Button>
                        </>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={() => setStep('input')} disabled={isProcessing}>Atrás</Button>
                            <Button onClick={handleImport} disabled={isProcessing}>
                                {isProcessing ? 'Importando...' : 'Confirmar Importación'}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
