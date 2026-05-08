import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
    Globe, Search, MapPin, Clock,
    CheckCircle2, Truck, MessageCircle,
    ShoppingBag, Loader2, Calendar, CreditCard, X, User, Eye, Store, RefreshCw, Wallet, Filter, ArrowRight
} from 'lucide-react';
import gsap from 'gsap';
import { useChanellUI } from '../context/UIContext';
import { open } from '@tauri-apps/plugin-shell';

export default function PedidosWebAdmin() {
    const { notify, confirm } = useChanellUI();
    const { user } = useAuth();
    const [pedidos, setPedidos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeShift, setActiveShift] = useState(null);

    // --- FILTROS AMPLIADOS ---
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todos');
    const [logisticFilter, setLogisticFilter] = useState('Todos'); // NUEVO
    const [dateFilter, setDateFilter] = useState('Todos'); // NUEVO

    // --- ESTADOS DE MODALES ---
    const [selectedPedido, setSelectedPedido] = useState(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isProcessingSale, setIsProcessingSale] = useState(false);

    // Estados de embudo
    const estados = ['pendiente', 'Contactando', 'En Preparación', 'Listo para Recojo', 'Enviado'];

    useEffect(() => {
        fetchPedidos();
        checkTurno();

        const channel = supabase.channel('pedidos-web-cambios');
        channel.on('postgres', { event: '*', schema: 'public', table: 'pedidos' }, () => fetchPedidos()).subscribe();

        return () => supabase.removeChannel(channel);
    }, []);

    const checkTurno = async () => {
        if (!user) return;
        const { data } = await supabase.from('turnos_caja').select('*').eq('usuario_id', user.id).eq('estado', 'abierto').single();
        if (data) setActiveShift(data);
    };

    const fetchPedidos = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('pedidos')
            .select('*')
            .is('turno_id', null) // Solo web
            .neq('estado', 'vendido') // Si ya se vendió, está en la bóveda
            .neq('estado', 'anulado')
            .order('created_at', { ascending: false });

        if (!error && data) setPedidos(data);
        setLoading(false);
    };

    const handleUpdateStatus = async (pedidoId, nuevoEstado) => {
        try {
            const { error } = await supabase.from('pedidos').update({ estado: nuevoEstado }).eq('id', pedidoId);
            if (error) throw error;

            setPedidos(pedidos.map(p => p.id === pedidoId ? { ...p, estado: nuevoEstado } : p));
            if (selectedPedido?.id === pedidoId) setSelectedPedido({ ...selectedPedido, estado: nuevoEstado });
        } catch (error) {
            notify("Error al actualizar estado: " + error.message, "error");
        }
    };

    const openWhatsApp = async (telefono) => {
        if (!telefono || telefono === 'N/A') return notify("Este cliente no proporcionó teléfono.", "error");
        const cleanPhone = telefono.replace(/\D/g, '');
        const finalPhone = cleanPhone.length === 9 ? `51${cleanPhone}` : cleanPhone;

        const url = `https://wa.me/${finalPhone}`;

        // Verificamos si estamos en la app de escritorio
        if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
            await open(url); // Le dice a Windows que abra Chrome con este link
        } else {
            window.open(url, '_blank'); // Para cuando uses la versión web en Vercel
        }
    };

    // =========================================================================
    // LÓGICA DE COBRO DIRECTO DESDE EL LEAD (SIN IR A VENTAS)
    // =========================================================================
    const ejecutarCobroWeb = async (destination) => {
        const nombresMetodos = { 'efectivo': 'Efectivo', 'yape_pos': 'Yape/POS Tienda', 'banco': 'Transferencia' };

        const isConfirmed = await confirm("Oficializar Venta", `¿Confirmas que recibiste S/ ${selectedPedido.total?.toFixed(2)} mediante ${nombresMetodos[destination]}? Al aceptar, el Lead se cerrará y pasará a Ventas.`, true);
        if (!isConfirmed) return;

        setIsProcessingSale(true);
        try {
            const nombreUsuario = user?.user_metadata?.full_name || user?.email || 'Vendedor';
            let p_turno_id = null;
            let p_metodo_pago = selectedPedido.metodo_pago;
            let p_metodo_entrega = selectedPedido.metodo_entrega;

            if (destination === 'efectivo' || destination === 'yape_pos') {
                p_turno_id = activeShift.id;
                p_metodo_pago = destination === 'efectivo' ? 'efectivo' : 'tarjeta';
                p_metodo_entrega = 'pickup';
            } else if (destination === 'banco') {
                p_metodo_pago = 'transferencia';
            }

            const { error: rpcError } = await supabase.rpc('cobrar_pedido_web_seguro', {
                p_pedido_id: selectedPedido.id,
                p_turno_id: p_turno_id,
                p_metodo_pago: p_metodo_pago,
                p_metodo_entrega: p_metodo_entrega,
                p_agencia: selectedPedido.agencia,
                p_usuario_id: user.id,
                p_usuario_nombre: nombreUsuario
            });

            if (rpcError) throw rpcError;

            notify("¡Lead convertido en Venta Exitosamente! El dinero ha sido ingresado.", "success");
            setIsPaymentModalOpen(false);
            setSelectedPedido(null);
            fetchPedidos(); // Refrescamos, este ticket desaparecerá mágicamente de esta bandeja
        } catch (error) {
            notify("Error procesando cobro: " + error.message, "error");
        } finally {
            setIsProcessingSale(false);
        }
    };

    // --- APLICACIÓN DE FILTROS ---
    const filteredPedidos = pedidos.filter(p => {
        const matchesSearch = (p.cliente_nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p.ticket || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p.cliente_dni_ruc || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'Todos' || p.estado === statusFilter;
        const matchesLogistics = logisticFilter === 'Todos' || p.metodo_entrega === logisticFilter;

        let matchesDate = true;
        if (dateFilter !== 'Todos') {
            const today = new Date().toDateString();
            const pDate = new Date(p.created_at).toDateString();
            if (dateFilter === 'hoy') matchesDate = today === pDate;
        }

        return matchesSearch && matchesStatus && matchesLogistics && matchesDate;
    });

    return (
        <div className="w-full space-y-6 pb-10">
            {/* ENCABEZADO */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 sm:p-8 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
                        <Globe className="text-[#3b82f6]" size={32} />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1e2a4a] to-[#3b82f6]">Pedidos Web (Leads)</span>
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Filtra, contacta y cierra las ventas de tu Landing Page.</p>
                </div>
                <button onClick={fetchPedidos} disabled={loading} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#f4f6f9] hover:bg-slate-100 text-[#1e2a4a] px-5 py-3 rounded-2xl font-bold text-sm transition-colors disabled:opacity-50">
                    <RefreshCw size={18} className={loading ? "animate-spin" : ""} /> {loading ? "Buscando..." : "Actualizar Bandeja"}
                </button>
            </div>

            {/* BARRA DE FILTROS AVANZADA */}
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
                <div className="relative w-full md:flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="text" placeholder="Buscar por cliente, DNI o #Ticket..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#f4f6f9] hover:bg-slate-100 border border-transparent focus:bg-white focus:border-[#ec4899] rounded-2xl pl-12 pr-4 py-3 text-sm text-[#1e2a4a] font-medium outline-none transition-all" />
                </div>

                <div className="flex w-full md:w-auto gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                    <div className="relative min-w-[140px]">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ec4899]" size={14} />
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full bg-[#f4f6f9] hover:bg-slate-100 border border-transparent focus:bg-white focus:border-[#ec4899] text-[#1e2a4a] text-xs font-bold rounded-2xl pl-10 pr-4 py-3.5 outline-none appearance-none cursor-pointer transition-all">
                            <option value="Todos">Embudo (Todos)</option>
                            {estados.map(estado => <option key={estado} value={estado}>{estado.toUpperCase()}</option>)}
                        </select>
                    </div>

                    <div className="relative min-w-[140px]">
                        <Truck className="absolute left-4 top-1/2 -translate-y-1/2 text-[#3b82f6]" size={14} />
                        <select value={logisticFilter} onChange={(e) => setLogisticFilter(e.target.value)} className="w-full bg-[#f4f6f9] hover:bg-slate-100 border border-transparent focus:bg-white focus:border-[#3b82f6] text-[#1e2a4a] text-xs font-bold rounded-2xl pl-10 pr-4 py-3.5 outline-none appearance-none cursor-pointer transition-all">
                            <option value="Todos">Despacho (Todos)</option>
                            <option value="shipping">Solo Envíos</option>
                            <option value="pickup">Recojo Tienda</option>
                        </select>
                    </div>

                    <div className="relative min-w-[140px]">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-full bg-[#f4f6f9] hover:bg-slate-100 border border-transparent focus:bg-white focus:border-slate-500 text-[#1e2a4a] text-xs font-bold rounded-2xl pl-10 pr-4 py-3.5 outline-none appearance-none cursor-pointer transition-all">
                            <option value="Todos">Fecha (Todas)</option>
                            <option value="hoy">Ingresados Hoy</option>
                        </select>
                    </div>
                </div>

                {(searchTerm || statusFilter !== 'Todos' || logisticFilter !== 'Todos' || dateFilter !== 'Todos') && (
                    <button onClick={() => { setSearchTerm(''); setStatusFilter('Todos'); setLogisticFilter('Todos'); setDateFilter('Todos'); }} className="p-3 text-slate-400 hover:text-[#ec4899] bg-[#f4f6f9] hover:bg-[#ec4899]/10 rounded-2xl transition-colors"><X size={18} /></button>
                )}
            </div>

            {/* TABLA PRINCIPAL DE LEADS */}
            <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[1000px]">
                        <thead>
                            <tr className="bg-[#f4f6f9]/50 text-[#1e2a4a] text-[10px] uppercase tracking-widest font-black border-b border-slate-100">
                                <th className="p-5 whitespace-nowrap">Ticket / Fecha</th>
                                <th className="p-5 whitespace-nowrap">Cliente y Contacto</th>
                                <th className="p-5 whitespace-nowrap bg-[#3b82f6]/5">Logística / Pago</th>
                                <th className="p-5 whitespace-nowrap">Monto</th>
                                <th className="p-5 whitespace-nowrap text-center">Estado Embudo</th>
                                <th className="p-5 text-right whitespace-nowrap">Acciones Comerciales</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan="6" className="p-10 text-center text-slate-400"><Loader2 className="animate-spin mx-auto mb-2 text-[#3b82f6]" />Cargando leads...</td></tr>
                            ) : filteredPedidos.length === 0 ? (
                                <tr><td colSpan="6" className="p-10 text-center text-slate-400 font-medium">No hay pedidos pendientes. Tu embudo está limpio.</td></tr>
                            ) : filteredPedidos.map((pedido) => (
                                <tr key={pedido.id} className="hover:bg-slate-50/80 transition-colors group">
                                    <td className="p-5">
                                        <div className="font-black text-[#ec4899] text-sm">#{pedido.ticket}</div>
                                        <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest whitespace-nowrap">{new Date(pedido.created_at).toLocaleString('es-PE')}</div>
                                    </td>

                                    <td className="p-5">
                                        <div className="text-sm font-bold text-[#1e2a4a] whitespace-nowrap">{pedido.cliente_nombre || 'Sin nombre'}</div>
                                        <div className="text-[10px] text-slate-500 font-medium mt-0.5 flex items-center gap-2">
                                            <span>DNI: {pedido.cliente_dni_ruc || 'N/A'}</span> <span className="text-slate-300">|</span>
                                            <span className={pedido.cliente_telefono ? "text-slate-600" : "text-red-500 font-bold"}>Telf: {pedido.cliente_telefono || 'FALTA'}</span>
                                        </div>
                                    </td>

                                    <td className="p-5 border-l border-r border-slate-50 bg-[#3b82f6]/5">
                                        {pedido.metodo_entrega === 'pickup' ? (
                                            <div className="flex items-center gap-1.5 text-xs font-black text-[#ec4899] uppercase tracking-wider"><Store size={14} /> Recojo Tienda</div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-xs font-black text-[#3b82f6] uppercase tracking-wider"><Truck size={14} /> Envío ({pedido.agencia || 'Agencia'})</div>
                                        )}
                                        <div className="text-[9px] text-slate-400 mt-1 uppercase tracking-widest font-black">💳 {pedido.metodo_pago || 'Pendiente'}</div>
                                    </td>

                                    <td className="p-5"><div className="text-base font-black text-[#1e2a4a] whitespace-nowrap">S/ {pedido.total?.toFixed(2)}</div></td>

                                    <td className="p-5 text-center">
                                        <select value={pedido.estado} onChange={(e) => handleUpdateStatus(pedido.id, e.target.value)} className={`border text-[10px] font-black uppercase tracking-widest rounded-xl px-3 py-2 outline-none cursor-pointer appearance-none transition-colors shadow-sm
                                            ${pedido.estado === 'pendiente' ? 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20' :
                                                pedido.estado === 'Contactando' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                                    pedido.estado === 'En Preparación' ? 'bg-[#ec4899]/10 text-[#ec4899] border-[#ec4899]/20' :
                                                        pedido.estado === 'Listo para Recojo' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                                                            pedido.estado === 'Enviado' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                            {estados.map(est => <option key={est} value={est}>{est}</option>)}
                                        </select>
                                    </td>

                                    <td className="p-5 text-right">
                                        <div className="flex justify-end items-center gap-2">
                                            <button onClick={() => openWhatsApp(pedido.cliente_telefono)} disabled={!pedido.cliente_telefono} className="p-2.5 text-white bg-[#25D366] hover:bg-[#20bd5a] rounded-xl transition-all shadow-md shadow-[#25D366]/20 disabled:opacity-50 disabled:shadow-none" title="Contactar por WhatsApp">
                                                <MessageCircle size={16} />
                                            </button>
                                            <button onClick={() => setSelectedPedido(pedido)} className="p-2.5 text-slate-500 hover:text-[#3b82f6] bg-[#f4f6f9] hover:bg-[#3b82f6]/10 rounded-xl transition-all" title="Ver Detalle y Oficializar">
                                                <Eye size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL DETALLE CON BOTÓN DE CONVERSIÓN A VENTA */}
            {selectedPedido && !isPaymentModalOpen && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100">
                        <div className="p-6 sm:p-8 border-b border-slate-100 flex justify-between items-center bg-[#f4f6f9]/50">
                            <div>
                                <h3 className="text-xl font-black text-[#1e2a4a] flex items-center gap-2">Auditoría de Lead Web</h3>
                                <p className="text-sm text-slate-500 font-bold tracking-widest mt-1">TICKET #{selectedPedido.ticket}</p>
                            </div>
                            <button onClick={() => setSelectedPedido(null)} className="p-2 text-slate-400 hover:text-[#ec4899] bg-white hover:bg-[#ec4899]/10 rounded-full border border-slate-200 transition-colors"><X size={20} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
                            {/* Info Dual */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-[#f4f6f9] p-5 rounded-2xl border border-slate-100 space-y-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><User size={12} /> Cliente</p>
                                    <p className="text-sm font-bold text-[#1e2a4a]">{selectedPedido.cliente_nombre}</p>
                                    <p className="text-xs text-slate-500">DNI/RUC: <span className="font-bold text-slate-700">{selectedPedido.cliente_dni_ruc || 'N/A'}</span></p>
                                    <p className="text-xs text-slate-500">Teléfono: <span className="font-bold text-slate-700">{selectedPedido.cliente_telefono || 'N/A'}</span></p>
                                </div>
                                <div className="bg-[#f4f6f9] p-5 rounded-2xl border border-slate-100 space-y-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><MapPin size={12} /> Despacho ({selectedPedido.metodo_entrega})</p>
                                    <p className="text-sm font-bold text-[#3b82f6] uppercase">{selectedPedido.agencia ? `Envío: ${selectedPedido.agencia}` : 'Recojo en Tienda'}</p>
                                    <p className="text-xs text-slate-600 break-words font-medium">{selectedPedido.direccion || 'Av. Sáenz Peña 100'}</p>
                                </div>
                            </div>

                            {/* Carrito */}
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1"><ShoppingBag size={12} /> Detalle del Pedido ({selectedPedido.metodo_pago})</p>
                                <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-[#f4f6f9] text-[#1e2a4a] border-b border-slate-100 font-black uppercase tracking-wider">
                                            <tr><th className="p-4">Producto</th><th className="p-4 text-center">Cant.</th><th className="p-4 text-right">Subtotal</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white text-slate-800">
                                            {selectedPedido.items && selectedPedido.items.map((det, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                    <td className="p-4 font-bold text-[#1e2a4a]">{det.product?.name || 'Desconocido'}</td>
                                                    <td className="p-4 text-center text-slate-500 font-black bg-slate-50/50">{det.quantity}</td>
                                                    <td className="p-4 text-right font-black text-[#1e2a4a]">S/ {(det.quantity * det.product?.price).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* EL BOTÓN MÁGICO DE CONVERSIÓN */}
                        <div className="p-6 sm:p-8 border-t border-slate-100 bg-white flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-3">
                                <span className="text-slate-400 text-xs font-black uppercase tracking-widest">Total</span>
                                <span className="font-black text-3xl text-[#1e2a4a] tracking-tight">S/ {selectedPedido.total?.toFixed(2)}</span>
                            </div>
                            <button onClick={() => setIsPaymentModalOpen(true)} className="w-full sm:w-auto bg-[#3b82f6] hover:bg-blue-600 text-white font-black uppercase tracking-widest px-8 py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-[0_4px_15px_rgba(59,130,246,0.3)] hover:shadow-[0_6px_20px_rgba(59,130,246,0.4)] hover:-translate-y-0.5">
                                Oficializar Venta <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SUBLAYER: MODAL DE MÉTODO DE PAGO RÁPIDO */}
            {isPaymentModalOpen && selectedPedido && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[110] p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-[#3b82f6]/10 text-[#3b82f6] rounded-full flex items-center justify-center mx-auto mb-4"><Wallet size={28} /></div>
                            <h3 className="text-2xl font-black text-[#1e2a4a] tracking-tight">Oficializar Cobro</h3>
                            <p className="text-slate-500 text-sm mt-2">¿Cómo pagó el cliente los <strong className="text-[#1e2a4a]">S/ {selectedPedido.total?.toFixed(2)}</strong>?</p>
                        </div>

                        <div className="space-y-3">
                            <button onClick={() => ejecutarCobroWeb('banco')} disabled={isProcessingSale} className="w-full flex items-center gap-4 p-4 border-2 border-[#f4f6f9] bg-[#f4f6f9]/50 rounded-2xl hover:border-[#3b82f6] hover:bg-[#3b82f6]/5 transition-all text-left group disabled:opacity-50">
                                <div className="p-3 bg-white shadow-sm rounded-xl text-slate-400 group-hover:text-[#3b82f6] transition-colors"><Globe size={24} /></div>
                                <div>
                                    <h4 className="font-bold text-[#1e2a4a]">Transferencia / Link Pago</h4>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Directo al banco de la empresa</p>
                                </div>
                            </button>

                            <button onClick={() => ejecutarCobroWeb('efectivo')} disabled={!activeShift || isProcessingSale} className="w-full flex items-center gap-4 p-4 border-2 border-[#f4f6f9] bg-[#f4f6f9]/50 rounded-2xl hover:border-[#ec4899] hover:bg-[#ec4899]/5 transition-all text-left group disabled:opacity-50">
                                <div className="p-3 bg-white shadow-sm rounded-xl text-slate-400 group-hover:text-[#ec4899] transition-colors"><Wallet size={24} /></div>
                                <div>
                                    <h4 className="font-bold text-[#1e2a4a]">Efectivo en Mostrador</h4>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Suma al Arqueo Diario</p>
                                    {!activeShift && <p className="text-[10px] text-red-500 font-bold mt-1">⚠️ Abre tu caja (POS) primero.</p>}
                                </div>
                            </button>
                        </div>

                        <button onClick={() => setIsPaymentModalOpen(false)} className="w-full mt-6 py-4 text-slate-400 font-bold text-sm hover:text-[#1e2a4a] bg-[#f4f6f9] hover:bg-slate-200 rounded-2xl transition-colors">Cancelar Operación</button>
                    </div>
                </div>
            )}
        </div>
    );
}