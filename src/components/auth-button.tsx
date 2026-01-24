"use client";

import { useAuth } from "@/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "./ui/button";
import { LogOut } from "lucide-react";

type AuthButtonProps = {
  mode: "logout";
};

export function AuthButton({ mode }: AuthButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión correctamente.",
      });
      router.push("/"); // Redirect to landing page after logout
    } catch (error) {
      console.error("Error signing out: ", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo cerrar la sesión.",
      });
    }
  };

  if (mode === "logout") {
    return (
        <Button variant="outline" onClick={handleLogout} className="w-full">
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
        </Button>
    );
  }

  // Fallback for any other mode, although we only expect 'logout'
  return (
    <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Cerrar sesión">
      <LogOut className="h-5 w-5 text-muted-foreground" />
    </Button>
  );
}
