import { Sprout } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="relative flex items-center justify-center">
        {/* Anillo exterior animado de carga */}
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-emerald-500/10 border-t-emerald-500" />
        
        {/* Icono central de Sprout */}
        <div className="absolute flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
          <Sprout className="h-5 w-5 animate-pulse" />
        </div>
      </div>
      
      <p className="mt-4 font-display text-sm font-semibold tracking-wide text-emerald-600 animate-pulse dark:text-emerald-400">
        Iniciando SkyCrop...
      </p>
    </div>
  );
}
