
import React, { useState, useMemo, useEffect } from 'react';
import { LayoutDashboard, FileText, Loader2, BookOpen, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { exportToExcel, formatDurationToText } from '../../utils/adminHelpers';
import { User } from '../../types';

interface RekapTabProps {
    students: any[];
    currentUser: User;
}

const RekapTab = ({ students, currentUser }: RekapTabProps) => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [filterSchool, setFilterSchool] = useState('all');
    const [filterKecamatan, setFilterKecamatan] = useState('all');
    const [filterClass, setFilterClass] = useState('all');
    const [filterSubject, setFilterSubject] = useState('all');

    // Create a robust map of users for quick lookup (Case Insensitive Key)
    const userMap = useMemo(() => {
        const map: Record<string, any> = {};
        students.forEach(s => {
            if (s.username) {
                map[String(s.username).toLowerCase().trim()] = s;
            }
        });
        return map;
    }, [students]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.getRecap();
            // Sort by timestamp descending (newest first)
            const sorted = res.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setData(sorted);
        } catch (e) {
            console.error("Failed to load recap data", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Pre-fill filter for Guru if needed
        if (currentUser.role === 'Guru') {
            if (currentUser.kelas && currentUser.kelas !== '-') {
                setFilterClass(currentUser.kelas);
            }
        }
    }, [currentUser]);

    // Extract Unique Options from Loaded Data & Students (Filtered for Guru)
    const uniqueSchools = useMemo(() => {
        const schools = new Set(data.map(d => d.sekolah).filter(Boolean));
        students.forEach(s => { if(s.school) schools.add(s.school); });
        return Array.from(schools).sort();
    }, [data, students]);

    const uniqueKecamatans = useMemo(() => {
        const kecs = new Set(students.map(s => s.kecamatan).filter(Boolean).filter(k => k !== '-'));
        return Array.from(kecs).sort();
    }, [students]);

    const uniqueClasses = useMemo(() => {
        const classes = new Set(students.map(s => s.kelas).filter(Boolean));
        return Array.from(classes).sort((a: any, b: any) => 
            String(a).localeCompare(String(b), undefined, { numeric: true })
        );
    }, [students]);

    const uniqueSubjects = useMemo(() => {
        const subjs = new Set(data.map(d => d.mapel).filter(Boolean));
        return Array.from(subjs).sort();
    }, [data]);

    const filteredData = useMemo(() => {
        return data.filter(d => {
            // Lookup user details securely
            const usernameKey = String(d.username).toLowerCase().trim();
            const userProfile = userMap[usernameKey];
            
            // Safety check: if user not found in student list, maybe ignore or process partially?
            // If we strictly filter by Guru role, we need userProfile.
            if (currentUser.role === 'Guru' && !userProfile) return false;

            const userKec = userProfile?.kecamatan || '-';
            const userKelas = userProfile?.kelas || '-';
            
            // GURU SPECIFIC FILTER LOGIC
            if (currentUser.role === 'Guru') {
                const mySchool = (currentUser.kelas_id || '').toLowerCase();
                const studentSchool = (d.sekolah || userProfile?.school || '').toLowerCase();
                
                // 1. Must match School
                if (studentSchool !== mySchool) return false;

                // 2. If Guru has specific class, Must match Class
                if (currentUser.kelas && currentUser.kelas !== '-' && currentUser.kelas !== '') {
                    // Using loose equality for class strings '1' vs '01' if necessary, but here exact match is preferred
                    if (userKelas !== currentUser.kelas) return false;
                }
            }

            // Standard Filters
            const matchSchool = filterSchool === 'all' || (d.sekolah && d.sekolah.toLowerCase() === filterSchool.toLowerCase());
            const matchKecamatan = filterKecamatan === 'all' || (userKec && userKec.toLowerCase() === filterKecamatan.toLowerCase());
            const matchClass = filterClass === 'all' || (userKelas === filterClass);
            const matchSubject = filterSubject === 'all' || d.mapel === filterSubject;

            return matchSchool && matchKecamatan && matchClass && matchSubject;
        });
    }, [data, filterSchool, filterKecamatan, filterClass, filterSubject, userMap, currentUser]);

    const handleExport = () => {
        const exportData = filteredData.map((d, i) => {
            const usernameKey = String(d.username).toLowerCase().trim();
            const userProfile = userMap[usernameKey];
            return {
                "No": i + 1,
                "Waktu Submit": new Date(d.timestamp).toLocaleString('id-ID'),
                "Username": d.username,
                "Nama Peserta": d.nama,
                "Kelas": userProfile?.kelas || '-',
                "Sekolah": d.sekolah,
                "Kecamatan": userProfile?.kecamatan || '-',
                "Mata Pelajaran": d.mapel,
                "Nilai Akhir": parseFloat(d.nilai) || 0,
                "Durasi": formatDurationToText(d.durasi)
            };
        });
        exportToExcel(exportData, `Rekap_Nilai_${filterSubject === 'all' ? 'Semua' : filterSubject}`);
    };

    const isGuruClassLocked = currentUser.role === 'Guru' && currentUser.kelas && currentUser.kelas !== '-';

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 fade-in p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h3 className="font-bold text-lg flex items-center gap-2"><LayoutDashboard size={20}/> Rekapitulasi Nilai</h3>
                    <p className="text-xs text-slate-400">Data nilai tersinkronisasi dari Database Hasil Ujian.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto flex-wrap items-center">
                     <button onClick={fetchData} className="p-2.5 rounded-lg bg-slate-50 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition" title="Refresh Data">
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                     </button>
                     <select className="p-2 border border-slate-200 rounded-lg text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer" value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
                        <option value="all">Semua Mata Pelajaran</option>
                        {uniqueSubjects.map((s:any) => <option key={s} value={s}>{s}</option>)}
                     </select>
                     
                     {/* Class Filter - Disabled if Guru is locked to a class */}
                     {!isGuruClassLocked && (
                         <select className="p-2 border border-slate-200 rounded-lg text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
                            <option value="all">Semua Kelas</option>
                            {uniqueClasses.map((s:any) => <option key={s} value={s}>Kelas {s}</option>)}
                         </select>
                     )}

                     {/* Filters hidden for Guru to simplify UI as they are auto-applied */}
                     {currentUser.role !== 'Guru' && (
                         <>
                         <select className="p-2 border border-slate-200 rounded-lg text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer" value={filterKecamatan} onChange={e => setFilterKecamatan(e.target.value)}>
                            <option value="all">Semua Kecamatan</option>
                            {uniqueKecamatans.map((s:any) => <option key={s} value={s}>{s}</option>)}
                         </select>
                         <select className="p-2 border border-slate-200 rounded-lg text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer max-w-[150px]" value={filterSchool} onChange={e => setFilterSchool(e.target.value)}>
                            <option value="all">Semua Sekolah</option>
                            {uniqueSchools.map((s:any) => <option key={s} value={s}>{s}</option>)}
                         </select>
                         </>
                     )}
                     
                     <button onClick={handleExport} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition shadow-lg shadow-emerald-200 active:scale-95">
                        <FileText size={16}/> Export
                     </button>
                </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-slate-50 font-bold text-slate-600 uppercase text-xs sticky top-0 z-10">
                        <tr>
                            <th className="p-4 w-12 text-center">No</th>
                            <th className="p-4">Waktu Submit</th>
                            <th className="p-4">Username</th>
                            <th className="p-4">Nama Peserta</th>
                            <th className="p-4 text-center">Kelas</th>
                            <th className="p-4">Sekolah</th>
                            {currentUser.role === 'admin' && <th className="p-4">Kecamatan</th>}
                            <th className="p-4 text-center bg-indigo-50/50 border-l border-slate-200">Mata Pelajaran</th>
                            <th className="p-4 text-center border-l border-slate-200 bg-emerald-50/50">Nilai Akhir</th>
                            <th className="p-4 text-center">Durasi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={10} className="p-12 text-center text-slate-400"><Loader2 className="animate-spin inline mr-2"/> Mengambil data dari database...</td></tr>
                        ) : filteredData.length === 0 ? (
                            <tr><td colSpan={10} className="p-12 text-center text-slate-400 italic">Data tidak ditemukan untuk filter ini.</td></tr>
                        ) : (
                            filteredData.map((d, i) => {
                                const usernameKey = String(d.username).toLowerCase().trim();
                                const userProfile = userMap[usernameKey];
                                const userKec = userProfile?.kecamatan || '-';
                                const userKelas = userProfile?.kelas || '-';
                                
                                return (
                                <tr key={i} className="hover:bg-slate-50 transition group">
                                    <td className="p-4 text-center text-slate-500">{i + 1}</td>
                                    <td className="p-4 text-xs text-slate-500 font-mono">
                                        {new Date(d.timestamp).toLocaleDateString('id-ID')} <br/>
                                        <span className="text-[10px] opacity-70">{new Date(d.timestamp).toLocaleTimeString('id-ID')}</span>
                                    </td>
                                    <td className="p-4 font-mono text-slate-600 font-bold text-xs">{d.username}</td>
                                    <td className="p-4 font-bold text-slate-700">{d.nama}</td>
                                    <td className="p-4 text-center text-slate-600 font-bold bg-slate-50/50">{userKelas}</td>
                                    <td className="p-4 text-slate-600 text-xs">{d.sekolah}</td>
                                    {currentUser.role === 'admin' && <td className="p-4 text-slate-600 text-xs">{userKec}</td>}
                                    <td className="p-4 text-center border-l border-slate-100 bg-indigo-50/10 font-bold text-indigo-700 text-xs">
                                        {d.mapel}
                                    </td>
                                    <td className="p-4 text-center border-l border-slate-100 bg-emerald-50/10">
                                        <span className="text-lg font-black text-emerald-600">{d.nilai}</span>
                                    </td>
                                    <td className="p-4 text-center text-xs text-slate-500 font-mono">
                                        {formatDurationToText(d.durasi)}
                                    </td>
                                </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-400 gap-2">
                <span>Total Data: <b>{filteredData.length}</b> record</span>
                <span className="text-right">Database Hasil Ujian (Realtime)</span>
            </div>
        </div>
    );
};

export default RekapTab;
