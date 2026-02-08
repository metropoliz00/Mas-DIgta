
import React, { useState, useMemo, useEffect } from 'react';
import { LayoutDashboard, FileText, Loader2, RefreshCw, Printer, Grid3X3, List } from 'lucide-react';
import { api } from '../../services/api';
import { exportToExcel, formatDurationToText, SUBJECTS_DB } from '../../utils/adminHelpers';
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
    const [viewMode, setViewMode] = useState<'list' | 'matrix'>('list');
    const [globalConfig, setGlobalConfig] = useState<Record<string, string>>({});

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
            const config = await api.getAppConfig();
            setGlobalConfig(config);
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
                    if (userKelas !== currentUser.kelas) return false;
                }
            }

            // Standard Filters
            const matchSchool = filterSchool === 'all' || (d.sekolah && d.sekolah.toLowerCase() === filterSchool.toLowerCase());
            const matchKecamatan = filterKecamatan === 'all' || (userKec && userKec.toLowerCase() === filterKecamatan.toLowerCase());
            const matchClass = filterClass === 'all' || (userKelas === filterClass);
            
            // For Matrix View, we filter subject differently (substring match for grouping)
            // For List View, we filter strictly
            const matchSubject = viewMode === 'matrix' 
                ? (filterSubject === 'all' || d.mapel.toLowerCase().includes(filterSubject.toLowerCase()))
                : (filterSubject === 'all' || d.mapel === filterSubject);

            return matchSchool && matchKecamatan && matchClass && matchSubject;
        });
    }, [data, filterSchool, filterKecamatan, filterClass, filterSubject, userMap, currentUser, viewMode]);

    // MATRIX VIEW LOGIC (LEGER)
    const matrixData = useMemo(() => {
        if (viewMode !== 'matrix' || filterSubject === 'all') return [];

        const studentRows: Record<string, any> = {};

        // 1. Get all eligible students first (even if they haven't taken the exam)
        const eligibleStudents = students.filter(s => {
            if (s.role !== 'siswa') return false;
            // Apply current filters
            if (currentUser.role === 'Guru') {
                const mySchool = (currentUser.kelas_id || '').toLowerCase();
                if ((s.school || '').toLowerCase() !== mySchool) return false;
                if (currentUser.kelas && currentUser.kelas !== '-' && s.kelas !== currentUser.kelas) return false;
            } else {
                if (filterSchool !== 'all' && s.school !== filterSchool) return false;
                if (filterKecamatan !== 'all' && (s.kecamatan || '').toLowerCase() !== filterKecamatan.toLowerCase()) return false;
            }
            if (filterClass !== 'all' && s.kelas !== filterClass) return false;
            return true;
        });

        // 2. Init Rows
        eligibleStudents.forEach(s => {
            studentRows[s.username] = {
                username: s.username,
                nama: s.fullname,
                kelas: s.kelas,
                sumatif1: '-',
                sumatif2: '-',
                sumatif3: '-',
                sumatif4: '-',
                sas: '-',
                avg: 0,
                scoreCount: 0,
                totalScore: 0
            };
        });

        // 3. Map Scores (Pivoting Logic)
        filteredData.forEach(d => {
            const row = studentRows[d.username];
            if (row) {
                const score = parseFloat(d.nilai) || 0;
                const mapelLower = d.mapel.toLowerCase();
                
                // Logic Mapping Kolom berdasarkan Nama Ujian
                // Keywords: "Sumatif 1", "S1", "TP 1" -> Column 1
                if (mapelLower.includes('sumatif 1') || mapelLower.includes('tp 1') || mapelLower.includes('tp1') || mapelLower.includes('s1')) {
                    row.sumatif1 = score;
                } else if (mapelLower.includes('sumatif 2') || mapelLower.includes('tp 2') || mapelLower.includes('tp2') || mapelLower.includes('s2')) {
                    row.sumatif2 = score;
                } else if (mapelLower.includes('sumatif 3') || mapelLower.includes('tp 3') || mapelLower.includes('tp3') || mapelLower.includes('s3')) {
                    row.sumatif3 = score;
                } else if (mapelLower.includes('sumatif 4') || mapelLower.includes('tp 4') || mapelLower.includes('tp4') || mapelLower.includes('s4')) {
                    row.sumatif4 = score;
                } else if (mapelLower.includes('akhir') || mapelLower.includes('sas') || mapelLower.includes('pas') || mapelLower.includes('uas')) {
                    row.sas = score;
                } else {
                    // Fallback: Jika nama tidak spesifik, taruh di S1 jika kosong
                    if(row.sumatif1 === '-') row.sumatif1 = score;
                }

                row.totalScore += score;
                row.scoreCount += 1;
            }
        });

        // 4. Calculate Average
        Object.values(studentRows).forEach((row: any) => {
            if (row.scoreCount > 0) {
                row.avg = (row.totalScore / row.scoreCount).toFixed(2);
            }
        });

        return Object.values(studentRows).sort((a: any, b: any) => a.nama.localeCompare(b.nama));

    }, [filteredData, students, viewMode, filterSubject, filterClass, filterSchool, filterKecamatan, currentUser]);

    const handleExport = () => {
        if (viewMode === 'matrix') {
            const exportData = matrixData.map((d, i) => ({
                "No": i + 1,
                "Username": d.username,
                "Nama Murid": d.nama,
                "Sumatif 1": d.sumatif1,
                "Sumatif 2": d.sumatif2,
                "Sumatif 3": d.sumatif3,
                "Sumatif 4": d.sumatif4,
                "Akhir Semester": d.sas,
                "Nilai Akhir": d.avg
            }));
            exportToExcel(exportData, `Rekap_Nilai_Sumatif_${filterSubject || 'Semua'}`);
        } else {
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
        }
    };

    const handlePrintMatrix = () => {
        if (matrixData.length === 0) return alert("Tidak ada data untuk dicetak.");
        
        const displayMapel = filterSubject === 'all' ? 'Semua Mata Pelajaran' : filterSubject;
        const displayKelas = filterClass === 'all' ? 'Semua Kelas' : filterClass;
        const displayTahun = globalConfig['ACADEMIC_YEAR'] || '2025/2026';
        const displaySchool = globalConfig['SCHOOL_NAME'] || (currentUser.kelas_id || '...........................');
        
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const rowsHtml = matrixData.map((d, i) => `
            <tr>
                <td style="text-align: center;">${i + 1}</td>
                <td style="font-family: monospace;">${d.username}</td>
                <td>${d.nama}</td>
                <td style="text-align: center;">${d.sumatif1}</td>
                <td style="text-align: center;">${d.sumatif2}</td>
                <td style="text-align: center;">${d.sumatif3}</td>
                <td style="text-align: center;">${d.sumatif4}</td>
                <td style="text-align: center;">${d.sas}</td>
                <td style="text-align: center; font-weight: bold;">${d.avg}</td>
            </tr>
        `).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Rekap Nilai Sumatif</title>
                <style>
                    @page { size: A4 landscape; margin: 10mm; }
                    body { font-family: Arial, sans-serif; font-size: 10pt; }
                    .header { text-align: center; margin-bottom: 20px; font-weight: bold; text-transform: uppercase; }
                    .meta { margin-bottom: 15px; width: 100%; }
                    .meta td { padding: 2px 10px 2px 0; }
                    table.data { width: 100%; border-collapse: collapse; }
                    table.data th, table.data td { border: 1px solid #000; padding: 5px; }
                    table.data th { background-color: #f0f0f0; text-align: center; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2 style="margin: 0; font-size: 16pt;">Rekap Nilai Sumatif</h2>
                    <h3 style="margin: 5px 0 0; font-size: 12pt;">${displaySchool}</h3>
                </div>
                <table class="meta">
                    <tr><td width="150">Mata Pelajaran</td><td>: ${displayMapel}</td></tr>
                    <tr><td>Kelas</td><td>: ${displayKelas}</td></tr>
                    <tr><td>Tahun Ajaran</td><td>: ${displayTahun}</td></tr>
                </table>
                <table class="data">
                    <thead>
                        <tr>
                            <th width="40">No</th>
                            <th>Username</th>
                            <th>Nama Murid</th>
                            <th width="70">Sumatif 1</th>
                            <th width="70">Sumatif 2</th>
                            <th width="70">Sumatif 3</th>
                            <th width="70">Sumatif 4</th>
                            <th width="80">Akhir Sem.</th>
                            <th width="80">Nilai Akhir</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
                <script>window.onload = function() { window.print(); }</script>
            </body>
            </html>
        `;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
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
                     
                     {/* View Toggle */}
                     <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button onClick={() => setViewMode('list')} className={`p-2 rounded-md flex items-center gap-2 text-xs font-bold transition ${viewMode === 'list' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
                            <List size={16}/> Tabel
                        </button>
                        <button onClick={() => setViewMode('matrix')} className={`p-2 rounded-md flex items-center gap-2 text-xs font-bold transition ${viewMode === 'matrix' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
                            <Grid3X3 size={16}/> Leger
                        </button>
                     </div>

                     <button onClick={fetchData} className="p-2.5 rounded-lg bg-slate-50 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition" title="Refresh Data">
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                     </button>
                     
                     {/* SUBJECT FILTER - Conditional Rendering based on ViewMode */}
                     {viewMode === 'matrix' ? (
                         <select
                            className="p-2 border border-slate-200 rounded-lg text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 min-w-[200px] cursor-pointer"
                            value={filterSubject}
                            onChange={e => setFilterSubject(e.target.value)}
                         >
                            <option value="all">-- Pilih Mata Pelajaran --</option>
                            {SUBJECTS_DB.map((s) => (
                                <option key={s.id} value={s.label}>{s.label}</option>
                            ))}
                         </select>
                     ) : (
                         <select className="p-2 border border-slate-200 rounded-lg text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer" value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
                            <option value="all">Semua Mata Pelajaran</option>
                            {uniqueSubjects.map((s:any) => <option key={s} value={s}>{s}</option>)}
                         </select>
                     )}
                     
                     {!isGuruClassLocked && (
                         <select className="p-2 border border-slate-200 rounded-lg text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
                            <option value="all">Semua Kelas</option>
                            {uniqueClasses.map((s:any) => <option key={s} value={s}>Kelas {s}</option>)}
                         </select>
                     )}

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
                     
                     {viewMode === 'matrix' && matrixData.length > 0 && (
                         <button onClick={handlePrintMatrix} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-900 transition shadow-lg active:scale-95">
                            <Printer size={16}/> Cetak Leger
                         </button>
                     )}

                     <button onClick={handleExport} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition shadow-lg shadow-emerald-200 active:scale-95">
                        <FileText size={16}/> Export Excel
                     </button>
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="overflow-x-auto rounded-lg border border-slate-200 min-h-[400px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <Loader2 className="animate-spin mb-2" size={32}/> 
                        <span className="font-bold">Mengolah Data...</span>
                    </div>
                ) : viewMode === 'matrix' ? (
                    /* MATRIX VIEW TABLE */
                    filterSubject === 'all' ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <Grid3X3 className="mb-2 opacity-20" size={48}/>
                            <span className="font-bold">Silakan Pilih Mata Pelajaran pada menu dropdown untuk melihat Rekap Nilai Keseluruhan (Leger).</span>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left whitespace-nowrap">
                            <thead className="bg-slate-50 font-bold text-slate-600 uppercase text-xs sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-4 w-12 text-center border-b border-slate-200">No</th>
                                    <th className="p-4 border-b border-slate-200">Username</th>
                                    <th className="p-4 border-b border-slate-200">Nama Murid</th>
                                    <th className="p-4 text-center border-b border-slate-200 bg-indigo-50/30">Sumatif 1</th>
                                    <th className="p-4 text-center border-b border-slate-200 bg-indigo-50/30">Sumatif 2</th>
                                    <th className="p-4 text-center border-b border-slate-200 bg-indigo-50/30">Sumatif 3</th>
                                    <th className="p-4 text-center border-b border-slate-200 bg-indigo-50/30">Sumatif 4</th>
                                    <th className="p-4 text-center border-b border-slate-200 bg-purple-50/30">Akhir Sem.</th>
                                    <th className="p-4 text-center border-b border-slate-200 bg-emerald-50/30 font-black">Nilai Akhir</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {matrixData.length === 0 ? (
                                    <tr><td colSpan={9} className="p-12 text-center text-slate-400 italic">Data tidak ditemukan untuk mapel "{filterSubject}".</td></tr>
                                ) : matrixData.map((d: any, i: number) => (
                                    <tr key={i} className="hover:bg-slate-50 transition group">
                                        <td className="p-4 text-center text-slate-500">{i + 1}</td>
                                        <td className="p-4 font-mono text-slate-500 font-bold text-xs">{d.username}</td>
                                        <td className="p-4 font-bold text-slate-700">{d.nama}</td>
                                        <td className="p-4 text-center text-slate-600">{d.sumatif1}</td>
                                        <td className="p-4 text-center text-slate-600">{d.sumatif2}</td>
                                        <td className="p-4 text-center text-slate-600">{d.sumatif3}</td>
                                        <td className="p-4 text-center text-slate-600">{d.sumatif4}</td>
                                        <td className="p-4 text-center font-bold text-indigo-600">{d.sas}</td>
                                        <td className="p-4 text-center font-black text-emerald-600 bg-emerald-50/10">{d.avg}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )
                ) : (
                    /* LIST VIEW TABLE (Existing) */
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-slate-50 font-bold text-slate-600 uppercase text-xs sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-4 w-12 text-center border-b border-slate-200">No</th>
                                <th className="p-4 border-b border-slate-200">Waktu Submit</th>
                                <th className="p-4 border-b border-slate-200">Username</th>
                                <th className="p-4 border-b border-slate-200">Nama Peserta</th>
                                <th className="p-4 text-center border-b border-slate-200">Kelas</th>
                                <th className="p-4 border-b border-slate-200">Sekolah</th>
                                {currentUser.role === 'admin' && <th className="p-4 border-b border-slate-200">Kecamatan</th>}
                                <th className="p-4 text-center bg-indigo-50/50 border-b border-l border-slate-200">Mata Pelajaran</th>
                                <th className="p-4 text-center border-b border-l border-slate-200 bg-emerald-50/50">Nilai Akhir</th>
                                <th className="p-4 text-center border-b border-slate-200">Durasi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredData.length === 0 ? (
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
                )}
            </div>
            
            <div className="mt-4 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-400 gap-2">
                <span>{viewMode === 'matrix' ? `Menampilkan ${matrixData.length} siswa` : `Total Data: ${filteredData.length} record`}</span>
                <span className="text-right">Database Hasil Ujian (Realtime)</span>
            </div>
        </div>
    );
};

export default RekapTab;
