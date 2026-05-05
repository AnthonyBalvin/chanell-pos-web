import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, User, Tag, CheckCircle2, Package, Lock, Unlock, Wallet, X, ShieldAlert, UserCheck, FileText, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { usePOS } from '../hooks/usePOS';

export default function PosAdmin({ onCloseCaja }) {
    const navigate = useNavigate();
    const cartRef = useRef(null);
    const searchInputRef = useRef(null); // NUEVO: Referencia para el buscador

    const pos = usePOS(cartRef);

    const [isTurnoModalOpen, setIsTurnoModalOpen] = useState(false);
    const [isGastoModalOpen, setIsGastoModalOpen] = useState(false);
    const [montoCaja, setMontoCaja] = useState('');
    const [gastoDesc, setGastoDesc] = useState('');
    const [gastoMonto, setGastoMonto] = useState('');

    // --- NUEVO: ATAJOS DE TECLADO GLOBALES (F4 y F8) ---
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            // F4: Enfocar buscador
            if (e.key === 'F4') {
                e.preventDefault(); // Evita el comportamiento por defecto del navegador
                if (searchInputRef.current) {
                    searchInputRef.current.focus();
                }
            }
            // F8: Cobrar Rápido (Solo si hay turno, hay items y no está procesando)
            else if (e.key === 'F8') {
                e.preventDefault();
                if (pos.turnoActivo && pos.cart.length > 0 && !pos.isProcessing && !isTurnoModalOpen && !isGastoModalOpen) {
                    pos.handleCheckout();
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [pos.turnoActivo, pos.cart.length, pos.isProcessing, isTurnoModalOpen, isGastoModalOpen, pos.handleCheckout]);

    // --- MANEJADORES DE UI ---
    const handleAbrirCaja = async (e) => {
        e.preventDefault();
        try {
            await pos.abrirCaja(parseFloat(montoCaja) || 0);
            setMontoCaja('');
        } catch (error) { alert("Error al abrir caja: " + error.message); }
    };

    const handlePrepararCierre = async () => {
        await pos.calcularCierre();
        setMontoCaja('');
        setIsTurnoModalOpen(true);
    };

    const handleCerrarCaja = async (e) => {
        e.preventDefault();
        try {
            await pos.cerrarCaja(parseFloat(montoCaja) || 0);
            alert(`¡Caja cerrada correctamente!\n\nEl reporte ha sido enviado a gerencia.`);
            setIsTurnoModalOpen(false);
        } catch (error) { alert("Error al cerrar caja: " + error.message); }
    };

    const handleRegistrarGasto = async (e) => {
        e.preventDefault();
        try {
            await pos.registrarGasto(gastoDesc, parseFloat(gastoMonto));
            alert("Gasto registrado exitosamente.");
            setIsGastoModalOpen(false); setGastoDesc(''); setGastoMonto('');
        } catch (error) { alert("Error: " + error.message); }
    };

    if (pos.loadingTurno) return <div className="min-h-screen flex items-center justify-center text-gray-400">Verificando estado de caja...</div>;

    return (
        <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-4rem)] bg-transparent gap-4 lg:gap-6 px-2 lg:px-4 pb-6 overflow-y-auto lg:overflow-hidden max-w-screen-2xl mx-auto relative">

            {/* OVERLAY BLOQUEO APERTURA DE CAJA */}
            {!pos.turnoActivo && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-3xl w-full max-w-md p-10 shadow-2xl relative">
                        <button type="button" onClick={() => onCloseCaja ? onCloseCaja() : navigate('/admin')} className="absolute top-5 right-5 text-slate-400 hover:text-red-500 p-2 bg-[#f4f6f9] hover:bg-red-50 rounded-full transition-colors"><X size={20} /></button>
                        <form onSubmit={handleAbrirCaja} className="space-y-8 mt-2">
                            <div className="text-center">
                                <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-sm"><Unlock size={36} /></div>
                                <h2 className="text-3xl font-black text-[#1e2a4a] tracking-tight">Abrir Caja</h2>
                                <p className="text-slate-500 text-sm mt-3 leading-relaxed">Declara el dinero físico inicial.</p>
                            </div>
                            <div>
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-3 text-center">Sencillo Inicial (S/)</label>
                                <input type="number" step="0.01" min="0" required autoFocus value={montoCaja} onChange={e => setMontoCaja(e.target.value)} placeholder="0.00" className="w-full text-5xl font-black text-center text-emerald-500 bg-[#f4f6f9] border-2 border-transparent rounded-2xl p-6 outline-none focus:bg-white focus:border-emerald-400 no-spinners transition-all" />
                            </div>
                            <button type="submit" className="w-full bg-emerald-500 text-white font-black py-4 rounded-2xl hover:bg-emerald-600 transition-all shadow-[0_4px_15px_rgba(16,185,129,0.3)] tracking-widest uppercase text-sm hover:-translate-y-0.5">Iniciar Turno</button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL CIERRE DE CAJA CIEGO */}
            {isTurnoModalOpen && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl relative">
                        <form onSubmit={handleCerrarCaja} className="space-y-6">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                                <h2 className="text-xl font-black text-[#1e2a4a] flex items-center gap-2"><Lock className="text-red-500" /> Cierre de Caja</h2>
                                <button type="button" onClick={() => setIsTurnoModalOpen(false)} className="text-slate-400 hover:text-red-500 p-2 bg-[#f4f6f9] hover:bg-red-50 rounded-full transition-colors"><X size={20} /></button>
                            </div>
                            <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 text-center space-y-3 shadow-sm">
                                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-blue-100 mx-auto"><ShieldAlert className="text-blue-500" size={28} /></div>
                                <h3 className="font-black text-blue-800 tracking-tight text-lg">Modo de Alta Seguridad</h3>
                                <p className="text-sm text-blue-600 leading-relaxed font-bold">Digita el total exacto de billetes y monedas que tienes físicamente.</p>
                            </div>
                            <div>
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-3 text-center">¿Total contado en Efectivo? (S/)</label>
                                <input type="number" step="0.01" min="0" required autoFocus value={montoCaja} onChange={e => setMontoCaja(e.target.value)} placeholder="0.00" className="w-full text-4xl font-black text-center text-[#1e2a4a] bg-[#f4f6f9] border-2 border-transparent rounded-2xl p-5 outline-none focus:bg-white focus:border-red-500 no-spinners transition-all" />
                            </div>
                            <button type="submit" className="w-full bg-red-500 text-white font-black py-4 rounded-2xl hover:bg-red-600 transition-all shadow-[0_4px_15px_rgba(239,68,68,0.3)] tracking-widest uppercase text-sm hover:-translate-y-0.5">Confirmar Arqueo Físico</button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL REGISTRAR GASTO */}
            {isGastoModalOpen && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl relative">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                            <h2 className="text-lg font-black text-[#1e2a4a] flex items-center gap-2"><Wallet className="text-amber-500" /> Registrar Gasto</h2>
                            <button type="button" onClick={() => setIsGastoModalOpen(false)} className="text-slate-400 hover:text-amber-500 p-2 bg-[#f4f6f9] hover:bg-amber-50 rounded-full transition-colors"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleRegistrarGasto} className="space-y-5">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Motivo</label>
                                <input type="text" required autoFocus value={gastoDesc} onChange={e => setGastoDesc(e.target.value)} placeholder="Ej: Pago de pasajes..." className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 font-bold text-[#1e2a4a] outline-none focus:bg-white focus:border-amber-500 transition-all" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Monto a retirar (S/)</label>
                                <input type="number" step="0.01" min="0.1" required value={gastoMonto} onChange={e => setGastoMonto(e.target.value)} placeholder="0.00" className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 text-3xl font-black text-amber-500 text-center outline-none focus:bg-white focus:border-amber-500 no-spinners transition-all" />
                            </div>
                            <button type="submit" className="w-full bg-amber-500 text-white font-black py-4 rounded-2xl hover:bg-amber-600 transition-all tracking-widest uppercase text-sm shadow-[0_4px_15px_rgba(245,158,11,0.3)] hover:-translate-y-0.5">Extraer Dinero</button>
                        </form>
                    </div>
                </div>
            )}

            {/* PANEL IZQUIERDO: PRODUCTOS */}
            <div className={`w-full lg:w-[65%] xl:w-[70%] h-[55vh] sm:h-[65vh] lg:h-full flex flex-col bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden transition-all ${!pos.turnoActivo ? 'blur-sm pointer-events-none opacity-40 scale-[0.98]' : ''}`}>
                <div className="p-4 sm:p-6 border-b border-slate-100 bg-[#f4f6f9]/50 shrink-0">
                    <div className="flex flex-col xl:flex-row justify-between gap-4">
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2">
                                <Tag className="text-[#3b82f6]" size={28} />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1e2a4a] to-[#3b82f6]">Punto de Venta</span>

                                {/* SEMÁFORO DE CONEXIÓN */}
                                {pos.syncStatus === 'online' && (
                                    <span className="ml-2 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md flex items-center gap-1 border border-emerald-200">
                                        <Wifi size={12} /> Online
                                    </span>
                                )}
                                {pos.syncStatus === 'offline' && (
                                    <span className="ml-2 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md flex items-center gap-1 border border-red-200 animate-pulse">
                                        <WifiOff size={12} /> Offline
                                    </span>
                                )}
                                {pos.syncStatus === 'syncing' && (
                                    <span className="ml-2 bg-blue-50 text-[#3b82f6] text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md flex items-center gap-1 border border-blue-200">
                                        <RefreshCw size={12} className="animate-spin" /> Sinc.
                                    </span>
                                )}
                            </h2>
                            <p className="text-slate-500 text-xs sm:text-sm font-bold mt-1">Presiona <kbd className="bg-slate-200 text-[#1e2a4a] px-1.5 py-0.5 rounded-md font-black">F4</kbd> para buscar | <kbd className="bg-slate-200 text-[#1e2a4a] px-1.5 py-0.5 rounded-md font-black">F8</kbd> para cobrar.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Buscar producto..."
                                    value={pos.searchTerm}
                                    onChange={(e) => pos.setSearchTerm(e.target.value)}
                                    onKeyDown={pos.handleSearchKeyDown}
                                    className="w-full bg-[#f4f6f9] hover:bg-slate-100 border border-transparent rounded-2xl pl-12 pr-4 py-3 text-sm font-bold text-[#1e2a4a] outline-none focus:bg-white focus:border-[#ec4899] transition-all placeholder:text-slate-400"
                                />
                            </div>
                            {pos.turnoActivo && (
                                <div className="flex gap-2 w-full sm:w-auto shrink-0">
                                    <button onClick={() => setIsGastoModalOpen(true)} className="flex-1 sm:flex-none bg-[#f4f6f9] hover:bg-amber-50 text-[#1e2a4a] hover:text-amber-600 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"><Wallet size={16} /> Gasto</button>
                                    <button onClick={handlePrepararCierre} className="flex-1 sm:flex-none bg-[#1e2a4a] text-white hover:bg-[#0f172a] px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md"><Lock size={16} /> Arqueo</button>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2 mt-5 sm:mt-6 overflow-x-auto pb-2 scrollbar-hide">
                        {pos.categories.map(cat => (
                            <button key={cat} onClick={() => pos.setSelectedCategory(cat)} className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${pos.selectedCategory === cat ? 'bg-[#3b82f6] text-white border-transparent shadow-[0_4px_15px_rgba(59,130,246,0.3)]' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'}`}>{cat}</button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white">
                    {pos.loadingProducts ? <div className="flex justify-center items-center h-full text-slate-400 font-bold">Cargando inventario...</div> : pos.filteredProductos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400"><Search size={48} className="opacity-20 mb-4" /><p className="font-bold text-center">No hay productos encontrados</p></div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                            {pos.filteredProductos.map(producto => (
                                <button key={producto.id} disabled={producto.stock <= 0} onClick={() => pos.addToCart(producto)} className={`relative flex flex-col text-left bg-white border rounded-2xl p-4 transition-all shadow-sm ${producto.stock > 0 ? 'border-slate-100 hover:border-[#ec4899] hover:shadow-md hover:-translate-y-1' : 'border-red-100 opacity-50 cursor-not-allowed grayscale bg-slate-50'}`}>

                                    <div className={`absolute top-2 right-2 text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg shadow-sm z-10 transition-colors duration-300
                                        ${producto.stock <= 0
                                            ? 'bg-red-500 text-white shadow-red-500/30'
                                            : producto.stock <= (producto.stock_minimo || 5)
                                                ? 'bg-amber-500 text-white shadow-amber-500/30 animate-pulse'
                                                : 'bg-emerald-500 text-white shadow-emerald-500/30'
                                        }`}>
                                        {producto.stock <= 0
                                            ? 'Agotado'
                                            : producto.stock <= (producto.stock_minimo || 5)
                                                ? `¡Solo ${producto.stock}!`
                                                : `${producto.stock} en stock`
                                        }
                                    </div>

                                    <div className="w-full aspect-square bg-[#f4f6f9] rounded-xl mb-3 flex items-center justify-center overflow-hidden border border-slate-100">{producto.image_url ? <img src={producto.image_url} alt={producto.name} className="object-cover w-full h-full" /> : <Package size={32} className="text-slate-300" />}</div>
                                    <h3 className="text-xs sm:text-sm font-bold text-[#1e2a4a] line-clamp-2 mb-1">{producto.name}</h3><p className="text-[#3b82f6] font-black mt-auto text-base sm:text-lg">S/ {producto.price?.toFixed(2)}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* PANEL DERECHO: CARRITO */}
            <div ref={cartRef} className={`w-full lg:w-[35%] xl:w-[30%] min-h-[40vh] lg:min-h-full flex flex-col bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden transition-all ${!pos.turnoActivo ? 'blur-sm pointer-events-none opacity-40 scale-[0.98]' : ''}`}>
                <div className="p-5 sm:p-6 border-b border-slate-100 bg-[#f4f6f9]/50 flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                        <ShoppingCart className="text-[#3b82f6]" size={24} />
                        <h2 className="text-xl font-black text-[#1e2a4a]">Caja</h2>
                        <span className="bg-[#3b82f6] text-white font-black px-2.5 py-1 rounded-lg text-xs tracking-widest uppercase">{pos.cart.length} items</span>
                    </div>
                    {/* NUEVO: BOTÓN VACIAR CARRITO */}
                    {(pos.cart.length > 0 || pos.clienteDni) && (
                        <button onClick={pos.clearCart} className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2.5 rounded-xl transition-colors" title="Vaciar y Cancelar (Alt+X)">
                            <Trash2 size={18} />
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-white">
                    {pos.cart.length === 0 ? (<div className="flex flex-col justify-center items-center h-full text-slate-300 space-y-3 min-h-[150px]"><ShoppingCart size={48} className="opacity-20" /><p className="text-sm font-bold text-slate-400">Agrega productos al carrito</p></div>) : (
                        pos.cart.map(item => (
                            <div key={item.product.id} className="bg-white border border-slate-100 shadow-sm p-4 rounded-2xl flex flex-col gap-3 relative group hover:border-[#ec4899] transition-colors">
                                <button onClick={() => pos.removeFromCart(item.product.id)} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1.5 transition-opacity shadow-md"><Trash2 size={12} /></button>
                                <div className="flex justify-between items-start"><h4 className="text-sm font-bold text-[#1e2a4a] line-clamp-2 pr-4">{item.product.name}</h4><span className="text-sm font-black text-[#1e2a4a] whitespace-nowrap">S/ {(item.product.price * item.quantity).toFixed(2)}</span></div>
                                <div className="flex items-center justify-between mt-auto"><span className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-widest">S/ {item.product.price.toFixed(2)} c/u</span>
                                    <div className="flex items-center bg-[#f4f6f9] border border-slate-200 rounded-xl overflow-hidden">
                                        <button onClick={() => pos.updateQuantity(item.product.id, item.quantity - 1, item.product.stock)} className="px-3 py-1.5 text-slate-500 hover:text-[#ec4899] hover:bg-[#ec4899]/10 transition-colors"><Minus size={14} /></button>
                                        <input type="number" value={item.quantity} onChange={(e) => pos.updateQuantity(item.product.id, e.target.value, item.product.stock)} className="w-10 text-center bg-transparent text-[#1e2a4a] font-black text-xs sm:text-sm py-1.5 outline-none no-spinners" min="1" max={item.product.stock} />
                                        <button onClick={() => pos.updateQuantity(item.product.id, item.quantity + 1, item.product.stock)} className="px-3 py-1.5 text-slate-500 hover:text-[#3b82f6] hover:bg-[#3b82f6]/10 transition-colors"><Plus size={14} /></button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-5 sm:p-6 border-t border-slate-100 bg-[#f4f6f9]/50 space-y-4 shrink-0">
                    {/* TIPO DE COMPROBANTE */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Comprobante</label>
                        <div className="flex bg-slate-200/50 p-1 rounded-xl gap-1">
                            {['ticket', 'boleta', 'factura'].map((tipo) => (
                                <button key={tipo} onClick={() => pos.setTipoComprobante(tipo)} className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${pos.tipoComprobante === tipo ? 'bg-white text-[#3b82f6] shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'}`}>
                                    {tipo === 'factura' && <FileText size={12} />}{tipo}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* CLIENTE — grid solo cuando es factura (necesita RUC + Razón Social) */}
                    {pos.tipoComprobante === 'factura' ? (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="RUC (Obligatorio)"
                                    value={pos.clienteDni}
                                    onChange={(e) => pos.setClienteDni(e.target.value)}
                                    className={`w-full bg-white border ${pos.clienteEncontrado ? 'border-emerald-500 ring-2 ring-emerald-500/10 text-emerald-700' : 'border-transparent'} text-[#1e2a4a] font-bold text-xs rounded-xl px-4 py-3 outline-none focus:border-[#ec4899] transition-all`}
                                />
                                {pos.clienteEncontrado && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500"><UserCheck size={16} /></div>}
                            </div>
                            <div className="relative">
                                <User className={`absolute left-3 top-1/2 -translate-y-1/2 ${pos.clienteEncontrado ? 'text-emerald-500' : 'text-slate-400'}`} size={16} />
                                <input
                                    type="text"
                                    placeholder="Razón Social"
                                    value={pos.clienteNombre}
                                    onChange={(e) => pos.setClienteNombre(e.target.value)}
                                    className={`w-full bg-white border ${pos.clienteEncontrado ? 'border-emerald-500 bg-emerald-50/30' : 'border-transparent'} text-[#1e2a4a] font-bold text-xs rounded-xl pl-10 pr-4 py-3 outline-none focus:border-[#ec4899] transition-all`}
                                />
                            </div>
                        </div>
                    ) : (
                        /* Ticket / Boleta: DNI opcional + nombre libre */
                        <div className="flex flex-col gap-2">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="DNI (opcional — busca cliente)"
                                    value={pos.clienteDni}
                                    onChange={(e) => pos.setClienteDni(e.target.value)}
                                    maxLength={11}
                                    className={`w-full bg-white border ${pos.clienteEncontrado
                                        ? 'border-emerald-400 ring-1 ring-emerald-400/20 text-emerald-700'
                                        : 'border-transparent'
                                        } text-[#1e2a4a] font-bold text-xs rounded-xl px-4 py-3 outline-none focus:border-[#ec4899] transition-all`}
                                />
                                {pos.clienteEncontrado && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 dni-icon">
                                        <UserCheck size={15} />
                                    </div>
                                )}
                            </div>
                            <div className="relative">
                                <User className={`absolute left-3 top-1/2 -translate-y-1/2 ${pos.clienteEncontrado ? 'text-emerald-500' : 'text-slate-400'
                                    }`} size={15} />
                                <input
                                    type="text"
                                    placeholder="Cliente Público"
                                    value={pos.clienteNombre}
                                    onChange={(e) => pos.setClienteNombre(e.target.value)}
                                    className={`w-full bg-white border ${pos.clienteEncontrado ? 'border-emerald-400 bg-emerald-50/30' : 'border-transparent'
                                        } text-[#1e2a4a] font-bold text-xs rounded-xl pl-10 pr-4 py-3 outline-none focus:border-[#ec4899] transition-all`}
                                />
                            </div>
                        </div>
                    )}

                    {/* MÉTODO DE PAGO */}
                    <div className="relative">
                        <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-[#3b82f6]" size={16} />
                        <select value={pos.metodoPago} onChange={(e) => pos.setMetodoPago(e.target.value)} className="w-full bg-white border border-transparent text-[#1e2a4a] text-xs sm:text-sm font-black rounded-xl pl-12 pr-4 py-3 sm:py-3.5 outline-none focus:border-[#3b82f6] appearance-none cursor-pointer transition-all">
                            <option value="efectivo">Efectivo</option>
                            <option value="yape">Yape / Plin</option>
                            <option value="tarjeta">Tarjeta (POS)</option>
                            <option value="transferencia">Transferencia Bancaria</option>
                        </select>
                    </div>

                    {/* DESGLOSE FISCAL — siempre visible cuando hay items */}
                    {pos.cart.length > 0 && (
                        <div className={`rounded-2xl border overflow-hidden ${pos.tipoComprobante === 'factura' ? 'border-[#3b82f6]/20 bg-[#3b82f6]/5' : 'border-slate-100 bg-white'}`}>
                            {pos.tipoComprobante === 'factura' && (
                                <>
                                    <div className="flex justify-between items-center px-4 py-3 border-b border-[#3b82f6]/10">
                                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Base Imponible</span>
                                        <span className="text-sm font-bold text-[#1e2a4a]">S/ {pos.subtotalCart.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center px-4 py-3 border-b border-[#3b82f6]/10">
                                        <span className="text-[11px] font-black text-[#3b82f6] uppercase tracking-widest">IGV ({pos.impuestoPorcentaje}%)</span>
                                        <span className="text-sm font-bold text-[#3b82f6]">S/ {pos.igvCart.toFixed(2)}</span>
                                    </div>
                                </>
                            )}
                            <div className="flex justify-between items-center px-4 py-3">
                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Total a Cobrar</span>
                                <span className="text-2xl font-black text-[#1e2a4a] tracking-tight">S/ {pos.totalCart.toFixed(2)}</span>
                            </div>
                        </div>
                    )}

                    {/* Si el carrito está vacío, mostrar el total igualmente */}
                    {pos.cart.length === 0 && (
                        <div className="flex justify-between items-center px-4 py-3 bg-white rounded-2xl border border-slate-100">
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Total a Cobrar</span>
                            <span className="text-2xl font-black text-slate-300 tracking-tight">S/ 0.00</span>
                        </div>
                    )}

                    {/* BOTÓN COBRAR */}
                    <button
                        onClick={pos.handleCheckout}
                        disabled={pos.cart.length === 0 || pos.isProcessing}
                        className="w-full bg-[#3b82f6] text-white hover:bg-blue-600 font-black uppercase tracking-widest py-4 rounded-2xl flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(59,130,246,0.3)] disabled:opacity-40 disabled:cursor-not-allowed text-sm transition-all hover:-translate-y-0.5"
                    >
                        {pos.isProcessing ? (
                            <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg> Procesando...</>
                        ) : (
                            <>Cobrar S/ {pos.totalCart.toFixed(2)} <CheckCircle2 size={18} /></>
                        )}
                    </button>
                </div>
                <style jsx="true">{`.no-spinners::-webkit-outer-spin-button,.no-spinners::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; } .no-spinners { -moz-appearance: textfield; }`}</style>
            </div>
        </div>
    );
}