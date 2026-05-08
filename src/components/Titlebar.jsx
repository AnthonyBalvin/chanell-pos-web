import { useEffect, useState } from 'react';
import { X, Minus, Square } from 'lucide-react';

export default function Titlebar() {
    const [isTauri, setIsTauri] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined) {
            setIsTauri(true);
        }
    }, []);

    if (!isTauri) return null;

    const handleAction = async (action) => {
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const appWindow = getCurrentWindow();

            if (action === 'minimize') await appWindow.minimize();
            if (action === 'maximize') await appWindow.toggleMaximize();
            if (action === 'close') await appWindow.close();
        } catch (error) {
            console.error("Error en acción de ventana:", error);
        }
    };

    return (
        <div
            data-tauri-drag-region
            className="h-10 bg-[#0B1F3B] flex justify-between items-center select-none border-b border-white/10 shrink-0 z-[9999] cursor-default"
        >
            {/* Área del Logo - El click aquí también permite arrastrar */}
            <div data-tauri-drag-region className="flex items-center px-4 gap-2 pointer-events-none">
                <img src="/pwa-192x192.png" className="w-5 h-5" alt="logo" />
                <span className="text-xs text-slate-300 font-bold">Chanell Tecnología</span>
            </div>

            {/* Controles */}
            <div className="flex h-full relative z-[10000]">
                <button
                    onClick={() => handleAction('minimize')}
                    className="px-4 hover:bg-white/10 transition-colors flex items-center h-full"
                    title="Minimizar"
                >
                    <Minus className="w-4 h-4 text-slate-400" />
                </button>
                <button
                    onClick={() => handleAction('maximize')}
                    className="px-4 hover:bg-white/10 transition-colors flex items-center h-full"
                    title="Maximizar"
                >
                    <Square className="w-3 h-3 text-slate-400" />
                </button>
                <button
                    onClick={() => handleAction('close')}
                    className="px-4 hover:bg-red-600 transition-colors group flex items-center h-full"
                    title="Cerrar"
                >
                    <X className="w-4 h-4 text-slate-400 group-hover:text-white" />
                </button>
            </div>
        </div>
    );
}