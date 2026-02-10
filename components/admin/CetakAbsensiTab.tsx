
import React, { useState, useMemo, useEffect } from 'react';
import { Printer, ArrowDownAZ, ArrowUpZA } from 'lucide-react';
import { api } from '../../services/api';
import { User, Exam } from '../../types';

const CetakAbsensiTab = ({ currentUser, students }: { currentUser: User, students: any[] }) => {
    const [exams, setExams] = useState<Exam[]>([]);
    const [selectedExamId, setSelectedExamId] = useState('');
    const [selectedSession, setSelectedSession] = useState('');
    const [filterSchool, setFilterSchool] = useState('all');
    const [filterKecamatan, setFilterKecamatan] = useState('all');
    const [filterClass, setFilterClass] = useState('all');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    
    // Config for Logos
    const [appConfig, setAppConfig] = useState<Record<string, string>>({});

    useEffect(() => {
        api.getExams().then(res => {
            setExams(res);
        });
        api.getAppConfig().then(setAppConfig).catch(console.error);
    }, []);

    // FILTER ONLY STUDENTS
    const studentList = useMemo(() => students.filter(s => s.role === 'siswa'), [students]);

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

    const filteredStudents = useMemo(() => {
        let res = studentList.filter(s => {
            if (currentUser.role === 'Guru') {
                if ((s.school || '').toLowerCase() !== (currentUser.kelas_id || '').toLowerCase()) return false;
            } else {
                if (filterSchool !== 'all' && s.school !== filterSchool) return false;
                if (filterKecamatan !== 'all' && (s.kecamatan || '').toLowerCase() !== filterKecamatan.toLowerCase()) return false;
            }
            if (selectedSession && s.session !== selectedSession) return false;
            if (filterClass !== 'all' && (s.kelas || '') !== filterClass) return false;
            return true;
        });

        // Sort by Name
        return res.sort((a, b) => {
            const nameA = (a.fullname || a.username || '').toLowerCase();
            const nameB = (b.fullname || b.username || '').toLowerCase();
            return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        });
    }, [studentList, currentUser, filterSchool, filterKecamatan, filterClass, selectedSession, sortOrder]);

    const handlePrint = () => {
        if (filteredStudents.length === 0) return alert("Tidak ada data siswa untuk dicetak.");

        const printWindow = window.open('', '_blank');
        if (!printWindow) return alert("Pop-up blocked. Please allow pop-ups.");

        const schoolName = currentUser.role === 'Guru' ? currentUser.kelas_id : (filterSchool !== 'all' ? filterSchool : 'Semua Sekolah');
        const kecamatanName = currentUser.role === 'Guru' ? (currentUser.kecamatan || '-') : (filterKecamatan !== 'all' ? filterKecamatan : '-');
        const sesiName = selectedSession || 'Semua Sesi';
        const className = filterClass !== 'all' ? `Kelas ${filterClass}` : '';
        const examName = exams.find(e => e.id === selectedExamId)?.nama_ujian || '...........................';
        
        const dateNow = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const signatureDate = `Tuban, ${dateNow}`;
        const proktorName = currentUser.nama_lengkap || "...........................";
        
        // UPDATED LOGOS from CONFIG (Transparent fallback if empty)
        const transparentPixel = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        const logoLeftUrl = appConfig['LOGO_KABUPATEN'] || transparentPixel;
        const logoRightUrl = appConfig['LOGO_SEKOLAH'] || transparentPixel;

        const rowsHtml = filteredStudents.map((s, idx) => `
            <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td>${s.username}</td>
                <td>${s.fullname}</td>
                <td style="text-align: center;">${s.kelas || '-'}</td>
                <td>${s.school}</td>
                <td style="text-align: center;">${s.session || '-'}</td>
                <td></td>
            </tr>
        `).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Cetak Absensi</title>
                <style>
                    body { font-family: 'Times New Roman', serif; padding: 20px; color: #000; }
                    .header-container { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px double black; padding-bottom: 10px; margin-bottom: 20px; }
                    .logo { height: 80px; width: auto; object-fit: contain; }
                    .header-text { text-align: center; flex-grow: 1; padding: 0 10px; }
                    .header-text h2 { margin: 0; font-size: 18px; text-transform: uppercase; line-height: 1.2; }
                    .header-text h3 { margin: 5px 0 0; font-size: 16px; font-weight: normal; }
                    .info-table { margin-bottom: 20px; font-size: 14px; width: 100%; }
                    .info-table td { padding: 4px; vertical-align: top; }
                    .main-table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    .main-table th, .main-table td { border: 1px solid black; padding: 8px; }
                    .main-table th { background-color: #f0f0f0; text-align: center; font-weight: bold; }
                    .signature-section { margin-top: 50px; float: right; width: 250px; text-align: center; font-size: 14px; }
                    @media print {
                        @page { size: A4; margin: 1.5cm; }
                        button { display: none; }
                        body { padding: 0; }
                        .header-container { -webkit-print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                <div class="header-container">
                    <img src="${logoLeftUrl}" class="logo" alt="Logo Kiri" />
                    <div class="header-text">
                        <h2>DAFTAR HADIR</h2>
                        <h2>UJIAN BERBASIS KOMPUTER</h2>
                        <h3>${schoolName} ${kecamatanName !== '-' ? `- Kecamatan ${kecamatanName}` : ''}</h3>
                    </div>
                    <img src="${logoRightUrl}" class="logo" alt="Logo Kanan" />
                </div>

                <table class="info-table">
                    <tr><td width="150">Mata Pelajaran</td><td>: ${examName}</td></tr>
                    <tr><td width="150">Sesi</td><td>: ${sesiName} ${className ? `(${className})` : ''}</td></tr>
                    <tr><td>Hari, Tanggal</td><td>: ${dateNow}</td></tr>
                </table>

                <table class="main-table">
                    <thead>
                        <tr>
                            <th width="40">No</th>
                            <th>Username</th>
                            <th>Nama Peserta</th>
                            <th width="60">Kelas</th>
                            <th>Sekolah</th>
                            <th width="80">Sesi</th>
                            <th width="100">Tanda Tangan</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>

                <div class="signature-section">
                    <p>${signatureDate}</p>
                    <p>Proktor</p>
                    <br/><br/><br/>
                    <p><strong>${proktorName}</strong></p>
                </div>

                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 fade-in p-6">
             <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-700"><Printer size={20}/> Cetak Daftar Hadir (Absensi)</h3>
             
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div>
                         <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Mata Pelajaran</label>
                         <select className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100" value={selectedExamId} onChange={e => setSelectedExamId(e.target.value)}>
                            <option value="">-- Pilih Mapel --</option>
                            {exams.map(e => <option key={e.id} value={e.id}>{e.nama_ujian}</option>)}
                        </select>
                    </div>
                    <div>
                         <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Filter Sesi</label>
                         <select className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100" value={selectedSession} onChange={e => setSelectedSession(e.target.value)}>
                            <option value="">Semua Sesi</option>
                            <option value="Sesi 1">Sesi 1</option>
                            <option value="Sesi 2">Sesi 2</option>
                            <option value="Sesi 3">Sesi 3</option>
                            <option value="Sesi 4">Sesi 4</option>
                        </select>
                    </div>
                    
                    {currentUser.role === 'admin' && (
                        <>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Filter Kecamatan</label>
                            <select className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100" value={filterKecamatan} onChange={e => setFilterKecamatan(e.target.value)}>
                                <option value="all">Semua Kecamatan</option>
                                {uniqueKecamatans.map((s:any) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Filter Sekolah</label>
                            <select 
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100" 
                                value={filterSchool} 
                                onChange={e => {
                                    const val = e.target.value;
                                    setFilterSchool(val);
                                    if (val !== 'all') {
                                        const found = studentList.find(s => s.school === val);
                                        if (found && found.kecamatan) setFilterKecamatan(found.kecamatan);
                                    }
                                }}
                            >
                                <option value="all">Semua Sekolah</option>
                                {uniqueSchools.map((s:any) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        </>
                    )}

                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Filter Kelas</label>
                        <select className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-100" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
                            <option value="all">Semua Kelas</option>
                            {uniqueClasses.map((s:any) => <option key={s} value={s}>Kelas {s}</option>)}
                        </select>
                    </div>

                    <div className="flex gap-2 items-center">
                        <button onClick={() => setSortOrder(p => p === 'asc' ? 'desc' : 'asc')} className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 hover:border-indigo-100 transition shadow-sm h-[38px] flex items-center justify-center" title={sortOrder === 'asc' ? "Urutkan Z-A" : "Urutkan A-Z"}>
                            {sortOrder === 'asc' ? <ArrowDownAZ size={18}/> : <ArrowUpZA size={18}/>}
                        </button>
                        <div className="text-xs font-bold text-slate-400">Sort Nama</div>
                    </div>
                </div>
                
                <div className="flex justify-end mt-4 pt-4 border-t border-slate-200">
                    <button onClick={handlePrint} className="bg-slate-800 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-slate-900 transition flex items-center gap-2 shadow-lg">
                        <Printer size={16}/> Cetak Absensi
                    </button>
                </div>
             </div>

             <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                        <tr>
                            <th className="p-4 w-10">No</th>
                            <th className="p-4">Username</th>
                            <th className="p-4">Nama Peserta</th>
                            <th className="p-4">Kelas</th>
                            <th className="p-4">Sekolah</th>
                            <th className="p-4">Sesi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                         {filteredStudents.length === 0 ? (
                            <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">Tidak ada data siswa sesuai filter.</td></tr>
                        ) : (
                            filteredStudents.map((s, idx) => (
                                <tr key={s.username} className="hover:bg-slate-50">
                                    <td className="p-4 text-center text-slate-500 font-mono">{idx+1}</td>
                                    <td className="p-4 font-mono font-bold text-slate-600">{s.username}</td>
                                    <td className="p-4 font-bold text-slate-700">{s.fullname}</td>
                                    <td className="p-4 text-slate-600">{s.kelas || '-'}</td>
                                    <td className="p-4 text-slate-600">{s.school}</td>
                                    <td className="p-4"><span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded text-xs font-bold">{s.session || '-'}</span></td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
             </div>
        </div>
    );
};

export default CetakAbsensiTab;
