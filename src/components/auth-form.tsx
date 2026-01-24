
"use client";

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useAuth, useFirestore } from '@/firebase';
import { 
  AuthError,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  User,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { sendNewUserEmail } from "@/ai/flows/send-new-user-email";
import type { UserProfileData } from '@/lib/types';
import { getDefaultMaterials } from '@/lib/default-materials';
import { GoogleIcon } from "./icons";
import { PREMIUM_USERS, ENTERPRISE_USERS } from '@/lib/roles';


const formSchema = z.object({
  email: z.string().email({
    message: "Por favor, introduce una dirección de correo electrónico válida.",
  }),
  password: z.string().min(6, {
    message: "La contraseña debe tener al menos 6 caracteres.",
  }),
})

type AuthFormProps = {
  mode: 'login' | 'signup';
}

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


export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const db = useFirestore();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetDialogOpen, setResetDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    const { email, password } = values;

    try {
      if (mode === 'signup') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await syncUserProfile(userCredential.user, db);
      } else { // mode === 'login'
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        await syncUserProfile(userCredential.user, db);
      }
      router.push('/dashboard');
    } catch (error: any) {
        const authError = error as AuthError;
        console.error(`Error during ${mode}:`, authError);
        let description = "Ha ocurrido un error. Por favor, inténtalo de nuevo.";
        switch (authError.code) {
          case 'auth/email-already-in-use':
            description = "Este correo electrónico ya está registrado. Por favor, inicia sesión.";
            break;
          case 'auth/wrong-password':
          case 'auth/user-not-found':
          case 'auth/invalid-credential':
            description = "El correo electrónico o la contraseña son incorrectos.";
            break;
          case 'auth/weak-password':
            description = "La contraseña es demasiado débil. Debe tener al menos 6 caracteres.";
            break;
          default:
            description = authError.message;
            break;
        }
        toast({
            variant: "destructive",
            title: `Error de ${mode === 'login' ? 'inicio de sesión' : 'registro'}`,
            description: description
        });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        await syncUserProfile(result.user, db);
        router.push('/dashboard');
    } catch (error: any) {
        const authError = error as AuthError;
        let description = "No se pudo iniciar sesión con Google. Por favor, inténtalo de nuevo.";
        if (authError.code === 'auth/account-exists-with-different-credential') {
            description = "Ya existe una cuenta con esta dirección de correo electrónico pero con un método de inicio de sesión diferente. Por favor, inicia sesión con el método original.";
        }
        toast({
            variant: "destructive",
            title: "Error de inicio de sesión con Google",
            description,
        });
        console.error("Google Sign-In Error:", authError);
    } finally {
        setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resetEmail) {
      toast({
        variant: "destructive",
        title: "Correo electrónico requerido",
        description: "Por favor, introduce tu dirección de correo electrónico.",
      });
      return;
    }

    setIsResetting(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      toast({
        title: "Correo enviado",
        description: "Si existe una cuenta con ese correo, se ha enviado un enlace para restablecer la contraseña. Revisa tu carpeta de spam.",
      });
      setResetDialogOpen(false);
      setResetEmail("");
    } catch (error: any) {
      console.error("Password reset error:", error);
       toast({
        variant: "destructive",
        title: "Error al enviar correo",
        description: "No se pudo enviar el correo de restablecimiento. Por favor, inténtalo más tarde.",
      });
    } finally {
      setIsResetting(false);
    }
  };


  const title = mode === 'login' ? 'Bienvenido de Nuevo' : 'Crear una Cuenta';
  const description = mode === 'login' 
    ? 'Inicia sesión para acceder a tu dashboard.'
    : 'Regístrate para empezar a crear tus cotizaciones.';
  const buttonText = mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta';

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="mx-auto max-w-sm w-full">
        <CardHeader>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={isSubmitting}>
              <GoogleIcon className="mr-2 h-4 w-4" />
              Continuar con Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  O continuar con
                </span>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="m@example.com" {...field} disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                       <div className="flex items-center">
                        <FormLabel>Contraseña</FormLabel>
                        {mode === 'login' && (
                           <AlertDialog open={isResetDialogOpen} onOpenChange={setResetDialogOpen}>
                              <AlertDialogTrigger asChild>
                                <Button variant="link" type="button" className="ml-auto p-0 h-auto inline-block text-sm underline">
                                    ¿Contraseña olvidada?
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <form onSubmit={handlePasswordReset}>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Restablecer Contraseña</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Introduce tu correo electrónico para recibir un enlace de restablecimiento.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <div className="space-y-2 py-4">
                                    <Label htmlFor="reset-email">Email</Label>
                                    <Input
                                      id="reset-email"
                                      type="email"
                                      placeholder="tu@email.com"
                                      value={resetEmail}
                                      onChange={(e) => setResetEmail(e.target.value)}
                                      disabled={isResetting}
                                    />
                                  </div>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel type="button" disabled={isResetting}>Cancelar</AlertDialogCancel>
                                    <Button type="submit" disabled={isResetting}>
                                      {isResetting ? "Enviando..." : "Enviar enlace"}
                                    </Button>
                                  </AlertDialogFooter>
                                </form>
                              </AlertDialogContent>
                            </AlertDialog>
                        )}
                       </div>
                      <FormControl>
                        <div className="relative">
                            <Input 
                                type={showPassword ? 'text' : 'password'} 
                                {...field} 
                                disabled={isSubmitting}
                                placeholder="******"
                            />
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon"
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                                onClick={() => setShowPassword(prev => !prev)}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                <span className="sr-only">{showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}</span>
                            </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Procesando...' : buttonText}
                </Button>
              </form>
            </Form>
          </div>
          <div className="mt-4 text-center text-sm">
            {mode === 'login' ? (
                <>
                ¿No tienes una cuenta?{" "}
                <Link href="/signup" className="underline">
                    Regístrate
                </Link>
                </>
            ) : (
                <>
                ¿Ya tienes una cuenta?{" "}
                <Link href="/login" className="underline">
                    Inicia sesión
                </Link>
                </>
            )}
            
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
