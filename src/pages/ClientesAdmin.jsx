import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Search, X, UserPlus, Phone, Mail, Edit2, ExternalLink, ShieldCheck, Loader2 } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener'; // Actualizado para coherencia con tu app
import { useChanellUI } from '../context/UIContext'; // <-- IMPORTADO EL UIX

export default function ClientesAdmin() {
    const { notify } = useChanellUI(); // <-- INSTANCIADO EL NOTIFICADOR
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal de Registro/Edición
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCliente, setEditingCliente] = useState(null);
    const [formData, setFormData] = useState({ dni_ruc: '', nombre: '', telefono: '', email: '' });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchClientes();
    }, []);

    const fetchClientes = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('clientes')
            .select('*')
            .order('total_gastado', { ascending: false });

        if (!error && data) setClientes(data);
        setLoading(false);
    };

    const handleOpenModal = (cliente = null) => {
        if (cliente) {
            setEditingCliente(cliente);
            setFormData({ dni_ruc: cliente.dni_ruc, nombre: cliente.nombre, telefono: cliente.telefono || '', email: cliente.email || '' });
        } else {
            setEditingCliente(null);
            setFormData({ dni_ruc: '', nombre: '', telefono: '', email: '' });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (editingCliente) {
                const { error } = await supabase.from('clientes').update(formData).eq('id', editingCliente.id);
                if (error) throw error;
                notify("Cliente actualizado exitosamente.", "success"); // <-- NOTIFICACIÓN DE ÉXITO
            } else {
                const { error } = await supabase.from('clientes').insert([formData]);
                if (error) throw error;
                notify("Cliente registrado exitosamente.", "success"); // <-- NOTIFICACIÓN DE ÉXITO
            }
            setIsModalOpen(false);
            fetchClientes();
        } catch (error) {
            // NOTIFICACIÓN DE ERROR
            notify("Error: " + (error.message.includes('unique') ? "El DNI o RUC ya se encuentra registrado en el sistema." : error.message), "error");
        } finally {
            setIsSaving(false);
        }
    };

    const openWhatsApp = async (telefono) => {
        if (!telefono || telefono === 'N/A') return notify("Este cliente no proporcionó teléfono.", "warning");
        const cleanPhone = telefono.replace(/\D/g, '');
        const finalPhone = cleanPhone.length === 9 ? `51${cleanPhone}` : cleanPhone;

        const url = `https://wa.me/${finalPhone}`;

        // Verificamos si estamos en la app de escritorio
        if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
            try {
                await openUrl(url); // Abre Chrome/Edge del sistema con el chat
            } catch (err) {
                notify("No se pudo abrir WhatsApp de escritorio.", "error");
            }
        } else {
            window.open(url, '_blank'); // Para cuando uses la versión web
        }
    };

    const filteredClientes = clientes.filter(c =>
        c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.dni_ruc.includes(searchTerm)
    );

    return (
        <div className="w-full space-y-4 sm:space-y-6 pb-10 sm:px-4 animate-in fade-in duration-500">
            {/* CABECERA */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 sm:p-8 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
                <div className="w-full md:w-auto">
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
                        <Users className="text-[#3b82f6]" size={28} />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1e2a4a] to-[#3b82f6]">Directorio</span>
                    </h2>
                    <p className="text-slate-500 text-xs sm:text-sm mt-1">Gestión y ranking de compradores de Chanell.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="w-full md:w-auto bg-[#3b82f6] hover:bg-blue-600 text-white px-6 py-3.5 sm:py-3 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all shadow-[0_4px_15px_rgba(59,130,246,0.3)] hover:-translate-y-0.5"
                >
                    <UserPlus size={18} /> Agregar Cliente
                </button>
            </div>

            {/* BARRA DE BÚSQUEDA */}
            <div className="bg-white p-4 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col sm:flex-row items-center gap-4">
                <div className="relative w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por Nombre o Documento..."
                        className="w-full bg-[#f4f6f9] hover:bg-slate-100 border border-transparent rounded-2xl pl-12 pr-10 sm:pr-4 py-3.5 text-sm font-medium outline-none focus:bg-white focus:border-[#ec4899] text-[#1e2a4a] transition-all placeholder:text-slate-400"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-[#ec4899] bg-[#f4f6f9] hover:bg-[#ec4899]/10 rounded-xl transition-colors sm:hidden"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
                {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="hidden sm:block p-3.5 text-slate-400 hover:text-[#ec4899] bg-[#f4f6f9] hover:bg-[#ec4899]/10 rounded-2xl transition-colors shrink-0">
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* TABLA PRINCIPAL Y CARDS MÓVILES */}
            <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden">
                {loading ? (
                    <div className="flex flex-col justify-center items-center h-48 text-slate-400 space-y-4">
                        <Loader2 className="animate-spin text-[#3b82f6]" size={32} />
                        <p className="font-bold tracking-widest uppercase text-xs text-[#1e2a4a]">Cargando directorio...</p>
                    </div>
                ) : filteredClientes.length === 0 ? (
                    <div className="p-12 flex flex-col items-center justify-center text-slate-300">
                        <Users size={56} className="mb-4 opacity-30 text-[#1e2a4a]" />
                        <p className="font-bold text-[#1e2a4a]">Directorio Vacío</p>
                        <p className="text-xs text-slate-400 mt-1 text-center">No se encontraron clientes con esos datos.</p>
                    </div>
                ) : (
                    <>
                        {/* VISTA MÓVIL: Tarjetas */}
                        <div className="md:hidden divide-y divide-slate-100">
                            {filteredClientes.map((c, index) => (
                                <div key={c.id} className="p-5 flex flex-col gap-4">
                                    <div className="flex items-center gap-3">
                                        {/* Avatar o Ranking */}
                                        {index < 3 && c.total_gastado > 0 ? (
                                            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
                                                <ShieldCheck size={20} />
                                            </div>
                                        ) : (
                                            <div className="w-12 h-12 rounded-full bg-[#f4f6f9] text-[#1e2a4a] flex items-center justify-center font-black text-sm shrink-0">
                                                {c.nombre.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-bold text-[#1e2a4a] truncate">{c.nombre}</div>
                                            <div className="text-[10px] font-black text-slate-400 mt-0.5 tracking-widest uppercase">DOC: <span className="text-[#3b82f6]">{c.dni_ruc}</span></div>
                                        </div>
                                    </div>

                                    {/* Info Contacto y Métricas */}
                                    <div className="grid grid-cols-2 gap-3 bg-[#f4f6f9]/50 p-3 rounded-xl border border-slate-100">
                                        <div className="col-span-2 flex flex-col gap-1.5 pb-2 border-b border-slate-100">
                                            <div className="flex items-center gap-2 text-xs">
                                                <Phone size={12} className="text-slate-400 shrink-0" />
                                                <span className={`truncate ${c.telefono ? "font-bold text-[#1e2a4a]" : "text-slate-400 italic"}`}>{c.telefono || 'Sin celular'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs">
                                                <Mail size={12} className="text-slate-400 shrink-0" />
                                                <span className={`truncate ${c.email ? "text-slate-600" : "text-slate-400 italic"}`}>{c.email || 'Sin correo'}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Compras</p>
                                            <span className="inline-flex items-center justify-center px-2 py-0.5 bg-[#3b82f6]/10 text-[#3b82f6] font-black rounded-md text-[10px]">
                                                {c.cantidad_compras || 0}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Valor (LTV)</p>
                                            <p className="font-black text-[#1e2a4a] text-sm">S/ {c.total_gastado?.toFixed(2) || '0.00'}</p>
                                        </div>
                                    </div>

                                    {/* Acciones */}
                                    <div className="grid grid-cols-2 gap-2 mt-1">
                                        <button
                                            onClick={() => openWhatsApp(c.telefono)}
                                            disabled={!c.telefono}
                                            className="flex items-center justify-center gap-2 p-3 text-white bg-[#25D366] hover:bg-[#20bd5a] rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:bg-slate-300 font-bold text-[10px] uppercase tracking-widest"
                                        >
                                            <ExternalLink size={14} /> WhatsApp
                                        </button>
                                        <button
                                            onClick={() => handleOpenModal(c)}
                                            className="flex items-center justify-center gap-2 p-3 text-slate-500 bg-[#f4f6f9] active:bg-slate-200 rounded-xl transition-all font-bold text-[10px] uppercase tracking-widest"
                                        >
                                            <Edit2 size={14} /> Editar
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* VISTA DESKTOP: Tabla Clásica */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left min-w-[900px]">
                                <thead>
                                    <tr className="bg-[#f4f6f9]/50 text-[#1e2a4a] text-[10px] uppercase tracking-widest font-black border-b border-slate-100">
                                        <th className="p-5">Identificación / Nombre</th>
                                        <th className="p-5">Datos de Contacto</th>
                                        <th className="p-5 text-center">Nº Compras</th>
                                        <th className="p-5 text-right">Valor Total (LTV)</th>
                                        <th className="p-5 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredClientes.map((c, index) => (
                                        <tr key={c.id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="p-5">
                                                <div className="flex items-center gap-3">
                                                    {index < 3 && c.total_gastado > 0 ? (
                                                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200" title={`Top ${index + 1} Comprador`}>
                                                            <ShieldCheck size={18} />
                                                        </div>
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-[#f4f6f9] text-[#1e2a4a] flex items-center justify-center font-black text-xs shrink-0 group-hover:bg-[#ec4899] group-hover:text-white transition-colors">
                                                            {c.nombre.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="text-sm font-bold text-[#1e2a4a]">{c.nombre}</div>
                                                        <div className="text-[10px] font-black text-slate-400 mt-0.5 tracking-widest uppercase">DOC: <span className="text-[#3b82f6]">{c.dni_ruc}</span></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <Phone size={12} className="text-slate-400" />
                                                        <span className={c.telefono ? "font-bold text-[#1e2a4a]" : "text-slate-400 italic"}>{c.telefono || 'Sin registrar'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <Mail size={12} className="text-slate-400" />
                                                        <span className={c.email ? "text-slate-600" : "text-slate-400 italic"}>{c.email || 'Sin correo'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5 text-center">
                                                <span className="inline-flex items-center justify-center min-w-[32px] h-8 bg-[#3b82f6]/10 text-[#3b82f6] font-black rounded-xl text-xs border border-transparent">
                                                    {c.cantidad_compras || 0}
                                                </span>
                                            </td>
                                            <td className="p-5 text-right">
                                                <div className="text-sm font-black text-[#1e2a4a]">
                                                    S/ {c.total_gastado?.toFixed(2) || '0.00'}
                                                </div>
                                            </td>
                                            <td className="p-5 text-center">
                                                <div className="flex justify-center items-center gap-2">
                                                    <button
                                                        onClick={() => openWhatsApp(c.telefono)}
                                                        disabled={!c.telefono}
                                                        className="p-2.5 text-white bg-[#25D366] hover:bg-[#20bd5a] rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:bg-slate-300 disabled:border-slate-300"
                                                        title="Contactar por WhatsApp"
                                                    >
                                                        <ExternalLink size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenModal(c)}
                                                        className="p-2.5 text-slate-500 hover:text-[#3b82f6] bg-[#f4f6f9] hover:bg-slate-200 rounded-xl transition-all"
                                                        title="Editar Datos"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* MODAL REGISTRO/EDICIÓN (Móvil: Bottom Sheet) */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4">
                    <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden max-h-[90vh] animate-in slide-in-from-bottom-full sm:zoom-in duration-200">

                        {/* Drag Handle Móvil */}
                        <div className="w-full flex justify-center pt-3 pb-1 sm:hidden">
                            <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
                        </div>

                        <div className="flex justify-between items-center p-5 sm:p-8 border-b border-slate-100 bg-[#f4f6f9]/50">
                            <h3 className="text-xl font-black text-[#1e2a4a] flex items-center gap-3">
                                <div className="p-2 bg-[#ec4899]/10 text-[#ec4899] rounded-xl"><UserPlus size={20} /></div>
                                {editingCliente ? 'Editar Perfil' : 'Nuevo Cliente'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-[#ec4899] hover:bg-[#ec4899]/10 p-2 rounded-full transition-colors hidden sm:block"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSave} className="p-5 sm:p-8 space-y-4 sm:space-y-5 overflow-y-auto bg-white hide-scrollbar">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">DNI o RUC (Identificador)</label>
                                <input
                                    type="text" required
                                    className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 text-sm font-bold text-[#1e2a4a] outline-none focus:bg-white focus:border-[#ec4899] transition-all"
                                    value={formData.dni_ruc}
                                    onChange={(e) => setFormData({ ...formData, dni_ruc: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Nombre Completo / Razón Social</label>
                                <input
                                    type="text" required
                                    className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 text-sm font-bold text-[#1e2a4a] outline-none focus:bg-white focus:border-[#ec4899] transition-all"
                                    value={formData.nombre}
                                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Celular (WhatsApp)</label>
                                    <input
                                        type="tel"
                                        className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 text-sm font-bold text-[#1e2a4a] outline-none focus:bg-white focus:border-[#ec4899] transition-all"
                                        value={formData.telefono}
                                        onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Email Comercial</label>
                                    <input
                                        type="email"
                                        className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 text-sm font-bold text-[#1e2a4a] outline-none focus:bg-white focus:border-[#ec4899] transition-all"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="pt-2 sm:pt-4 space-y-2">
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="w-full bg-[#3b82f6] hover:bg-blue-600 text-white font-black uppercase tracking-widest py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(59,130,246,0.3)] hover:-translate-y-0.5 disabled:opacity-50 text-xs"
                                >
                                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : null}
                                    {isSaving ? 'Registrando...' : 'Confirmar Datos'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="w-full py-4 text-slate-400 font-bold text-[10px] uppercase tracking-widest sm:hidden bg-slate-50 rounded-2xl border border-slate-100"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}