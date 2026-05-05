import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Globe, CheckCircle2, Store, MessageCircle, Wallet, RefreshCw, X, CreditCard } from 'lucide-react';

export default function PedidosWebVendedor({ user, activeShift, onGoToTickets }) {
    const [pedidos, setPedidos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [orderToSell, setOrderToSell] = useState(null);
    const [isProcessingSale, setIsProcessingSale] = useState(false);

    const estados = ['pendiente', 'Contactando', 'En Preparación', 'Listo para Recojo', 'Enviado'];

    useEffect(() => { fetchPedidosWeb(); }, []);

    const fetchPedidosWeb = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('pedidos')
            .select('*')
            .is('turno_id', null)
            .neq('estado', 'vendido')
            .neq('estado', 'anulado')
            .order('created_at', { ascending: false });
        if (data) setPedidos(data);
        setLoading(false);
    };

    const handleUpdateStatus = async (pedidoId, nuevoEstado) => {
        try {
            const { error } = await supabase.from('pedidos').update({ estado: nuevoEstado }).eq('id', pedidoId);
            if (error) throw error;
            setPedidos(pedidos.map(p => p.id === pedidoId ? { ...p, estado: nuevoEstado } : p));
        } catch (error) {
            alert("Error: " + error.message);
        }
    };

    const handleOpenPayment = (pedido) => {
        setOrderToSell(pedido);
        setIsPaymentModalOpen(true);
    };

    const ejecutarCobroWeb = async (destination) => {
        setIsProcessingSale(true);
        try {
            const nombreUsuario = user?.user_metadata?.full_name || user?.email || 'Vendedor POS';

            if ((destination === 'efectivo' || destination === 'yape_pos') && !activeShift) {
                throw new Error("No puedes cobrar en efectivo o POS si la caja está cerrada. Abre tu turno primero.");
            }

            let p_turno_id = null;
            let p_metodo_pago = orderToSell.metodo_pago;
            let p_metodo_entrega = orderToSell.metodo_entrega;

            if (destination === 'efectivo' || destination === 'yape_pos') {
                p_turno_id = activeShift.id;
                p_metodo_pago = destination === 'efectivo' ? 'efectivo' : 'tarjeta';
                p_metodo_entrega = 'pickup';
            } else if (destination === 'banco') {
                p_metodo_pago = 'transferencia';
            }

            const { error: rpcError } = await supabase.rpc('cobrar_pedido_web_seguro', {
                p_pedido_id: orderToSell.id,
                p_turno_id: p_turno_id,
                p_metodo_pago: p_metodo_pago,
                p_metodo_entrega: p_metodo_entrega,
                p_agencia: orderToSell.agencia,
                p_usuario_id: user.id,
                p_usuario_nombre: nombreUsuario
            });

            if (rpcError) throw rpcError;

            alert("¡Venta oficializada! El ticket ahora aparecerá en tu historial.");
            setIsPaymentModalOpen(false);
            onGoToTickets();
        } catch (error) {
            alert("Operación denegada: " + error.message);
        } finally {
            setIsProcessingSale(false);
        }
    };

    return (
        <div className="w-full space-y-6 pb-10 sm:px-4 animate-in fade-in duration-500">

            {/* CABECERA (Adaptada para PWA) */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 sm:p-8 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
                <div className="w-full md:w-auto">
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
                        <Globe className="text-[#3b82f6]" size={28} />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1e2a4a] to-[#3b82f6]">Pedidos Web</span>
                    </h2>
                    <p className="text-slate-500 text-xs sm:text-sm mt-1">Gestiona estados y cobra los pedidos de la tienda online.</p>
                </div>
                <button
                    onClick={fetchPedidosWeb}
                    disabled={loading}
                    className="w-full md:w-auto flex items-center justify-center gap-2 bg-[#f4f6f9] hover:bg-slate-100 text-[#1e2a4a] px-5 py-3.5 sm:py-3 rounded-2xl font-black text-sm transition-colors uppercase tracking-widest disabled:opacity-50"
                >
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                    {loading ? 'Buscando...' : 'Actualizar'}
                </button>
            </div>

            {/* LISTA DE PEDIDOS (Móvil: Cards / Desktop: Filas) */}
            <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden">
                {loading ? (
                    <div className="flex flex-col justify-center items-center h-48 text-slate-400 space-y-4">
                        <div className="w-8 h-8 border-4 border-[#3b82f6] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : pedidos.length === 0 ? (
                    <div className="p-12 flex flex-col items-center justify-center text-slate-300">
                        <CheckCircle2 size={56} className="mb-4 text-emerald-400 opacity-40" />
                        <p className="font-bold text-[#1e2a4a]">Bandeja Limpia</p>
                        <p className="text-xs text-slate-400 mt-1">No hay pedidos web pendientes en este momento.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {pedidos.map((p) => (
                            <div key={p.id} className="p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">

                                {/* Info del Pedido */}
                                <div className="flex-1 flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6] shrink-0 border border-[#3b82f6]/10">
                                        <Globe size={20} />
                                    </div>
                                    <div className="w-full">
                                        <div className="flex justify-between items-start xl:items-center w-full">
                                            <h3 className="font-black text-[#1e2a4a] text-sm sm:text-base">
                                                #{p.ticket} <span className="hidden sm:inline text-slate-400 font-bold ml-2">S/ {p.total?.toFixed(2)}</span>
                                            </h3>
                                            <span className="sm:hidden font-black text-[#1e2a4a] text-base">S/ {p.total?.toFixed(2)}</span>
                                        </div>
                                        <p className="text-xs sm:text-sm font-bold text-slate-500 mt-0.5 mb-3 xl:mb-0">Cliente: {p.cliente_nombre}</p>

                                        {/* Selector de Estado (Full width en celular) */}
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2">
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest hidden sm:block">Estado:</span>
                                            <select
                                                value={p.estado}
                                                onChange={(e) => handleUpdateStatus(p.id, e.target.value)}
                                                className={`w-full sm:w-auto text-[10px] sm:text-xs font-black uppercase tracking-widest px-3 py-2.5 sm:py-1.5 rounded-xl border outline-none cursor-pointer transition-all
                                                ${p.estado === 'pendiente' ? 'bg-blue-50 text-[#3b82f6] border-blue-200' :
                                                        p.estado === 'En Preparación' ? 'bg-purple-50 text-purple-600 border-purple-200' :
                                                            p.estado === 'Listo para Recojo' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                                                                p.estado === 'Enviado' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                                            >
                                                {estados.map(est => <option key={est} value={est}>{est}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Botones de Acción (Side-by-side en celular) */}
                                <div className="flex items-center gap-2 xl:gap-3 shrink-0 mt-2 xl:mt-0 border-t xl:border-none border-slate-100 pt-4 xl:pt-0 w-full xl:w-auto">
                                    <button
                                        onClick={() => {
                                            const phone = p.cliente_telefono?.replace(/\D/g, '');
                                            if (phone) window.open(`https://wa.me/${phone.length === 9 ? '51' + phone : phone}`, '_blank');
                                            else alert("Sin teléfono");
                                        }}
                                        className="flex-1 xl:flex-none flex items-center justify-center gap-2 p-3 sm:p-3.5 text-white bg-[#25D366] hover:bg-[#20bd5a] rounded-2xl transition-all shadow-sm font-bold text-xs uppercase tracking-widest"
                                        title="Contactar por WhatsApp"
                                    >
                                        <MessageCircle size={18} />
                                        <span className="xl:hidden">WhatsApp</span>
                                    </button>
                                    <button
                                        onClick={() => handleOpenPayment(p)}
                                        className="flex-[2] xl:flex-none bg-[#3b82f6] hover:bg-blue-600 text-white px-6 py-3 sm:py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-[0_4px_15px_rgba(59,130,246,0.3)] flex items-center justify-center gap-2 transition-all"
                                    >
                                        <Wallet size={16} /> Cobrar
                                    </button>
                                </div>

                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* MODAL DE COBRO (Móvil: Bottom Sheet / Desktop: Modal Centrado) */}
            {isPaymentModalOpen && orderToSell && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4">
                    {/* El modal se pega abajo en celulares (rounded-t-3xl) y se centra en PC (rounded-3xl) */}
                    <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in duration-300">

                        {/* Botón cerrar sutil arriba para celulares */}
                        <div className="w-full flex justify-center pt-3 sm:hidden">
                            <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
                        </div>

                        <div className="p-6 sm:p-8 flex flex-col items-center text-center relative">
                            <button onClick={() => setIsPaymentModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 hidden sm:block">
                                <X size={20} />
                            </button>
                            <div className="w-14 h-14 bg-[#3b82f6]/10 text-[#3b82f6] rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-[#3b82f6]/20">
                                <CreditCard size={28} />
                            </div>
                            <h3 className="text-xl sm:text-2xl font-black text-[#1e2a4a] tracking-tight">Cobrar #{orderToSell.ticket}</h3>
                            <p className="text-xs text-slate-500 mt-2 uppercase font-black tracking-widest">Monto a cancelar: <span className="text-[#ec4899] text-sm">S/ {orderToSell.total?.toFixed(2)}</span></p>
                        </div>

                        <div className="px-5 sm:px-6 pb-6 sm:pb-8 space-y-3">
                            <button onClick={() => ejecutarCobroWeb('banco')} disabled={isProcessingSale} className="w-full flex items-center gap-4 p-4 border-2 border-slate-100 rounded-2xl hover:border-[#3b82f6] hover:bg-[#3b82f6]/5 transition-all text-left group">
                                <div className="p-3 bg-[#f4f6f9] rounded-xl group-hover:bg-[#3b82f6]/10 group-hover:text-[#3b82f6] text-slate-500 transition-colors shrink-0"><Globe size={20} /></div>
                                <div><h4 className="font-bold text-[#1e2a4a] text-sm">Depósito Directo</h4><p className="text-[10px] text-slate-400 font-medium mt-0.5">Directo a cuenta de la empresa (Web)</p></div>
                            </button>

                            <button onClick={() => ejecutarCobroWeb('efectivo')} disabled={!activeShift || isProcessingSale} className={`w-full flex items-center gap-4 p-4 border-2 rounded-2xl transition-all text-left group ${!activeShift ? 'bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed' : 'border-slate-100 hover:border-emerald-500 hover:bg-emerald-50/50'}`}>
                                <div className="p-3 bg-[#f4f6f9] rounded-xl group-hover:bg-emerald-50 group-hover:text-emerald-600 text-slate-500 transition-colors shrink-0"><Wallet size={20} /></div>
                                <div>
                                    <h4 className="font-bold text-[#1e2a4a] text-sm">Efectivo en Tienda</h4>
                                    {!activeShift ? <p className="text-[10px] text-[#ec4899] font-black uppercase mt-0.5">Caja Cerrada</p> : <p className="text-[10px] text-slate-400 font-medium mt-0.5">Ingresa físico a tu caja actual</p>}
                                </div>
                            </button>

                            <button onClick={() => ejecutarCobroWeb('yape_pos')} disabled={!activeShift || isProcessingSale} className={`w-full flex items-center gap-4 p-4 border-2 rounded-2xl transition-all text-left group ${!activeShift ? 'bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed' : 'border-slate-100 hover:border-[#ec4899] hover:bg-[#ec4899]/5'}`}>
                                <div className="p-3 bg-[#f4f6f9] rounded-xl group-hover:bg-[#ec4899]/10 group-hover:text-[#ec4899] text-slate-500 transition-colors shrink-0"><Store size={20} /></div>
                                <div>
                                    <h4 className="font-bold text-[#1e2a4a] text-sm">Terminal POS / Yape</h4>
                                    {!activeShift ? <p className="text-[10px] text-[#ec4899] font-black uppercase mt-0.5">Caja Cerrada</p> : <p className="text-[10px] text-slate-400 font-medium mt-0.5">Suma al arqueo digital del día</p>}
                                </div>
                            </button>

                            {/* Botón cancelar visible solo en móvil */}
                            <button onClick={() => setIsPaymentModalOpen(false)} className="w-full mt-4 py-4 text-slate-400 font-black uppercase tracking-widest text-[10px] sm:hidden hover:text-[#1e2a4a] transition-colors rounded-2xl bg-slate-50 border border-slate-100">
                                Cancelar Operación
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}