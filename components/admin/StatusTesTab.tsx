
import React, { useState, useMemo } from 'react';
import { Monitor, Search, PlayCircle, Key, CheckCircle2, RefreshCw, Filter, UserX } from 'lucide-react';
import { api } from '../../services/api';
import { User } from '../../types';

const StatusTesTab = ({ currentUser, students, refreshData }: { currentUser: User, students: any[], refreshData: () => void }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSchool, setFilterSchool] = useState('all');
    const [filterKecamatan, setFilterKecamatan] = useState('all');
    const [filterClass, setFilterClass] = useState('all');
    const [resetting, setResetting] = useState<string | null>(null);

    // Extract Class logic
    const getClass = (schoolName: string) => {
        if (!schoolName) return '-';
        const match = schoolName.match(/\d+/);
        if ((schoolName.toLowerCase().includes('kelas') || schoolName.toLowerCase().includes('kls')) && match) {
            return match[0];
        }
        return '-';
    };

    // Filter students ONLY (Exclude admin/guru from live monitor)
    const onlyStudents = useMemo(() => students.filter(s => s.role === 'siswa'), [students]);

    const uniqueSchools = useMemo<string[]>(() => { 
        const schools = new Set(onlyStudents.map(s => s.school).filter(Boolean)); 
        return Array.from(schools).sort() as string[]; 
    }, [onlyStudents]);

    const uniqueKecamatans = useMemo(() => { 
        const kecs = new Set(onlyStudents.map(s => s.kecamatan).filter(Boolean).filter(k => k !== '-')); 
        return Array.from(kecs).sort(); 
    }, [onlyStudents]);

    const uniqueClasses = useMemo(() => {
        const classes = new Set(onlyStudents.map(s => getClass(s.school)).filter(c => c !== '-'));
        return Array.from(classes).sort();
    }, [onlyStudents]);

    const filtered = useMemo(() => { 
        return onlyStudents.filter(s => { 
            const sClass = getClass(s.school);
            const matchName = (s.fullname || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (s.username || '').toLowerCase().includes(searchTerm.toLowerCase()); 
            
            // Logic Filter Guru: Sekolah Wajib Sama + Kelas Opsional (jika di-set)
            if (currentUser.role === 'Guru') { 
                const matchSchool = (s.school || '').toLowerCase() === (currentUser.kelas_id || '').toLowerCase();
                // Jika Guru punya kelas spesifik (e.g. "6"), filter juga kelasnya. Jika kosong, tampilkan semua.
                const matchClass = !currentUser.kelas || currentUser.kelas === '-' || currentUser.kelas === '' ? true : sClass === currentUser.kelas;
                
                return matchName && matchSchool && matchClass;
            } 
            
            let matchFilter = true; 
            if (filterSchool !== 'all') matchFilter = matchFilter && s.school === filterSchool; 
            if (filterKecamatan !== 'all') matchFilter = matchFilter && (s.kecamatan || '').toLowerCase() === filterKecamatan.toLowerCase(); 
            if (filterClass !== 'all') matchFilter = matchFilter && sClass === filterClass;

            return matchName && matchFilter; 
        }); 
    }, [onlyStudents, searchTerm, currentUser, filterSchool, filterKecamatan, filterClass]);

    const handleReset = async (username: string) => { 
        if(!confirm(`Reset login untuk ${username}? Siswa akan logout otomatis and status menjadi OFFLINE.`)) return; 
        setResetting(username); 
        try { 
            await api.resetLogin(username); 
            refreshData(); 
        } catch(e) { 
            console.error(e); 
            alert("Gagal reset login."); 
        } finally { 
            setResetting(null); 
        } 
    }

    const renderStatusBadge = (status: string) => { 
        switch (status) { 
            case 'WORKING': return <span className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide flex items-center justify-center gap-1.5 border border-blue-100 shadow-sm w-fit mx-auto"><PlayCircle size={12}/> Mengerjakan</span>; 
            case 'LOGGED_IN': return <span className="bg-amber-50 text-amber-600 px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide flex items-center justify-center gap-1.5 border border-amber-100 shadow-sm w-fit mx-auto"><Key size={12}/> Standby</span>; 
            case 'FINISHED': return <span className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide flex items-center justify-center gap-1.5 border border-emerald-100 shadow-sm w-fit mx-auto"><CheckCircle2 size={12}/> Selesai</span>; 
            case 'OFFLINE': default: return <span className="bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide flex items-center justify-center gap-1.5 border border-slate-200 w-fit mx-auto"><UserX size={12}/> Offline</span>; 
        } 
    };

    return (
        <div className="space-y-6 fade-in">
             {/* Header Card */}
             <div className="bg-white p-6 rounded-[1.5rem] shadow-lg shadow-slate-200/50 border border-slate-100 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                <div className="z-10">
                    <h3 className="font-black text-xl md:text-2xl text-slate-800 flex items-center gap-3"><Monitor size={28} className="text-indigo-600"/> Live Status Monitor</h3>
                    <p className="text-slate-500 text-sm mt-1 font-medium">Pantau aktivitas peserta ujian secara realtime.</p>
                </div>
                
                <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto z-10 flex-wrap">
                    {currentUser.role === 'admin' && (
                        <>
                        <div className="relative group">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16}/>
                            <select className="pl-10 pr-4 py-3 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-indigo-500 focus:bg-white bg-slate-50 transition-all cursor-pointer w-full md:w-36 appearance-none" value={filterKecamatan} onChange={e => setFilterKecamatan(e.target.value)}><option value="all">Semua Kec.</option>{uniqueKecamatans.map((s:any) => <option key={s} value={s}>{s}</option>)}</select>
                        </div>
                        <div className="relative group">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16}/>
                            <select 
                                className="pl-10 pr-4 py-3 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-indigo-500 focus:bg-white bg-slate-50 transition-all cursor-pointer w-full md:w-40 appearance-none" 
                                value={filterSchool} 
                                onChange={e => {
                                    const val = e.target.value;
                                    setFilterSchool(val);
                                    if (val !== 'all') {
                                        const found = onlyStudents.find(s => s.school === val);
                                        if (found && found.kecamatan) setFilterKecamatan(found.kecamatan);
                                    }
                                }}
                            >
                                <option value="all">Semua Sekolah</option>
                                {uniqueSchools.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="relative group">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16}/>
                            <select className="pl-10 pr-4 py-3 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-indigo-500 focus:bg-white bg-slate-50 transition-all cursor-pointer w-full md:w-32 appearance-none" value={filterClass} onChange={e => setFilterClass(e.target.value)}><option value="all">Semua Kls</option>{uniqueClasses.map((s:any) => <option key={s} value={s}>Kelas {s}</option>)}</select>
                        </div>
                        </>
                    )}
                    <div className="relative group w-full md:w-64">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                        <input type="text" placeholder="Cari Nama / Username..." className="w-full pl-11 pr-4 py-3 border-2 border-slate-100 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-700 placeholder-slate-400 transition-all bg-slate-50 focus:bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                    </div>
                </div>
             </div>

             {/* Table Card */}
             <div className="bg-white rounded-[1.5rem] shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
                 <div className="overflow-x-auto">
                     <table className="w-full text-xs md:text-sm text-left">
                         <thead className="bg-slate-50/80 text-slate-500 font-extrabold uppercase text-[10px] md:text-[11px] tracking-wider backdrop-blur-sm sticky top-0 z-10">
                             <tr>
                                 <th className="p-3 md:p-5 border-b border-slate-200">Username</th>
                                 <th className="p-3 md:p-5 border-b border-slate-200">Nama Peserta</th>
                                 <th className="p-3 md:p-5 border-b border-slate-200 text-center w-16">Kelas</th>
                                 <th className="p-3 md:p-5 border-b border-slate-200">Sekolah & Kecamatan</th>
                                 <th className="p-3 md:p-5 border-b border-slate-200 text-center">Status</th>
                                 <th className="p-3 md:p-5 border-b border-slate-200 text-center">Ujian Aktif</th>
                                 <th className="p-3 md:p-5 border-b border-slate-200 text-center">Aksi</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                             {filtered.length === 0 ? 
                                <tr><td colSpan={7} className="p-12 text-center text-slate-400 font-medium italic bg-slate-50/30">Tidak ada data peserta (Siswa) yang cocok.</td></tr> 
                                : filtered.map((s, i) => (
                                <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                                    <td className="p-3 md:p-5 font-mono text-slate-500 font-bold">{s.username}</td>
                                    <td className="p-3 md:p-5 font-bold text-slate-800">{s.fullname}</td>
                                    <td className="p-3 md:p-5 text-center font-bold text-indigo-600 bg-indigo-50/30">{getClass(s.school)}</td>
                                    <td className="p-3 md:p-5 text-slate-600">
                                        <div className="font-bold">{s.school}</div>
                                        <div className="text-[10px] text-slate-500 uppercase tracking-wide">{s.kecamatan || '-'}</div>
                                    </td>
                                    <td className="p-3 md:p-5 text-center">{renderStatusBadge(s.status)}</td>
                                    <td className="p-3 md:p-5 text-center">
                                        {s.active_exam && s.active_exam !== '-' ? (
                                            <span className="font-bold text-indigo-700 text-[10px] md:text-xs bg-indigo-50 px-2 py-1 rounded border border-indigo-100">{s.active_exam}</span>
                                        ) : (
                                            <span className="text-slate-300 text-xs font-bold">-</span>
                                        )}
                                    </td>
                                    <td className="p-3 md:p-5 text-center">
                                        <button onClick={() => handleReset(s.username)} disabled={!!resetting || s.status === 'OFFLINE'} className="group/btn relative overflow-hidden bg-white text-rose-500 border border-rose-200 hover:border-rose-500 hover:bg-rose-500 hover:text-white px-3 md:px-4 py-1.5 rounded-xl text-[10px] md:text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300 disabled:border-slate-200 flex items-center gap-1 mx-auto w-fit">
                                            {resetting === s.username ? <RefreshCw size={12} className="animate-spin"/> : <RefreshCw size={12} className="group-hover/btn:rotate-180 transition-transform duration-500"/>}
                                            <span>Reset</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-400 font-medium flex justify-between items-center">
                    <span>Total: {filtered.length} Peserta</span>
                    <span>Menampilkan 50 data teratas</span>
                </div>
            </div>
        </div>
    )
};

export default StatusTesTab;
