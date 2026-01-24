import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CustomerInfo } from '@/lib/types';

interface CustomerFormProps {
    onCustomerChange: (customer: CustomerInfo) => void;
    customer: CustomerInfo;
}

export function CustomerForm({ onCustomerChange, customer }: CustomerFormProps) {
    const [errors, setErrors] = useState<Partial<Record<keyof CustomerInfo, string>>>({});

    const handleChange = (field: keyof CustomerInfo, value: string) => {
        onCustomerChange({ ...customer, [field]: value });
        // Clear error when user starts typing
        if (errors[field]) {
            setErrors({ ...errors, [field]: undefined });
        }
    };

    const validateEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const validatePhone = (phone: string) => {
        // Bolivian phone format: 8 digits or with country code
        const phoneRegex = /^(\+591)?[67]\d{7}$/;
        return phoneRegex.test(phone.replace(/\s/g, ''));
    };

    useEffect(() => {
        // Validate on change
        const newErrors: Partial<Record<keyof CustomerInfo, string>> = {};

        if (customer.email && !validateEmail(customer.email)) {
            newErrors.email = 'Email inválido';
        }

        if (customer.phone && !validatePhone(customer.phone)) {
            newErrors.phone = 'Teléfono inválido (ej: 71234567)';
        }

        setErrors(newErrors);
    }, [customer]);

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg">Tus Datos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="customer-name">Nombre Completo *</Label>
                    <Input
                        id="customer-name"
                        placeholder="Juan Pérez"
                        value={customer.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        required
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="customer-email">Email *</Label>
                    <Input
                        id="customer-email"
                        type="email"
                        placeholder="juan@ejemplo.com"
                        value={customer.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        required
                        className={errors.email ? 'border-destructive' : ''}
                    />
                    {errors.email && (
                        <p className="text-xs text-destructive">{errors.email}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="customer-phone">Teléfono / WhatsApp *</Label>
                    <Input
                        id="customer-phone"
                        type="tel"
                        placeholder="71234567"
                        value={customer.phone}
                        onChange={(e) => handleChange('phone', e.target.value)}
                        required
                        className={errors.phone ? 'border-destructive' : ''}
                    />
                    {errors.phone && (
                        <p className="text-xs text-destructive">{errors.phone}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                        Te contactaremos por WhatsApp para confirmar tu pedido
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
