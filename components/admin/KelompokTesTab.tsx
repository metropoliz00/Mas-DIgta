
import React, { useState, useMemo, useEffect } from 'react';
import { Group, Search, Save, Loader2, Filter, Target, ListChecks } from 'lucide-react';
import { api } from '../../services/api';
import { User, Exam, LearningObjective } from '../../types';

const KelompokTesTab = ({ currentUser, students, refreshData }: { currentUser: User, students: any[], refreshData: () => void }) => {
    const [exams, setExams] = useState<Exam[]>([]);
    const [selectedExam, setSelectedExam] = useState('');
    
    // Logic TP
    const [tps, setTps] = useState<LearningObjective[]>([]);
    const [selectedTp, setSelectedTp] = useState('');
    
    // Logic Exam Type
    const [selectedExamType, setSelectedExamType] = useState('Sumatif 1');
    const examTypes = ['Sumatif 1', 'Sumatif 2', 'Sumatif 3', 'Sumatif 4', 'Sumatif Akhir Semester'];
    
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [loadingTps, setLoadingTps] = useState(false);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSchool, setFilterSchool] = useState('all');
    const [filterKecamatan, setFilterKecamatan] = useState('all');
    const [filterClass, setFilterClass] = useState('all');

    useEffect(() => {
        api.getExams().then(setExams);
        setLoadingTps(true);
        api.getLearningObjectives().then(res => {
            setTps(res);
            setLoadingTps(false);
        });
    }, []);

    // STRICTLY FILTER FOR STUDENTS ONLY
    const studentList = useMemo(() => {
        return students.filter(s => s.role === 'siswa');
    }, [students]);

    const uniqueSchools = useMemo(() => {
        const schools = new Set(studentList.map(s => s.school).filter(Boolean));
        return Array.from(schools).sort() as string[];
    }, [studentList]);

    const uniqueKecamatans = useMemo(() => {
        const kecs = new Set(studentList.map(s => s.kecamatan).filter(Boolean).filter(k => k !== '-'));
        return Array.from(kecs).sort();
    }, [studentList]);

    const uniqueClasses = useMemo(() => {
        const classes = new Set(studentList.map(s => s.kelas).filter(Boolean));
        return Array.from(classes).sort((a: any, b: any) => 
            String(a).localeCompare(String(b), undefined, { numeric: true })
        );
    }, [studentList]);

    // FILTER TP BASED ON SELECTED EXAM (MAPEL)
    const filteredTps = useMemo(() => {
        if (!selectedExam) return [];
        // Match TP mapel with active exam name
        return tps.filter(t => t.mapel === selectedExam);
    }, [tps, selectedExam]);

    // Reset selected TP when exam changes
    useEffect(() => {
        setSelectedTp('');
    }, [selectedExam]);

    const filteredStudents = useMemo(() => {
        return studentList.filter(s => {
            const matchName = (s.fullname || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (s.username || '').toLowerCase().includes(searchTerm.toLowerCase());
            
            if (currentUser.role === 'Guru') {
                return matchName && (s.school || '').toLowerCase() === (currentUser.kelas_id || '').toLowerCase();
            }
            
            let matchFilter = true;
            if (filterSchool !== 'all') matchFilter = matchFilter && s.school === filterSchool;
            if (filterKecamatan !== 'all') matchFilter = matchFilter && (s.kecamatan || '').toLowerCase() === filterKecamatan.toLowerCase();
            if (filterClass !== 'all') matchFilter = matchFilter && (s.kelas || '') === filterClass;

            return matchName && matchFilter;
        });
    }, [studentList, searchTerm, currentUser, filterSchool, filterKecamatan, filterClass]);

    const handleSave = async () => {
        if (!selectedExam) return alert("Pilih ujian terlebih dahulu");
        if (selectedUsers.size === 0) return alert("Pilih siswa");
        
        setLoading(true);
        try {
            // Pass selectedTp and selectedExamType to API
            await api.assignTestGroup(
                Array.from(selectedUsers).map(String), 
                selectedExam, 
                '', 
                selectedTp,
                selectedExamType
            );
            alert("Berhasil set ujian aktif, TP, dan jenis ujian.");
            refreshData();
            setSelectedUsers(new Set());
        } catch(e) { console.error(e); alert("Gagal."); }
        setLoading(false);
    };

    const toggleSelectAll = (checked: boolean) => {
        if (checked) setSelectedUsers(new Set(filteredStudents.map(s => s.username)));
        else setSelectedUsers(new Set());
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 fade-in p-6">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-700"><Group size={20}/> Kelompok Tes (Set Ujian Aktif)</h3>
            
            <div className="flex flex-col gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* SELECT EXAM TYPE (NEW) */}
                    <div className="lg:col-span-1">
                         <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Jenis Ujian</label>
                         <div className="relative">
                             <ListChecks className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                             <select className="w-full pl-8 p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100 font-bold text-indigo-700" value={selectedExamType} onChange={e => setSelectedExamType(e.target.value)}>
                                {examTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                         </div>
                    </div>

                    {/* SELECT EXAM */}
                    <div className="lg:col-span-1">
                         <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Pilih Ujian (Mapel)</label>
                         <select className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100 font-bold text-indigo-700" value={selectedExam} onChange={e => setSelectedExam(e.target.value)}>
                            <option value="">-- Pilih Ujian --</option>
                            {exams.map(e => <option key={e.id} value={e.id}>{e.nama_ujian}</option>)}
                        </select>
                    </div>

                    {/* SELECT TP */}
                    <div className="lg:col-span-2">
                         <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Pilih Tujuan Pembelajaran (TP)</label>
                         <div className="relative">
                             <Target className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                             <select 
                                className="w-full pl-8 p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100 font-bold text-indigo-700" 
                                value={selectedTp} 
                                onChange={e => setSelectedTp(e.target.value)}
                                disabled={!selectedExam || filteredTps.length === 0}
                             >
                                <option value="">-- Semua TP (Default) --</option>
                                {filteredTps.map(tp => (
                                    <option key={tp.id} value={tp.id}>
                                        {tp.id} - {tp.materi ? tp.materi.substring(0, 30) + (tp.materi.length>30?'...':'') : 'Tanpa Materi'}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {selectedExam && filteredTps.length === 0 && !loadingTps && (
                            <p className="text-[9px] text-orange-500 mt-1 italic">*Belum ada data TP untuk mapel ini.</p>
                        )}
                    </div>
                    
                    {currentUser.role === 'admin' && (
                        <>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Filter Kecamatan</label>
                            <select 
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100"
                                value={filterKecamatan}
                                onChange={e => setFilterKecamatan(e.target.value)}
                            >
                                <option value="all">Semua Kecamatan</option>
                                {uniqueKecamatans.map((s:any) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Filter Sekolah</label>
                            <select 
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100"
                                value={filterSchool}
                                onChange={e => setFilterSchool(e.target.value)}
                            >
                                <option value="all">Semua Sekolah</option>
                                {uniqueSchools.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        </>
                    )}

                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Filter Kelas</label>
                        <div className="relative">
                            <Filter className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <select 
                                className="w-full pl-8 p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100"
                                value={filterClass}
                                onChange={e => setFilterClass(e.target.value)}
                            >
                                <option value="all">Semua Kelas</option>
                                {uniqueClasses.map((s:any) => <option key={s} value={s}>Kelas {s}</option>)}
                            </select>
                        </div>
                    </div>
                    
                    <div className="lg:col-span-3">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Cari Peserta</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input type="text" placeholder="Cari Username atau Nama..." className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm w-full outline-none focus:ring-2 focus:ring-indigo-100" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center border-t border-slate-200 pt-4 mt-2">
                     <div className="text-xs text-slate-500 font-bold">
                        Terpilih: {selectedUsers.size} Siswa
                     </div>
                     <button onClick={handleSave} disabled={loading} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 flex items-center gap-2">
                        {loading ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Simpan Kelompok
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                        <tr>
                            <th className="p-4 w-10"><input type="checkbox" onChange={e => toggleSelectAll(e.target.checked)} checked={filteredStudents.length > 0 && filteredStudents.every(s => selectedUsers.has(s.username))}/></th>
                            <th className="p-4">Username</th>
                            <th className="p-4">Nama Lengkap</th>
                            <th className="p-4 text-center">Kelas</th>
                            <th className="p-4">Sekolah</th>
                            <th className="p-4 text-center">Ujian Aktif</th>
                            <th className="p-4 text-center">Jenis Ujian</th>
                            <th className="p-4 text-center">Active TP</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredStudents.length === 0 ? (
                            <tr><td colSpan={8} className="p-8 text-center text-slate-400 italic">Tidak ada siswa yang cocok dengan filter.</td></tr>
                        ) : filteredStudents.map(s => (
                            <tr key={s.username} className="hover:bg-slate-50 transition">
                                <td className="p-4">
                                    <input type="checkbox" checked={selectedUsers.has(s.username)} onChange={() => {
                                        const newSet = new Set(selectedUsers);
                                        if (newSet.has(s.username)) newSet.delete(s.username);
                                        else newSet.add(s.username);
                                        setSelectedUsers(newSet);
                                    }}/>
                                </td>
                                <td className="p-4 font-mono text-slate-500 font-bold">{s.username}</td>
                                <td className="p-4 font-bold text-slate-700">{s.fullname}</td>
                                <td className="p-4 text-center">{s.kelas || '-'}</td>
                                <td className="p-4 text-slate-600">{s.school}</td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${s.active_exam && s.active_exam !== '-' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                        {s.active_exam && s.active_exam !== '-' ? s.active_exam : 'Tidak Ada'}
                                    </span>
                                </td>
                                <td className="p-4 text-center">
                                    {s.exam_type ? (
                                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 whitespace-nowrap">{s.exam_type}</span>
                                    ) : <span className="text-slate-300">-</span>}
                                </td>
                                <td className="p-4 text-center">
                                    {s.active_tp ? (
                                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100" title={s.active_tp}>{s.active_tp}</span>
                                    ) : <span className="text-slate-300">-</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 text-xs text-slate-400 flex justify-between">
                <span>Total Siswa: {filteredStudents.length}</span>
                <span>Terpilih: {selectedUsers.size}</span>
            </div>
        </div>
    );
};

export default KelompokTesTab;
