"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/firebase";
import { Facture, FactureType } from "@/lib/types";
import { Loader2, UploadCloud, DownloadCloud, Brain, FileSpreadsheet, Building2, Receipt, TrendingDown, TrendingUp, AlertCircle, CheckCircle2, PlusCircle } from "lucide-react";
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
    
    // Manual Entry State
    const [manualEntry, setManualEntry] = useState({
        fournisseur: "",
        montant: "",
        date: new Date().toISOString().split('T')[0],
        isFuel: false
    });
    const [aiSuggestion, setAiSuggestion] = useState<{isDeductible?: boolean, reason?: string, loading: boolean}>({ loading: false });

    // Derived State
    const totalAchats = factures.filter(f => f.type === 'Achat').reduce((sum, f) => sum + f.montantTotal, 0);
    const totalVentes = factures.filter(f => f.type === 'Vente').reduce((sum, f) => sum + f.montantTotal, 0);
    
    // Updated Credit Fiscal calculation for Bolivia
    const creditFiscal = factures.filter(f => f.type === 'Achat').reduce((sum, f) => {
        const base = f.isFuel ? f.montantTotal * 0.7 : f.montantTotal;
        return sum + (base * 0.13); // Bolivian IVA is 13%
    }, 0);

    const debitFiscal = factures.filter(f => f.type === 'Vente').reduce((sum, f) => sum + (f.montantTotal * 0.13), 0);
    const ivaPayable = Math.max(0, debitFiscal - creditFiscal);

    const handleManualSubmit = async () => {
        if (!manualEntry.fournisseur || !manualEntry.montant || !user) return;
        
        setIsImporting(true);
        try {
            const montant = parseFloat(manualEntry.montant);
            const baseImposable = manualEntry.isFuel ? montant * 0.7 : montant;

            const newFacture: Facture = {
                id: crypto.randomUUID(),
                userId: user.uid,
                nFacture: "MANU-" + Date.now().toString().slice(-6),
                date: manualEntry.date,
                nit: "0",
                fournisseurClient: manualEntry.fournisseur,
                montantTotal: montant,
                creditDebitFiscal: baseImposable * 0.13,
                type: 'Achat',
                isFuel: manualEntry.isFuel,
                isDeductible: aiSuggestion.isDeductible,
                deductibilityReason: aiSuggestion.reason,
                status: 'Reviewed',
                createdAt: new Date().toISOString()
            };

            const res = await fetch('/api/factures', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ factures: [newFacture] })
            });

            if (res.ok) {
                toast({ title: "Saisie enregistrée", description: "La facture a été ajoutée manuellement." });
                setManualEntry({ fournisseur: "", montant: "", date: new Date().toISOString().split('T')[0], isFuel: false });
                setAiSuggestion({ loading: false });
                await loadFactures();
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de sauvegarder" });
        } finally {
            setIsImporting(false);
        }
    };

    const getAiSuggestion = async () => {
        if (!manualEntry.fournisseur) return;
        setAiSuggestion(prev => ({ ...prev, loading: true }));
        try {
            const res = await fetch('/api/ai/categorize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ supplierName: manualEntry.fournisseur })
            });
            if (res.ok) {
                const data = await res.json();
                setAiSuggestion({
                    isDeductible: data.isDeductible,
                    reason: data.deductibilityReason,
                    loading: false
                });
            }
        } catch (e) {
            setAiSuggestion(prev => ({ ...prev, loading: false }));
        }
    };

    if (loading && factures.length === 0) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <Tabs defaultValue="dashboard" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 lg:w-[500px]">
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                <TabsTrigger value="manual">Saisie Manuelle</TabsTrigger>
                <TabsTrigger value="import">Import SIAT</TabsTrigger>
                <TabsTrigger value="liste">Liste</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="bg-white/50 backdrop-blur-sm border-emerald-100 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium text-emerald-900">Ventes Totales</CardTitle>
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-emerald-700">{totalVentes.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs</div>
                            <p className="text-xs text-muted-foreground mt-1">Débit Fiscal: {debitFiscal.toFixed(2)} Bs</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-white/50 backdrop-blur-sm shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium">Achats Totaux</CardTitle>
                            <TrendingDown className="w-4 h-4 text-red-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalAchats.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs</div>
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
                            <p className="text-xs text-muted-foreground mt-1 text-purple-600/80">Analysées par Gemma</p>
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
                                const tabTrigger = document.querySelector('[value="manual"]') as HTMLElement;
                                if (tabTrigger) tabTrigger.click();
                            }}>
                                <PlusCircle className="mr-3 h-5 w-5 text-primary" />
                                <div className="flex flex-col items-start">
                                    <span className="font-semibold">Saisie Manuelle Rapide</span>
                                    <span className="text-xs text-muted-foreground font-normal">Essence, loyer, frais divers</span>
                                </div>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>

            <TabsContent value="manual">
                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Nouvelle Saisie Directe</CardTitle>
                            <CardDescription>Entrez vos factures du quotidien qui n'ont pas encore été exportées du SIAT.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Nom du Fournisseur</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="Ex: YPFB, Viva, Supermercado..."
                                        value={manualEntry.fournisseur}
                                        onChange={(e) => setManualEntry({ ...manualEntry, fournisseur: e.target.value })}
                                        onBlur={getAiSuggestion}
                                    />
                                    <Button variant="ghost" size="icon" onClick={getAiSuggestion} disabled={aiSuggestion.loading}>
                                        <Brain className={`h-4 w-4 ${aiSuggestion.loading ? 'animate-pulse text-purple-500' : 'text-muted-foreground'}`} />
                                    </Button>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Montant Total (Bs)</label>
                                    <input 
                                        type="number" 
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="0.00"
                                        value={manualEntry.montant}
                                        onChange={(e) => setManualEntry({ ...manualEntry, montant: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Date</label>
                                    <input 
                                        type="date" 
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={manualEntry.date}
                                        onChange={(e) => setManualEntry({ ...manualEntry, date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center space-x-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
                                <input 
                                    type="checkbox" 
                                    id="isFuel" 
                                    className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                                    checked={manualEntry.isFuel}
                                    onChange={(e) => setManualEntry({ ...manualEntry, isFuel: e.target.checked })}
                                />
                                <label htmlFor="isFuel" className="text-sm font-medium text-amber-900 cursor-pointer">
                                    C'est une facture de carburant (Essence/Gasoil) ?
                                    <span className="block text-[10px] font-normal text-amber-700">Applique la règle bolivienne de base imposable à 70%</span>
                                </label>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full" onClick={handleManualSubmit} disabled={isImporting || !manualEntry.fournisseur}>
                                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                Enregistrer la Facture
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card className={`border-2 transition-colors ${aiSuggestion.isDeductible === true ? 'border-emerald-200 bg-emerald-50/30' : aiSuggestion.isDeductible === false ? 'border-red-200 bg-red-50/30' : 'border-dashed'}`}>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Brain className="h-5 w-5 text-purple-500" />
                                Analyse d'Intelligence Fiscale
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {aiSuggestion.loading ? (
                                <div className="space-y-4 animate-pulse">
                                    <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                                    <div className="h-20 bg-slate-200 rounded w-full"></div>
                                </div>
                            ) : aiSuggestion.isDeductible !== undefined ? (
                                <>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={aiSuggestion.isDeductible ? 'default' : 'destructive'} className={aiSuggestion.isDeductible ? 'bg-emerald-500' : 'bg-red-500'}>
                                            {aiSuggestion.isDeductible ? 'DÉDUCTIBLE' : 'NON DÉDUCTIBLE'}
                                        </Badge>
                                        <span className="text-sm font-medium text-slate-600">Suggestion Gemma</span>
                                    </div>
                                    <p className="text-sm text-slate-700 leading-relaxed font-medium italic">
                                        "{aiSuggestion.reason}"
                                    </p>
                                    <div className="p-3 rounded bg-white/50 text-[11px] text-muted-foreground border border-slate-100">
                                        Cette analyse tient compte de vos secteurs : <strong>Confection Textile</strong> & <strong>Développement Web</strong>.
                                    </div>
                                </>
                            ) : (
                                <div className="h-40 flex flex-col items-center justify-center text-center text-muted-foreground text-sm px-10">
                                    <AlertCircle className="h-8 w-8 mb-2 opacity-20" />
                                    Entrez un nom de fournisseur pour que Gemma analyse la déductibilité.
                                </div>
                            )}
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
                                        <TableHead>Déductible (IA)</TableHead>
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
                                                        {facture.isFuel && ' ⛽'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">{facture.nFacture}</TableCell>
                                                <TableCell>{facture.date}</TableCell>
                                                <TableCell className="font-medium">{facture.fournisseurClient}</TableCell>
                                                <TableCell>
                                                    {facture.isDeductible !== undefined ? (
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-1">
                                                                {facture.isDeductible ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <AlertCircle className="h-3 w-3 text-red-500" />}
                                                                <span className={`text-[10px] font-bold ${facture.isDeductible ? 'text-emerald-700' : 'text-red-700'}`}>
                                                                    {facture.isDeductible ? 'OUI' : 'NON'}
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] text-muted-foreground italic truncate max-w-[120px]" title={facture.deductibilityReason}>
                                                                {facture.deductibilityReason}
                                                            </span>
                                                        </div>
                                                    ) : '-'}
                                                </TableCell>
                                                <TableCell className="text-right font-medium">{facture.montantTotal.toFixed(2)}</TableCell>
                                                <TableCell className="text-right font-medium text-muted-foreground">
                                                    {facture.creditDebitFiscal.toFixed(2)}
                                                    {facture.isFuel && <span className="block text-[8px] font-normal">(70% Base)</span>}
                                                </TableCell>
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
