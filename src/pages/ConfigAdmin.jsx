import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Settings, Save, Building2, Receipt, ReceiptText, Loader2, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChanellUI } from '../context/UIContext';

export default function ConfigAdmin() {
    const { notify } = useChanellUI();
    const { role } = useAuth();
    const [config, setConfig] = useState({
        empresa_nombre: '', empresa_ruc: '', empresa_direccion: '', empresa_telefono: '', empresa_email: '',
        impuesto_nombre: 'IGV', impuesto_porcentaje: 18, moneda: 'S/', ticket_mensaje: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchConfig = async () => {
            const { data, error } = await supabase.from('configuracion').select('*').eq('id', 1).single();
            if (data) setConfig(data);
            setLoading(false);
        };
        fetchConfig();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setConfig(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (role !== 'admin') return notify('Solo los administradores pueden guardar cambios.', 'error');

        setSaving(true);
        // Usamos UPSERT para forzar el guardado sí o sí en el ID 1
        const { error } = await supabase.from('configuracion')
            .upsert({
                id: 1,
                ...config,
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' }); // Si ya existe el ID 1, lo sobreescribe

        if (error) {
            notify('Error al guardar: ' + error.message, "error");
        } else {
            notify('¡Configuración guardada con éxito!', "success");
        }
        setSaving(false);
    };

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center h-[50vh] text-slate-400 space-y-4">
                <div className="w-8 h-8 border-4 border-[#3b82f6] border-t-transparent rounded-full animate-spin"></div>
                <p className="font-bold tracking-widest uppercase text-xs text-[#1e2a4a]">Cargando ajustes...</p>
            </div>
        );
    }

    // Si el usuario es supervisor, bloqueamos los inputs visualmente
    const isReadOnly = role !== 'admin';

    return (
        <div className="w-full max-w-5xl mx-auto space-y-6 sm:space-y-8 pb-10 px-4 sm:px-6 lg:px-8 animate-in fade-in duration-500">

            {/* CABECERA */}
            <div className="bg-white p-5 sm:p-8 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
                    <Settings className="text-[#3b82f6] shrink-0" size={28} />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1e2a4a] to-[#3b82f6]">Ajustes del Sistema</span>
                </h2>
                <p className="text-slate-500 text-xs sm:text-sm mt-1 sm:mt-2 leading-relaxed">Configura la información legal y visual para los comprobantes.</p>

                {isReadOnly && (
                    <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 sm:px-4 sm:py-3 bg-amber-50 text-amber-600 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl border border-amber-200">
                        <Info size={16} className="shrink-0" />
                        <span>Modo de Solo Lectura: No tienes permisos para editar.</span>
                    </div>
                )}
            </div>

            <form onSubmit={handleSave} className="space-y-6">

                {/* SECCIÓN 1: DATOS DE LA EMPRESA */}
                <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden">
                    <div className="p-4 sm:p-6 bg-[#f4f6f9]/50 border-b border-slate-100 flex items-center gap-2 text-[#1e2a4a] font-black text-xs sm:text-sm uppercase tracking-widest">
                        <Building2 size={18} className="text-[#3b82f6]" /> Información Comercial
                    </div>
                    <div className="p-5 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 sm:mb-2 ml-1">Nombre Comercial / Razón Social</label>
                            <input disabled={isReadOnly} required type="text" name="empresa_nombre" value={config.empresa_nombre} onChange={handleChange} className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 text-sm font-bold text-[#1e2a4a] outline-none focus:bg-white focus:border-[#ec4899] focus:ring-4 focus:ring-[#ec4899]/10 transition-all disabled:opacity-60" placeholder="Ej: Chanell Tecnología SAC" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 sm:mb-2 ml-1">RUC</label>
                            <input disabled={isReadOnly} type="text" name="empresa_ruc" value={config.empresa_ruc || ''} onChange={handleChange} placeholder="Ej: 20123456789" className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 text-sm font-bold text-[#1e2a4a] outline-none focus:bg-white focus:border-[#ec4899] focus:ring-4 focus:ring-[#ec4899]/10 transition-all disabled:opacity-60" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 sm:mb-2 ml-1">Teléfono Fijo / Celular</label>
                            <input disabled={isReadOnly} type="text" name="empresa_telefono" value={config.empresa_telefono || ''} onChange={handleChange} placeholder="Ej: 999 888 777" className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 text-sm font-bold text-[#1e2a4a] outline-none focus:bg-white focus:border-[#ec4899] focus:ring-4 focus:ring-[#ec4899]/10 transition-all disabled:opacity-60" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 sm:mb-2 ml-1">Dirección Principal</label>
                            <input disabled={isReadOnly} type="text" name="empresa_direccion" value={config.empresa_direccion || ''} onChange={handleChange} placeholder="Ej: Av. Principal 123, Ciudad" className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 text-sm font-bold text-[#1e2a4a] outline-none focus:bg-white focus:border-[#ec4899] focus:ring-4 focus:ring-[#ec4899]/10 transition-all disabled:opacity-60" />
                        </div>
                    </div>
                </div>

                {/* SECCIÓN 2: PARÁMETROS DE FACTURACIÓN */}
                <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden">
                    <div className="p-4 sm:p-6 bg-[#f4f6f9]/50 border-b border-slate-100 flex items-center gap-2 text-[#1e2a4a] font-black text-xs sm:text-sm uppercase tracking-widest">
                        <Receipt size={18} className="text-emerald-500" /> Parámetros Financieros
                    </div>
                    <div className="p-5 sm:p-8 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 sm:mb-2 ml-1 text-left sm:text-center">Símbolo Moneda</label>
                            <input disabled={isReadOnly} required type="text" name="moneda" value={config.moneda} onChange={handleChange} className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 text-sm sm:text-center font-black text-[#1e2a4a] outline-none focus:bg-white focus:border-[#ec4899] focus:ring-4 focus:ring-[#ec4899]/10 transition-all disabled:opacity-60" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 sm:mb-2 ml-1 text-left sm:text-center">Nombre Impuesto</label>
                            <input disabled={isReadOnly} required type="text" name="impuesto_nombre" value={config.impuesto_nombre} onChange={handleChange} className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 text-sm sm:text-center font-black text-[#1e2a4a] outline-none focus:bg-white focus:border-[#ec4899] focus:ring-4 focus:ring-[#ec4899]/10 transition-all disabled:opacity-60" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 sm:mb-2 ml-1 text-left sm:text-center">Tasa Impuesto (%)</label>
                            <input disabled={isReadOnly} required type="number" step="0.01" min="0" name="impuesto_porcentaje" value={config.impuesto_porcentaje} onChange={handleChange} className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 text-sm sm:text-center font-black text-[#1e2a4a] outline-none focus:bg-white focus:border-[#ec4899] focus:ring-4 focus:ring-[#ec4899]/10 transition-all disabled:opacity-60 no-spinners" />
                        </div>
                    </div>
                </div>

                {/* SECCIÓN 3: TICKETS */}
                <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden">
                    <div className="p-4 sm:p-6 bg-[#f4f6f9]/50 border-b border-slate-100 flex items-center gap-2 text-[#1e2a4a] font-black text-xs sm:text-sm uppercase tracking-widest">
                        <ReceiptText size={18} className="text-amber-500" /> Diseño de Comprobantes
                    </div>
                    <div className="p-5 sm:p-8">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 sm:mb-2 ml-1">Mensaje al pie del Ticket Físico y PDF</label>
                        <textarea disabled={isReadOnly} name="ticket_mensaje" rows="4" value={config.ticket_mensaje || ''} onChange={handleChange} placeholder="Ej: No se aceptan devoluciones pasados los 7 días. Gracias por comprar en Chanell Tecnología." className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 text-sm font-medium text-[#1e2a4a] outline-none focus:bg-white focus:border-[#ec4899] focus:ring-4 focus:ring-[#ec4899]/10 transition-all resize-none disabled:opacity-60"></textarea>
                    </div>
                </div>

                {/* BOTÓN GUARDAR (Oculto si es Supervisor) */}
                {!isReadOnly && (
                    <div className="flex justify-center sm:justify-end pt-2 sm:pt-4">
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full sm:w-auto bg-[#3b82f6] hover:bg-blue-600 text-white px-8 sm:px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(59,130,246,0.3)] transition-all disabled:opacity-50 hover:-translate-y-0.5"
                        >
                            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            {saving ? 'Guardando...' : 'Guardar Configuración'}
                        </button>
                    </div>
                )}
            </form>
            <style jsx="true">{`.no-spinners::-webkit-outer-spin-button,.no-spinners::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; } .no-spinners { -moz-appearance: textfield; }`}</style>
        </div>
    );
}