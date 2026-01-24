"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Trash2, Plus, Scissors, Ruler, Upload, Building, X } from 'lucide-react';
import type { Material, QuoteItem, LineItem } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import Image from 'next/image';
import { SizeSelection } from './size-selection';
import { FileUpload } from '../ui/file-upload';
import { useToast } from '@/hooks/use-toast';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useUser } from '@/firebase';
import { Slider } from '../ui/slider';

type MaterialsState = { fabrics: Material[], accessories: Material[], prints: Material[] };

interface MaterialCostsProps {
  lineItem: LineItem;
  updateLineItem: (updater: (prev: LineItem) => LineItem) => void;
  removeLineItem: () => void;
  materials: MaterialsState;
  updateMaterials: (newMaterials: MaterialsState) => Promise<void>;
  isOnlyLineItem: boolean;
  isIndividualMode: boolean;
}

type MaterialType = 'Fabric' | 'Accessory' | 'Print';
type MaterialCategory = 'fabrics' | 'accessories' | 'prints';

interface ItemInputState {
    id: string;
    quantity: number | string;
    price: number | string;
}

const typeTranslations: { [key in MaterialType]: string } = {
  'Fabric': 'Tela',
  'Accessory': 'Accesorio',
  'Print': 'Estampado'
};

const EMPTY_NEW_MATERIAL: Partial<Material> = { name: '', price: 0, unit: 'm' };

export function MaterialCostsSection({ 
    lineItem,
    updateLineItem,
    removeLineItem,
    materials, 
    updateMaterials,
    isOnlyLineItem,
    isIndividualMode,
}: MaterialCostsProps) {
  
  const { toast } = useToast();
  const { user } = useUser();
  const { items, laborCosts, name: garmentType, quantity: lineItemQuantity, profitMargin, description, productImageUrls, sizePrices } = lineItem;
  
  const [isFabricDialogOpen, setFabricDialogOpen] = useState(false);
  const [isAccessoryDialogOpen, setAccessoryDialogOpen] = useState(false);
  const [isPrintDialogOpen, setPrintDialogOpen] = useState(false);
  const [isNewMaterialDialogOpen, setNewMaterialDialogOpen] = useState(false);
  
  const [fabricInput, setFabricInput] = useState<ItemInputState>({ id: '', quantity: '', price: '' });
  const [accessoryInput, setAccessoryInput] = useState<ItemInputState>({ id: '', quantity: 1, price: '' });
  const [printInput, setPrintInput] = useState<ItemInputState>({ id: '', quantity: 1, price: '' });

  const [newMaterial, setNewMaterial] = useState<Partial<Material>>(EMPTY_NEW_MATERIAL);
  const [newMaterialCategory, setNewMaterialCategory] = useState<MaterialCategory>('fabrics');

  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const selectedAccessory = useMemo(() => materials.accessories.find(f => f.id === accessoryInput.id), [accessoryInput.id, materials.accessories]);

  const totalLinearMetersPerUnit = useMemo(() => {
    return items.filter(item => item.type === 'Fabric').reduce((acc, item) => acc + item.quantity, 0);
  }, [items]);


  const handleDetailsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    updateLineItem(prev => ({ ...prev, [id]: value }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    updateLineItem(prev => ({ ...prev, [id]: parseInt(value) || 1 }));
  }

  const handleProfitMarginChange = (value: number[]) => {
    updateLineItem(p => ({ ...p, profitMargin: value[0] }));
  };

  // Effects to auto-fill price on material selection
  useEffect(() => {
    const selected = materials.fabrics.find(f => f.id === fabricInput.id);
    setFabricInput(prev => ({ ...prev, price: selected?.price ?? '' }));
  }, [fabricInput.id, materials.fabrics]);

  useEffect(() => {
    if (selectedAccessory) {
      setAccessoryInput(prev => ({...prev, price: selectedAccessory.price ?? ''}));
    }
  }, [selectedAccessory]);

  useEffect(() => {
    const selected = materials.prints.find(f => f.id === printInput.id);
    setPrintInput(prev => ({...prev, price: selected?.price ?? ''}));
  }, [printInput.id, materials.prints]);

  const handleImageUpload = async () => {
    if (!productImageFile || !user) {
        toast({ variant: 'destructive', title: 'Error', description: 'Por favor, selecciona un archivo de imagen primero.' });
        return;
    }

    setIsUploading(true);
    const storage = getStorage();
    const storageRef = ref(storage, `users/${user.uid}/product_images/${Date.now()}-${productImageFile.name}`);
    
    try {
        const snapshot = await uploadBytes(storageRef, productImageFile);
        const downloadURL = await getDownloadURL(snapshot.ref);

        updateLineItem(prev => ({ ...prev, productImageUrls: [...(prev.productImageUrls || []), downloadURL] }));
        
        toast({ title: "Imagen Subida", description: "La imagen del producto ha sido añadida." });
        setProductImageFile(null);
    } catch (error: any) {
        console.error("Error uploading image: ", error);
        let description = "No se pudo subir la imagen. Inténtalo de nuevo.";
        if (error.code === 'storage/unauthorized') {
            description = "Error de autorización. Verifica que las reglas de Storage y la configuración CORS sean correctas en tu proyecto de Firebase.";
        } else if (error.code === 'storage/object-not-found') {
            description = "Error: el objeto no se encontró. Contacta al soporte.";
        }
        toast({ variant: 'destructive', title: 'Error de subida', description: description, duration: 9000 });
    } finally {
        setIsUploading(false);
    }
  };

  const removeProductImage = (urlToRemove: string) => {
    updateLineItem(prev => ({
        ...prev,
        productImageUrls: (prev.productImageUrls || []).filter(url => url !== urlToRemove)
    }));
  };


  const handleAddFabricItem = () => {
    const fabric = materials.fabrics.find(f => f.id === fabricInput.id);
    if (!fabric || !fabricInput.quantity || !fabricInput.price) return;

    const quantity = Number(fabricInput.quantity);
    const total = quantity * Number(fabricInput.price);

    const newItem: QuoteItem = {
      id: `${fabric.id}-${Date.now()}`,
      material: { ...fabric, price: Number(fabricInput.price) },
      quantity: quantity,
      total: total,
      type: 'Fabric',
    };
    updateLineItem(prev => ({ ...prev, items: [...prev.items, newItem] }));
    setFabricInput({ id: '', quantity: '', price: '' });
    setFabricDialogOpen(false);
  };

  const handleAddItem = (type: 'Accessory' | 'Print') => {
    const { materialList, itemInput, setItemInput, setDialogOpen } = type === 'Accessory' 
      ? { materialList: materials.accessories, itemInput: accessoryInput, setItemInput: setAccessoryInput, setDialogOpen: setAccessoryDialogOpen }
      : { materialList: materials.prints, itemInput: printInput, setItemInput: setPrintInput, setDialogOpen: setPrintDialogOpen };
      
    const material = materialList.find((m) => m.id === itemInput.id);
    if (!material || !itemInput.quantity || !itemInput.price) return;

    const newItem: QuoteItem = {
      id: `${material.id}-${Date.now()}`,
      material: { ...material, price: Number(itemInput.price) },
      quantity: Number(itemInput.quantity),
      total: Number(itemInput.price) * Number(itemInput.quantity),
      type: type,
    };

    updateLineItem(prev => ({ ...prev, items: [...prev.items, newItem] }));
    setItemInput({ id: '', quantity: 1, price: '' });
    setDialogOpen(false);
  };

  const handleRemoveItem = (id: string) => {
    updateLineItem(prev => ({ ...prev, items: prev.items.filter((item) => item.id !== id) }));
  };

  const openNewMaterialDialog = (category: MaterialCategory) => {
    setNewMaterialCategory(category);
    let unit: Material['unit'] = 'm';
    if (category === 'accessories') unit = 'piece';
    if (category === 'prints') unit = 'fixed';
    setNewMaterial({ ...EMPTY_NEW_MATERIAL, unit, ancho: 1.50 });
    setNewMaterialDialogOpen(true);
  }

  const handleSaveNewMaterial = async () => {
      const materialData: Partial<Material> & {name: string, price: number, unit: Material['unit']} = {
        name: newMaterial.name || '',
        price: Number(newMaterial.price) || 0,
        unit: newMaterial.unit || 'm',
        ancho: newMaterial.ancho ? Number(newMaterial.ancho) : undefined,
      };

      if (!materialData.name || materialData.price <= 0) {
          toast({ variant: 'destructive', title: 'Datos incompletos', description: 'El nombre y el precio son obligatorios.' });
          return;
      }
      
      if (materialData.unit === 'kg') {
          if (!newMaterial.grammage || newMaterial.grammage <= 0) {
               toast({ variant: 'destructive', title: 'Datos incompletos', description: 'El gramaje es obligatorio para la unidad "kg".' });
               return;
          }
          materialData.grammage = Number(newMaterial.grammage);
      }

      const newMaterialWithId: Material = {
        id: `${newMaterialCategory}-${Date.now()}`,
        ...materialData
      } as Material;

      const updatedMaterials = {
        ...materials,
        [newMaterialCategory]: [...materials[newMaterialCategory], newMaterialWithId]
      };

      await updateMaterials(updatedMaterials);

      toast({ title: 'Material Añadido', description: `"${newMaterial.name}" ha sido añadido a tu catálogo.` });
      
      setNewMaterialDialogOpen(false);
  }
  
  const getUnitLabel = (unit: string, quantity: number) => {
    if (unit === 'piece') return quantity > 1 ? 'pzs' : 'pz';
    if (unit === 'm') return 'm';
    if (unit === 'm²') return 'm';
    return unit;
  };
  
  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-start sm:items-center justify-between">
        <div>
            <CardTitle className="text-xl md:text-2xl">Costos por Prenda</CardTitle>
            <CardDescription>Añade los materiales, mano de obra y ganancia para esta prenda.</CardDescription>
        </div>
         {!isOnlyLineItem && (
            <Button variant="destructive" size="sm" onClick={removeLineItem}>
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
            </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
                <Label htmlFor="name">Tipo de Prenda</Label>
                <Input id="name" placeholder="p. ej., Camisa, Pantalón" value={garmentType} onChange={handleDetailsChange} />
            </div>
            {!isIndividualMode && (
                <div className="space-y-2">
                    <Label htmlFor="quantity">Cantidad de Prendas</Label>
                    <Input id="quantity" type="number" placeholder="p. ej. 100" value={lineItemQuantity} onChange={handleNumberChange} min="1" />
                </div>
            )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-2">
                <Label htmlFor="description">Descripción del Producto</Label>
                <Textarea id="description" placeholder="Añade detalles sobre la prenda, como el tipo de tela, colores, etc." value={description || ''} onChange={handleDetailsChange} />
            </div>
            <div className="space-y-4">
                <Label>Fotos del Producto</Label>
                {(productImageUrls && productImageUrls.length > 0) ? (
                    <div className="grid grid-cols-3 gap-2">
                        {productImageUrls.map(url => (
                             <div key={url} className="relative w-full h-24 rounded-md overflow-hidden border">
                                 <Image src={url} alt="Preview" fill style={{ objectFit: 'cover' }}/>
                                 <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 z-10" onClick={() => removeProductImage(url)}>
                                     <X className="h-3 w-3" />
                                 </Button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="w-full h-32 rounded-md border border-dashed flex items-center justify-center bg-muted/50">
                        <div className="text-center text-muted-foreground">
                            <Building className="h-8 w-8 mx-auto mb-2" />
                            <p className="text-sm">Sin imágenes</p>
                        </div>
                    </div>
                )}
                <FileUpload onFileSelect={setProductImageFile} currentFile={productImageFile} />
                {productImageFile && (
                    <Button onClick={handleImageUpload} disabled={isUploading} className="w-full">
                        <Upload className="mr-2 h-4 w-4" />
                        {isUploading ? 'Subiendo...' : 'Añadir Imagen'}
                    </Button>
                )}
            </div>
        </div>

        <Separator />

        {items.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed rounded-lg">
            <h3 className="text-lg font-medium text-muted-foreground">Aún no hay costos añadidos.</h3>
            <p className="text-sm text-muted-foreground mt-1">Empieza añadiendo telas, accesorios o mano de obra.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-center">Cantidad</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {items.map((item) => (
                    <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.material.name}</TableCell>
                    <TableCell>{typeTranslations[item.type]}</TableCell>
                    <TableCell className="text-center">
                        {item.quantity.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} {getUnitLabel(item.material.unit, item.quantity)}
                    </TableCell>
                    <TableCell className="text-right">Bs. {item.total.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveItem(item.id)}>
                        <Trash2 className="h-4 w-4" />
                        </Button>
                    </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
          </div>
        )}
        
        {totalLinearMetersPerUnit > 0 && (
            <>
                <Separator className="my-4" />
                <div className="p-4 bg-muted/50 rounded-lg">
                    <Label>Consumo total de tela (por Prenda)</Label>
                    <div className="flex items-center gap-2 mt-2">
                        <Ruler className="h-5 w-5 text-muted-foreground" />
                        <div className='flex-1'>
                            <p className="text-sm">
                                Total de tela necesaria: <span className="font-bold">{totalLinearMetersPerUnit.toFixed(2)} m</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Calculado para 1 prenda.
                            </p>
                        </div>
                    </div>
                </div>
            </>
        )}

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="laborCost">Costo Fijo de Mano de Obra</Label>
                <div className="flex items-center gap-2">
                    <Scissors className="h-5 w-5 text-muted-foreground" />
                    <Input id="laborCost" type="number" placeholder="Bs." value={laborCosts.labor || ''} onChange={(e) => updateLineItem(p => ({ ...p, laborCosts: { ...p.laborCosts, labor: parseFloat(e.target.value) || 0 }}))} min="0"/>
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="cuttingCost">Costo Fijo de Corte</Label>
                 <div className="flex items-center gap-2">
                    <Scissors className="h-5 w-5 text-muted-foreground" />
                    <Input id="cuttingCost" type="number" placeholder="Bs." value={laborCosts.cutting || ''} onChange={(e) => updateLineItem(p => ({ ...p, laborCosts: { ...p.laborCosts, cutting: parseFloat(e.target.value) || 0 }}))} min="0"/>
                </div>
            </div>
        </div>

        <Separator />

        <div className="space-y-3 rounded-md border p-4">
            <Label htmlFor="profit-slider" className="font-semibold">Ganancia para esta prenda ({profitMargin}%)</Label>
            <Slider
                id="profit-slider"
                value={[profitMargin]}
                onValueChange={handleProfitMarginChange}
                max={200}
                step={1}
            />
             <p className="text-xs text-muted-foreground">
              Ajusta el margen de ganancia para este producto.
            </p>
        </div>


        {isIndividualMode && (
          <>
            <Separator />
            <SizeSelection updateLineItem={updateLineItem} sizePrices={sizePrices} />
          </>
        )}
        
        <Separator />


        <div className="flex flex-wrap gap-4">
            <Dialog open={isFabricDialogOpen} onOpenChange={setFabricDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline"><Plus className="mr-2 h-4 w-4" />Añadir Tela</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader><DialogTitle>Añadir Tela</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nombre de la Tela</Label>
                            <div className="flex gap-2">
                                <Select value={fabricInput.id} onValueChange={(value) => setFabricInput(p => ({...p, id: value}))}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar una tela" /></SelectTrigger>
                                    <SelectContent>{materials.fabrics.map((mat) => <SelectItem key={mat.id} value={mat.id}>{mat.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <Button variant="outline" onClick={() => openNewMaterialDialog('fabrics')}>Añadir nuevo</Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="fabric-length">Largo de Tela (m)</Label>
                            <Input id="fabric-length" type="number" placeholder="p. ej. 0.75" value={fabricInput.quantity} onChange={(e) => setFabricInput(p => ({...p, quantity: e.target.value}))} min="0" step="0.01" disabled={!fabricInput.id} />
                            <p className="text-xs text-muted-foreground">La longitud de tela necesaria para 1 prenda.</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Precio (por metro lineal)</Label>
                            <Input type="number" placeholder="p. ej. 40" value={fabricInput.price} onChange={(e) => setFabricInput(p => ({...p, price: e.target.value}))} min="0" step="0.01" disabled={!fabricInput.id} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setFabricDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleAddFabricItem} disabled={!fabricInput.id || !fabricInput.quantity || !fabricInput.price}>Añadir</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isAccessoryDialogOpen} onOpenChange={setAccessoryDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline"><Plus className="mr-2 h-4 w-4" />Añadir Accesorio</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader><DialogTitle>Añadir Accesorio</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nombre del Accesorio</Label>
                             <div className="flex gap-2">
                                <Select value={accessoryInput.id} onValueChange={(value) => setAccessoryInput(p => ({...p, id: value}))}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar un accesorio" /></SelectTrigger>
                                    <SelectContent>{materials.accessories.map((mat) => <SelectItem key={mat.id} value={mat.id}>{mat.name} ({mat.unit})</SelectItem>)}</SelectContent>
                                </Select>
                                <Button variant="outline" onClick={() => openNewMaterialDialog('accessories')}>Añadir nuevo</Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Cantidad ({selectedAccessory?.unit === 'm' ? 'metros' : 'unidades'})</Label>
                            <Input type="number" placeholder="p. ej. 2" value={accessoryInput.quantity} onChange={(e) => setAccessoryInput(p => ({...p, quantity: e.target.value}))} min="1" step="1" disabled={!accessoryInput.id} />
                        </div>
                        <div className="space-y-2">
                            <Label>Precio por Unidad/Metro</Label>
                            <Input type="number" placeholder="p. ej. 0.50" value={accessoryInput.price} onChange={(e) => setAccessoryInput(p => ({...p, price: e.target.value}))} min="0" step="0.01" disabled={!accessoryInput.id} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setAccessoryDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={() => handleAddItem('Accessory')} disabled={!accessoryInput.id || !accessoryInput.quantity || !accessoryInput.price}>Añadir</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isPrintDialogOpen} onOpenChange={setPrintDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline"><Plus className="mr-2 h-4 w-4" />Añadir Estampado</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader><DialogTitle>Añadir Estampado</DialogTitle></DialogHeader>
                     <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Tipo de Estampado</Label>
                             <div className="flex gap-2">
                                <Select value={printInput.id} onValueChange={(value) => setPrintInput(p => ({...p, id: value}))}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar un estampado" /></SelectTrigger>
                                    <SelectContent>{materials.prints.map((mat) => <SelectItem key={mat.id} value={mat.id}>{mat.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <Button variant="outline" onClick={() => openNewMaterialDialog('prints')}>Añadir nuevo</Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Cantidad</Label>
                            <Input type="number" placeholder="p. ej. 1" value={printInput.quantity} onChange={(e) => setPrintInput(p => ({...p, quantity: e.target.value}))} min="1" step="1" disabled={!printInput.id} />
                        </div>
                        <div className="space-y-2">
                            <Label>Precio por Unidad</Label>
                            <Input type="number" placeholder="p. ej. 5.00" value={printInput.price} onChange={(e) => setPrintInput(p => ({...p, price: e.target.value}))} min="0" step="0.01" disabled={!printInput.id} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setPrintDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={() => handleAddItem('Print')} disabled={!printInput.id || !printInput.quantity || !printInput.price}>Añadir</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
      </CardContent>
    </Card>
    <Dialog open={isNewMaterialDialogOpen} onOpenChange={setNewMaterialDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Añadir Nuevo Material al Catálogo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Nombre del Material</Label>
                    <Input id="name" value={newMaterial.name ?? ''} onChange={(e) => setNewMaterial(p => ({...p, name: e.target.value}))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="price">Precio</Label>
                        <Input id="price" type="number" value={newMaterial.price ?? ''} onChange={(e) => setNewMaterial(p => ({...p, price: Number(e.target.value)}))} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="unit">Unidad</Label>
                        <Select 
                            value={newMaterial.unit} 
                            onValueChange={(val) => setNewMaterial(p => ({...p, unit: val as any}))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="m">m (metro lineal)</SelectItem>
                                <SelectItem value="kg">kg (kilo)</SelectItem>
                                <SelectItem value="piece">pz (pieza)</SelectItem>
                                <SelectItem value="fixed">fijo (costo único)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                {newMaterialCategory === 'fabrics' && (
                     <div className="space-y-2 pt-4 border-t">
                        <Label htmlFor="ancho">Ancho de la tela (m)</Label>
                        <Input id="ancho" type="number" placeholder="p. ej., 1.50" value={newMaterial.ancho ?? ''} onChange={(e) => setNewMaterial(p => ({...p, ancho: Number(e.target.value)}))} />
                        <p className="text-xs text-muted-foreground">Opcional. Informativo.</p>
                    </div>
                )}
                 {newMaterial.unit === "kg" && (
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                        <div className="space-y-2">
                            <Label htmlFor="grammage">Gramaje (g/m²)</Label>
                            <Input
                            id="grammage"
                            type="number"
                            value={newMaterial.grammage ?? ""}
                            onChange={(e) => setNewMaterial(p => ({...p, grammage: parseFloat(e.target.value)}))}
                            placeholder="Ej: 180"
                            required
                            />
                        </div>
                    </div>
                )}
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setNewMaterialDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSaveNewMaterial}>Guardar Material</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  </>
  );
}
