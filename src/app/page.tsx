
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { GoogleIcon } from '@/components/icons';
import { GoogleAuthProvider, signInWithPopup, User } from 'firebase/auth';
import { useAuth, useFirestore } from '@/firebase';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { sendNewUserEmail } from '@/ai/flows/send-new-user-email';
import { getDefaultMaterials } from '@/lib/default-materials';
import { UserProfileData } from '@/lib/types';
import { useState } from 'react';
import { PREMIUM_USERS, ENTERPRISE_USERS } from '@/lib/roles';


// --- User Profile Synchronization Logic (Simplified) ---
const syncUserProfile = async (user: User, db: any) => {
    if (!user.email) return;

    const userDocRef = doc(db, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);

    // This logic only runs for NEW users
    if (!userDocSnap.exists()) {
        
        let initialPlan: UserProfileData['plan'] = 'Gratuito';
        
        // Determine plan for the new user based on email lists
        if (ENTERPRISE_USERS.includes(user.email)) {
            initialPlan = 'Entreprise';
        } else if (PREMIUM_USERS.includes(user.email)) {
            initialPlan = 'Premium';
        }

        // Create new user profile with only essential data
        const newUserProfile: Partial<UserProfileData> = {
            name: user.displayName || user.email?.split('@')[0] || 'Usuario',
            email: user.email!,
            plan: initialPlan,
            createdAt: serverTimestamp(),
            status: 'Activo',
            // Materials catalog will be handled on the materials page
        };
        
        await setDoc(userDocRef, newUserProfile, { merge: true });

        // Send notification email for the new user
        sendNewUserEmail({
            email: user.email!,
            uid: user.uid,
            name: newUserProfile.name
        }).catch(console.error);
    }
    // For existing users, no action is needed here on login.
};


export default function LandingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const db = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
        prompt: 'select_account'
    });
    try {
        const result = await signInWithPopup(auth, provider);
        await syncUserProfile(result.user, db);
        router.push('/dashboard');
    } catch (error: any) {
        console.error("Google Sign-In Error Code:", error.code);
        console.error("Google Sign-In Error Message:", error.message);
        let description = "No se pudo iniciar sesión con Google. Por favor, inténtalo de nuevo.";
        if (error.code === 'auth/account-exists-with-different-credential') {
            description = "Ya existe una cuenta con esta dirección de correo electrónico pero con un método de inicio de sesión diferente. Por favor, inicia sesión con el método original.";
        } else if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
             description = "El proceso de inicio de sesión fue cancelado.";
        }
        else if (error.message.includes('network')) {
            description = "Error de red. Por favor, comprueba tu conexión a internet.";
        }
        toast({
            variant: "destructive",
            title: "Error de inicio de sesión con Google",
            description,
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="max-w-xl w-full text-center">
        
        <div className="mb-8 rounded-lg overflow-hidden shadow-2xl aspect-video">
            <iframe
                className="w-full h-full"
                src="https://www.youtube.com/embed/lU_7nQUafjQ?si=cP-4qPr_96HchNCF"
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
            ></iframe>
        </div>

        <div>
          <img src="/logo-calcostpro.png" alt="CalcostPro Logo" className="mx-auto w-1/2" />
        </div>

        <p className="max-w-md mx-auto text-muted-foreground md:text-xl my-8">
          Tu herramienta esencial para cotizaciones precisas en la fabricación de textiles y accesorios.
        </p>

        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Button asChild size="lg">
            <Link href="/signup">Crear una cuenta</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/login">Iniciar Sesión</Link>
          </Button>
        </div>
        
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              O
            </span>
          </div>
        </div>
        
        <div className="flex justify-center">
            <Button variant="outline" size="lg" className="w-full sm:w-auto" onClick={handleGoogleSignIn} disabled={isSubmitting}>
              <GoogleIcon className="mr-2 h-5 w-5" />
              {isSubmitting ? 'Iniciando...' : 'Iniciar Sesión con Google'}
            </Button>
        </div>


        <div className="mt-12 text-sm text-muted-foreground">
          <p>
            Una aplicación desarrollada por Emmanuel Iung.
            <br />
            ¿Tienes un proyecto? Escríbeme a{' '}
            <a
              href="mailto:emmanuel.iung@gmail.com"
              className="underline hover:text-primary"
            >
              emmanuel.iung@gmail.com
            </a>
            {' o por '}
            <a
              href="https://wa.me/59177699920"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-primary"
            >
              WhatsApp
            </a>
            .
            <br />
            Visita mi página en{' '}
            <a
                href="https://des.iung.li/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-primary"
            >
                des.iung.li
            </a>
          </p>
        </div>

      </div>
    </main>
  );
}
