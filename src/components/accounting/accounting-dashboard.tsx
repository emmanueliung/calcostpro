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
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [factures, setFactures] = useState<Facture[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Saldo Favor & UFV State
    const [prevMonthSaldo, setPrevMonthSaldo] = useState(0);
    const [ufvData, setUfvData] = useState({ prev: 0, current: 0 });
    const [isSavingSaldo, setIsSavingSaldo] = useState(false);
    
    // Import State
    const [csvData, setCsvData] = useState("");
    const [isImporting, setIsImporting] = useState(false);
    
    // Manual Entry State
    const [manualEntry, setManualEntry] = useState({
        fournisseur: "",
        montant: "",
        baseImponible: "", // NEW: Base for 13% tax
        date: new Date().toISOString().split('T')[0],
        isFuel: false
    });
    const [aiSuggestion, setAiSuggestion] = useState<{isDeductible?: boolean, reason?: string, rule?: string, loading: boolean}>({ loading: false });

    // Derived State - Filtering by selected month
    const filteredFactures = factures.filter(f => f.date.startsWith(selectedMonth));
    
    const totalAchats = filteredFactures.filter(f => f.type === 'Achat').reduce((sum, f) => sum + f.montantTotal, 0);
    const totalVentes = filteredFactures.filter(f => f.type === 'Vente').reduce((sum, f) => sum + f.montantTotal, 0);
    
    // Mantenimiento de Valor calculation
    const maintenanceValor = (ufvData.prev > 0 && ufvData.current > 0 && prevMonthSaldo > 0) 
        ? prevMonthSaldo * (ufvData.current / ufvData.prev - 1) 
        : 0;

    const creditFiscalCurrent = filteredFactures.filter(f => f.type === 'Achat').reduce((sum, f) => {
        const base = f.baseImposable || (f.isFuel ? f.montantTotal * 0.7 : f.montantTotal);
        return sum + (base * 0.13); 
    }, 0);

    // Total Credit Fiscal = Current + Past + Maintenance
    const creditFiscalTotal = creditFiscalCurrent + prevMonthSaldo + maintenanceValor;

    const debitFiscal = filteredFactures.filter(f => f.type === 'Vente').reduce((sum, f) => {
        return sum + (f.montantTotal * 0.13);
    }, 0);

    const ivaPayable = Math.max(0, debitFiscal - creditFiscalTotal);
    const nextMonthSaldo = Math.max(0, creditFiscalTotal - debitFiscal);

    // Initial Load
    const loadFactures = async () => {
        if (!user) return;
        try {
            const res = await fetch(`/api/factures?userId=${user.uid}`);
            if (res.ok) {
                const data = await res.json();
                
                // Deduplicate items on the client side to avoid UI confusion
                // If the same invoice (Number, NIT, Date, Amount) exists multiple times, keep only one.
                const seen = new Set();
                const uniqueData = data.filter((f: Facture) => {
                    const key = `${f.type}-${f.nFacture}-${f.nit}-${f.date}-${f.montantTotal}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
                
                setFactures(uniqueData);
            }
        } catch (e) {
            console.error("Failed to load factures", e);
        } finally {
            setLoading(false);
        }
    };

    // Load Saldo Favor from previous month
    const loadSaldoFavor = async () => {
        if (!user) return;
        try {
            // Get previous month string
            const date = new Date(selectedMonth + "-01");
            date.setMonth(date.getMonth() - 1);
            const prevMonth = date.toISOString().slice(0, 7);
            
            const res = await fetch(`/api/saldo-favor?userId=${user.uid}&month=${prevMonth}`);
            if (res.ok) {
                const data = await res.json();
                setPrevMonthSaldo(data.saldo || 0);
                // Also load current month UFV config if exists
                const resCurrent = await fetch(`/api/saldo-favor?userId=${user.uid}&month=${selectedMonth}`);
                if (resCurrent.ok) {
                    const dataCurrent = await resCurrent.json();
                    setUfvData({ 
                        prev: dataCurrent.ufvPrevious || 0, 
                        current: dataCurrent.ufvCurrent || 0 
                    });
                }
            }
        } catch (e) {
            console.error("Failed to load saldo favor", e);
        }
    };

    useEffect(() => {
        if (user) {
            loadFactures();
            loadSaldoFavor();
        }
    }, [user, selectedMonth]);

    const handleSaveSaldo = async () => {
        if (!user) return;
        setIsSavingSaldo(true);
        try {
            const res = await fetch('/api/saldo-favor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.uid,
                    month: selectedMonth,
                    saldo: nextMonthSaldo,
                    ufvPrevious: ufvData.prev,
                    ufvCurrent: ufvData.current
                })
            });
            if (res.ok) {
                toast({ title: "Calcul Fiscal Enregistré", description: `Solde de ${nextMonthSaldo.toFixed(2)} Bs reporté.` });
            }
        } catch (e) {
            toast({ variant: "destructive", title: "Erreur", description: "Échec de sauvegarde du solde" });
        } finally {
            setIsSavingSaldo(false);
        }
    };

    const handleManualSubmit = async () => {
        const montant = parseFloat(manualEntry.montant);
        const base = parseFloat(manualEntry.baseImponible) || (manualEntry.isFuel ? montant * 0.7 : montant);

        if (!manualEntry.fournisseur || isNaN(montant) || !user) return;
        
        setIsImporting(true);
        try {
            const newFacture: Facture = {
                id: crypto.randomUUID(),
                userId: user.uid,
                nFacture: "MANU-" + Date.now().toString().slice(-6),
                date: manualEntry.date,
                nit: "0",
                fournisseurClient: manualEntry.fournisseur,
                montantTotal: montant,
                baseImposable: base,
                creditDebitFiscal: base * 0.13,
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
                toast({ title: "Facture ajoutée", description: "Enregistrée avec succès." });
                setManualEntry({ fournisseur: "", montant: "", baseImponible: "", date: new Date().toISOString().split('T')[0], isFuel: false });
                setAiSuggestion({ loading: false });
                await loadFactures();
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Erreur", description: "Échec de sauvegarde" });
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
                    rule: data.rule,
                    loading: false
                });

                // Auto-apply rules logic
                const total = parseFloat(manualEntry.montant);
                if (!isNaN(total)) {
                    if (data.rule === "FUEL_70") {
                        setManualEntry(prev => ({ ...prev, isFuel: true, baseImponible: (total * 0.7).toFixed(2) }));
                        toast({ title: "Règle Carburant appliquée", description: "Base imponible fixée à 70%" });
                    } else if (data.rule === "ELEC_EXEMPT") {
                        setManualEntry(prev => ({ ...prev, isFuel: false }));
                        toast({ title: "Facture Électricité", description: "Veuillez soustraire les taxes municipales du montant total." });
                    } else {
                        setManualEntry(prev => ({ ...prev, isFuel: false, baseImponible: total.toString() }));
                    }
                }
            }
        } catch (e) {
            setAiSuggestion(prev => ({ ...prev, loading: false }));
        }
    };
    
    // Sync base when montant changes for simple cases
    useEffect(() => {
        const total = parseFloat(manualEntry.montant);
        if (!isNaN(total) && !manualEntry.baseImponible) {
            setManualEntry(prev => ({ ...prev, baseImponible: manualEntry.isFuel ? (total * 0.7).toFixed(2) : total.toString() }));
        }
    }, [manualEntry.montant, manualEntry.isFuel]);

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
            const getIdx = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.includes(k)));
            
            const idx = {
                nFacture: getIdx(['NRO. DE LA FACTURA', 'NRO FACTURA', 'NUMERO FACTURA', 'Nro. de la Factura']),
                date: getIdx(['FECHA DE LA FACTURA', 'FECHA FACTURA', 'FECHA']),
                nit: getIdx(['NIT / CI', 'NIT PROVEEDOR', 'NIT CLIENTE', 'NIT/CI']),
                nom: getIdx(['NOMBRE O RAZON SOCIAL', 'NOMBRE', 'RAZON SOCIAL', 'NOMBRE O RAZÓN SOCIAL']),
                total: getIdx(['IMPORTE TOTAL', 'MONTO TOTAL', 'TOTAL DE LA VENTA', 'TOTAL COMPRA']),
                impot: getIdx(['CREDITO FISCAL', 'DEBITO FISCAL', 'DÉBITO FISCAL', 'CRÉDITO FISCAL', 'IVA']),
            };

            // Fix for cases where Total and Tax headers are too similar
            if (idx.total === idx.impot && idx.total !== -1) {
                // Try to find a better index for tax
                idx.impot = headers.findIndex((h, i) => i > idx.total && (h.includes('FISCAL') || h.includes('IVA')));
            }

            const parsedFactures: Omit<Facture, 'id' | 'createdAt'>[] = [];
            const startLine = idx.date !== -1 ? 1 : 0;

            for (let i = startLine; i < lines.length; i++) {
                const parts = lines[i].split(separator).map(p => p.trim().replace(/^"|"$/g, ''));
                if (parts.length < 3) continue; 

                const nFacture = idx.nFacture !== -1 ? parts[idx.nFacture] : parts[0];
                const date = idx.date !== -1 ? parts[idx.date] : parts[1];
                const nit = idx.nit !== -1 ? parts[idx.nit] : parts[2];
                const fournisseurClient = idx.nom !== -1 ? parts[idx.nom] : parts[3];
                const cleanNum = (val: string) => parseFloat(val.replace(',', '.')) || 0;
                const montantTotal = idx.total !== -1 ? cleanNum(parts[idx.total]) : cleanNum(parts[4]);
                
                // For SIAT imports, the SIAT already provides the Credit/Debit Fiscal. 
                // We divide by 0.13 to get the baseImposable.
                const creditDebitFiscal = idx.impot !== -1 ? cleanNum(parts[idx.impot]) : (montantTotal * 0.13);
                const baseImposable = creditDebitFiscal / 0.13;
                
                const isVente = headers.some(h => h.includes('VENTA') || h.includes('DEBITO'));
                const type = (isVente ? 'Vente' : 'Achat') as FactureType;
                
                let isDeductible = true;
                let deductibilityReason = "";
                let isFuel = false;

                if (type === 'Achat') {
                    try {
                        const res = await fetch('/api/ai/categorize', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ supplierName: fournisseurClient })
                        });
                        if (res.ok) {
                            const aiData = await res.json();
                            isDeductible = aiData.isDeductible;
                            deductibilityReason = aiData.deductibilityReason;
                            isFuel = aiData.rule === "FUEL_70";
                            if (isFuel) {
                                baseImposable = montantTotal * 0.7;
                            }
                        }
                    } catch (e) {}
                }

                const cleanId = (str: string) => str ? str.toString().replace(/[^a-zA-Z0-9]/g, '').trim() : '';
                // Stable ID should include date and amount to avoid collisions of same invoice number used on different occasions
                const stableId = `${type.toLowerCase()}-${cleanId(nit)}-${cleanId(nFacture)}-${cleanId(date)}-${Math.round(montantTotal)}`;

                parsedFactures.push({
                    id: stableId,
                    userId: user.uid,
                    nFacture,
                    date,
                    nit,
                    fournisseurClient,
                    montantTotal,
                    baseImposable,
                    creditDebitFiscal,
                    type,
                    isFuel,
                    isDeductible,
                    deductibilityReason,
                    status: 'Imported'
                } as Facture);
            }

            const res = await fetch('/api/factures', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ factures: parsedFactures.map(f => ({ ...f, createdAt: new Date().toISOString() })) })
            });

            if (res.ok) {
                toast({ title: "Import réussi" });
                setCsvData("");
                await loadFactures();
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Erreur", description: error.message });
        } finally {
            setIsImporting(false);
        }
    };

    const handleDeleteAll = async () => {
        if (!user || !confirm("Êtes-vous sûr de vouloir supprimer TOUTES vos factures ? Cette action est irréversible.")) return;
        
        setIsImporting(true);
        try {
            const res = await fetch(`/api/factures?userId=${user.uid}`, { method: 'DELETE' });
            if (res.ok) {
                toast({ title: "Données supprimées", description: "Votre historique a été réinitialisé." });
                setFactures([]);
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Erreur", description: "Échec de la suppression" });
        } finally {
            setIsImporting(false);
        }
    };

    const handleExportRCV = () => {
        if (factures.length === 0) return;
        let csvContent = "data:text/csv;charset=utf-8,Type,N° Facture,Date,NIT,Entité,Total,Base Imponible,IVA\n";
        factures.forEach(f => {
            csvContent += `${f.type},${f.nFacture},${f.date},${f.nit},"${f.fournisseurClient}",${f.montantTotal},${f.baseImposable || f.montantTotal},${f.creditDebitFiscal}\n`;
        });
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", "Export_Comptable.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading && factures.length === 0) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6">
            {/* GLOBAL FISCAL CONFIG (Visible on all tabs) */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="md:col-span-1 shadow-sm border-primary/10">
                    <CardHeader className="pb-2">
                         <CardTitle className="text-sm flex items-center gap-2">
                            Période Fiscale
                         </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <input 
                            type="month" 
                            className="w-full p-2 border rounded font-bold text-primary"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                        />
                    </CardContent>
                </Card>

                <Card className="md:col-span-2 shadow-sm border-primary/10">
                    <CardHeader className="pb-2">
                         <CardTitle className="text-sm flex items-center gap-2">
                            Mise à jour UFV (Mantenimiento de Valor)
                         </CardTitle>
                    </CardHeader>
                    <CardContent className="flex gap-4 items-end">
                        <div className="flex-1 space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase text-primary/70">UFV Fin Mois Précédent</label>
                            <input 
                                type="number" step="0.00001"
                                className="w-full p-2 border rounded text-xs bg-slate-50"
                                value={ufvData.prev || ''}
                                onChange={(e) => setUfvData({ ...ufvData, prev: parseFloat(e.target.value) })}
                                placeholder="ex: 2.34567"
                            />
                        </div>
                        <div className="flex-1 space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase text-primary/70">UFV Fin Mois Actuel</label>
                            <input 
                                type="number" step="0.00001"
                                className="w-full p-2 border rounded text-xs bg-slate-50"
                                value={ufvData.current || ''}
                                onChange={(e) => setUfvData({ ...ufvData, current: parseFloat(e.target.value) })}
                                placeholder="ex: 2.45678"
                            />
                        </div>
                        <Button variant="default" className="bg-primary" size="sm" onClick={handleSaveSaldo} disabled={isSavingSaldo}>
                            {isSavingSaldo ? <Loader2 className="h-4 w-4 animate-spin" /> : "Calculer & Sauver"}
                        </Button>
                    </CardContent>
                </Card>
            </div>

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
                            <p className="text-xs text-muted-foreground mt-1">Débit Fiscal: {debitFiscal.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-white/50 backdrop-blur-sm shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium">Achats Totaux</CardTitle>
                            <TrendingDown className="w-4 h-4 text-red-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalAchats.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs</div>
                            <p className="text-xs text-muted-foreground mt-1">Crédit Fiscal: {creditFiscal.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-primary/5 backdrop-blur-sm border-primary/20 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium text-primary">NET à payer au SIN (IVA)</CardTitle>
                            {ivaPayable > 0 ? <AlertCircle className="w-4 h-4 text-primary" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${ivaPayable > 0 ? 'text-primary' : 'text-emerald-600'}`}>{ivaPayable.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs</div>
                            <p className="text-xs text-muted-foreground mt-1 text-slate-500">
                                {ivaPayable === 0 ? "Crédit reportable au mois prochain" : "Montant effectif à payer"}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-white/50 backdrop-blur-sm shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium">Reporting Fiscal</CardTitle>
                            <Brain className="w-4 h-4 text-purple-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-lg font-bold">
                                {selectedMonth}
                            </div>
                            {prevMonthSaldo > 0 && (
                                <p className="text-[10px] text-emerald-600 font-medium mt-1">
                                    Report : +{prevMonthSaldo.toFixed(2)} Bs
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <Card className="shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">Calculateur de Crédit Fiscal Bolivien</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="text-sm space-y-2">
                                <div className="flex justify-between p-1">
                                    <span>Crédit Fiscal Mois</span>
                                    <span>{creditFiscalCurrent.toFixed(2)} Bs</span>
                                </div>
                                <div className="flex justify-between p-1 text-emerald-600">
                                    <span>Crédit Reporté Précédent</span>
                                    <span>+{prevMonthSaldo.toFixed(2)} Bs</span>
                                </div>
                                <div className="flex justify-between p-1 text-emerald-600 border-b pb-2">
                                    <span>Mantenimiento de Valor (UFV)</span>
                                    <span>+{maintenanceValor.toFixed(2)} Bs</span>
                                </div>
                                <div className="flex justify-between p-2 bg-slate-100 rounded font-bold">
                                    <span>Crédit Fiscal TOTAL</span>
                                    <span>{creditFiscalTotal.toFixed(2)} Bs</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-muted-foreground" /> Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <Button className="w-full justify-start h-14 bg-gradient-to-r from-emerald-500 to-teal-600" onClick={handleExportRCV}>
                                <DownloadCloud className="mr-3 h-5 w-5" />
                                <div className="flex flex-col items-start text-left">
                                    <span className="font-semibold text-white">Export RCV (Excel/CSV)</span>
                                    <span className="text-xs text-emerald-100 font-normal">Format officiel pour votre comptable</span>
                                </div>
                            </Button>
                            <Button variant="outline" className="w-full justify-start h-14" onClick={() => (document.querySelector('[value="manual"]') as HTMLElement).click()}>
                                <PlusCircle className="mr-3 h-5 w-5 text-primary" />
                                <div className="flex flex-col items-start text-left">
                                    <span className="font-semibold">Saisie Manuelle Rapide</span>
                                    <span className="text-xs text-muted-foreground font-normal">Pour factures papier et carburant</span>
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
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold uppercase text-muted-foreground">Fournisseur</label>
                                <div className="flex gap-2">
                                    <input 
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        placeholder="Ex: Entel, YPFB..."
                                        value={manualEntry.fournisseur}
                                        onChange={(e) => setManualEntry({ ...manualEntry, fournisseur: e.target.value })}
                                        onBlur={getAiSuggestion}
                                    />
                                    <Button variant="ghost" size="icon" onClick={getAiSuggestion}>
                                        <Brain className={`h-4 w-4 ${aiSuggestion.loading ? 'animate-pulse text-purple-500' : 'text-muted-foreground'}`} />
                                    </Button>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Montant Total (Bs)</label>
                                    <input 
                                        type="number" 
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={manualEntry.montant}
                                        onChange={(e) => setManualEntry({ ...manualEntry, montant: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Base Imponible (Bs)</label>
                                    <input 
                                        type="number" 
                                        className="flex h-10 w-full rounded-md border border-input bg-blue-50/50 px-3 py-2 text-sm font-bold border-blue-200"
                                        value={manualEntry.baseImponible}
                                        onChange={(e) => setManualEntry({ ...manualEntry, baseImponible: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center space-x-2 p-3 bg-slate-50 rounded-lg border">
                                <input 
                                    type="checkbox" 
                                    id="isFuel" 
                                    className="h-4 w-4 rounded"
                                    checked={manualEntry.isFuel}
                                    onChange={(e) => setManualEntry({ ...manualEntry, isFuel: e.target.checked })}
                                />
                                <label htmlFor="isFuel" className="text-xs font-medium cursor-pointer">
                                    Facture Carburant (Règle 70%)
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

                    <Card className={`border-2 transition-colors ${aiSuggestion.isDeductible === true ? 'border-emerald-200 bg-emerald-50/20' : 'border-dashed'}`}>
                        <CardHeader className="pb-2">
                             <CardTitle className="text-sm flex items-center gap-2"><Brain className="h-4 w-4 text-purple-500" /> Analyse IA (Gemma)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {aiSuggestion.loading ? (
                                <div className="h-20 flex items-center justify-center"><Loader2 className="animate-spin h-5 w-5 text-muted-foreground" /></div>
                            ) : aiSuggestion.isDeductible !== undefined ? (
                                <>
                                    <div className="flex items-center gap-2">
                                        <Badge className={aiSuggestion.isDeductible ? 'bg-emerald-500' : 'bg-red-500'}>
                                            {aiSuggestion.isDeductible ? 'DÉDUCTIBLE' : 'NON DÉDUCTIBLE'}
                                        </Badge>
                                        <Badge variant="outline" className="font-mono text-[9px] border-purple-200 text-purple-700">
                                            Règle: {aiSuggestion.rule}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-slate-700 font-medium italic">"{aiSuggestion.reason}"</p>
                                    {aiSuggestion.rule === 'ELEC_EXEMPT' && (
                                        <div className="text-[10px] p-2 bg-blue-100 text-blue-800 rounded border border-blue-200">
                                            ⚠️ <strong>Action requise :</strong> Pour l'électricité, retirez les 'Tasas Municipales' du montant total et saisissez le résultat dans <strong>Base Imponible</strong>.
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="h-32 flex items-center justify-center text-center text-[10px] text-muted-foreground px-10">
                                    Saisissez le fournisseur pour l'analyse fiscale.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>

            <TabsContent value="import">
                <Card>
                    <CardHeader>
                        <CardTitle>Coller l'export SIAT</CardTitle>
                        <CardDescription>Format : N°Facture, Date, NIT, Nom, Total, Crédit Fiscal, Type</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Textarea 
                            className="min-h-[250px] font-mono text-xs"
                            value={csvData}
                            onChange={(e) => setCsvData(e.target.value)}
                            placeholder="Copié depuis SIAT ou Excel..."
                        />
                    </CardContent>
                    <CardFooter className="flex flex-col gap-2">
                        <Button onClick={handleImportSIAT} disabled={isImporting || !csvData} className="w-full">
                            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Importer et Analyser"}
                        </Button>
                        {factures.length > 0 && (
                            <Button variant="ghost" className="w-full text-red-500 hover:text-red-700 hover:bg-red-50 text-xs" onClick={handleDeleteAll}>
                                Vider toutes les données (Reset)
                            </Button>
                        )}
                    </CardFooter>
                </Card>
            </TabsContent>

            <TabsContent value="liste">
                <Card>
                    <CardContent className="pt-6">
                        <div className="rounded-md border overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead>Facture</TableHead>
                                        <TableHead>Entité</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-right">Base Impo.</TableHead>
                                        <TableHead className="text-right">13% IVA</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredFactures.map((f) => (
                                        <TableRow key={f.id} className="text-xs">
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-bold">{f.nFacture}</span>
                                                    <span className="text-[9px] text-muted-foreground">{f.date}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold">{f.fournisseurClient}</span>
                                                    {f.isFuel && <span className="text-[9px] text-amber-600 font-bold uppercase">Carburant (70%)</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">{f.montantTotal.toFixed(2)}</TableCell>
                                            <TableCell className="text-right font-bold text-blue-600">{(f.baseImposable || f.montantTotal).toFixed(2)}</TableCell>
                                            <TableCell className="text-right font-bold text-emerald-600">{f.creditDebitFiscal.toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredFactures.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucune facture pour cette période.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
        </div>
    );
}
