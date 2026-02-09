"use client";

import { useState, useEffect } from "react";
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from "firebase/firestore";
import { TechnicalSheet } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Scissors, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface TemplateSelectorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (template: TechnicalSheet) => void;
}

export function TemplateSelector({ open, onOpenChange, onSelect }: TemplateSelectorProps) {
    const { user } = useUser();
    const db = useFirestore();
    const [templates, setTemplates] = useState<TechnicalSheet[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        if (open && user) {
            loadTemplates();
        }
    }, [open, user]);

    const loadTemplates = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const q = query(collection(db, "technical_sheets"), where("userId", "==", user.uid));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TechnicalSheet));
            setTemplates(data);
        } catch (error) {
            console.error("Error loading templates:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredTemplates = templates.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Seleccionar Modelo</DialogTitle>
                </DialogHeader>

                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nombre o categoría..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex-1 overflow-y-auto min-h-[300px] p-1">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredTemplates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-2">
                            <Scissors className="h-12 w-12 opacity-20" />
                            <p>No se encontraron modelos.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredTemplates.map(template => (
                                <Card
                                    key={template.id}
                                    className="cursor-pointer hover:border-primary transition-all hover:shadow-md"
                                    onClick={() => {
                                        onSelect(template);
                                        onOpenChange(false);
                                    }}
                                >
                                    <CardContent className="p-4 flex flex-col gap-3">
                                        <div className="aspect-video bg-muted rounded-md flex items-center justify-center overflow-hidden relative">
                                            {template.imageUrl ? (
                                                <img src={template.imageUrl} alt={template.name} className="object-cover w-full h-full" />
                                            ) : (
                                                <Scissors className="h-8 w-8 text-muted-foreground/50" />
                                            )}
                                            <Badge variant="secondary" className="absolute bottom-2 left-2 shadow-sm">
                                                {template.category}
                                            </Badge>
                                        </div>
                                        <div>
                                            <h4 className="font-semibold leading-tight">{template.name}</h4>
                                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                {template.components.length} componentes • {template.sizeConsumptions.length} tallas
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
