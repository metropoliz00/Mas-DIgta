
import React, { useState, useMemo, useEffect } from 'react';
import { BarChart3, FileText, Loader2, Filter, AlertCircle, Printer, Settings, Target } from 'lucide-react';
import { api } from '../../services/api';
import { Exam, User, LearningObjective } from '../../types';

const AnalisisTab = ({ currentUser, students }: { currentUser: User, students: any[] }) => {
    const [exams, setExams] = useState<Exam[]>([]);
    const [tps, setTps] = useState<LearningObjective[]>([]);
    const [selectedExam, setSelectedExam] = useState('');
    
    // Data States
    const [resultsData, setResultsData] = useState<any[]>([]);
    const [questionsData, setQuestionsData] = useState<any[]>([]);
    
    const [loading, setLoading] = useState(false);
    const [loadingTps, setLoadingTps] = useState(false);
    
    // Global Config State (Loaded from API)
    const [globalConfig, setGlobalConfig] = useState<Record<string, string>>({});

    // Local Filter & Config States
    const [filterClass, setFilterClass] = useState('all'); // Filter Table
    const [tpId, setTpId] = useState(''); // ID TP Selection
    const [tpInput, setTpInput] = useState(''); // Deskripsi TP
    const [materiInput, setMateriInput] = useState(''); // Materi
    const [kktp, setKktp] = useState(75); // KKTP Logic (Default 75)
    const [showConfig, setShowConfig] = useState(true); // Default open to encourage selection

    // Helper Maps
    const userMap = useMemo(() => {
        const map: Record<string, any> = {};
        students.forEach(s => map[s.username] = s);
        return map;
    }, [students]);

    useEffect(() => { 
        // Load Exams
        api.getExams().then(res => {
            setExams(res.filter(e => !e.id.startsWith('Survey_')));
        });
        // Load TPs
        setLoadingTps(true);
        api.getLearningObjectives().then(res => {
            setTps(res);
            setLoadingTps(false);
        });
        
        // Load Configs (Global + User Specific for Guru)
        const loadConfigs = async () => {
            try {
                const gConfig = await api.getAppConfig();
                let combinedConfig = { ...gConfig };
                
                // If Guru, merge with personal config to get specific Jabatan/Settings
                if (currentUser.role === 'Guru') {
                    const uConfig = await api.getUserConfig(currentUser.username);
                    combinedConfig = { ...combinedConfig, ...uConfig };
                }
                setGlobalConfig(combinedConfig);
            } catch (e) {
                console.error("Config load error", e);
            }
        };
        loadConfigs();
        
        // Auto set filter class for Guru if locked
        if (currentUser.role === 'Guru' && currentUser.kelas && currentUser.kelas !== '-') {
            setFilterClass(currentUser.kelas);
        }
    }, [currentUser]);

    // Filter TPs based on selected Exam (Mapel)
    const relevantTps = useMemo(() => {
        if (!selectedExam) return [];
        const examName = exams.find(e => e.id === selectedExam)?.nama_ujian || '';
        // Match TP Mapel exactly
        return tps.filter(t => t.mapel === examName);
    }, [tps, selectedExam, exams]);

    // Load Data when Exam Selected
    useEffect(() => {
        if (!selectedExam) {
            setResultsData([]);
            setQuestionsData([]);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                const qData = await api.getQuestions(selectedExam);
                const currentExamConfig = exams.find(e => e.id === selectedExam);
                let finalQuestions = qData;
                if (currentExamConfig && currentExamConfig.max_questions && currentExamConfig.max_questions > 0) {
                    finalQuestions = qData.slice(0, currentExamConfig.max_questions);
                }
                setQuestionsData(finalQuestions);

                // RESET INPUTS (Logic: Deskripsi tidak muncul sebelum ID TP dipilih)
                // Ini memaksa user memilih TP ulang saat ganti mapel
                setTpId('');
                setTpInput('');
                setMateriInput('');
                // If not Guru, reset class filter when mapel changes
                if (!(currentUser.role === 'Guru' && currentUser.kelas)) {
                    setFilterClass('all');
                }
                
                // Auto open config panel if mapel changed
                setShowConfig(true);

                const rData = await api.getAnalysis(selectedExam);
                setResultsData(rData);
            } catch (e) {
                console.error("Failed to load analysis data", e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [selectedExam, exams]); // Removed 'tps' from dep to prevent loop, 'tps' is loaded once

    // FILTER ONLY STUDENTS FOR CLASS LIST (Requirement: Users only, no admins)
    const uniqueClasses = useMemo(() => {
        const studentOnly = students.filter(s => s.role === 'siswa');
        const classes = new Set(studentOnly.map(s => s.kelas).filter(Boolean));
        return Array.from(classes).sort((a: any, b: any) => 
            String(a).localeCompare(String(b), undefined, { numeric: true })
        );
    }, [students]);

    // Process Data
    const processedData = useMemo(() => {
        // Filter Students
        const filtered = resultsData.filter(d => {
            const user = userMap[d.username];
            // Strict check: User must exist and be a student (role siswa)
            if (!user || user.role !== 'siswa') return false;

            const userKelas = user.kelas || '-';
            
            // GURU SPECIFIC LOGIC
            if (currentUser.role === 'Guru') {
                const mySchool = (currentUser.kelas_id || '').toLowerCase();
                const studentSchool = (user.school || '').toLowerCase();
                if (studentSchool !== mySchool) return false;

                if (currentUser.kelas && currentUser.kelas !== '-' && currentUser.kelas !== '') {
                    if (userKelas !== currentUser.kelas) return false;
                }
            }
            
            // Logic Filter Kelas
            const classMatch = filterClass === 'all' || (userKelas === filterClass);
            
            return classMatch;
        });

        // Parse JSON and Calculate Mastery
        const rows = filtered.map(d => {
            let ansMap = {};
            try {
                ansMap = typeof d.analisis === 'string' ? JSON.parse(d.analisis) : d.analisis || {};
            } catch (e) { console.error("JSON Parse Error", e); }
            
            const score = parseFloat(d.nilai) || 0;
            const isTuntas = score >= kktp;

            return { 
                ...d, 
                ansMap,
                score,
                isTuntas,
                ketuntasan: isTuntas ? "Tuntas" : "Tidak Tuntas",
                rekomendasi: isTuntas ? "Pengayaan" : "Remidi"
            };
        });

        // Calculate Stats Per Question (Item Difficulty)
        const questionStats: Record<string, { correct: number, total: number }> = {};
        questionsData.forEach(q => { questionStats[q.id] = { correct: 0, total: 0 }; });

        rows.forEach(row => {
            questionsData.forEach(q => {
                const isCorrect = row.ansMap[q.id] === 1;
                if (questionStats[q.id]) {
                    questionStats[q.id].total++;
                    if (isCorrect) questionStats[q.id].correct++;
                }
            });
        });

        return { rows, questionStats };
    }, [resultsData, questionsData, filterClass, userMap, kktp, currentUser]);

    const { rows, questionStats } = processedData;

    // Requirement: Check if config is complete to show dashboard
    const isConfigComplete = selectedExam && tpId && tpInput;
    const isGuruClassLocked = currentUser.role === 'Guru' && currentUser.kelas && currentUser.kelas !== '-';

    // Generate HTML String for Print
    const generateHtmlReport = () => {
        const dateNow = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        const examName = exams.find(e => e.id === selectedExam)?.nama_ujian || selectedExam;
        
        // --- FETCH DATA FROM GLOBAL/USER CONFIG ---
        const schoolName = globalConfig['SCHOOL_NAME'] || '...........................';
        const kepSek = globalConfig['PRINCIPAL_NAME'] || '...........................';
        const nipKepSek = globalConfig['PRINCIPAL_NIP'] || '-';
        
        // LOGIC TANDA TANGAN (SESUAI USER LOGIN UNTUK GURU)
        let guru = globalConfig['TEACHER_NAME'] || '...........................';
        let nipGuru = globalConfig['TEACHER_NIP'] || '-';
        let jabatan = globalConfig['TEACHER_POSITION'] || 'Guru Kelas';

        if (currentUser.role === 'Guru') {
            guru = currentUser.nama_lengkap;
            nipGuru = currentUser.username;
            
            // Use specific teacher position from config if available, otherwise auto-generate
            if (!globalConfig['TEACHER_POSITION'] && currentUser.kelas && currentUser.kelas !== '-') {
                jabatan = `Guru Kelas ${currentUser.kelas}`;
            }
        }

        const tahunAjaran = globalConfig['ACADEMIC_YEAR'] || '2025/2026';
        const semester = globalConfig['SEMESTER'] || '1 (Ganjil)';
        
        // Smart Class Name Logic for Print: RAW DATA WITHOUT PREFIX
        const className = filterClass !== 'all' ? filterClass : 'Semua Kelas';

        const tableHeaderCols = questionsData.map((q, i) => `<th class="col-ans">${i+1}</th>`).join('');
        
        const tableRows = rows.map((r, i) => {
            const cells = questionsData.map(q => {
                const val = r.ansMap[q.id];
                const bg = val === 1 ? '#d1fae5' : val === 0 ? '#fee2e2' : '#ffffff';
                return `<td class="col-ans" style="background-color: ${bg};">${val === 1 ? '1' : val === 0 ? '0' : '-'}</td>`;
            }).join('');

            return `
                <tr>
                    <td style="text-align: center;">${i+1}</td>
                    <td class="col-name">${r.nama}</td>
                    <td style="text-align: center;">${r.score}</td>
                    ${cells}
                    <td style="text-align: center; color: ${r.isTuntas ? 'green' : 'red'}; font-weight: bold;">${r.ketuntasan}</td>
                    <td style="text-align: center; color: ${r.isTuntas ? 'blue' : 'orange'};">${r.rekomendasi}</td>
                </tr>
            `;
        }).join('');

        // BOTTOM STATS ROWS
        const correctRow = questionsData.map(q => `<td class="col-ans" style="font-weight:bold;">${questionStats[q.id].correct}</td>`).join('');
        const incorrectRow = questionsData.map(q => `<td class="col-ans" style="font-weight:bold; color:red;">${questionStats[q.id].total - questionStats[q.id].correct}</td>`).join('');
        const percentRow = questionsData.map(q => {
            const stats = questionStats[q.id];
            const pct = stats.total > 0 ? Math.round((stats.correct/stats.total)*100) : 0;
            return `<td class="col-ans" style="font-weight:bold;">${pct}%</td>`;
        }).join('');
        
        const diffRow = questionsData.map(q => {
            const stats = questionStats[q.id];
            const pct = stats.total > 0 ? Math.round((stats.correct/stats.total)*100) : 0;
            let label = "Sd";
            let color = "blue";
            if (pct > 70) { label = "M"; color = "green"; }
            else if (pct < 30) { label = "S"; color = "red"; }
            return `<td class="col-ans" style="font-weight:bold; color:${color};">${label}</td>`;
        }).join('');

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Analisis Hasil Asesmen</title>
                <style>
                    @page { size: A4 landscape; margin: 10mm; }
                    body { font-family: 'Arial', sans-serif; padding: 0; margin: 0; font-size: 9px; color: #000; }
                    .container { width: 100%; }
                    
                    /* Header Styles */
                    .header-title { text-align: center; font-weight: bold; font-size: 14pt; margin-bottom: 5px; text-transform: uppercase; line-height: 1.2; }
                    .header-subtitle { text-align: center; font-weight: bold; font-size: 12pt; margin-bottom: 20px; text-transform: uppercase; border-bottom: 3px double #000; padding-bottom: 10px; }
                    
                    /* UPDATED: Font size set to 9pt for identity header */
                    .meta-container { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; font-size: 9pt; }
                    
                    .meta-table td { padding: 2px 5px; vertical-align: top; }
                    .meta-label { font-weight: bold; width: 140px; white-space: nowrap; }
                    
                    /* TP Description Wrapper */
                    .tp-container { display: flex; align-items: flex-start; gap: 4px; }
                    .tp-desc {
                        max-width: 550px;
                        display: -webkit-box;
                        -webkit-line-clamp: 3;
                        -webkit-box-orient: vertical;
                        overflow: hidden;
                        line-height: 1.2;
                        text-align: justify;
                    }
                    
                    /* Table Styles - Font Size 9px Enforcement */
                    table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 9px; table-layout: auto; }
                    table.data-table th, table.data-table td { border: 1px solid #000; padding: 3px; vertical-align: middle; }
                    table.data-table th { background-color: #f0f0f0; text-align: center; font-weight: bold; padding: 4px 2px; }
                    
                    /* Column Sizing */
                    .col-no { width: 25px; text-align: center; }
                    .col-name { width: 140px; } 
                    .col-score { width: 35px; text-align: center; }
                    
                    .col-ans { 
                        width: 20px; 
                        min-width: 20px; 
                        max-width: 20px; 
                        text-align: center; 
                        font-size: 9px; 
                        padding: 0;
                        overflow: hidden;
                    }
                    
                    .col-status { width: 60px; text-align: center; }
                    .col-rec { width: 60px; text-align: center; }
                    
                    /* Footer */
                    .footer { display: flex; justify-content: space-between; margin-top: 20px; page-break-inside: avoid; font-size: 11pt; }
                    .signature-box { text-align: center; width: 250px; line-height: 1.2; }
                    .signature-box p { margin: 0; }
                    .signature-space { height: 60px; }
                    .sig-name { font-weight: bold; font-size: 11pt; margin-bottom: 2px; text-decoration: underline; } 
                    .sig-nip { font-size: 10pt; }
                    
                    .bg-gray { background-color: #f9fafb; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header-title">Analisis Hasil Asesmen Sumatif</div>
                    <div class="header-subtitle">${schoolName}</div>
                    
                    <div class="meta-container">
                        <table class="meta-table">
                            <tr><td class="meta-label">Mata Pelajaran</td><td>: ${examName}</td></tr>
                            <tr><td class="meta-label">Materi</td><td>: ${materiInput || '-'}</td></tr>
                            <tr>
                                <td class="meta-label">Tujuan Pembelajaran</td>
                                <td>
                                    <div class="tp-container">
                                        <span>:</span>
                                        <div class="tp-desc">${tpInput || '-'}</div>
                                    </div>
                                </td>
                            </tr>
                        </table>
                        <table class="meta-table">
                            <tr><td class="meta-label">Kelas / Semester</td><td>: ${className} / ${semester}</td></tr>
                            <tr><td class="meta-label">Tahun Ajaran</td><td>: ${tahunAjaran}</td></tr>
                        </table>
                    </div>

                    <table class="data-table">
                        <thead>
                            <tr>
                                <th class="col-no" rowspan="2">No</th>
                                <th class="col-name" rowspan="2">Nama Peserta Didik</th>
                                <th class="col-score" rowspan="2">Nilai</th>
                                <th colspan="${questionsData.length}">Analisis Butir Soal</th>
                                <th class="col-status" rowspan="2">Ketuntasan</th>
                                <th class="col-rec" rowspan="2">Rekomendasi</th>
                            </tr>
                            <tr>
                                ${tableHeaderCols}
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                        <tfoot>
                            <tr class="bg-gray"><td colspan="3" class="text-align:right font-bold" style="text-align:right; padding-right:10px;">Jumlah Benar</td>${correctRow}<td colspan="2"></td></tr>
                            <tr class="bg-gray"><td colspan="3" class="text-align:right font-bold" style="text-align:right; padding-right:10px;">Jumlah Salah</td>${incorrectRow}<td colspan="2"></td></tr>
                            <tr class="bg-gray"><td colspan="3" class="text-align:right font-bold" style="text-align:right; padding-right:10px;">Prosentase Benar</td>${percentRow}<td colspan="2"></td></tr>
                            <tr class="bg-gray"><td colspan="3" class="text-align:right font-bold" style="text-align:right; padding-right:10px;">Tingkat Kesukaran</td>${diffRow}<td colspan="2"></td></tr>
                        </tfoot>
                    </table>

                    <div class="footer">
                        <div class="signature-box">
                            <p>Mengetahui,</p>
                            <p>Kepala Sekolah</p>
                            <div class="signature-space"></div>
                            <p class="sig-name">${kepSek}</p>
                            <p class="sig-nip">NIP. ${nipKepSek}</p>
                        </div>
                        <div class="signature-box">
                            <p>Tuban, ${dateNow}</p>
                            <p>${jabatan}</p>
                            <div class="signature-space"></div>
                            <p class="sig-name">${guru}</p>
                            <p class="sig-nip">NIP. ${nipGuru}</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;
    };

    const handlePrint = () => {
        if (!isConfigComplete || rows.length === 0) return alert("Data belum lengkap atau kosong.");
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        const content = generateHtmlReport();
        printWindow.document.write(content + `<script>window.onload = function() { window.print(); }</script>`);
        printWindow.document.close();
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 fade-in p-6">
            {/* Header Control */}
            <div className="flex flex-col gap-6 mb-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800"><BarChart3 size={20} className="text-indigo-600"/> Analisis Hasil Asesmen</h3>
                        <p className="text-xs text-slate-400">Pilih Ujian dan TP untuk melihat analisis butir soal.</p>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 items-center">
                        <button onClick={() => setShowConfig(!showConfig)} className={`p-2.5 rounded-lg border transition flex items-center gap-2 text-xs font-bold ${showConfig ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'} ${!isConfigComplete && selectedExam ? 'animate-pulse ring-2 ring-indigo-300' : ''}`}>
                            <Settings size={16}/> Konfigurasi
                        </button>
                        
                        <div className="h-8 w-px bg-slate-200 mx-1"></div>

                        <select className="p-2 border border-slate-200 rounded-lg text-sm font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 min-w-[200px]" value={selectedExam} onChange={e => setSelectedExam(e.target.value)}>
                            <option value="">-- Pilih Mapel / Ujian --</option>
                            {exams.map(e => <option key={e.id} value={e.id}>{e.nama_ujian}</option>)}
                        </select>
                        
                        {isConfigComplete && rows.length > 0 && (
                            <button onClick={handlePrint} className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 active:scale-95">
                                <Printer size={16}/> Cetak
                            </button>
                        )}
                    </div>
                </div>

                {/* SIMPLIFIED Configuration Panel */}
                {showConfig && (
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 animate-in fade-in slide-in-from-top-2">
                        <h4 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2"><FileText size={16}/> Filter & Atribut Laporan</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            
                            {/* TP Configuration */}
                            <div className="lg:col-span-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Tujuan Pembelajaran (TP)</label>
                                <div className="flex gap-2">
                                    <div className="relative w-1/3">
                                        <Target className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
                                        <select 
                                            className="w-full pl-8 p-2 border border-slate-200 rounded-lg text-sm font-bold focus:border-indigo-500 outline-none bg-white truncate cursor-pointer text-indigo-700"
                                            value={tpId}
                                            onChange={(e) => {
                                                const id = e.target.value;
                                                setTpId(id);
                                                const selected = tps.find(t => t.id === id);
                                                if (selected) {
                                                    setTpInput(selected.text_tujuan);
                                                    if(selected.materi) setMateriInput(selected.materi);
                                                    // Auto Lock Filter Kelas based on TP
                                                    if(selected.kelas) setFilterClass(selected.kelas);
                                                } else {
                                                    setTpInput('');
                                                    setMateriInput('');
                                                    // Reset class if not locked by Guru
                                                    if (!isGuruClassLocked) setFilterClass('all');
                                                }
                                            }}
                                            disabled={!selectedExam}
                                        >
                                            <option value="">Pilih ID TP</option>
                                            {relevantTps.map(t => (
                                                <option key={t.id} value={t.id}>{t.id}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <input type="text" readOnly className="w-2/3 p-2 border border-slate-200 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none bg-slate-100 text-slate-600 cursor-not-allowed" value={tpInput} placeholder="Deskripsi TP (Otomatis)" />
                                </div>
                                {selectedExam && relevantTps.length === 0 && !loadingTps && (
                                    <p className="text-[9px] text-orange-500 mt-1 italic">* Tidak ada data TP untuk Mapel ini. Tambahkan di menu Data Laporan {'>'} Tujuan Pembelajaran.</p>
                                )}
                            </div>

                            {/* Materi Configuration - NOW DISABLED/READONLY */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Materi</label>
                                <input 
                                    type="text" 
                                    readOnly
                                    className="w-full p-2 border border-slate-200 rounded-lg text-sm font-medium outline-none bg-slate-100 text-slate-600 cursor-not-allowed" 
                                    value={materiInput} 
                                    placeholder="Materi (Otomatis dari TP)" 
                                />
                            </div>

                            {/* Class Filter - Auto Locked if TP Selected */}
                            {!isGuruClassLocked && (
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Filter Kelas Siswa</label>
                                    <select 
                                        className={`w-full p-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 outline-none focus:border-indigo-500 bg-white ${tpId ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                        value={filterClass} 
                                        onChange={e => setFilterClass(e.target.value)}
                                        disabled={!!tpId}
                                    >
                                        <option value="all">Semua Kelas</option>
                                        {uniqueClasses.map((s:any) => (
                                            <option key={s} value={s}>
                                                {/* Raw value from DB without additional text */}
                                                {s}
                                            </option>
                                        ))}
                                    </select>
                                    {tpId && <p className="text-[9px] text-indigo-500 mt-0.5 italic flex items-center gap-1">* Terkunci sesuai ID TP</p>}
                                </div>
                            )}
                        </div>
                        <div className="mt-3 text-[10px] text-slate-400 italic">
                            * Data Sekolah, Kepala Sekolah, dan Guru diambil otomatis dari menu <b>Konfigurasi</b>.
                        </div>
                    </div>
                )}
            </div>

            {/* MAIN CONTENT AREA - CONDITIONALLY RENDERED */}
            {!selectedExam ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <Filter size={40} className="text-slate-300 mb-2"/>
                    <p className="text-slate-400 font-medium">Pilih Ujian (Mata Pelajaran) terlebih dahulu.</p>
                </div>
            ) : !isConfigComplete ? (
                // BLOCKING VIEW IF TP IS NOT SELECTED
                <div className="flex flex-col items-center justify-center py-20 bg-orange-50 rounded-2xl border-2 border-orange-100">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                        <Target size={32} className="text-orange-500"/>
                    </div>
                    <h3 className="text-lg font-black text-orange-700 mb-2">Konfigurasi Belum Lengkap</h3>
                    <p className="text-orange-600/80 font-medium text-sm text-center max-w-md px-4">
                        Dasbord analisis terkunci. Silakan pilih <b>ID Tujuan Pembelajaran (TP)</b> pada panel Konfigurasi di atas untuk menampilkan hasil.
                    </p>
                </div>
            ) : loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 size={40} className="text-indigo-600 animate-spin mb-4"/>
                    <p className="text-slate-500 font-bold">Sedang mengambil data dari database...</p>
                </div>
            ) : rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-2xl border border-slate-100">
                    <AlertCircle size={40} className="text-slate-300 mb-2"/>
                    <p className="text-slate-400 font-medium">Belum ada data nilai masuk untuk filter ini.</p>
                </div>
            ) : (
                <div className="relative border border-slate-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto custom-scrollbar">
                        {/* Requirement: Font Size 9px */}
                        <table className="w-full text-left whitespace-nowrap" style={{ fontFamily: 'Arial', fontSize: '9px' }}>
                            <thead className="bg-slate-50 font-bold text-slate-600 uppercase sticky top-0 z-20 shadow-sm" style={{ fontSize: '9px' }}>
                                <tr>
                                    <th className="p-3 w-10 text-center border-r border-slate-200 bg-slate-50" rowSpan={2}>No</th>
                                    <th className="p-3 sticky left-0 bg-slate-50 z-30 border-r border-slate-200 min-w-[150px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" rowSpan={2}>Nama Murid</th>
                                    <th className="p-3 border-r border-slate-200 text-center bg-indigo-50 text-indigo-700 w-16 border-b border-indigo-100" rowSpan={2}>Nilai</th>
                                    <th className="p-3 border-r border-slate-200 text-center bg-slate-100 border-b border-slate-200" colSpan={questionsData.length}>Analisis Butir Soal</th>
                                    <th className="p-3 border-r border-slate-200 text-center bg-emerald-50 text-emerald-700 w-24 border-b border-emerald-100" rowSpan={2}>Ketuntasan</th>
                                    <th className="p-3 text-center bg-blue-50 text-blue-700 w-24 border-b border-blue-100" rowSpan={2}>Rekomendasi</th>
                                </tr>
                                <tr>
                                    {questionsData.map((q, idx) => (
                                        <th key={q.id} className="p-2 text-center w-10 min-w-[40px] border-r border-slate-100 bg-white" title={q.text_soal}>
                                            {idx + 1}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {rows.map((d, i) => (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-2 text-center text-slate-500 border-r border-slate-100">{i + 1}</td>
                                        <td className="p-2 font-bold text-slate-700 sticky left-0 bg-white border-r border-slate-100 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] truncate max-w-[150px]">
                                            {d.nama}
                                            <div className="text-[9px] text-slate-400 font-normal">{d.username}</div>
                                        </td>
                                        <td className="p-2 font-black text-center text-indigo-600 bg-indigo-50/20 border-r border-slate-100">{d.score}</td>
                                        
                                        {questionsData.map(q => {
                                            const val = d.ansMap[q.id];
                                            let cellClass = "bg-slate-50 text-slate-300"; 
                                            if (val === 1) cellClass = "bg-emerald-100 text-emerald-700";
                                            else if (val === 0) cellClass = "bg-rose-100 text-rose-700";
                                            return (
                                                <td key={q.id} className={`p-1 text-center font-bold border-r border-slate-50 w-10 min-w-[40px] ${cellClass}`}>
                                                    {val === 1 ? '1' : val === 0 ? '0' : '-'}
                                                </td>
                                            );
                                        })}

                                        <td className={`p-2 text-center font-bold text-[9px] border-r border-slate-100 ${d.isTuntas ? 'text-emerald-600 bg-emerald-50/20' : 'text-rose-600 bg-rose-50/20'}`}>
                                            {d.ketuntasan}
                                        </td>
                                        <td className={`p-2 text-center font-bold text-[9px] ${d.isTuntas ? 'text-blue-600' : 'text-orange-600'}`}>
                                            {d.rekomendasi}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-50 font-bold text-slate-600 text-[9px] shadow-[0_-2px_5px_rgba(0,0,0,0.05)]">
                                <tr className="border-t border-slate-200">
                                    <td colSpan={3} className="p-2 text-right border-r border-slate-200">Jumlah Benar</td>
                                    {questionsData.map(q => <td key={q.id} className="p-2 text-center border-r border-slate-200">{questionStats[q.id].correct}</td>)}
                                    <td colSpan={2} className="bg-slate-100"></td>
                                </tr>
                                <tr className="border-t border-slate-200">
                                    <td colSpan={3} className="p-2 text-right border-r border-slate-200">Jumlah Salah</td>
                                    {questionsData.map(q => <td key={q.id} className="p-2 text-center border-r border-slate-200 text-rose-500">{questionStats[q.id].total - questionStats[q.id].correct}</td>)}
                                    <td colSpan={2} className="bg-slate-100"></td>
                                </tr>
                                <tr className="border-t border-slate-200">
                                    <td colSpan={3} className="p-2 text-right border-r border-slate-200">Prosentase Benar</td>
                                    {questionsData.map(q => {
                                        const percent = questionStats[q.id].total > 0 ? Math.round((questionStats[q.id].correct / questionStats[q.id].total) * 100) : 0;
                                        return <td key={q.id} className="p-2 text-center border-r border-slate-200">{percent}%</td>
                                    })}
                                    <td colSpan={2} className="bg-slate-100"></td>
                                </tr>
                                <tr className="border-t border-slate-200 bg-slate-100">
                                    <td colSpan={3} className="p-2 text-right border-r border-slate-200">Tingkat Kesukaran</td>
                                    {questionsData.map(q => {
                                        const percent = questionStats[q.id].total > 0 ? Math.round((questionStats[q.id].correct / questionStats[q.id].total) * 100) : 0;
                                        let label = "Sd", color = "text-blue-600";
                                        if (percent > 70) { label = "M"; color = "text-emerald-600"; }
                                        else if (percent < 30) { label = "S"; color = "text-rose-600"; }
                                        return <td key={q.id} className={`p-2 text-center border-r border-slate-200 ${color}`}>{label}</td>
                                    })}
                                    <td colSpan={2} className="bg-slate-100"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnalisisTab;
