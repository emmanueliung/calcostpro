"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/firebase";
import { Facture, FactureType } from "@/lib/types";
import { Loader2, UploadCloud, DownloadCloud, Brain, FileSpreadsheet, Building2, Receipt, TrendingDown, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';

export default function AccountingDashboard() {
    const { user } = useUser();
    const { toast } = useToast();
    
    // State
    const [factures, setFactures] = useState<Facture[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Import State
    const [csvData, setCsvData] = useState("");
    const [isImporting, setIsImporting] = useState(false);
    
    // Derived State
    const totalAchats = factures.filter(f => f.type === 'Achat').reduce((sum, f) => sum + f.montantTotal, 0);
    const totalVentes = factures.filter(f => f.type === 'Vente').reduce((sum, f) => sum + f.montantTotal, 0);
    const creditFiscal = factures.filter(f => f.type === 'Achat').reduce((sum, f) => sum + f.creditDebitFiscal, 0);
    const debitFiscal = factures.filter(f => f.type === 'Vente').reduce((sum, f) => sum + f.creditDebitFiscal, 0);
    const ivaPayable = Math.max(0, debitFiscal - creditFiscal);
    
    // Chart Data
    const sectorData = factures.reduce((acc, f) => {
        if (f.type === 'Achat' && f.secteurActivite) {
            const existing = acc.find(item => item.name === f.secteurActivite);
            if (existing) {
                existing.value += f.montantTotal;
            } else {
                acc.push({ name: f.secteurActivite, value: f.montantTotal });
            }
        }
        return acc;
    }, [] as {name: string, value: number}[]).sort((a,b) => b.value - a.value).slice(0, 5);

    useEffect(() => {
        if (user) {
            loadFactures();
        }
    }, [user]);

    const loadFactures = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const res = await fetch('/api/factures');
            if (res.ok) {
                let data: Facture[] = await res.json();
                // Filter locally by user
                data = data.filter(f => f.userId === user.uid);
                setFactures(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            }
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les factures" });
        } finally {
            setLoading(false);
        }
    };

    const handleImportSIAT = async () => {
        if (!csvData.trim() || !user) return;
        setIsImporting(true);
        try {
            const lines = csvData.trim().split('\n');
            if (lines.length < 1) return;

            // Detect separator (comma, semicolon or tab)
            const firstLine = lines[0];
            let separator = ",";
            if (firstLine.includes(';')) separator = ";";
            else if (firstLine.includes('\t')) separator = "\t";

            const headers = lines[0].split(separator).map(h => h.trim().toUpperCase());
            
            // Map headers to indices
            const getIdx = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.includes(k)));
            
            const idx = {
                nFacture: getIdx(['NRO. DE LA FACTURA', 'NRO FACTURA', 'NUMERO FACTURA', 'Nro. de la Factura']),
                date: getIdx(['FECHA DE LA FACTURA', 'FECHA FACTURA', 'FECHA']),
                nit: getIdx(['NIT / CI', 'NIT PROVEEDOR', 'NIT CLIENTE', 'NIT/CI']),
                nom: getIdx(['NOMBRE O RAZON SOCIAL', 'NOMBRE', 'RAZON SOCIAL', 'NOMBRE O RAZÓN SOCIAL']),
                total: getIdx(['IMPORTE TOTAL', 'MONTO TOTAL', 'TOTAL DE LA VENTA', 'TOTAL COMPRA']),
                impot: getIdx(['CREDITO FISCAL', 'DEBITO FISCAL', 'DÉBITO FISCAL', 'CRÉDITO FISCAL']),
            };

            const parsedFactures: Omit<Facture, 'id' | 'createdAt'>[] = [];
            
            // Start from line 1 if line 0 is a header, else start from 0
            const startLine = idx.date !== -1 ? 1 : 0;

            for (let i = startLine; i < lines.length; i++) {
                const parts = lines[i].split(separator).map(p => p.trim().replace(/^"|"$/g, ''));
                if (parts.length < 3) continue; 

                // Use mapping or defaults
                const nFacture = idx.nFacture !== -1 ? parts[idx.nFacture] : parts[0];
                const date = idx.date !== -1 ? parts[idx.date] : parts[1];
                const nit = idx.nit !== -1 ? parts[idx.nit] : parts[2];
                const fournisseurClient = idx.nom !== -1 ? parts[idx.nom] : parts[3];
                
                // Handle numbers with comma or dot
                const cleanNum = (val: string) => parseFloat(val.replace(',', '.')) || 0;
                const montantTotal = idx.total !== -1 ? cleanNum(parts[idx.total]) : cleanNum(parts[4]);
                const creditDebitFiscal = idx.impot !== -1 ? cleanNum(parts[idx.impot]) : (montantTotal * 0.13); // Default to 13%
                
                // Logic to detect if it's Achat or Vente based on headers or content
                const isVente = headers.some(h => h.includes('VENTA') || h.includes('DEBITO'));
                const type = (isVente ? 'Vente' : 'Achat') as FactureType;
                
                let secteurActivite = "Non catégorisé";
                let categorieDepense = "Non catégorisée";

                if (type === 'Achat') {
                    try {
                        const res = await fetch('/api/ai/categorize', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ supplierName: fournisseurClient })
                        });
                        if (res.ok) {
                            const aiData = await res.json();
                            secteurActivite = aiData.secteurActivite || secteurActivite;
                            categorieDepense = aiData.categorieDepense || categorieDepense;
                        }
                    } catch (aiError) {
                        console.error('AI Categorization failed', aiError);
                    }
                }

                parsedFactures.push({
                    userId: user.uid,
                    nFacture,
                    date,
                    nit,
                    fournisseurClient,
                    montantTotal,
                    creditDebitFiscal,
                    type,
                    secteurActivite,
                    categorieDepense,
                    status: 'Imported'
                });
            }

            if (parsedFactures.length === 0) {
                throw new Error("Aucune donnée valide détectée");
            }

            const newFacturesArray = parsedFactures.map(f => ({
                ...f,
                id: crypto.randomUUID(),
                createdAt: new Date().toISOString()
            }));

            const res = await fetch('/api/factures', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ factures: newFacturesArray })
            });

            if (!res.ok) throw new Error("Erreur API locale");

            toast({ title: "Import réussi", description: `${parsedFactures.length} factures enregistrées.` });
            setCsvData("");
            await loadFactures();

        } catch (error: any) {
            console.error(error);
            toast({ variant: "destructive", title: "Erreur d'import", description: error.message || "Vérifiez le format" });
        } finally {
            setIsImporting(false);
        }
    };

    const handleExportRCV = () => {
        if (factures.length === 0) {
            toast({ title: "Rien à exporter", description: "Aucune facture disponible." });
            return;
        }
        
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Type,N° Facture,Date,NIT,Fournisseur/Client,Montant Total,Crédit/Débit Fiscal,Secteur,Catégorie\n";
        
        factures.forEach(f => {
            const row = [f.type, f.nFacture, f.date, f.nit, `"${f.fournisseurClient}"`, f.montantTotal, f.creditDebitFiscal, `"${f.secteurActivite || ''}"`, `"${f.categorieDepense || ''}"`];
            csvContent += row.join(",") + "\n";
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Export_RCV_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading && factures.length === 0) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <Tabs defaultValue="dashboard" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                <TabsTrigger value="import">Import SIAT</TabsTrigger>
                <TabsTrigger value="liste">Liste Complète</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="bg-white/50 backdrop-blur-sm border-emerald-100 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium text-emerald-900">Ventes Totales</CardTitle>
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-emerald-700">{totalVentes.toFixed(2)} Bs</div>
                            <p className="text-xs text-muted-foreground mt-1">Débit Fiscal: {debitFiscal.toFixed(2)} Bs</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-white/50 backdrop-blur-sm shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium">Achats Totaux</CardTitle>
                            <TrendingDown className="w-4 h-4 text-red-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalAchats.toFixed(2)} Bs</div>
                            <p className="text-xs text-muted-foreground mt-1">Crédit Fiscal: {creditFiscal.toFixed(2)} Bs</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-primary/5 backdrop-blur-sm border-primary/20 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium text-primary">TVA à Payer (IVA)</CardTitle>
                            {ivaPayable > 0 ? <AlertCircle className="w-4 h-4 text-primary" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${ivaPayable > 0 ? 'text-primary' : 'text-emerald-600'}`}>{ivaPayable.toFixed(2)} Bs</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {ivaPayable === 0 ? "Crédit fiscal excédentaire" : "Débit > Crédit"}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-white/50 backdrop-blur-sm shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium">Factures Analysées</CardTitle>
                            <Brain className="w-4 h-4 text-purple-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{factures.length}</div>
                            <p className="text-xs text-muted-foreground mt-1 text-purple-600/80">Catégorisées par IA</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-muted-foreground" /> Top 5 Secteurs d'Achats</CardTitle>
                            <CardDescription>Catégorisés par l'Intelligence Artificielle (Gemma)</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            {sectorData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={sectorData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" />
                                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                                    <RechartsTooltip />
                                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                                        {sectorData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={`hsl(220, 80%, ${50 + index * 10}%)`} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-muted-foreground">Aucune donnée sectorielle</div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-muted-foreground" /> Actions Rapides</CardTitle>
                            <CardDescription>Gestion comptable et exports</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <Button className="w-full justify-start h-14 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700" onClick={handleExportRCV}>
                                <DownloadCloud className="mr-3 h-5 w-5" />
                                <div className="flex flex-col items-start">
                                    <span className="font-semibold">Export RCV (Comptable)</span>
                                    <span className="text-xs text-emerald-100 font-normal">Télécharger au format CSV</span>
                                </div>
                            </Button>
                            <Button variant="outline" className="w-full justify-start h-14" onClick={() => {
                                const tabTrigger = document.querySelector('[value="import"]') as HTMLElement;
                                if (tabTrigger) tabTrigger.click();
                            }}>
                                <UploadCloud className="mr-3 h-5 w-5 text-blue-500" />
                                <div className="flex flex-col items-start">
                                    <span className="font-semibold">Importer de nouvelles données</span>
                                    <span className="text-xs text-muted-foreground font-normal">Copier-coller depuis le SIAT</span>
                                </div>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>

            <TabsContent value="import">
                <Card className="border-dashed border-2 shadow-sm">
                    <CardHeader>
                        <CardTitle>Importation des données SIAT</CardTitle>
                        <CardDescription>
                            Collez ici les lignes du fichier Excel/CSV exporté depuis le SIAT. L'intelligence artificielle se chargera d'analyser le secteur d'activité et la catégorie de chaque fournisseur.<br/>
                            <strong>Format attendu séparé par des virgules (CSV) :</strong><br/>
                            <code className="bg-slate-100 p-1 rounded text-xs">N° Facture, Date (YYYY-MM-DD), NIT, Fournisseur/Client, Montant Total, Crédit/Débit Fiscal, Type (Achat ou Vente)</code>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Textarea 
                            placeholder="Exemple :
10293, 2026-04-10, 123456701, EMPRESA DE LUZ Y FUERZA ELECTRICA, 1500.50, 195.06, Achat
4402, 2026-04-11, 765432101, TEXTILES SAN MARCOS S.A., 5000.00, 650.00, Achat
5001, 2026-04-12, 10203040, JUAN PEREZ, 2500.00, 325.00, Vente" 
                            className="min-h-[300px] font-mono text-sm"
                            value={csvData}
                            onChange={(e) => setCsvData(e.target.value)}
                        />
                    </CardContent>
                    <CardFooter className="flex justify-between">
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Brain className="h-4 w-4 text-purple-500" />
                            Gemma (Ollama) identifiera les secteurs sur votre réseau local.
                        </p>
                        <Button 
                            onClick={handleImportSIAT} 
                            disabled={isImporting || !csvData.trim()}
                            className="bg-primary hover:bg-primary/90"
                        >
                            {isImporting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Traitement IA...</> : <><FileSpreadsheet className="mr-2 h-4 w-4" /> Lancer l'Importation</>}
                        </Button>
                    </CardFooter>
                </Card>
            </TabsContent>

            <TabsContent value="liste">
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Registre des Factures</CardTitle>
                        <CardDescription>Toutes les factures importées et enrichies par l'IA.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Type</TableHead>
                                        <TableHead>N° Facture</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Tier (Fournisseur/Client)</TableHead>
                                        <TableHead>Secteur / Categorie (IA)</TableHead>
                                        <TableHead className="text-right">Total (Bs)</TableHead>
                                        <TableHead className="text-right">Crédit/Débit (Bs)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {factures.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">Aucune facture importée</TableCell>
                                        </TableRow>
                                    ) : (
                                        factures.map((facture) => (
                                            <TableRow key={facture.id}>
                                                <TableCell>
                                                    <Badge variant={facture.type === 'Achat' ? 'secondary' : 'default'} className={facture.type === 'Achat' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'}>
                                                        {facture.type}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">{facture.nFacture}</TableCell>
                                                <TableCell>{facture.date}</TableCell>
                                                <TableCell className="font-medium">{facture.fournisseurClient}</TableCell>
                                                <TableCell>
                                                    {facture.type === 'Achat' ? (
                                                       <div className="flex flex-col gap-1">
                                                            <span className="text-xs font-semibold text-slate-700">{facture.secteurActivite}</span>
                                                            <span className="text-[10px] text-muted-foreground truncate max-w-[150px]" title={facture.categorieDepense}>{facture.categorieDepense}</span>
                                                       </div>
                                                    ) : '-'}
                                                </TableCell>
                                                <TableCell className="text-right font-medium">{facture.montantTotal.toFixed(2)}</TableCell>
                                                <TableCell className="text-right font-medium text-muted-foreground">{facture.creditDebitFiscal.toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    );
}
