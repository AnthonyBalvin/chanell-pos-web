import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

// 1. CREACIÓN DEL CONTEXTO
const UIContext = createContext();

// EXPORT PARA ARCHIVOS QUE NO SON COMPONENTES (ej. pdfGenerator.js)
export const uiManager = {
    notify: () => console.warn("UIContext no inicializado"),
    confirm: async () => false
};

// 2. HOOK PERSONALIZADO
export const useChanellUI = () => {
    const context = useContext(UIContext);
    if (!context) throw new Error("useChanellUI debe usarse dentro de un NotificationProvider");
    return context;
};

// 3. PROVIDER PRINCIPAL
export const NotificationProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    
    const [confirmState, setConfirmState] = useState({
        isOpen: false,
        title: '',
        description: '',
        isDestructive: false,
        resolve: null
    });

    // ─── MÉTODO NOTIFY ────────────────────────────────────────────────────────
    const notify = useCallback((mensaje, tipo = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { id, mensaje, tipo }]);
        
        // Auto-remover después de 4 segundos
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    // ─── MÉTODO CONFIRM (ASÍNCRONO) ───────────────────────────────────────────
    const confirm = useCallback((title, description, isDestructive = false) => {
        return new Promise((resolve) => {
            setConfirmState({
                isOpen: true,
                title,
                description,
                isDestructive,
                resolve
            });
        });
    }, []);

    const handleConfirmClose = (result) => {
        if (confirmState.resolve) {
            confirmState.resolve(result);
        }
        setConfirmState(prev => ({ ...prev, isOpen: false }));
    };

    // Bloquear scroll cuando el modal está abierto
    useEffect(() => {
        if (confirmState.isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [confirmState.isOpen]);

    // ─── LIGAR REFERENCIAS GLOBALES ───
    useEffect(() => {
        uiManager.notify = notify;
        uiManager.confirm = confirm;
    }, [notify, confirm]);

    return (
        <UIContext.Provider value={{ notify, confirm }}>
            {children}
            
            {/* ─── TOASTS CONTAINER (NOTIFICACIONES) ─── */}
            <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
                {toasts.map(t => (
                    <div 
                        key={t.id} 
                        className="pointer-events-auto bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-100 p-4 flex items-start gap-3 min-w-[320px] max-w-sm animate-in slide-in-from-top-4 fade-in duration-300"
                    >
                        {/* Iconos basados en la paleta de marca */}
                        {t.tipo === 'success' && <CheckCircle2 className="text-[#3b82f6] shrink-0 mt-0.5" size={20} />}
                        {t.tipo === 'error' && <AlertCircle className="text-[#ec4899] shrink-0 mt-0.5" size={20} />}
                        {t.tipo === 'info' && <Info className="text-slate-400 shrink-0 mt-0.5" size={20} />}
                        
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-800 leading-tight pr-4">{t.mensaje}</p>
                        </div>
                        
                        <button 
                            onClick={() => removeToast(t.id)}
                            className="text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>

            {/* ─── MODAL DE CONFIRMACIÓN ─── */}
            {confirmState.isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-0">
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm animate-in fade-in duration-300"
                        onClick={() => handleConfirmClose(false)}
                    />
                    
                    {/* Modal Card */}
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[400px] overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                        <div className="p-6 sm:p-8 flex flex-col items-center text-center">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 shadow-sm ${confirmState.isDestructive ? 'bg-pink-50 text-[#ec4899]' : 'bg-blue-50 text-[#3b82f6]'}`}>
                                {confirmState.isDestructive ? <AlertCircle size={28} /> : <AlertTriangle size={28} />}
                            </div>
                            <h3 className="text-xl font-black text-[#1e2a4a] mb-2 tracking-tight">
                                {confirmState.title}
                            </h3>
                            <p className="text-sm text-slate-500 font-medium leading-relaxed">
                                {confirmState.description}
                            </p>
                        </div>
                        
                        <div className="p-4 sm:px-8 sm:py-5 bg-slate-50/80 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-center gap-3">
                            <button 
                                onClick={() => handleConfirmClose(false)}
                                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={() => handleConfirmClose(true)}
                                className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-sm hover:shadow-md ${
                                    confirmState.isDestructive 
                                        ? 'bg-[#ec4899] hover:bg-pink-600' 
                                        : 'bg-[#3b82f6] hover:bg-blue-600'
                                }`}
                            >
                                Confirmar Acción
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </UIContext.Provider>
    );
};
