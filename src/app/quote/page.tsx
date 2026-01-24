
import { Suspense } from 'react';
import QuoteBuilder from '@/components/quote-builder';
import { Loader } from '@/components/ui/loader';
import { Header } from '@/components/header';

export default function QuotePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">
        <Suspense fallback={<Loader text="Cargando creador de cotizaciones..." />}>
          <QuoteBuilder />
        </Suspense>
      </main>
    </div>
  );
}
