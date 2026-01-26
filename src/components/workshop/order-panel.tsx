import { useState, useEffect } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ShoppingBag, Ruler } from 'lucide-react';
import { OrderItem, Student, College } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';

interface OrderPanelProps {
    student: Student | null;
    items: OrderItem[];
    onAddItem: (item: OrderItem) => void;
    onRemoveItem: (index: number) => void;
}

export function OrderPanel({ student, items, onAddItem, onRemoveItem }: OrderPanelProps) {
    const { user } = useUser();
    const db = useFirestore();
    const [activeTab, setActiveTab] = useState("uniform");

    // College Config State
    const [collegeConfig, setCollegeConfig] = useState<College | null>(null);

    // Custom Order State
    const [garmentType, setGarmentType] = useState('Pantalon');
    const [customPrice, setCustomPrice] = useState<number>(0);
    const [quantity, setQuantity] = useState(1);

    // Fetch College Configuration when student changes
    useEffect(() => {
        const fetchCollegeConfig = async () => {
            if (!user || !student) {
                setCollegeConfig(null);
                return;
            }

            try {
                // 1. Try to find the college by ID if available
                if (student.collegeId) {
                    const docSnap = await getDoc(doc(db, "colleges", student.collegeId));
                    if (docSnap.exists()) {
                        setCollegeConfig({ id: docSnap.id, ...docSnap.data() } as College);
                        setActiveTab("uniform");
                        return;
                    }
                }

                // 2. Fallback: Fetch all colleges for the user and find the best match
                // We do this in JS to be flexible with Name/Course concatenation in legacy data
                const q = query(
                    collection(db, "colleges"),
                    where("userId", "==", user.uid)
                );

                const snapshot = await getDocs(q);
                const allColleges = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as College));

                // Try exact match with both name and course
                let match = allColleges.find(c =>
                    c.name === student.college && (c.course || '') === (student.classroom || '')
                );

                // If no exact match, try matching the concatenated string
                if (!match) {
                    match = allColleges.find(c => {
                        const fullName = c.course ? `${c.name} ${c.course}` : c.name;
                        const fullNameAlt = c.course ? `${c.name} (${c.course})` : c.name;
                        return fullName === student.college || fullNameAlt === student.college || c.name === student.college;
                    });
                }

                if (match) {
                    setCollegeConfig(match);
                    setActiveTab("uniform");
                } else {
                    setCollegeConfig(null);
                    setActiveTab("custom");
                }
            } catch (error) {
                console.error("Error fetching college config:", error);
                setCollegeConfig(null);
                setActiveTab("custom");
            }
        };
        fetchCollegeConfig();
    }, [user, student, db]);

    const handleAddCustom = () => {
        if (customPrice <= 0) return;
        onAddItem({
            productName: `${garmentType} (Extra)`,
            quantity: quantity,
            price: customPrice,
            type: 'sur_mesure'
        });
        setQuantity(1);
    };

    const handleAddConfiguredItem = (name: string, price: number) => {
        const studentSize = student?.sizes?.[name] || '';
        onAddItem({
            productName: name,
            quantity: 1,
            price: price,
            size: studentSize.toUpperCase(),
            type: 'sur_mesure'
        });
    };

    if (!student) {
        return (
            <Card className="h-full flex flex-col justify-center items-center text-muted-foreground p-6">
                <p>Seleccione un estudiante para comenzar el pedido.</p>
            </Card>
        );
    }

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-3 border-b mb-2">
                <CardTitle className="text-lg">
                    Pedido para <span className="text-primary">{student.name}</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground">{student.college}</p>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4 p-3 pt-0">

                {/* Selection Area */}
                <div className="bg-muted/30 p-1 rounded-lg">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="uniform">
                                <ShoppingBag className="w-4 h-4 mr-2" /> Uniforme
                            </TabsTrigger>
                            <TabsTrigger value="custom">
                                <Ruler className="w-4 h-4 mr-2" /> Manual / Extra
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="uniform" className="mt-4 min-h-[160px]">
                            {collegeConfig && collegeConfig.priceList && collegeConfig.priceList.length > 0 ? (
                                <div className="grid grid-cols-2 gap-2">
                                    {collegeConfig.priceList.map((item, idx) => (
                                        <Button
                                            key={idx}
                                            variant="outline"
                                            className="h-auto py-3 flex flex-col items-start gap-1 text-left bg-white hover:bg-primary/5 hover:border-primary"
                                            onClick={() => handleAddConfiguredItem(item.name, item.price)}
                                        >
                                            <span className="font-semibold">{item.name}</span>
                                            <span className="text-xs text-muted-foreground">Precio: {item.price} Bs</span>
                                        </Button>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-muted-foreground text-sm">
                                    <p>No hay precios configurados para <strong>{student.college}</strong>.</p>
                                    <p className="text-xs mt-2">Vaya a Configuración para añadir prendas.</p>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="custom" className="space-y-4 mt-4 min-h-[160px]">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Prenda</Label>
                                    <Select value={garmentType} onValueChange={setGarmentType}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Pantalon">Pantalón</SelectItem>
                                            <SelectItem value="Saco">Saco</SelectItem>
                                            <SelectItem value="Chaleco">Chaleco</SelectItem>
                                            <SelectItem value="Falda">Falda</SelectItem>
                                            <SelectItem value="Camisa">Camisa</SelectItem>
                                            <SelectItem value="Polo">Polo</SelectItem>
                                            <SelectItem value="Deportivo">Deportivo</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Precio (Bs)</Label>
                                    <Input
                                        type="number"
                                        value={customPrice || ''}
                                        onChange={(e) => setCustomPrice(Number(e.target.value))}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <Button className="w-full" onClick={handleAddCustom} disabled={customPrice <= 0}>
                                <Plus className="mr-2 h-4 w-4" /> Agregar Manual
                            </Button>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Order Summary List */}
                <div className="flex-1 flex flex-col border-t pt-2">
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">Resumen del Pedido</h4>
                    <ScrollArea className="flex-1 border rounded-md bg-white/50">
                        {items.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                                El carrito está vacío.
                            </div>
                        ) : (
                            <div className="divide-y">
                                {items.map((item, index) => (
                                    <div key={index} className="p-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                                        <div>
                                            <p className="font-medium text-sm">{item.productName}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {item.quantity} x {item.price} Bs
                                                {item.type === 'sur_mesure' && ' (Talla registrada)'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-sm">{item.quantity * item.price} Bs</span>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => onRemoveItem(index)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </CardContent>
        </Card>
    );
}
