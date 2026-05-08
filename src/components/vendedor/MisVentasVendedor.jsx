// src/components/vendedor/MisVentasVendedor.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
    ReceiptText, Search, Package, Globe, Store, FileText, Printer, MessageCircle
} from 'lucide-react';
import { generateIndividualPDF, printThermalTicket } from '../../utils/pdfGenerator';
import { openUrl } from '@tauri-apps/plugin-opener'; // Puente nativo
import { useChanellUI } from '../../context/UIContext'; // Para alertas bonitas

export default function MisVentasVendedor({ user }) {
    const { notify } = useChanellUI();
    const [pedidos, setPedidos] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filtros locales
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all'); // all, pos, web
    const [dateFilter, setDateFilter] = useState('today');

    useEffect(() => {
        if (user) fetchMisVentas();
    }, [user, dateFilter]);

    const fetchMisVentas = async () => {
        setLoading(true);
        let query = supabase
            .from('pedidos')
            .select('*')
            .eq('vendedor_id', user.id)
            .order('created_at', { ascending: false });

        if (dateFilter === 'today') {
            const today = new Date().toISOString().split('T')[0];
            query = query.gte('created_at', `${today}T00:00:00`);
        }

        const { data, error } = await query;
        if (data) setPedidos(data);
        setLoading(false);
    };

    const filteredPedidos = pedidos.filter(p => {
        // 1. Buscador por texto
        const matchesSearch =
            p.ticket.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.cliente_nombre || '').toLowerCase().includes(searchTerm.toLowerCase());

        // 2. Lógica de Filtro por Tipo (CORREGIDA)
        // Una venta es WEB si tiene una agencia asignada o si el método de entrega NO es pickup
        const isWeb = p.agencia !== null || p.metodo_entrega !== 'pickup';

        let matchesType = true;
        if (typeFilter === 'web') {
            matchesType = isWeb;
        } else if (typeFilter === 'pos') {
            matchesType = !isWeb;
        }

        return matchesSearch && matchesType;
    });

    // ==========================================
    // LÓGICA DE WHATSAPP HÍBRIDA (Tauri / Web)
    // ==========================================
    const handleWhatsApp = async (telefono) => {
        if (!telefono || telefono === 'N/A') return notify("Este cliente no proporcionó un teléfono de contacto.", "warning");

        const cleanPhone = telefono.replace(/\D/g, '');
        const finalPhone = cleanPhone.length === 9 ? `51${cleanPhone}` : cleanPhone;
        const url = `https://wa.me/${finalPhone}`;

        // Verificamos si estamos en la app de escritorio nativa de Tauri
        if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
            try {
                await openUrl(url); // Abre Chrome/Edge del sistema con el chat
            } catch (err) {
                console.error("Error al abrir WhatsApp en Tauri:", err);
                notify("No se pudo abrir WhatsApp automáticamente.", "error");
            }
        } else {
            // Si estamos probando en la web tradicional (Vercel)
            window.open(url, '_blank');
        }
    };

    return (
        <div className="w-full space-y-6 pb-10 sm:px-4 animate-in fade-in duration-500">

            {/* CABECERA (Adaptada para celular) */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 sm:p-8 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
                <div className="w-full sm:w-auto">
                    <div className="flex justify-between items-start">
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
                            <ReceiptText className="text-[#3b82f6]" size={28} />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1e2a4a] to-[#3b82f6]">Mis Ventas del Día</span>
                        </h2>
                        {/* El badge se mueve arriba a la derecha en móviles para ahorrar espacio */}
                        <span className="sm:hidden bg-[#ec4899]/10 text-[#ec4899] px-3 py-1.5 rounded-xl text-[10px] font-black border border-[#ec4899]/20 uppercase tracking-widest shrink-0">
                            {filteredPedidos.length} Tickets
                        </span>
                    </div>
                    <p className="text-slate-500 text-xs sm:text-sm mt-1 sm:mt-2">Historial personal de tickets emitidos y sus detalles.</p>
                </div>

                {/* Badge en Desktop */}
                <span className="hidden sm:inline-flex bg-[#ec4899]/10 text-[#ec4899] px-4 py-2.5 rounded-2xl text-xs font-black border border-[#ec4899]/20 uppercase tracking-widest">
                    {filteredPedidos.length} Tickets Registrados
                </span>
            </div>

            {/* FILTROS (Móvil First: Selects al 50% de ancho en celular) */}
            <div className="bg-white p-4 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col lg:flex-row gap-3">
                <div className="relative w-full lg:flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por ticket o cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#f4f6f9] hover:bg-slate-100 border border-transparent focus:bg-white focus:border-[#ec4899] rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold text-[#1e2a4a] outline-none transition-all placeholder:font-medium placeholder:text-slate-400"
                    />
                </div>
                <div className="grid grid-cols-2 lg:flex gap-3 w-full lg:w-auto">
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="w-full bg-[#f4f6f9] border border-transparent focus:border-[#ec4899] focus:bg-white rounded-2xl px-4 py-3.5 text-xs sm:text-sm font-bold text-[#1e2a4a] outline-none transition-all cursor-pointer appearance-none"
                    >
                        <option value="all">Todos los tipos</option>
                        <option value="pos">Solo POS</option>
                        <option value="web">Solo Web</option>
                    </select>
                    <select
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="w-full bg-[#f4f6f9] border border-transparent focus:border-[#ec4899] focus:bg-white rounded-2xl px-4 py-3.5 text-xs sm:text-sm font-bold text-[#1e2a4a] outline-none transition-all cursor-pointer appearance-none"
                    >
                        <option value="today">Hoy</option>
                        <option value="all">Historial completo</option>
                    </select>
                </div>
            </div>

            {/* TABLA / LISTA (Transformación de Tabla a Cards en Móvil) */}
            <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden">
                {loading ? (
                    <div className="flex flex-col justify-center items-center h-48 text-slate-400 space-y-4">
                        <div className="w-8 h-8 border-4 border-[#3b82f6] border-t-transparent rounded-full animate-spin"></div>
                        <p className="font-bold tracking-widest uppercase text-xs text-[#1e2a4a]">Cargando ventas...</p>
                    </div>
                ) : filteredPedidos.length === 0 ? (
                    <div className="p-12 flex flex-col items-center justify-center text-slate-300">
                        <Package size={56} className="mb-4 opacity-30 text-[#1e2a4a]" />
                        <p className="font-bold text-[#1e2a4a]">No se encontraron ventas</p>
                        <p className="text-xs text-slate-400 mt-1 text-center">Intenta ajustando los filtros de búsqueda.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {filteredPedidos.map((p) => (
                            <div key={p.id} className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors group">

                                {/* Información Principal */}
                                <div className="flex items-start sm:items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-[#f4f6f9] flex items-center justify-center shrink-0 group-hover:bg-[#3b82f6]/10 transition-colors">
                                        {(p.agencia || p.metodo_entrega !== 'pickup') ? (
                                            <Globe size={20} className="text-[#3b82f6]" />
                                        ) : (
                                            <Store size={20} className="text-[#1e2a4a]" />
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="font-black text-[#1e2a4a] text-sm sm:text-base">#{p.ticket}</h3>
                                            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                                {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-xs sm:text-sm font-bold text-slate-500 truncate max-w-[200px] sm:max-w-[300px]">
                                            {p.cliente_nombre || 'Cliente General'}
                                        </p>
                                    </div>
                                </div>

                                {/* Acciones y Precio */}
                                <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t sm:border-t-0 border-slate-100 pt-4 sm:pt-0 mt-1 sm:mt-0">
                                    <p className="font-black text-[#1e2a4a] text-xl sm:text-2xl tracking-tight">
                                        S/ {p.total?.toFixed(2)}
                                    </p>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {/* NUEVO BOTÓN DE WHATSAPP */}
                                        <button
                                            onClick={() => handleWhatsApp(p.cliente_telefono)}
                                            className="p-3 sm:p-2.5 bg-[#f4f6f9] text-slate-500 hover:text-white hover:bg-[#25D366] rounded-xl transition-all"
                                            title="Enviar comprobante por WhatsApp"
                                        >
                                            <MessageCircle size={18} />
                                        </button>

                                        <button
                                            onClick={() => generateIndividualPDF(p)}
                                            className="p-3 sm:p-2.5 bg-[#f4f6f9] text-slate-500 hover:text-[#3b82f6] hover:bg-[#3b82f6]/10 rounded-xl transition-all"
                                            title="Descargar PDF corporativo"
                                        >
                                            <FileText size={18} />
                                        </button>
                                        <button
                                            onClick={() => printThermalTicket(p)}
                                            className="p-3 sm:p-2.5 bg-[#f4f6f9] text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                                            title="Imprimir ticket térmico"
                                        >
                                            <Printer size={18} />
                                        </button>
                                    </div>
                                </div>

                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}