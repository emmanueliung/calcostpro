"use client";

// This is a client-only component that ensures Firebase is initialized.
import "./firebase";
import { FirebaseErrorListener } from "@/components/FirebaseErrorListener";

export default function FirebaseInit() {
  return <FirebaseErrorListener />;
}
