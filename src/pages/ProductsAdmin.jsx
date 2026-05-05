import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Package, Plus, Edit, Trash2, Search, X, Boxes, TrendingUp, Calculator } from 'lucide-react';
import gsap from 'gsap';
import { useChanellUI } from '../context/UIContext';

export default function ProductsAdmin() {
    const { notify, confirm } = useChanellUI();
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Estado para la mini calculadora
    const [showCalc, setShowCalc] = useState(false);
    const [calcData, setCalcData] = useState({ totalPagado: '', cantidad: '' });

    // ESTADO INICIAL
    const [formData, setFormData] = useState({
        id: '', name: '', description: '', price: '', costo: '', stock: '', category: 'gadget', barcode: ''
    });

    const modalRef = useRef(null);
    const overlayRef = useRef(null);

    useEffect(() => { fetchProductos(); }, []);

    const fetchProductos = async () => {
        const { data, error } = await supabase.from('productos').select('*').order('created_at', { ascending: false });
        if (!error) setProductos(data);
        setLoading(false);
    };

    const handleOpenModal = (prod = null) => {
        // Reiniciamos la calculadora siempre que se abre el modal
        setShowCalc(false);
        setCalcData({ totalPagado: '', cantidad: '' });

        if (prod) {
            setIsEditing(true);
            setFormData({
                id: prod.id,
                name: prod.name || '',
                description: prod.description || '',
                price: prod.price || '',
                costo: prod.costo || '',
                stock: prod.stock || 0,
                category: prod.category || 'gadget',
                barcode: prod.barcode || ''
            });
        } else {
            setIsEditing(false);
            setFormData({ id: '', name: '', description: '', price: '', costo: '', stock: '', category: 'gadget', barcode: '' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        gsap.to(overlayRef.current, { opacity: 0, duration: 0.3, onComplete: () => setIsModalOpen(false) });
    };

    useEffect(() => {
        if (isModalOpen) {
            gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 });
            gsap.fromTo(modalRef.current, { scale: 0.9, opacity: 0, y: 20 }, { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: "back.out(1.5)" });
        }
    }, [isModalOpen]);

    // LÓGICA DE LA CALCULADORA AUTOMÁTICA
    const handleCalcChange = (field, value) => {
        const newCalcData = { ...calcData, [field]: value };
        setCalcData(newCalcData);

        const total = parseFloat(newCalcData.totalPagado);
        const qty = parseFloat(newCalcData.cantidad);

        if (!isNaN(total) && !isNaN(qty) && qty > 0) {
            const unitCost = (total / qty).toFixed(2);
            setFormData(prev => ({ ...prev, costo: unitCost }));
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();

        const payload = {
            id: isEditing ? formData.id : formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
            name: formData.name,
            description: formData.description,
            price: parseFloat(formData.price),
            costo: parseFloat(formData.costo) || 0,
            stock: parseInt(formData.stock, 10) || 0,
            category: formData.category,
            barcode: formData.barcode || null
        };

        let error;
        if (isEditing) {
            const res = await supabase.from('productos').update(payload).eq('id', formData.id);
            error = res.error;
        } else {
            const res = await supabase.from('productos').insert([payload]);
            error = res.error;
        }

        if (error) notify("Error: " + error.message, "error");
        else {
            notify(isEditing ? "Producto actualizado." : "Producto registrado exitosamente.", "success");
            fetchProductos();
            handleCloseModal();
        }
    };

    const handleDelete = async (id) => {
        const isConfirmed = await confirm("Eliminar Producto", "¿Seguro que deseas eliminar este producto permanentemente? Se perderá su historial asociado.", true);
        if (isConfirmed) {
            const { error } = await supabase.from('productos').delete().eq('id', id);
            if (error) notify("No se pudo eliminar: " + error.message, "error");
            else {
                notify("Producto eliminado exitosamente.", "success");
                fetchProductos();
            }
        }
    };

    return (
        <div className="w-full space-y-6 pb-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 sm:p-8 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
                        <Boxes className="text-[#3b82f6]" size={32} />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1e2a4a] to-[#3b82f6]">Inventario POS</span>
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Gestiona el stock, costos y márgenes de ganancia.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                    <div className="relative w-full sm:w-auto">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text" placeholder="Buscar producto..."
                            className="w-full sm:w-64 bg-[#f4f6f9] hover:bg-slate-100 border border-transparent focus:bg-white focus:border-[#ec4899] rounded-2xl pl-10 pr-4 py-3 text-sm outline-none transition-colors text-[#1e2a4a] font-medium"
                            onChange={(e) => setFilter(e.target.value)}
                        />
                    </div>
                    <button onClick={() => handleOpenModal()} className="w-full sm:w-auto bg-[#3b82f6] hover:bg-blue-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all shadow-[0_4px_15px_rgba(59,130,246,0.3)] hover:-translate-y-0.5">
                        <Plus size={18} /> Nuevo Producto
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden overflow-x-auto">
                <table className="w-full text-left min-w-[800px]">
                    <thead className="bg-[#f4f6f9]/50 text-[#1e2a4a] text-[10px] uppercase tracking-widest font-black border-b border-slate-100">
                        <tr>
                            <th className="p-5">Producto</th>
                            <th className="p-5 text-center">Stock</th>
                            <th className="p-5">Categoría</th>
                            <th className="p-5">Finanzas (Venta / Costo)</th>
                            <th className="p-5 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {productos.filter(p => p.name.toLowerCase().includes(filter.toLowerCase())).map((p) => {
                            const costo = p.costo || 0;
                            const ganancia = p.price - costo;

                            return (
                                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                                    <td className="p-5 flex items-center gap-4">
                                        <div className="w-10 h-10 bg-[#3b82f6]/10 rounded-xl flex items-center justify-center text-[#3b82f6] shrink-0">
                                            <Package size={20} />
                                        </div>
                                        <div>
                                            <div className="font-bold text-[#1e2a4a] text-sm">{p.name}</div>
                                            <div className="text-[10px] text-slate-500 mt-0.5">ID: {p.id}</div>
                                            {p.barcode && <div className="text-[9px] text-[#ec4899] mt-0.5 font-mono font-bold">BC: {p.barcode}</div>}
                                        </div>
                                    </td>
                                    <td className="p-5 text-center">
                                        <span className={`px-3 py-1.5 rounded-xl text-xs font-black border ${p.stock > 10 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                            p.stock > 0 ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                                'bg-red-50 text-red-500 border-red-200'
                                            }`}>
                                            {p.stock} u.
                                        </span>
                                    </td>
                                    <td className="p-5">
                                        <span className="bg-[#f4f6f9] text-[#1e2a4a] px-3 py-1.5 rounded-xl text-[10px] uppercase font-bold tracking-wider">{p.category}</span>
                                    </td>
                                    <td className="p-5">
                                        <div className="flex flex-col gap-1">
                                            <div className="font-black text-[#1e2a4a] text-sm">Venta: S/ {p.price.toFixed(2)}</div>
                                            <div className="flex items-center gap-3 text-[10px] font-bold">
                                                <span className="text-slate-500">Costo: S/ {costo.toFixed(2)}</span>
                                                <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                                                    <TrendingUp size={10} /> Gana S/ {ganancia.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-5 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => handleOpenModal(p)} className="p-2.5 text-slate-500 bg-[#f4f6f9] hover:text-[#3b82f6] hover:bg-[#3b82f6]/10 rounded-xl transition-colors"><Edit size={16} /></button>
                                            <button onClick={() => handleDelete(p.id)} className="p-2.5 text-slate-500 bg-[#f4f6f9] hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* MODAL DE CREACIÓN / EDICIÓN */}
            {isModalOpen && (
                <div ref={overlayRef} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div ref={modalRef} className="bg-white border border-slate-100 w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="p-6 sm:p-8 border-b border-slate-100 flex justify-between items-center bg-[#f4f6f9]/50">
                            <h3 className="text-xl font-black text-[#1e2a4a] flex items-center gap-3">
                                <div className="p-2 bg-[#ec4899]/10 text-[#ec4899] rounded-xl"><Boxes size={24} /></div>
                                {isEditing ? 'Editar Producto' : 'Nuevo Producto'}
                            </h3>
                            <button onClick={handleCloseModal} className="text-slate-400 hover:text-[#ec4899] hover:bg-[#ec4899]/10 transition-colors p-2 rounded-full"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 bg-white">

                            <div className="space-y-5">
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-2 block">Nombre del Producto</label>
                                    <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 outline-none focus:bg-white focus:border-[#ec4899] text-sm text-[#1e2a4a] font-bold transition-all" />
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div className="relative">
                                        <label className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-2 flex items-center justify-between">
                                            Costo Und.
                                            <button
                                                type="button"
                                                onClick={() => setShowCalc(!showCalc)}
                                                className={`transition-colors p-1 rounded-lg ${showCalc ? 'text-white bg-emerald-500' : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50'}`}
                                                title="Calculadora Automática"
                                            >
                                                <Calculator size={14} />
                                            </button>
                                        </label>
                                        <input type="number" step="0.01" min="0" value={formData.costo} onChange={e => setFormData({ ...formData, costo: e.target.value })} placeholder="0.00" className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 outline-none focus:bg-white focus:border-emerald-400 text-emerald-600 font-black text-sm transition-all" />

                                        {/* MINI CALCULADORA */}
                                        {showCalc && (
                                            <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-slate-100 p-4 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.1)] z-20">
                                                <p className="text-[9px] text-[#1e2a4a] uppercase tracking-widest font-black mb-3">Calculadora de Lote</p>
                                                <div className="space-y-3">
                                                    <div>
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase">Pagué (Total S/):</span>
                                                        <input type="number" value={calcData.totalPagado} onChange={e => handleCalcChange('totalPagado', e.target.value)} className="w-full bg-[#f4f6f9] border border-transparent rounded-xl p-2.5 text-xs font-bold text-[#1e2a4a] outline-none focus:bg-white focus:border-emerald-400 mt-1 transition-all" placeholder="Ej: 2000" />
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase">Por (Cantidad u.):</span>
                                                        <input type="number" value={calcData.cantidad} onChange={e => handleCalcChange('cantidad', e.target.value)} className="w-full bg-[#f4f6f9] border border-transparent rounded-xl p-2.5 text-xs font-bold text-[#1e2a4a] outline-none focus:bg-white focus:border-emerald-400 mt-1 transition-all" placeholder="Ej: 50" />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-2 block">Precio Venta</label>
                                        <input required type="number" step="0.01" min="0" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 outline-none focus:bg-white focus:border-[#3b82f6] font-black text-[#3b82f6] text-sm transition-all" />
                                    </div>

                                    <div>
                                        <label className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-2 block">
                                            Stock Actual
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            required
                                            value={formData.stock}
                                            onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                                            disabled={isEditing}
                                            className={`w-full border rounded-2xl p-4 outline-none font-black text-sm transition-all ${isEditing ? 'bg-slate-100 border-transparent text-slate-400 cursor-not-allowed' : 'bg-[#f4f6f9] border-transparent focus:bg-white focus:border-[#ec4899] text-[#1e2a4a]'}`}
                                        />
                                        {isEditing && (
                                            <p className="text-[9px] text-red-500 font-bold mt-2 leading-tight">
                                                * Stock bloqueado.
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-2 block">Categoría</label>
                                        <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 outline-none focus:bg-white focus:border-[#ec4899] text-sm text-[#1e2a4a] font-bold transition-all appearance-none cursor-pointer">
                                            <option value="streaming">Streaming</option>
                                            <option value="projector">Proyectores</option>
                                            <option value="gadget">Gadgets</option>
                                            <option value="perifericos">Periféricos</option>
                                            <option value="cables">Cables / Accesorios</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-2 block">Código de Barras (Opcional)</label>
                                    <div className="relative">
                                        <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ec4899]" size={18} />
                                        <input
                                            placeholder="Escanea o escribe el código..."
                                            value={formData.barcode || ''}
                                            onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                                            className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 pl-12 outline-none focus:bg-white focus:border-[#ec4899] text-sm text-[#ec4899] font-mono font-bold transition-all"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-2 block mt-2">Descripción / Notas (Opcional)</label>
                                    <textarea rows={2} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Ej: Proveedor Juan, Ubicación A2..." className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 outline-none focus:bg-white focus:border-[#ec4899] text-sm text-[#1e2a4a] font-medium resize-none transition-all"></textarea>
                                </div>
                            </div>

                            <div className="pt-8 mt-4 border-t border-slate-100">
                                <button type="submit" className="w-full bg-[#3b82f6] hover:bg-blue-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest transition-all shadow-[0_4px_15px_rgba(59,130,246,0.3)] hover:-translate-y-0.5">
                                    {isEditing ? 'Guardar Cambios' : 'Registrar Producto'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}