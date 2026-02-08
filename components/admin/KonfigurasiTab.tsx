
import React, { useState, useEffect } from 'react';
import { Save, Loader2, Building, UserSquare, Calendar, Shield, School, UserCircle, Briefcase, Lock, Upload, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import { User } from '../../types';

const KonfigurasiTab = ({ currentUser }: { currentUser: User }) => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    
    const [formData, setFormData] = useState({
        schoolName: '',
        principalName: '',
        principalNip: '',
        teacherName: '',
        teacherNip: '',
        teacherPosition: '',
        gradeLevel: '', 
        semester: '',   
        academicYear: '',
        logoKabupaten: '', 
        logoSekolah: ''
    });

    const isGuru = currentUser.role === 'Guru';
    // Logic: If user has specific class assigned in DB, lock it.
    const userClass = currentUser.kelas && currentUser.kelas !== '-' ? currentUser.kelas : '';

    useEffect(() => {
        const fetchConfig = async () => {
            setLoading(true);
            try {
                // 1. Fetch Global Config (Defaults & Logos)
                const globalConfig = await api.getAppConfig();
                
                // 2. Fetch User Specific Config (Overrides)
                const userConfig = await api.getUserConfig(currentUser.username);
                
                // Merge Logic
                const mergedConfig = { ...globalConfig, ...userConfig };

                const lockedName = currentUser.nama_lengkap;
                const lockedNip = currentUser.username;
                
                // Auto-generate default position, but allow override from config
                const defaultPosition = currentUser.kelas && currentUser.kelas !== '-' ? `Guru Kelas ${currentUser.kelas}` : 'Guru Kelas';

                setFormData({
                    schoolName: mergedConfig['SCHOOL_NAME'] || '',
                    principalName: mergedConfig['PRINCIPAL_NAME'] || '',
                    principalNip: mergedConfig['PRINCIPAL_NIP'] || '',
                    
                    teacherName: lockedName || mergedConfig['TEACHER_NAME'] || '',
                    teacherNip: lockedNip || mergedConfig['TEACHER_NIP'] || '',
                    // UPDATED: Prioritize saved config, fallback to default
                    teacherPosition: mergedConfig['TEACHER_POSITION'] || defaultPosition,
                    
                    // If user has specific class, force it. Otherwise use config or default '1'
                    gradeLevel: userClass || mergedConfig['GRADE_LEVEL'] || '1',
                    
                    semester: mergedConfig['SEMESTER'] || '1 (Ganjil)',
                    academicYear: mergedConfig['ACADEMIC_YEAR'] || '2025/2026',
                    
                    logoKabupaten: globalConfig['LOGO_KABUPATEN'] || '',
                    logoSekolah: globalConfig['LOGO_SEKOLAH'] || ''
                });
            } catch(e) {
                console.error("Failed to load config", e);
            } finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, [currentUser, userClass]);

    // Helper to resize image to Base64 (Max Height 150px to save storage)
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'logoKabupaten' | 'logoSekolah') => {
        if (isGuru) return; // Security check
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 2 * 1024 * 1024) { alert("Ukuran file maksimal 2MB"); return; }
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const maxHeight = 150; // Limit height for logos
                    
                    let width = img.width;
                    let height = img.height;
                    
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                    
                    canvas.width = Math.floor(width);
                    canvas.height = Math.floor(height);
                    
                    if (ctx) { 
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height); 
                        const dataUrl = canvas.toDataURL('image/png', 0.8); 
                        setFormData(prev => ({ ...prev, [field]: dataUrl })); 
                    }
                };
                img.src = event.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // 1. SAVE TO GLOBAL CONFIG (Sekolah & Logos) - Only Admin
            if (!isGuru) {
                const globalPayload = {
                    'SCHOOL_NAME': formData.schoolName,
                    'LOGO_KABUPATEN': formData.logoKabupaten,
                    'LOGO_SEKOLAH': formData.logoSekolah,
                    'ACADEMIC_YEAR': formData.academicYear
                };
                await api.saveBatchConfig(globalPayload);
            }

            // 2. SAVE TO USER CONFIG (Personal Data)
            // Prepare User Payload
            const userPayload: Record<string, string> = {
                'TEACHER_NAME': formData.teacherName,
                'TEACHER_NIP': formData.teacherNip,
                'TEACHER_POSITION': formData.teacherPosition,
                'GRADE_LEVEL': formData.gradeLevel,
                'SEMESTER': formData.semester,
            };

            // If Admin, they can also set Principal info for themselves/Global context if implemented
            // If Guru, they cannot change Principal info, so we don't save it to their config to allow Global fallback
            if (!isGuru) {
                userPayload['PRINCIPAL_NAME'] = formData.principalName;
                userPayload['PRINCIPAL_NIP'] = formData.principalNip;
            }

            await api.saveUserConfig(currentUser.username, userPayload);
            
            alert(isGuru ? "Konfigurasi guru berhasil disimpan." : "Konfigurasi instansi berhasil disimpan.");
        } catch(e) {
            console.error(e);
            alert("Gagal menyimpan konfigurasi.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <Loader2 size={40} className="text-indigo-600 animate-spin mb-4"/>
                <p className="text-slate-500 font-bold">Memuat Konfigurasi...</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 fade-in p-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6">
                <div>
                    <h3 className="font-black text-2xl text-slate-800 flex items-center gap-3">
                        <Shield size={28} className="text-indigo-600"/> Konfigurasi {isGuru ? 'Guru' : 'Instansi'}
                    </h3>
                    <p className="text-slate-500 font-medium text-sm mt-1">
                        {isGuru ? 'Pengaturan data laporan dan identitas guru.' : 'Pengaturan data sekolah, logo, dan pimpinan.'}
                    </p>
                </div>
                <button 
                    onClick={handleSave} 
                    disabled={saving} 
                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition flex items-center gap-2 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {saving ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>} Simpan Perubahan
                </button>
            </div>

            <div className="space-y-8">
                
                {/* Section 0: LOGO UPLOAD */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 relative overflow-hidden">
                    {isGuru && (
                        <div className="absolute top-0 right-0 bg-slate-200 text-slate-500 text-[10px] font-bold px-3 py-1 rounded-bl-xl border-l border-b border-slate-300 flex items-center gap-1">
                            <Lock size={10} /> Read Only
                        </div>
                    )}
                    <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                        <ImageIcon size={18} className="text-purple-500"/> Logo Instansi
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Logo Kabupaten */}
                        <div className="flex flex-col items-center gap-3">
                            <span className="text-xs font-bold text-slate-400 uppercase">Logo Kabupaten (Kiri)</span>
                            <div className={`relative w-32 h-32 bg-white border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center overflow-hidden group ${isGuru ? 'opacity-80' : ''}`}>
                                {formData.logoKabupaten ? (
                                    <img src={formData.logoKabupaten} className="w-full h-full object-contain p-2" alt="Kabupaten" />
                                ) : (
                                    <ImageIcon className="text-slate-300" size={32}/>
                                )}
                                {!isGuru && (
                                    <label className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-xs font-bold">
                                        <Upload size={20} className="mb-1"/> Ubah
                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'logoKabupaten')} />
                                    </label>
                                )}
                            </div>
                        </div>

                        {/* Logo Sekolah */}
                        <div className="flex flex-col items-center gap-3">
                            <span className="text-xs font-bold text-slate-400 uppercase">Logo Sekolah (Kanan / Login)</span>
                            <div className={`relative w-32 h-32 bg-white border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center overflow-hidden group ${isGuru ? 'opacity-80' : ''}`}>
                                {formData.logoSekolah ? (
                                    <img src={formData.logoSekolah} className="w-full h-full object-contain p-2" alt="Sekolah" />
                                ) : (
                                    <School className="text-slate-300" size={32}/>
                                )}
                                {!isGuru && (
                                    <label className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-xs font-bold">
                                        <Upload size={20} className="mb-1"/> Ubah
                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'logoSekolah')} />
                                    </label>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 1: Data Sekolah */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 relative overflow-hidden">
                    {isGuru && (
                        <div className="absolute top-0 right-0 bg-slate-200 text-slate-500 text-[10px] font-bold px-3 py-1 rounded-bl-xl border-l border-b border-slate-300 flex items-center gap-1">
                            <Lock size={10} /> Data Terkunci
                        </div>
                    )}
                    <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                        <School size={18} className="text-blue-500"/> Data Sekolah & Akademik
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nama Sekolah</label>
                            <div className="relative">
                                <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                <input 
                                    type="text" 
                                    className={`w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-all ${isGuru ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`} 
                                    placeholder="Contoh: UPT SDN REMEN 2"
                                    value={formData.schoolName}
                                    onChange={e => setFormData({...formData, schoolName: e.target.value})}
                                    readOnly={isGuru}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Tahun Ajaran</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                <input 
                                    type="text" 
                                    className={`w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-all ${isGuru ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`} 
                                    placeholder="Contoh: 2025/2026"
                                    value={formData.academicYear}
                                    onChange={e => setFormData({...formData, academicYear: e.target.value})}
                                    readOnly={isGuru}
                                />
                            </div>
                        </div>
                        
                        {/* SPLIT CLASS & SEMESTER */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Kelas</label>
                                <input 
                                    type="text"
                                    className={`w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-all text-center ${!!userClass ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'bg-white focus:border-indigo-500'}`}
                                    placeholder="1, 2, 3..."
                                    value={formData.gradeLevel}
                                    onChange={e => setFormData({...formData, gradeLevel: e.target.value})}
                                    readOnly={!!userClass}
                                />
                                {!!userClass && <span className="text-[9px] text-slate-400 mt-1 block">*Otomatis dari Database</span>}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Semester</label>
                                <select 
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:border-indigo-500 outline-none transition-all bg-white cursor-pointer appearance-none"
                                    value={formData.semester}
                                    onChange={e => setFormData({...formData, semester: e.target.value})}
                                >
                                    <option>1 (Ganjil)</option>
                                    <option>2 (Genap)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 2: Data Kepala Sekolah */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 relative overflow-hidden">
                    {isGuru && (
                        <div className="absolute top-0 right-0 bg-slate-200 text-slate-500 text-[10px] font-bold px-3 py-1 rounded-bl-xl border-l border-b border-slate-300 flex items-center gap-1">
                            <Lock size={10} /> Data Terkunci
                        </div>
                    )}
                    <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                        <UserSquare size={18} className="text-emerald-500"/> Kepala Sekolah
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nama Kepala Sekolah</label>
                            <div className="relative">
                                <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                <input 
                                    type="text" 
                                    className={`w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-all ${isGuru ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`} 
                                    placeholder="Nama Lengkap & Gelar"
                                    value={formData.principalName}
                                    onChange={e => setFormData({...formData, principalName: e.target.value})}
                                    readOnly={isGuru}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">NIP Kepala Sekolah</label>
                            <div className="relative">
                                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                <input 
                                    type="text" 
                                    className={`w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-all ${isGuru ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`} 
                                    placeholder="NIP"
                                    value={formData.principalNip}
                                    onChange={e => setFormData({...formData, principalNip: e.target.value})}
                                    readOnly={isGuru}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 3: Data Guru (With Auto-Lock Logic) */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 relative overflow-hidden">
                    {(currentUser.nama_lengkap || currentUser.username) && (
                        <div className="absolute top-0 right-0 bg-amber-100 text-amber-700 text-[10px] font-bold px-3 py-1 rounded-bl-xl border-l border-b border-amber-200 flex items-center gap-1">
                            <Lock size={10} /> Data Terkunci (Sesuai Login)
                        </div>
                    )}
                    <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                        <UserSquare size={18} className="text-amber-500"/> Guru Kelas / Mapel
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Jabatan Guru</label>
                            <div className="relative">
                                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                <input 
                                    type="text" 
                                    // UPDATED: Allow editing for Teacher Position even if user has a class assigned
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-all bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                                    placeholder="Contoh: Guru Kelas 1 atau Guru PAI"
                                    value={formData.teacherPosition}
                                    onChange={e => setFormData({...formData, teacherPosition: e.target.value})}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nama Guru</label>
                            <div className="relative">
                                <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                <input 
                                    type="text" 
                                    className={`w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-all ${!!currentUser.nama_lengkap ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`}
                                    placeholder="Nama Lengkap & Gelar"
                                    value={formData.teacherName}
                                    onChange={e => setFormData({...formData, teacherName: e.target.value})}
                                    disabled={!!currentUser.nama_lengkap}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">NIP Guru</label>
                            <div className="relative">
                                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                <input 
                                    type="text" 
                                    className={`w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-all ${!!currentUser.username ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`}
                                    placeholder="NIP"
                                    value={formData.teacherNip}
                                    onChange={e => setFormData({...formData, teacherNip: e.target.value})}
                                    disabled={!!currentUser.username}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KonfigurasiTab;
