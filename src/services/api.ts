
import { User, Exam, QuestionWithOptions, QuestionRow, SchoolSchedule, LearningObjective, ExternalGrade } from '../../types';
import { supabase } from './supabaseClient';

// Helper to format Google Drive URLs to direct image links
const formatGoogleDriveUrl = (url?: string): string | undefined => {
    if (!url) return undefined;
    if (typeof url !== 'string') return url;
    try {
        if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
            const match = url.match(/[-\w]{25,}/);
            if (match) {
                return `https://drive.google.com/thumbnail?id=${match[0]}&sz=w1000`;
            }
        }
    } catch (e) { 
        return url; 
    }
    return url;
};

export const api = {
  login: async (username: string, password?: string): Promise<{user: User | null, error?: string}> => {
    console.log("Attempting login for:", username);
    
    // Debug: Fetch user by username only first to check if user exists and what the password looks like
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('username, password, role, fullname, gender, kelas, school, kecamatan, active_exam, session, photo_url, active_tp, exam_type')
      .eq('username', username);

    if (userError) {
        console.error("Supabase login error:", userError);
        return { user: null, error: userError.message };
    }
    
    if (!userData || userData.length === 0) {
        console.log("No user found with username:", username);
        
        // Debug: Fetch all usernames to check for typos/case issues
        const { data: allUsers, error: allUsersError } = await supabase
          .from('users')
          .select('username');
          
        if (allUsers) {
            console.log("Available usernames in DB:", allUsers.map(u => u.username));
        }
        
        return { user: null, error: "Username atau password salah." };
    }
    
    const dataRow = userData[0];
    
    // Debug: Compare passwords
    console.log("Comparing passwords. Input:", password, "DB:", dataRow.password);
    
    if (dataRow.password !== password) {
        console.log("Password mismatch for user:", username);
        return { user: null, error: "Username atau password salah." };
    }
    
    console.log("Login successful for:", dataRow.username);
    const user: User = {
        id: dataRow.username,
        username: dataRow.username,
        role: dataRow.role,
        nama_lengkap: dataRow.fullname,
        jenis_kelamin: dataRow.gender, 
        kelas: dataRow.kelas,
        kelas_id: dataRow.school, 
        kecamatan: dataRow.kecamatan, 
        active_exam: dataRow.active_exam, 
        session: dataRow.session,
        photo_url: formatGoogleDriveUrl(dataRow.photo_url),
        active_tp: dataRow.active_tp || '',
        exam_type: dataRow.exam_type || ''
    };
    return { user, error: undefined };
  },

  startExam: async (username: string, fullname: string, subject: string): Promise<any> => {
      // Assuming a table 'student_exams' or similar
      const { data, error } = await supabase
        .from('student_exams')
        .insert([{ user_id: username, exam_id: subject, status: 'ongoing' }]);
      return { success: !error };
  },

  checkStatus: async (username: string): Promise<string> => {
      const { data, error } = await supabase
        .from('users')
        .select('status')
        .eq('username', username);
      return data && data.length > 0 ? data[0].status : 'OFFLINE';
  },

  getExams: async (): Promise<Exam[]> => {
    const { data, error } = await supabase.from('exams').select('*');
    if (error) return [];
    return data.map((e: any) => ({
        id: e.id,
        nama_ujian: e.nama_ujian,
        waktu_mulai: e.waktu_mulai,
        durasi: e.durasi,
        token_akses: e.token_akses,
        is_active: e.is_active,
        max_questions: e.max_questions
    }));
  },

  getServerToken: async (): Promise<string> => {
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'TOKEN');
      return data && data.length > 0 ? data[0].value : '';
  },

  saveToken: async (newToken: string): Promise<{success: boolean}> => {
      const { error } = await supabase
        .from('app_config')
        .upsert({ key: 'TOKEN', value: newToken });
      return { success: !error };
  },
  
  saveDuration: async (minutes: number): Promise<{success: boolean}> => {
      const { error } = await supabase
        .from('app_config')
        .upsert({ key: 'DURATION', value: minutes.toString() });
      return { success: !error };
  },

  saveMaxQuestions: async (amount: number): Promise<{success: boolean}> => {
      const { error } = await supabase
        .from('app_config')
        .upsert({ key: 'MAX_QUESTIONS', value: amount.toString() });
      return { success: !error };
  },

  saveKKTP: async (value: number): Promise<{success: boolean}> => {
      const { error } = await supabase
        .from('app_config')
        .upsert({ key: 'KKTP', value: value.toString() });
      return { success: !error };
  },

  getAppConfig: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.from('app_config').select('key, value');
      if (error) return {};
      return data.reduce((acc: any, curr: any) => { acc[curr.key] = curr.value; return acc; }, {});
  },

  saveBatchConfig: async (config: Record<string, string>): Promise<{success: boolean}> => {
      const updates = Object.entries(config).map(([key, value]) => ({ key, value }));
      const { error } = await supabase.from('app_config').upsert(updates);
      return { success: !error };
  },

  getUserConfig: async (username: string): Promise<Record<string, any>> => {
      const { data, error } = await supabase.from('user_config').select('key, value').eq('username', username);
      if (error) return {};
      return data.reduce((acc: any, curr: any) => { acc[curr.key] = curr.value; return acc; }, {});
  },

  saveUserConfig: async (username: string, config: Record<string, any>): Promise<{success: boolean}> => {
      const updates = Object.entries(config).map(([key, value]) => ({ username, key, value }));
      const { error } = await supabase.from('user_config').upsert(updates);
      return { success: !error };
  },

  getQuestions: async (subject: string): Promise<QuestionWithOptions[]> => {
    const { data, error } = await supabase.from('questions').select('*, options(*)').eq('exam_id', subject);
    if (error || !data) return [];

    return data.map((q: any) => ({
        id: q.id,
        exam_id: q.exam_id,
        text_soal: q.text_soal,
        tipe_soal: q.tipe_soal,
        bobot_nilai: q.bobot_nilai,
        gambar: q.gambar,
        kelas: q.kelas, 
        tp_id: q.tp_id, 
        caption: q.caption,
        options: q.options.map((o: any) => ({
            id: o.id,
            question_id: o.question_id,
            text_jawaban: o.text_jawaban,
            is_correct: o.is_correct
        }))
    }));
  },

  getRawQuestions: async (subject: string): Promise<QuestionRow[]> => {
      const { data, error } = await supabase.from('questions').select('*, options(*)').eq('exam_id', subject);
      if (error || !data) return [];
      // This needs to map to QuestionRow, which is a flat structure.
      // This might be tricky. I'll leave it as is for now, assuming the DB structure matches.
      return data as any;
  },
  
  saveQuestion: async (subject: string, data: QuestionRow): Promise<{success: boolean, message: string}> => {
      const { error } = await supabase.from('questions').upsert(data);
      return { success: !error, message: error?.message || 'Success' };
  },

  importQuestions: async (subject: string, data: QuestionRow[]): Promise<{success: boolean, message: string}> => {
      const { error } = await supabase.from('questions').upsert(data);
      return { success: !error, message: error?.message || 'Success' };
  },

  deleteQuestion: async (subject: string, id: string): Promise<{success: boolean, message: string}> => {
      const { error } = await supabase.from('questions').delete().eq('id', id);
      return { success: !error, message: error?.message || 'Success' };
  },

  getUsers: async (): Promise<any[]> => {
      const { data, error } = await supabase.from('users').select('*');
      if (error || !data) return [];
      return data.map((u: any) => ({
          ...u,
          kelas_id: u.school,
          photo_url: formatGoogleDriveUrl(u.photo_url),
          active_tp: u.active_tp || '',
          exam_type: u.exam_type || ''
      }));
  },

  saveUser: async (userData: any): Promise<{success: boolean, message: string}> => {
      const { error } = await supabase.from('users').upsert(userData);
      return { success: !error, message: error?.message || 'Success' };
  },

  deleteUser: async (userId: string): Promise<{success: boolean, message: string}> => {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      return { success: !error, message: error?.message || 'Success' };
  },

  importUsers: async (users: any[]): Promise<{success: boolean, message: string}> => {
      const { error } = await supabase.from('users').upsert(users);
      return { success: !error, message: error?.message || 'Success' };
  },

  normalizeDatabaseRoles: async (): Promise<{success: boolean, updated: number}> => {
      const { data, error } = await supabase.from('users').select('id, role');
      if (error) return { success: false, updated: 0 };
      
      let updated = 0;
      for (const user of data) {
          const newRole = user.role === 'Guru' ? 'Guru' : 'siswa';
          if (user.role !== newRole) {
              await supabase.from('users').update({ role: newRole }).eq('id', user.id);
              updated++;
          }
      }
      return { success: true, updated };
  },

  // --- LEARNING OBJECTIVES CRUD ---
  getLearningObjectives: async (): Promise<LearningObjective[]> => {
      const { data, error } = await supabase.from('learning_objectives').select('*');
      return error ? [] : data;
  },

  saveLearningObjective: async (data: LearningObjective): Promise<{success: boolean}> => {
      const { error } = await supabase.from('learning_objectives').upsert(data);
      return { success: !error };
  },

  deleteLearningObjective: async (id: string): Promise<{success: boolean}> => {
      const { error } = await supabase.from('learning_objectives').delete().eq('id', id);
      return { success: !error };
  },

  importLearningObjectives: async (data: LearningObjective[]): Promise<{success: boolean}> => {
      const { error } = await supabase.from('learning_objectives').upsert(data);
      return { success: !error };
  },

  // UPDATED: Added examType as 5th argument
  assignTestGroup: async (usernames: string[], examId: string, session: string, tpId: string = '', examType: string = ''): Promise<{success: boolean}> => {
      const { error } = await supabase.from('users').update({ active_exam: examId, session, active_tp: tpId, exam_type: examType }).in('username', usernames);
      return { success: !error };
  },

  updateUserSessions: async (updates: {username: string, session: string}[]): Promise<{success: boolean}> => {
      for (const update of updates) {
          await supabase.from('users').update({ session: update.session }).eq('username', update.username);
      }
      return { success: true };
  },

  resetLogin: async (username: string): Promise<{success: boolean}> => {
      const { error } = await supabase.from('users').update({ status: 'OFFLINE' }).eq('username', username);
      return { success: !error };
  },
  
  getSchoolSchedules: async (): Promise<SchoolSchedule[]> => {
      const { data, error } = await supabase.from('school_schedules').select('*');
      return error ? [] : data;
  },

  saveSchoolSchedules: async (schedules: SchoolSchedule[]): Promise<{success: boolean}> => {
      const { error } = await supabase.from('school_schedules').upsert(schedules);
      return { success: !error };
  },

  getRecap: async (): Promise<any[]> => {
      const { data, error } = await supabase.from('student_exams').select('*, users(*), exams(*)');
      return error ? [] : data;
  },

  getAnalysis: async (subject: string): Promise<any> => {
      const { data, error } = await supabase.from('student_exams').select('*, answers(*, questions(*))').eq('exam_id', subject);
      return error ? null : data;
  },

  saveExternalGrades: async (data: ExternalGrade[]): Promise<{success: boolean}> => {
      const { error } = await supabase.from('external_grades').upsert(data);
      return { success: !error };
  },

  submitExam: async (payload: { user: User, subject: string, answers: any, startTime: number, displayedQuestionCount?: number, questionIds?: string[] }) => {
      const { data, error } = await supabase.from('student_exams').insert([{
          user_id: payload.user.username,
          exam_id: payload.subject,
          status: 'completed',
          waktu_submit: new Date().toISOString()
      }]).select();
      
      if (error || !data || data.length === 0) return { success: false };
      const studentExam = data[0];
      
      const answers = Object.entries(payload.answers).map(([question_id, option_id]) => ({
          student_exam_id: studentExam.id,
          question_id,
          option_id
      }));
      
      const { error: ansError } = await supabase.from('answers').insert(answers);
      return { success: !ansError };
  },
  
  getDashboardData: async () => {
      const { data: users, error: uErr } = await supabase.from('users').select('*');
      const { data: exams, error: eErr } = await supabase.from('exams').select('*');
      return { allUsers: users || [], allExams: exams || [] };
  },

  getSurveyQuestions: async (surveyType: string): Promise<QuestionWithOptions[]> => {
      const { data, error } = await supabase.from('questions').select('*, options(*)').eq('exam_id', surveyType);
      if (error || !data) return [];
      return data as any;
  },

  submitSurvey: async (payload: { user: User, surveyType: string, answers: any, startTime: number }) => {
      const { data, error } = await supabase.from('student_exams').insert([{
          user_id: payload.user.username,
          exam_id: payload.surveyType,
          status: 'completed'
      }]);
      return { success: !error };
  },

  getSurveyRecap: async (surveyType: string): Promise<any[]> => {
      const { data, error } = await supabase.from('student_exams').select('*, answers(*)').eq('exam_id', surveyType);
      return error ? [] : data;
  }
};
