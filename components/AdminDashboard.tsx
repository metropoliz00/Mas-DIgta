
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Home, LogOut, Menu, Monitor, Group, Clock, Printer, List, Calendar, Key, FileQuestion, LayoutDashboard, BarChart3, Award, RefreshCw, X, CreditCard, Bell, CheckCircle2, ChevronRight, ChevronLeft, Loader2, Search, Target, UserCog, ClipboardList, User as UserIcon, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types';
import OverviewTab from './admin/OverviewTab';
import AturGelombangTab from './admin/AturGelombangTab';
import KelompokTesTab from './admin/KelompokTesTab';
import AturSesiTab from './admin/AturSesiTab';
import CetakAbsensiTab from './admin/CetakAbsensiTab';
import CetakKartuTab from './admin/CetakKartuTab';
import RekapTab from './admin/RekapTab';
import RankingTab from './admin/RankingTab';
import AnalisisTab from './admin/AnalisisTab';
import StatusTesTab from './admin/StatusTesTab';
import DaftarPesertaTab from './admin/DaftarPesertaTab';
import RilisTokenTab from './admin/RilisTokenTab';
import BankSoalTab from './admin/BankSoalTab';
import TujuanPembelajaranTab from './admin/TujuanPembelajaranTab';
import KonfigurasiTab from './admin/KonfigurasiTab';

interface AdminDashboardProps {
    user: User;
    onLogout: () => void;
    onSwitchUser: (user: User) => void; // New Prop for User Switching
}

type TabType = 'overview' | 'rekap' | 'analisis' | 'ranking' | 'bank_soal' | 'data_user' | 'data_admin' | 'status_tes' | 'kelompok_tes' | 'rilis_token' | 'atur_sesi' | 'atur_gelombang' | 'cetak_absensi' | 'cetak_kartu' | 'tujuan_pembelajaran' | 'konfigurasi';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout, onSwitchUser }) => {
  const [activeTab, setActiveTab] = useState<TabType>(() => (localStorage.getItem('cbt_admin_tab') as TabType) || 'overview');
  const [dashboardData, setDashboardData] = useState<any>({ students: [], questionsMap: {}, totalUsers: 0, token: 'TOKEN', duration: 60, maxQuestions: 0, kktp: 75, statusCounts: { OFFLINE: 0, LOGGED_IN: 0, WORKING: 0, FINISHED: 0 }, activityFeed: [], allUsers: [], schedules: [] });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentUserState, setCurrentUserState] = useState<User>(user);
  
  // App Config for Logo
  const [appConfig, setAppConfig] = useState<Record<string, string>>({});

  // Collapsible Menu State
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
      'ujian': true,
      'user': true,
      'data': true,
      'cetak': true
  });

  const toggleGroup = (group: string) => {
      setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };
  
  const handleTabChange = (tab: TabType) => { setActiveTab(tab); localStorage.setItem('cbt_admin_tab', tab); setIsSidebarOpen(false); };
  
  const fetchData = async () => {
    setIsRefreshing(true);
    try {
        const data = await api.getDashboardData();
        setDashboardData(data);
        const config = await api.getAppConfig();
        setAppConfig(config);
    } catch (e) { console.error(e); } finally { setLoading(false); setIsRefreshing(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const navButtonClass = (tab: TabType) => `
    flex items-center ${isCollapsed ? 'justify-center px-0' : 'justify-start px-4'} w-full py-3 my-1.5 rounded-xl font-bold transition-all duration-200 relative group
    ${!isCollapsed ? 'text-[13px] tracking-wide' : ''}
    ${activeTab === tab 
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
        : 'text-slate-500 hover:text-slate-900 hover:bg-white hover:shadow-sm'
    }
  `;

  // Helper for Group Header
  const GroupHeader = ({ id, label }: { id: string, label: string }) => (
      !isCollapsed ? (
        <button 
            onClick={() => toggleGroup(id)} 
            className="flex items-center justify-between w-full px-4 mt-6 mb-2 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors text-left"
        >
            <span>{label}</span>
            {openGroups[id] ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
        </button>
      ) : (
        <div className="h-px bg-slate-200 mx-4 my-4" title={label}></div>
      )
  );

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans overflow-hidden">
      {isSidebarOpen && <div className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>}
      
      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 bg-[#f8fafc] border-r border-slate-200 flex flex-col transition-all duration-300 ease-in-out md:translate-x-0 ${isSidebarOpen ? 'translate-x-0 w-72 bg-white' : '-translate-x-full md:static'} ${isCollapsed ? 'md:w-24' : 'md:w-72'}`}>
        <div className={`p-6 flex items-center ${isCollapsed ? 'justify-center flex-col gap-6' : 'justify-between'}`}>
            <div className={`flex items-center gap-3 ${isCollapsed ? 'hidden' : ''}`}>
                <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center text-white font-black text-xl shadow-[0_10px_20px_-5px_rgba(99,102,241,0.3)] overflow-hidden border-2 border-white relative shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-200"></div>
                    {appConfig['LOGO_SEKOLAH'] ? (
                        <img src={appConfig['LOGO_SEKOLAH']} className="w-full h-full object-contain p-1 relative z-10" alt="Logo" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center relative z-10">M</div>
                    )}
                </div>
                <div className="flex flex-col overflow-hidden">
                    <h1 className="font-black text-2xl text-slate-800 tracking-tighter leading-none">
                        MAS <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">DIGTA</span>
                    </h1>
                    <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap mt-0.5 tracking-widest uppercase">
                        Digital Assessment
                    </span>
                </div>
            </div>
            
            {/* Logo when collapsed */}
            <div className={`${isCollapsed ? 'block' : 'hidden'} w-10 h-10 bg-white rounded-xl flex items-center justify-center text-white font-black text-xl shadow-md overflow-hidden border-2 border-white relative`}>
                <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-200"></div>
                {appConfig['LOGO_SEKOLAH'] ? (
                    <img src={appConfig['LOGO_SEKOLAH']} className="w-full h-full object-contain p-1 relative z-10" alt="Logo" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center relative z-10">M</div>
                )}
            </div>
            
            <button onClick={() => setIsCollapsed(!isCollapsed)} className="hidden md:flex text-slate-400 hover:text-indigo-600 transition-colors p-2 hover:bg-slate-100 rounded-lg justify-center"><Menu size={20}/></button>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400"><X size={22}/></button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 space-y-1 custom-scrollbar pb-10">
             <button onClick={() => handleTabChange('overview')} className={navButtonClass('overview')} title={isCollapsed ? "Dashboard" : ""}>
                 <Home size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> 
                 {!isCollapsed && <span>Dashboard</span>}
             </button>
             
             {/* GROUP: UJIAN */}
             <GroupHeader id="ujian" label="Ujian" />
             {(openGroups['ujian'] || isCollapsed) && (
                 <div className={!isCollapsed ? "pl-2 border-l border-slate-200 ml-3 space-y-1" : "space-y-1"}>
                    <button onClick={() => handleTabChange('status_tes')} className={navButtonClass('status_tes')} title="Live Status">
                        <Monitor size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Live Status</span>}
                    </button>
                    <button onClick={() => handleTabChange('rilis_token')} className={navButtonClass('rilis_token')} title="Token & Timer">
                        <Key size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Token & Timer</span>}
                    </button>
                    <button onClick={() => handleTabChange('kelompok_tes')} className={navButtonClass('kelompok_tes')} title="Set Ujian Aktif">
                        <Group size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Set Ujian Aktif</span>}
                    </button>
                    <button onClick={() => handleTabChange('atur_sesi')} className={navButtonClass('atur_sesi')} title="Atur Sesi">
                        <Clock size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Atur Sesi</span>}
                    </button>
                    {currentUserState.role === 'admin' && (
                        <button onClick={() => handleTabChange('atur_gelombang')} className={navButtonClass('atur_gelombang')} title="Atur Gelombang">
                            <Calendar size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Atur Gelombang</span>}
                        </button>
                    )}
                 </div>
             )}
             
             {/* GROUP: MANAJEMEN USER */}
             {(currentUserState.role === 'admin' || currentUserState.role === 'Guru') && (
                 <>
                    <GroupHeader id="user" label="Manajemen User" />
                    {(openGroups['user'] || isCollapsed) && (
                        <div className={!isCollapsed ? "pl-2 border-l border-slate-200 ml-3 space-y-1" : "space-y-1"}>
                            <button onClick={() => handleTabChange('data_user')} className={navButtonClass('data_user')} title="Data Siswa">
                                <List size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Data Siswa</span>}
                            </button>
                            {currentUserState.role === 'admin' && (
                                <button onClick={() => handleTabChange('data_admin')} className={navButtonClass('data_admin')} title="Data Admin & Guru">
                                    <UserCog size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Data Admin & Guru</span>}
                                </button>
                            )}
                        </div>
                    )}
                 </>
             )}

             {/* GROUP: DATA & LAPORAN */}
             {(currentUserState.role === 'admin' || currentUserState.role === 'Guru') && (
                 <>
                    <GroupHeader id="data" label="Data & Laporan" />
                    {(openGroups['data'] || isCollapsed) && (
                        <div className={!isCollapsed ? "pl-2 border-l border-slate-200 ml-3 space-y-1" : "space-y-1"}>
                            {currentUserState.role === 'admin' && (
                                <>
                                <button onClick={() => handleTabChange('tujuan_pembelajaran')} className={navButtonClass('tujuan_pembelajaran')} title="Tujuan Pembelajaran">
                                    <Target size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Tujuan Pembelajaran</span>}
                                </button>
                                <button onClick={() => handleTabChange('bank_soal')} className={navButtonClass('bank_soal')} title="Bank Soal">
                                    <FileQuestion size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Bank Soal</span>}
                                </button>
                                </>
                            )}
                            
                            {/* Rekap & Analisis now available for Guru */}
                            <button onClick={() => handleTabChange('rekap')} className={navButtonClass('rekap')} title="Rekap Nilai">
                                <LayoutDashboard size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Rekap Nilai</span>}
                            </button>
                            <button onClick={() => handleTabChange('analisis')} className={navButtonClass('analisis')} title="Analisis Soal">
                                <BarChart3 size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Analisis Soal</span>}
                            </button>
                            
                            {currentUserState.role === 'admin' && (
                                <button onClick={() => handleTabChange('ranking')} className={navButtonClass('ranking')} title="Peringkat">
                                    <Award size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Peringkat</span>}
                                </button>
                            )}
                            
                            <button onClick={() => handleTabChange('konfigurasi')} className={navButtonClass('konfigurasi')} title="Konfigurasi">
                                <Settings size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Konfigurasi</span>}
                            </button>
                        </div>
                    )}
                 </>
             )}
             
             {/* GROUP: CETAK */}
             <GroupHeader id="cetak" label="Cetak" />
             {(openGroups['cetak'] || isCollapsed) && (
                 <div className={!isCollapsed ? "pl-2 border-l border-slate-200 ml-3 space-y-1" : "space-y-1"}>
                    <button onClick={() => handleTabChange('cetak_kartu')} className={navButtonClass('cetak_kartu')} title="Kartu Peserta">
                        <CreditCard size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Kartu Peserta</span>}
                    </button>
                    <button onClick={() => handleTabChange('cetak_absensi')} className={navButtonClass('cetak_absensi')} title="Absensi">
                        <Printer size={22} className={isCollapsed ? "" : "shrink-0 mr-3"}/> {!isCollapsed && <span>Absensi</span>}
                    </button>
                 </div>
             )}
        </nav>

        <div className="p-4 border-t border-slate-200">
             <div className={`flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 border-l-4 border-l-indigo-500 shadow-sm ${isCollapsed ? 'justify-center' : ''}`}>
                 <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs border-2 border-white shadow-sm shrink-0 overflow-hidden">
                     {currentUserState.photo_url ? (
                         <img src={currentUserState.photo_url} alt="Profile" className="w-full h-full rounded-full object-cover"/>
                     ) : (
                         <UserIcon size={20} className="text-slate-400" />
                     )}
                 </div>
                 {!isCollapsed && (
                     <div className="overflow-hidden flex-1 min-w-0 text-left">
                         <p className="text-xs font-black text-slate-700 truncate">{currentUserState.nama_lengkap || currentUserState.username}</p>
                         <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest truncate">
                             {currentUserState.role === 'admin' ? 'Administrator' : 'GURU'}
                         </p>
                     </div>
                 )}
                 {!isCollapsed && (
                     <button onClick={onLogout} className="ml-auto text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition" title="Logout"><LogOut size={18}/></button>
                 )}
             </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
         <header className="flex justify-between items-center mb-8">
             <div className="flex items-center gap-4">
                 <button onClick={() => setIsSidebarOpen(true)} className="md:hidden bg-white p-2 rounded-lg shadow-sm border border-slate-200"><Menu size={20}/></button>
                 <h2 className="text-2xl font-black text-slate-800 tracking-tight capitalize">
                    {activeTab === 'overview' ? 'Dasbord Utama' : activeTab.replace(/_/g, ' ')}
                 </h2>
             </div>
             <button onClick={fetchData} disabled={isRefreshing} className="bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-2">
                 <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} /> Sync
             </button>
         </header>

         <div className="min-h-[500px]">
            {loading ? (
                <div className="flex flex-col items-center justify-center h-[50vh]">
                    <Loader2 size={40} className="text-indigo-600 animate-spin mb-4"/>
                    <p className="text-slate-400 font-medium">Memuat Data...</p>
                </div>
            ) : (
                <>
                    {activeTab === 'overview' && <OverviewTab dashboardData={dashboardData} currentUserState={currentUserState} />}
                    {activeTab === 'status_tes' && <StatusTesTab currentUser={currentUserState} students={dashboardData.allUsers || []} refreshData={fetchData} />}
                    {activeTab === 'kelompok_tes' && <KelompokTesTab currentUser={currentUserState} students={dashboardData.allUsers || []} refreshData={fetchData} />}
                    {activeTab === 'atur_sesi' && <AturSesiTab currentUser={currentUserState} students={dashboardData.allUsers || []} refreshData={fetchData} isLoading={isRefreshing} />}
                    {activeTab === 'cetak_absensi' && <CetakAbsensiTab currentUser={currentUserState} students={dashboardData.allUsers || []} />}
                    {activeTab === 'cetak_kartu' && <CetakKartuTab currentUser={currentUserState} students={dashboardData.allUsers || []} schedules={dashboardData.schedules || []} />}
                    
                    {/* Separate Tabs based on Mode and Pass onSwitchUser */}
                    {activeTab === 'data_user' && (currentUserState.role === 'admin' || currentUserState.role === 'Guru') && (
                        <DaftarPesertaTab currentUser={currentUserState} onDataChange={fetchData} mode="siswa" onSwitchUser={onSwitchUser} />
                    )}
                    {activeTab === 'data_admin' && currentUserState.role === 'admin' && (
                        <DaftarPesertaTab currentUser={currentUserState} onDataChange={fetchData} mode="staff" onSwitchUser={onSwitchUser} />
                    )}

                    {activeTab === 'atur_gelombang' && currentUserState.role === 'admin' && <AturGelombangTab students={dashboardData.allUsers || []} />}
                    {activeTab === 'rilis_token' && <RilisTokenTab currentUser={currentUserState} token={dashboardData.token} duration={dashboardData.duration} maxQuestions={dashboardData.maxQuestions} kktp={dashboardData.kktp} surveyDuration={0} refreshData={fetchData} isRefreshing={isRefreshing} />}
                    {activeTab === 'bank_soal' && currentUserState.role === 'admin' && <BankSoalTab />}
                    {activeTab === 'tujuan_pembelajaran' && currentUserState.role === 'admin' && <TujuanPembelajaranTab />}
                    
                    {/* REKAP & ANALISIS for both Admin and Guru */}
                    {activeTab === 'rekap' && (currentUserState.role === 'admin' || currentUserState.role === 'Guru') && (
                        <RekapTab students={dashboardData.allUsers} currentUser={currentUserState} />
                    )}
                    {activeTab === 'analisis' && (currentUserState.role === 'admin' || currentUserState.role === 'Guru') && (
                        <AnalisisTab currentUser={currentUserState} students={dashboardData.allUsers} />
                    )}
                    
                    {activeTab === 'ranking' && currentUserState.role === 'admin' && <RankingTab students={dashboardData.allUsers} />}
                    
                    {/* Allow Konfigurasi for both Admin and Guru */}
                    {activeTab === 'konfigurasi' && (currentUserState.role === 'admin' || currentUserState.role === 'Guru') && (
                        <KonfigurasiTab currentUser={currentUserState} />
                    )}
                </>
            )}
         </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
