
import React, { useState, useMemo, useEffect } from 'react';
import { Award, FileText, Loader2, BookOpen, Filter } from 'lucide-react';
import { api } from '../../services/api';
import { exportToExcel, getPredicateBadge } from '../../utils/adminHelpers';

const RankingTab = ({ students }: { students: any[] }) => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [filterKecamatan, setFilterKecamatan] = useState('all');
    const [filterSchool, setFilterSchool] = useState('all');
    const [filterClass, setFilterClass] = useState('all');
    const [filterSubject, setFilterSubject] = useState('');
    
    // User Map for quick lookup of profile data (Kecamatan, etc)
    const userMap = useMemo(() => {
        const map: Record<string, any> = {};
        students.forEach(s => map[s.username] = s);
        return map;
    }, [students]);
    
    // Extract Unique Filter Options
    const uniqueKecamatans = useMemo(() => {
        const kecs = new Set(students.map(s => s.kecamatan).filter(Boolean).filter(k => k !== '-'));
        return Array.from(kecs).sort();
    }, [students]);
    
    const uniqueSchools = useMemo(() => {
        const schools = new Set(data.map(d => d.sekolah).filter(Boolean));
        return Array.from(schools).sort();
    }, [data]);

    const uniqueClasses = useMemo(() => {
        const classes = new Set(students.map(s => s.kelas).filter(Boolean));
        return Array.from(classes).sort((a: any, b: any) => 
            String(a).localeCompare(String(b), undefined, { numeric: true })
        );
    }, [students]);

    // Extract Unique Subjects from Results (Dynamic Sync)
    const uniqueSubjects = useMemo(() => {
        const subjects = new Set(data.map(d => d.mapel).filter(Boolean));
        return Array.from(subjects).sort();
    }, [data]);
    
    useEffect(() => {
        setLoading(true);
        api.getRecap().then(res => { 
            setData(res);
        }).catch(console.error).finally(() => setLoading(false));
    }, []);
    
    // Filter and Sort Data
    const filteredData = useMemo(() => {
        let res = data;

        // 1. Filter by Subject
        if (filterSubject) {
            res = res.filter(d => d.mapel === filterSubject);
        }

        // 2. Filter by School, Kecamatan, & Class
        res = res.filter(d => {
            const userProfile = userMap[d.username];
            const userKecamatan = userProfile?.kecamatan || '-';
            const userKelas = userProfile?.kelas || '-';
            
            const kecMatch = filterKecamatan === 'all' || (userKecamatan && userKecamatan.toLowerCase() === filterKecamatan.toLowerCase());
            const schoolMatch = filterSchool === 'all' || (d.sekolah && d.sekolah.toLowerCase() === filterSchool.toLowerCase());
            const classMatch = filterClass === 'all' || (userKelas === filterClass);
            
            return kecMatch && schoolMatch && classMatch;
        });

        // 3. Sort by Score (Desc)
        return res.sort((a, b) => {
            const scoreA = parseFloat(a.nilai) || 0;
            const scoreB = parseFloat(b.nilai) || 0;
            return scoreB - scoreA; // Highest to Lowest
        });
    }, [data, filterKecamatan, filterSchool, filterClass, filterSubject, userMap]);
    
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 fade-in p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h3 className="font-bold text-lg flex items-center gap-2"><Award size={20}/> Peringkat Peserta</h3>
                    <p className="text-xs text-slate-400">Ranking tersinkronisasi dengan seluruh mapel di database.</p>
                </div>
                
                <div className="flex flex-col xl:flex-row gap-2 w-full md:w-auto flex-wrap">
                    {/* Subject Filter */}
                    <div className="relative">
                        <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                        <select 
                            className="pl-9 pr-4 py-2 border-2 border-indigo-100 rounded-lg text-sm font-bold bg-indigo-50 text-indigo-700 outline-none focus:border-indigo-500 cursor-pointer w-full md:w-48" 
                            value={filterSubject} 
                            onChange={e => setFilterSubject(e.target.value)}
                        >
                            <option value="">Semua Mata Pelajaran</option>
                            {uniqueSubjects.map((s:any) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    {/* Class Filter */}
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
                        <select 
                            className="pl-8 pr-4 py-2 border border-slate-200 rounded-lg text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
                            value={filterClass}
                            onChange={e => setFilterClass(e.target.value)}
                        >
                            <option value="all">Semua Kelas</option>
                            {uniqueClasses.map((s:any) => <option key={s} value={s}>Kelas {s}</option>)}
                        </select>
                    </div>

                    <select className="p-2 border border-slate-200 rounded-lg text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer" value={filterKecamatan} onChange={e => setFilterKecamatan(e.target.value)}><option value="all">Semua Kecamatan</option>{uniqueKecamatans.map((s:any) => <option key={s} value={s}>{s}</option>)}</select>
                    <select 
                        className="p-2 border border-slate-200 rounded-lg text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer" 
                        value={filterSchool} 
                        onChange={e => {
                            const val = e.target.value;
                            setFilterSchool(val);
                            if (val !== 'all') {
                                const found = students.find((s:any) => s.school === val);
                                if (found && found.kecamatan) setFilterKecamatan(found.kecamatan);
                            }
                        }}
                    >
                        <option value="all">Semua Sekolah</option>
                        {uniqueSchools.map((s:any) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    
                    <button onClick={() => exportToExcel(filteredData, `Ranking_${filterSubject || 'All'}`)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition shadow-lg shadow-emerald-200"><FileText size={16}/> Export</button>
                </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs md:text-sm text-left">
                    <thead className="bg-slate-50 font-bold text-slate-600 uppercase text-[10px] md:text-xs">
                        <tr>
                            <th className="p-2 md:p-4 text-center w-16">Rank</th>
                            <th className="p-2 md:p-4">Nama</th>
                            <th className="p-2 md:p-4 text-center">Kelas</th>
                            <th className="p-2 md:p-4">Sekolah</th>
                            <th className="p-2 md:p-4">Kecamatan</th>
                            <th className="p-2 md:p-4">Mata Pelajaran</th>
                            <th className="p-2 md:p-4 text-center bg-indigo-50/50 border-l border-slate-200">Nilai</th>
                            <th className="p-2 md:p-4 text-center border-l border-slate-200">Predikat</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={8} className="p-8 text-center text-slate-400"><Loader2 className="animate-spin inline mr-2"/> Memuat data ranking...</td></tr>
                        ) : filteredData.length === 0 ? (
                            <tr><td colSpan={8} className="p-8 text-center text-slate-400 italic">Data tidak ditemukan untuk filter ini.</td></tr>
                        ) : (
                            filteredData.map((d, i) => {
                                const score = parseFloat(d.nilai) || 0;
                                return (
                                    <tr key={i} className="border-b hover:bg-slate-50 transition">
                                        <td className="p-2 md:p-4 font-bold text-center text-slate-500">
                                            <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center mx-auto ${i < 3 ? 'bg-yellow-100 text-yellow-700 font-black shadow-sm ring-2 ring-yellow-50' : 'bg-slate-100'}`}>
                                                {i+1}
                                            </div>
                                        </td>
                                        <td className="p-2 md:p-4">
                                            <div className="font-bold text-slate-700 text-xs md:text-sm">{d.nama}</div>
                                            <div className="text-[9px] md:text-[10px] text-slate-400 font-mono">{d.username}</div>
                                        </td>
                                        <td className="p-2 md:p-4 text-center text-slate-600 font-bold text-xs">
                                            {userMap[d.username]?.kelas || '-'}
                                        </td>
                                        <td className="p-2 md:p-4 text-slate-600 text-xs md:text-sm">{d.sekolah}</td>
                                        <td className="p-2 md:p-4 text-slate-600 text-xs md:text-sm">{userMap[d.username]?.kecamatan || '-'}</td>
                                        <td className="p-2 md:p-4 text-slate-600">
                                            <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 md:px-2 md:py-1 rounded text-[9px] md:text-[10px] font-bold uppercase border border-slate-200 whitespace-nowrap">
                                                {d.mapel}
                                            </span>
                                        </td>
                                        <td className="p-2 md:p-4 text-center font-black text-indigo-700 text-sm md:text-lg border-l border-slate-100 bg-indigo-50/20">
                                            {score}
                                        </td>
                                        <td className="p-2 md:p-4 text-center border-l border-slate-100">
                                            {getPredicateBadge(score)}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
            
            <div className="mt-4 flex justify-between items-center text-xs text-slate-400 font-medium">
                <span>Menampilkan {filteredData.length} Peserta</span>
                {filterSubject && <span>Mapel Aktif: {filterSubject}</span>}
            </div>
        </div>
    );
};

export default RankingTab;
