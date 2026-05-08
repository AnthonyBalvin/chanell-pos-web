import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { LogOut, Store, ReceiptText, Globe, ChevronDown, User as UserIcon } from 'lucide-react';
import PosAdmin from '../components/PosAdmin';
import PedidosWebVendedor from '../components/vendedor/PedidosWebVendedor';
import MisVentasVendedor from '../components/vendedor/MisVentasVendedor';
import { useChanellUI } from '../context/UIContext';

export default function DashboardVendedor() {
    const { confirm } = useChanellUI();
    const { user } = useAuth();
    const [activeView, setActiveView] = useState('pos');
    const [activeShift, setActiveShift] = useState(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    useEffect(() => {
        const checkTurno = async () => {
            if (!user) return;
            const { data } = await supabase.from('turnos_caja').select('*').eq('usuario_id', user.id).eq('estado', 'abierto').single();
            if (data) setActiveShift(data);
        };
        checkTurno();
    }, [user, activeView]);

    const handleLogout = async () => {
        const isConfirmed = await confirm("Cerrar Sesión", "¿Seguro que deseas salir del sistema?", true);
        if (isConfirmed) {
            await supabase.auth.signOut();
        }
    };

    return (
        // Contenedor principal con pb-[72px] en móvil para la PWA Bottom Bar
        <div className="h-screen bg-[#f4f6f9] flex flex-col overflow-hidden text-gray-800 relative pb-[72px] md:pb-0">

            {/* HEADER SUPERIOR */}
            <header className="bg-[#1e2a4a] text-white h-16 flex items-center justify-between px-4 sm:px-6 shadow-[0_4px_20px_rgba(30,42,74,0.4)] z-50 shrink-0">
                <div className="flex items-center gap-6">
                    {/* LOGO */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#ec4899] to-[#3b82f6] rounded-2xl flex items-center justify-center font-bold shadow-[0_0_15px_rgba(236,72,153,0.4)] shrink-0">
                            <Store size={18} />
                        </div>
                        <div className="hidden sm:block">
                            <h1 className="font-black tracking-widest text-xs uppercase leading-none">Chanell</h1>
                            <p className="text-[9px] text-slate-400 uppercase tracking-widest font-medium">Tecnología</p>
                        </div>
                    </div>

                    {/* NAVEGACIÓN DESKTOP (Se oculta en móvil md:hidden) */}
                    <div className="hidden md:flex bg-white/5 rounded-2xl p-1 border border-white/10 gap-1">
                        <button onClick={() => setActiveView('pos')} className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeView === 'pos' ? 'bg-[#ec4899] text-white shadow-[0_2px_10px_rgba(236,72,153,0.4)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                            <Store size={14} /> Caja
                        </button>
                        <button onClick={() => setActiveView('web')} className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeView === 'web' ? 'bg-[#3b82f6] text-white shadow-[0_2px_10px_rgba(59,130,246,0.4)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                            <Globe size={14} /> Pedidos Web
                        </button>
                        <button onClick={() => setActiveView('ventas')} className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeView === 'ventas' ? 'bg-[#ec4899] text-white shadow-[0_2px_10px_rgba(236,72,153,0.4)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                            <ReceiptText size={14} /> Mis Tickets
                        </button>
                    </div>
                </div>

                {/* MENÚ DE PERFIL */}
                <div className="relative">
                    <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-2 sm:gap-3 hover:bg-white/5 p-1 rounded-2xl transition-all border border-white/10 pr-2 sm:pr-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-[#3b82f6] to-[#1e2a4a] rounded-xl flex items-center justify-center border border-white/20 text-[10px] font-black uppercase tracking-tighter">
                            {user?.email?.charAt(0) || <UserIcon size={14} />}
                        </div>
                        <div className="text-left hidden sm:block">
                            <p className="text-[11px] font-bold leading-tight">{user?.user_metadata?.full_name || 'Vendedor'}</p>
                            <p className="text-[9px] text-slate-400 uppercase tracking-widest font-medium">Cajero Activo</p>
                        </div>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* DROPDOWN PERFIL */}
                    {isProfileOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsProfileOpen(false)}></div>
                            <div className="absolute right-0 mt-3 w-56 sm:w-64 bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-100 z-20 py-2 overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right">
                                <div className="px-4 py-4 border-b border-slate-50 bg-[#f4f6f9]/50">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cuenta</p>
                                    <p className="text-xs sm:text-sm font-bold text-[#1e2a4a] truncate">{user?.email}</p>
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter">En Línea</span>
                                    </div>
                                </div>
                                <div className="p-2">
                                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-all text-left group">
                                        <div className="p-2 bg-red-100 text-red-500 rounded-lg group-hover:bg-red-500 group-hover:text-white transition-colors">
                                            <LogOut size={16} />
                                        </div>
                                        Cerrar Sesión
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </header>

            {/* ÁREA PRINCIPAL (AQUÍ ESTÁ LA CORRECCIÓN: flex-1, flex-col, min-h-0) */}
            <main className="flex-1 flex flex-col min-h-0 w-full relative pt-4 sm:pt-6">
                {activeView === 'pos' && <PosAdmin onCloseCaja={() => setActiveView('ventas')} />}
                {activeView === 'web' && <PedidosWebVendedor user={user} activeShift={activeShift} onGoToTickets={() => setActiveView('ventas')} />}
                {activeView === 'ventas' && <MisVentasVendedor user={user} />}
            </main>

            {/* -------------------------------------------------------------
                NAVEGACIÓN MÓVIL (PWA Bottom Tab Bar - Solo visible en móvil)
            -------------------------------------------------------------- */}
            <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 flex justify-around items-center h-[72px] z-50 shadow-[0_-10px_20px_rgba(0,0,0,0.03)] pb-2">
                <button
                    onClick={() => setActiveView('pos')}
                    className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${activeView === 'pos' ? 'text-[#ec4899]' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <div className={`p-1.5 rounded-xl transition-all ${activeView === 'pos' ? 'bg-[#ec4899]/10 scale-110' : ''}`}>
                        <Store size={22} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest">Caja</span>
                </button>

                <button
                    onClick={() => setActiveView('web')}
                    className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${activeView === 'web' ? 'text-[#3b82f6]' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <div className={`p-1.5 rounded-xl transition-all ${activeView === 'web' ? 'bg-[#3b82f6]/10 scale-110' : ''}`}>
                        <Globe size={22} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest">Web</span>
                </button>

                <button
                    onClick={() => setActiveView('ventas')}
                    className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${activeView === 'ventas' ? 'text-[#ec4899]' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <div className={`p-1.5 rounded-xl transition-all ${activeView === 'ventas' ? 'bg-[#ec4899]/10 scale-110' : ''}`}>
                        <ReceiptText size={22} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest">Tickets</span>
                </button>
            </nav>

        </div>
    );
}