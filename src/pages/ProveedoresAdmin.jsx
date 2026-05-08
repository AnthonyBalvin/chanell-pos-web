import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
    Truck, Plus, Search, Edit, Trash2, Globe,
    Phone, Mail, MapPin, Building2, CheckCircle2,
    X, Loader2, AlertCircle, ShieldCheck, User, Edit2
} from 'lucide-react';
import { useChanellUI } from '../context/UIContext';

export default function ProveedoresAdmin() {
    // EXTRAEMOS 'confirm' ADEMÁS DE 'notify'
    const { notify, confirm } = useChanellUI();
    const [proveedores, setProveedores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');

    // Estados para el Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const [formData, setFormData] = useState({
        razon_social: '',
        ruc: '',
        contacto_nombre: '',
        telefono: '',
        email: '',
        direccion: ''
    });

    useEffect(() => {
        fetchProveedores();
    }, []);

    const fetchProveedores = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('proveedores')
            .select('*')
            .order('razon_social', { ascending: true });

        if (!error) setProveedores(data);
        setLoading(false);
    };

    const handleOpenModal = (supplier = null) => {
        if (supplier) {
            setSelectedSupplier(supplier);
            setFormData({
                razon_social: supplier.razon_social,
                ruc: supplier.ruc || '',
                contacto_nombre: supplier.contacto_nombre || '',
                telefono: supplier.telefono || '',
                email: supplier.email || '',
                direccion: supplier.direccion || ''
            });
        } else {
            setSelectedSupplier(null);
            setFormData({ razon_social: '', ruc: '', contacto_nombre: '', telefono: '', email: '', direccion: '' });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();

        // 1. MODAL DE CONFIRMACIÓN ANTES DE GUARDAR/EDITAR
        const actionText = selectedSupplier ? "actualizar" : "registrar";
        const isConfirmed = await confirm(
            selectedSupplier ? "Actualizar Proveedor" : "Nuevo Proveedor",
            `¿Estás seguro de ${actionText} a ${formData.razon_social} en la base de datos?`,
            false
        );

        if (!isConfirmed) return; // Si el usuario cancela, detenemos la función

        setLoading(true);
        const payload = { ...formData };
        let error;

        if (selectedSupplier) {
            const { error: err } = await supabase.from('proveedores').update(payload).eq('id', selectedSupplier.id);
            error = err;
        } else {
            const { error: err } = await supabase.from('proveedores').insert([payload]);
            error = err;
        }

        if (error) {
            notify("Error al guardar: " + error.message, "error");
        } else {
            notify(selectedSupplier ? "Proveedor actualizado." : "Proveedor creado exitosamente.", "success");
            setIsModalOpen(false);
            fetchProveedores();
        }
        setLoading(false);
    };

    const toggleStatus = async (supplier) => {
        // 2. MODAL DE CONFIRMACIÓN PARA ACTIVAR/DESACTIVAR
        const actionText = supplier.activo ? "desactivar" : "activar";
        const isConfirmed = await confirm(
            `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} Proveedor`,
            `¿Deseas ${actionText} a ${supplier.razon_social}?`,
            supplier.activo // Si está activo, desactivarlo es "destructivo" (botón rojo)
        );

        if (!isConfirmed) return;

        const { error } = await supabase
            .from('proveedores')
            .update({ activo: !supplier.activo })
            .eq('id', supplier.id);

        if (!error) {
            notify(`Proveedor ${supplier.activo ? 'desactivado' : 'activado'} correctamente.`, "success");
            fetchProveedores();
        } else {
            notify("Error al cambiar el estado.", "error");
        }
    };

    const filteredProveedores = proveedores.filter(p =>
        p.razon_social.toLowerCase().includes(filter.toLowerCase()) ||
        (p.ruc && p.ruc.includes(filter))
    );

    return (
        <div className="w-full space-y-4 sm:space-y-6 pb-10 sm:px-4 animate-in fade-in duration-500">
            {/* ENCABEZADO ESTRATÉGICO */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 sm:p-8 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
                <div className="w-full md:w-auto">
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
                        <Truck className="text-[#3b82f6]" size={28} />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1e2a4a] to-[#3b82f6]">Proveedores</span>
                    </h2>
                    <p className="text-slate-500 text-xs sm:text-sm mt-1 text-pretty">Administra las fuentes de abastecimiento corporativo.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="w-full md:w-auto bg-[#3b82f6] hover:bg-blue-600 text-white font-black px-6 py-3.5 sm:py-3 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-[0_4px_15px_rgba(59,130,246,0.3)] hover:-translate-y-0.5 uppercase tracking-widest text-xs"
                >
                    <Plus size={18} /> Nuevo Proveedor
                </button>
            </div>

            {/* BUSCADOR */}
            <div className="bg-white p-4 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex items-center gap-3">
                <div className="relative w-full lg:max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por RUC o Razón Social..."
                        className="w-full bg-[#f4f6f9] hover:bg-slate-100 border border-transparent rounded-2xl pl-12 pr-10 py-3.5 text-sm font-medium outline-none focus:bg-white focus:border-[#ec4899] text-[#1e2a4a] transition-all placeholder:text-slate-400"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                    {filter && (
                        <button
                            onClick={() => setFilter('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-[#ec4899] bg-[#f4f6f9] hover:bg-[#ec4899]/10 rounded-xl transition-colors sm:hidden"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
                {filter && (
                    <button onClick={() => setFilter('')} className="hidden sm:block p-3.5 text-slate-400 hover:text-[#ec4899] bg-[#f4f6f9] hover:bg-[#ec4899]/10 rounded-2xl transition-colors shrink-0">
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* TABLA PRINCIPAL Y CARDS MÓVILES */}
            <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden">
                {loading && proveedores.length === 0 ? (
                    <div className="flex flex-col justify-center items-center h-48 text-slate-400 space-y-4">
                        <Loader2 className="animate-spin text-[#3b82f6]" size={32} />
                        <p className="font-bold tracking-widest uppercase text-xs text-[#1e2a4a]">Cargando proveedores...</p>
                    </div>
                ) : filteredProveedores.length === 0 ? (
                    <div className="p-12 flex flex-col items-center justify-center text-slate-300">
                        <Building2 size={56} className="mb-4 opacity-30 text-[#1e2a4a]" />
                        <p className="font-bold text-[#1e2a4a]">Directorio Vacío</p>
                        <p className="text-xs text-slate-400 mt-1 text-center">No se encontraron proveedores con esos datos.</p>
                    </div>
                ) : (
                    <>
                        {/* VISTA MÓVIL: Tarjetas */}
                        <div className="md:hidden divide-y divide-slate-100">
                            {filteredProveedores.map((p) => (
                                <div key={p.id} className={`p-5 flex flex-col gap-4 ${!p.activo ? 'bg-slate-50/50 grayscale-[50%]' : ''}`}>
                                    {/* Cabecera Tarjeta */}
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 ${p.activo ? 'bg-[#f4f6f9] text-[#1e2a4a]' : 'bg-slate-200 text-slate-400'}`}>
                                            {p.razon_social.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-bold text-[#1e2a4a] truncate">{p.razon_social}</div>
                                            <div className="text-[10px] font-black text-slate-400 mt-0.5 tracking-widest uppercase">RUC: <span className="text-[#3b82f6]">{p.ruc || 'S/N'}</span></div>
                                        </div>
                                    </div>

                                    {/* Detalles de Contacto */}
                                    <div className="flex flex-col gap-2 bg-[#f4f6f9]/50 p-3 rounded-xl border border-slate-100">
                                        <div className="flex items-center gap-2 text-xs">
                                            <User size={12} className="text-slate-400 shrink-0" />
                                            <span className="font-bold text-[#1e2a4a] truncate">{p.contacto_nombre || 'Sin contacto'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs">
                                            <Phone size={12} className="text-slate-400 shrink-0" />
                                            <span className="text-slate-600 truncate">{p.telefono || '---'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs">
                                            <MapPin size={12} className="text-slate-400 shrink-0" />
                                            <span className="text-slate-500 truncate">{p.direccion || '---'}</span>
                                        </div>
                                    </div>

                                    {/* Botones de Acción */}
                                    <div className="grid grid-cols-2 gap-2 mt-1">
                                        <button
                                            onClick={() => toggleStatus(p)}
                                            className={`flex items-center justify-center gap-2 p-3 rounded-xl transition-all font-bold text-[10px] uppercase tracking-widest border ${p.activo ? 'bg-slate-50 text-slate-400 border-slate-200 active:bg-slate-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200 active:bg-emerald-100'}`}
                                        >
                                            {p.activo ? 'Desactivar' : 'Activar'}
                                        </button>
                                        <button
                                            onClick={() => handleOpenModal(p)}
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
                                    <tr className="bg-[#f4f6f9]/50 border-b border-slate-100">
                                        <th className="p-5 text-[10px] font-black uppercase tracking-widest text-[#1e2a4a]">Proveedor</th>
                                        <th className="p-5 text-[10px] font-black uppercase tracking-widest text-[#1e2a4a]">Contacto</th>
                                        <th className="p-5 text-[10px] font-black uppercase tracking-widest text-[#1e2a4a]">Ubicación</th>
                                        <th className="p-5 text-[10px] font-black uppercase tracking-widest text-[#1e2a4a] text-center">Estado</th>
                                        <th className="p-5 text-[10px] font-black uppercase tracking-widest text-[#1e2a4a] text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredProveedores.map((p) => (
                                        <tr key={p.id} className={`hover:bg-slate-50/80 transition-colors group ${!p.activo ? 'opacity-60' : ''}`}>
                                            <td className="p-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-2xl bg-[#f4f6f9] flex items-center justify-center text-[#1e2a4a] font-black text-sm group-hover:bg-[#ec4899] group-hover:text-white transition-all shrink-0">
                                                        {p.razon_social.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-[#1e2a4a]">{p.razon_social}</div>
                                                        <div className="text-[10px] text-slate-400 font-black uppercase tracking-wider mt-0.5">RUC: <span className="text-[#3b82f6]">{p.ruc || 'S/N'}</span></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <div className="space-y-1.5">
                                                    <div className="text-xs font-bold text-[#1e2a4a] flex items-center gap-2"><User size={12} className="text-[#3b82f6]" /> {p.contacto_nombre || '---'}</div>
                                                    <div className="text-xs text-slate-500 flex items-center gap-2"><Phone size={12} className="text-slate-400" /> {p.telefono || '---'}</div>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <div className="max-w-[200px] text-xs text-slate-500 flex items-start gap-2">
                                                    <MapPin size={14} className="shrink-0 mt-0.5 text-[#ec4899]" />
                                                    <span className="line-clamp-2">{p.direccion || 'No registrada'}</span>
                                                </div>
                                            </td>
                                            <td className="p-5 text-center">
                                                <button
                                                    onClick={() => toggleStatus(p)}
                                                    className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-transparent transition-all ${p.activo ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                                >
                                                    {p.activo ? 'Activo' : 'Inactivo'}
                                                </button>
                                            </td>
                                            <td className="p-5 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOpenModal(p)}
                                                        className="p-2.5 bg-[#f4f6f9] hover:bg-slate-200 rounded-xl text-slate-500 hover:text-[#3b82f6] transition-all"
                                                        title="Editar Proveedor"
                                                    >
                                                        <Edit size={16} />
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

            {/* MODAL PARA CREAR/EDITAR (Móvil: Bottom Sheet) */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-2xl shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full sm:zoom-in duration-200">

                        {/* Drag Handle Móvil */}
                        <div className="w-full flex justify-center pt-3 pb-1 sm:hidden">
                            <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
                        </div>

                        <div className="flex justify-between items-center p-5 sm:p-8 border-b border-slate-100 bg-[#f4f6f9]/50">
                            <h3 className="text-xl sm:text-2xl font-black text-[#1e2a4a] tracking-tight flex items-center gap-3">
                                <div className="p-2 bg-[#ec4899]/10 text-[#ec4899] rounded-xl">
                                    {selectedSupplier ? <Edit size={20} /> : <Plus size={20} />}
                                </div>
                                {selectedSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-[#ec4899] hover:bg-[#ec4899]/10 rounded-full transition-colors hidden sm:block">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="overflow-y-auto p-5 sm:p-8 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 bg-white hide-scrollbar pb-6 sm:pb-8">
                            <div className="sm:col-span-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Razón Social</label>
                                <input
                                    required
                                    className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 text-sm font-bold text-[#1e2a4a] outline-none focus:bg-white focus:border-[#ec4899] transition-all"
                                    value={formData.razon_social}
                                    onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })}
                                    placeholder="Nombre de la empresa"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">RUC / ID Fiscal</label>
                                <input
                                    className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 text-sm font-medium text-[#1e2a4a] outline-none focus:bg-white focus:border-[#ec4899] transition-all"
                                    value={formData.ruc}
                                    onChange={(e) => setFormData({ ...formData, ruc: e.target.value })}
                                    placeholder="Número de identificación"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Nombre de Contacto</label>
                                <input
                                    className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 text-sm font-medium text-[#1e2a4a] outline-none focus:bg-white focus:border-[#ec4899] transition-all"
                                    value={formData.contacto_nombre}
                                    onChange={(e) => setFormData({ ...formData, contacto_nombre: e.target.value })}
                                    placeholder="Persona de contacto"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Teléfono</label>
                                <input
                                    type="tel"
                                    className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 text-sm font-medium text-[#1e2a4a] outline-none focus:bg-white focus:border-[#ec4899] transition-all"
                                    value={formData.telefono}
                                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                                    placeholder="+51 ..."
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Email Corporativo</label>
                                <input
                                    type="email"
                                    className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 text-sm font-medium text-[#1e2a4a] outline-none focus:bg-white focus:border-[#ec4899] transition-all"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="proveedor@empresa.com"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Dirección Física</label>
                                <input
                                    className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 text-sm font-medium text-[#1e2a4a] outline-none focus:bg-white focus:border-[#ec4899] transition-all"
                                    value={formData.direccion}
                                    onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                                    placeholder="Dirección completa"
                                />
                            </div>

                            <div className="sm:col-span-2 pt-2 sm:pt-4 space-y-2">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-[#3b82f6] hover:bg-blue-600 text-white font-black py-4 rounded-2xl transition-all shadow-[0_4px_15px_rgba(59,130,246,0.3)] hover:-translate-y-0.5 flex items-center justify-center gap-3 tracking-widest uppercase text-xs disabled:opacity-50"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
                                    {selectedSupplier ? 'Actualizar Proveedor' : 'Registrar Proveedor'}
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