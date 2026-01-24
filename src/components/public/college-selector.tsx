"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { College } from '@/lib/types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Loader2 } from 'lucide-react';

interface CollegeSelectorProps {
    userId: string;
    onSelectCollege: (college: College | null) => void;
    selectedCollege: College | null;
}

export function CollegeSelector({ userId, onSelectCollege, selectedCollege }: CollegeSelectorProps) {
    const db = useFirestore();
    const [colleges, setColleges] = useState<College[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchColleges = async () => {
            try {
                const q = query(
                    collection(db, 'colleges'),
                    where('userId', '==', userId)
                );
                const snapshot = await getDocs(q);
                const collegeData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as College));
                setColleges(collegeData);
            } catch (error) {
                console.error('Error fetching colleges:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchColleges();
    }, [userId, db]);

    const handleSelectCollege = (collegeId: string) => {
        const college = colleges.find(c => c.id === collegeId);
        onSelectCollege(college || null);
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    if (colleges.length === 0) {
        return (
            <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                    <p>No hay colegios disponibles en este momento.</p>
                    <p className="text-xs mt-2">Por favor contacta al taller.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg">Selecciona tu Colegio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                <Label htmlFor="college-select">Colegio *</Label>
                <Select
                    value={selectedCollege?.id || ''}
                    onValueChange={handleSelectCollege}
                >
                    <SelectTrigger id="college-select">
                        <SelectValue placeholder="Selecciona tu colegio..." />
                    </SelectTrigger>
                    <SelectContent>
                        {colleges.map((college) => (
                            <SelectItem key={college.id} value={college.id}>
                                {college.name}
                                {college.course && ` - ${college.course}`}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {selectedCollege && (
                    <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
                        <p className="text-sm font-medium">{selectedCollege.name}</p>
                        {selectedCollege.course && (
                            <p className="text-xs text-muted-foreground">{selectedCollege.course}</p>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
