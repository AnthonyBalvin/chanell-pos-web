import { useState } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { useChanellUI } from '../context/UIContext';
import { Loader2, RefreshCw, Download } from 'lucide-react';

export default function BotonActualizar() {
    const { notify, confirm } = useChanellUI();
    const [estado, setEstado] = useState('idle'); // idle, checking, downloading

    const buscarActualizacion = async () => {
        // Solo ejecutar si estamos en la app de escritorio (Tauri)
        if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) {
            return notify("Las actualizaciones automáticas solo funcionan en la app de escritorio (.exe)", "info");
        }

        setEstado('checking');
        try {
            const update = await check();

            if (update) {
                const aceptado = await confirm(
                    "¡Nueva Versión Disponible!",
                    `¿Deseas instalar la versión ${update.version}? \nNovedades: ${update.body || 'Mejoras de rendimiento y seguridad.'}`,
                    true
                );

                if (aceptado) {
                    setEstado('downloading');
                    notify("Descargando actualización... El sistema se reiniciará automáticamente al terminar.", "info");

                    // Descargar e instalar
                    await update.downloadAndInstall();

                    // Reiniciar la app para aplicar la nueva versión
                    await relaunch();
                } else {
                    setEstado('idle');
                }
            } else {
                notify("Ya tienes la versión más reciente instalada.", "success");
                setEstado('idle');
            }
        } catch (error) {
            console.error(error);
            notify("No se pudo conectar con el servidor de actualizaciones.", "error");
            setEstado('idle');
        }
    };

    return (
        <button
            onClick={buscarActualizacion}
            disabled={estado !== 'idle'}
            className="flex items-center gap-2 bg-[#1e2a4a] hover:bg-black text-white px-5 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-[0_4px_15px_rgba(30,42,74,0.3)] hover:-translate-y-0.5 disabled:opacity-70"
        >
            {estado === 'checking' && <Loader2 className="animate-spin" size={16} />}
            {estado === 'downloading' && <Download className="animate-bounce" size={16} />}
            {estado === 'idle' && <RefreshCw size={16} />}

            {estado === 'checking' ? 'Buscando...' :
                estado === 'downloading' ? 'Instalando...' :
                    'Buscar Actualizaciones'}
        </button>
    );
}