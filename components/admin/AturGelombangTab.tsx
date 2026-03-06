import React, { useState, useEffect } from 'react';
import { api } from '../../src/services/api';
import { SchoolSchedule } from '../../types';
import { useToast } from '../../context/ToastContext';
import { Save, Plus, Trash2, Calendar, Clock } from 'lucide-react';

const AturGelombangTab: React.FC = () => {
    const [schedules, setSchedules] = useState<SchoolSchedule[]>([]);
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    useEffect(() => {
        fetchSchedules();
    }, []);

    const fetchSchedules = async () => {
        setLoading(true);
        const data = await api.getSchoolSchedules();
        setSchedules(data);
        setLoading(false);
    };

    const handleSave = async () => {
        const result = await api.saveSchoolSchedules(schedules);
        if (result.success) {
            showToast('Jadwal berhasil disimpan', 'success');
        } else {
            showToast('Gagal menyimpan jadwal', 'error');
        }
    };

    const addSchedule = () => {
        setSchedules([...schedules, { school: '', gelombang: '', tanggal: '', tanggal_selesai: '' }]);
    };

    const updateSchedule = (index: number, field: keyof SchoolSchedule, value: string) => {
        const newSchedules = [...schedules];
        newSchedules[index][field] = value;
        setSchedules(newSchedules);
    };

    const deleteSchedule = (index: number) => {
        setSchedules(schedules.filter((_, i) => i !== index));
    };

    if (loading) return <div className="p-8 text-center">Memuat data...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">Atur Jadwal Gelombang</h2>
                <button onClick={handleSave} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700">
                    <Save size={18} /> Simpan Jadwal
                </button>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-slate-500 border-b">
                            <th className="p-2">Sekolah</th>
                            <th className="p-2">Gelombang</th>
                            <th className="p-2">Tanggal Mulai</th>
                            <th className="p-2">Tanggal Selesai</th>
                            <th className="p-2">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {schedules.map((s, i) => (
                            <tr key={i} className="border-b">
                                <td className="p-2"><input className="w-full border rounded p-1" value={s.school} onChange={e => updateSchedule(i, 'school', e.target.value)} /></td>
                                <td className="p-2"><input className="w-full border rounded p-1" value={s.gelombang} onChange={e => updateSchedule(i, 'gelombang', e.target.value)} /></td>
                                <td className="p-2"><input type="date" className="w-full border rounded p-1" value={s.tanggal} onChange={e => updateSchedule(i, 'tanggal', e.target.value)} /></td>
                                <td className="p-2"><input type="date" className="w-full border rounded p-1" value={s.tanggal_selesai || ''} onChange={e => updateSchedule(i, 'tanggal_selesai', e.target.value)} /></td>
                                <td className="p-2"><button onClick={() => deleteSchedule(i)} className="text-rose-500"><Trash2 size={18} /></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <button onClick={addSchedule} className="mt-4 text-indigo-600 flex items-center gap-2 font-bold text-sm">
                    <Plus size={18} /> Tambah Jadwal
                </button>
            </div>
        </div>
    );
};

export default AturGelombangTab;
