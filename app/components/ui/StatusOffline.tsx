import Image from 'next/image';

export const StatusOffline = ({ mensaje = "Parece que tu conexión está algo inestable" }) => (
  <div className="flex flex-col items-center justify-center p-8 bg-blue-50/50 rounded-2xl border-2 border-dashed border-blue-200 animate-pulse">
    <div className="relative w-24 h-24 mb-4">
      {/* Aquí podrías usar una versión simplificada de tu logo o un icono de red */}
      <Image src="/logo_kairos.png" alt="Kairós logo" fill className="opacity-50 grayscale" />
    </div>
    <h3 className="text-lg font-semibold text-blue-900 font-sans">Kairós está esperando la señal...</h3>
    <p className="text-sm text-blue-600 text-center max-w-xs mt-2">
      {mensaje}. Estamos intentando reconectar automáticamente.
    </p>
  </div>
);