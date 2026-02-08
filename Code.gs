
// --- CONFIGURATION ---
const SHEET_ADMINS = "Admins"; // Admin & Guru
const SHEET_USERS = "Users";   // Students
const SHEET_CONFIG = "Config";
const SHEET_USER_CONFIGS = "UserConfigs"; // NEW: Per-user settings
const SHEET_RESULTS = "Results";
const SHEET_SURVEY = "SurveyResults";
const SHEET_TP = "LearningObjectives";
const SHEET_SCHEDULES = "SchoolSchedules";
const SHEET_LOGS = "ActivityLogs";

// --- ENTRY POINT ---
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000); // Wait up to 10 seconds
  
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Invalid request" })).setMimeType(ContentService.MimeType.JSON);
    }

    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    const args = params.args || [];
    
    let result;
    
    switch(action) {
      // AUTH & USER MANAGEMENT
      case 'login': result = login(...args); break;
      case 'checkUserStatus': result = checkUserStatus(...args); break;
      case 'getUsers': result = getUsers(); break;
      case 'saveUser': result = saveUser(...args); break;
      case 'deleteUser': result = deleteUser(...args); break;
      case 'importUsers': result = importUsers(...args); break;
      case 'resetLogin': result = resetLogin(...args); break;
      case 'normalizeAllUserRoles': result = normalizeAllUserRoles(); break;
      
      // EXAM CONFIGURATION & FLOW
      case 'getSubjectList': result = getSubjectList(); break;
      case 'getTokenFromConfig': result = getTokenFromConfig(); break;
      case 'startExam': result = startExam(...args); break;
      case 'getQuestionsFromSheet': result = getQuestionsFromSheet(...args); break;
      case 'submitAnswers': result = submitAnswers(...args); break;
      case 'submitSurvey': result = submitSurvey(...args); break;
      
      // ADMIN - QUESTION BANK (BANK SOAL)
      case 'getRawQuestions': result = getRawQuestions(...args); break;
      case 'saveQuestion': result = saveQuestion(...args); break;
      case 'importQuestions': result = importQuestions(...args); break;
      case 'deleteQuestion': result = deleteQuestion(...args); break;
      
      // ADMIN - CONFIG & SCHEDULING
      case 'saveConfig': result = saveConfig(...args); break;
      case 'getAppConfig': result = getAppConfig(); break; 
      case 'saveBatchConfig': result = saveBatchConfig(...args); 
      case 'getUserConfig': result = getUserConfig(...args); // NEW
      case 'saveUserConfig': result = saveUserConfig(...args); // NEW
      case 'assignTestGroup': result = assignTestGroup(...args); break;
      case 'updateUserSessions': result = updateUserSessions(...args); break;
      case 'getSchoolSchedules': result = getSchoolSchedules(); break;
      case 'saveSchoolSchedules': result = saveSchoolSchedules(...args); break;
      
      // ADMIN - LEARNING OBJECTIVES (TP)
      case 'getLearningObjectives': result = getLearningObjectives(); break;
      case 'saveLearningObjective': result = saveLearningObjective(...args); break;
      case 'deleteLearningObjective': result = deleteLearningObjective(...args); break;
      case 'importLearningObjectives': result = importLearningObjectives(...args); break;

      // ADMIN - DASHBOARD & REPORTS
      case 'getDashboardData': result = getDashboardData(); break;
      case 'getRecapData': result = getRecapData(); break;
      case 'getAnalysisData': result = getAnalysisData(...args); break;
      
      default: result = { error: 'Unknown action: ' + action };
    }
    
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString(), stack: err.stack })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    
    if (name === SHEET_USERS) {
      // Added ActiveTP (Col 15) and ExamType (Col 16)
      sheet.appendRow(["ID", "Username", "Password", "Fullname", "Role", "Kelas", "School", "Kecamatan", "Gender", "PhotoURL", "ActiveExam", "Session", "Status", "LastLogin", "ActiveTP", "ExamType"]);
    } else if (name === SHEET_ADMINS) {
      sheet.appendRow(["ID", "Username", "Password", "Fullname", "Role", "Kelas", "School", "Kecamatan", "Gender", "PhotoURL"]);
      sheet.appendRow(["ADM001", "admin", "123456", "Administrator", "admin", "", "Pusat", "Kota", "L", ""]);
    } else if (name === SHEET_CONFIG) {
      sheet.appendRow(["Key", "Value"]);
      sheet.appendRow(["TOKEN", "TOKEN"]);
      sheet.appendRow(["DURATION", "60"]);
      sheet.appendRow(["MAX_QUESTIONS", "0"]);
      sheet.appendRow(["KKTP", "75"]);
    } else if (name === SHEET_USER_CONFIGS) {
      // NEW SHEET FOR PERSONAL CONFIG
      sheet.appendRow(["Username", "ConfigJSON", "LastUpdated"]);
    } else if (name === SHEET_RESULTS) {
      sheet.appendRow(["Timestamp", "Username", "Nama", "Sekolah", "Mapel", "Nilai", "AnalisisJSON", "Durasi"]);
    } else if (name === SHEET_TP) {
      sheet.appendRow(["ID", "Mapel", "Materi", "Kelas", "TujuanPembelajaran"]);
    } else if (name === SHEET_SCHEDULES) {
      sheet.appendRow(["Sekolah", "Gelombang", "TanggalMulai", "TanggalSelesai"]);
    } else if (name === SHEET_LOGS) {
      sheet.appendRow(["Timestamp", "Username", "Action", "Detail"]);
    } else if (name === SHEET_SURVEY) {
      sheet.appendRow(["Timestamp", "Username", "Nama", "Sekolah", "SurveyType", "TotalScore", "Average", "ItemsJSON", "Durasi"]);
    }
  }
  return sheet;
}

function getData(sheetName) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getDisplayValues();
  if (data.length <= 1) return [];
  const headers = data.shift();
  return data.map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function logActivity(username, action, detail) {
  try {
    const sheet = getSheet(SHEET_LOGS);
    sheet.appendRow([new Date().toISOString(), username, action, JSON.stringify(detail)]);
  } catch(e) {}
}

function login(username, password) {
  const normalizedUser = String(username).toLowerCase().trim();
  const cleanPass = String(password).trim();
  const adminSheet = getSheet(SHEET_ADMINS);
  if (adminSheet.getLastRow() <= 1) {
      adminSheet.appendRow(["ADM001", "admin", "123456", "Administrator", "admin", "", "Pusat", "Kota", "L", ""]);
  }
  const adminData = adminSheet.getDataRange().getDisplayValues();
  for (let i = 1; i < adminData.length; i++) {
    if (String(adminData[i][1]).toLowerCase() === normalizedUser && String(adminData[i][2]).trim() === cleanPass) {
       const role = normalizeRole(adminData[i][4]); 
       return {
         success: true,
         user: {
           username: adminData[i][1],
           password: adminData[i][2],
           fullname: adminData[i][3],
           role: role === 'siswa' ? 'Guru' : role, 
           kelas: adminData[i][5], 
           school: adminData[i][6], 
           kecamatan: adminData[i][7],
           gender: adminData[i][8],
           photo_url: adminData[i][9],
           active_exam: '',
           session: ''
         }
       };
    }
  }
  const userSheet = getSheet(SHEET_USERS);
  const userData = userSheet.getDataRange().getDisplayValues();
  for (let i = 1; i < userData.length; i++) {
    if (String(userData[i][1]).toLowerCase() === normalizedUser && String(userData[i][2]).trim() === cleanPass) {
      userSheet.getRange(i + 1, 13).setValue('LOGGED_IN'); 
      userSheet.getRange(i + 1, 14).setValue(new Date().toISOString());
      logActivity(userData[i][1], 'LOGIN', { school: userData[i][6] });
      return {
        success: true,
        user: {
           username: userData[i][1],
           password: userData[i][2],
           fullname: userData[i][3],
           role: normalizeRole(userData[i][4]),
           kelas: userData[i][5],
           school: userData[i][6],
           kecamatan: userData[i][7],
           gender: userData[i][8],
           photo_url: userData[i][9],
           active_exam: userData[i][10],
           session: userData[i][11],
           active_tp: userData[i][14] || '', // Col 15
           exam_type: userData[i][15] || '' // Col 16
        }
      };
    }
  }
  return { success: false, message: 'Invalid credentials' };
}

function checkUserStatus(username) {
  const sheet = getSheet(SHEET_USERS);
  const data = sheet.getDataRange().getDisplayValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).toLowerCase() === String(username).toLowerCase()) {
      return { status: data[i][12] || 'OFFLINE' };
    }
  }
  return { status: 'UNKNOWN' };
}

function resetLogin(username) {
  const sheet = getSheet(SHEET_USERS);
  const data = sheet.getDataRange().getDisplayValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).toLowerCase() === String(username).toLowerCase()) {
      sheet.getRange(i + 1, 13).setValue('OFFLINE'); 
      return { success: true };
    }
  }
  return { success: false };
}

function normalizeRole(rawRole) {
  if (!rawRole) return 'siswa';
  const r = String(rawRole).toLowerCase().replace(/_/g, ' ').trim();
  if (r.includes('admin')) return 'admin';
  if (r.includes('guru') || r.includes('proktor')) return 'Guru';
  return 'siswa';
}

function normalizeAllUserRoles() {
  const adminSheet = getSheet(SHEET_ADMINS);
  const adminData = adminSheet.getDataRange().getValues();
  let updatedCount = 0;
  for (let i = 1; i < adminData.length; i++) {
    const currentRole = adminData[i][4]; 
    const normalized = normalizeRole(currentRole);
    if (currentRole !== normalized) {
      adminSheet.getRange(i + 1, 5).setValue(normalized);
      updatedCount++;
    }
  }
  const userSheet = getSheet(SHEET_USERS);
  const userData = userSheet.getDataRange().getValues();
  for (let i = 1; i < userData.length; i++) {
    const currentRole = userData[i][4]; 
    const normalized = normalizeRole(currentRole);
    if (currentRole !== normalized) {
      userSheet.getRange(i + 1, 5).setValue(normalized);
      updatedCount++;
    }
  }
  return { success: true, updated: updatedCount };
}

function getUsers() {
  const mapUserFromRow = (row, isStudent) => {
      return {
        id: row[0],
        username: row[1],
        password: row[2],
        fullname: row[3],
        role: normalizeRole(row[4]),
        kelas: row[5],
        school: row[6],
        kecamatan: row[7],
        gender: row[8],
        photo_url: row[9],
        active_exam: isStudent ? (row[10] || '') : '',
        session: isStudent ? (row[11] || '') : '',
        status: isStudent ? (row[12] || 'OFFLINE') : 'OFFLINE',
        active_tp: isStudent ? (row[14] || '') : '', // Col 15
        exam_type: isStudent ? (row[15] || '') : '' // Col 16
      };
  };
  const adminSheet = getSheet(SHEET_ADMINS);
  if (adminSheet.getLastRow() <= 1) {
      adminSheet.appendRow(["ADM001", "admin", "123456", "Administrator", "admin", "", "Pusat", "Kota", "L", ""]);
  }
  const adminRows = adminSheet.getDataRange().getDisplayValues();
  const admins = adminRows.slice(1).map(r => mapUserFromRow(r, false));
  const userSheet = getSheet(SHEET_USERS);
  const userRows = userSheet.getDataRange().getDisplayValues();
  const students = userRows.slice(1).map(r => mapUserFromRow(r, true));
  return [...admins, ...students];
}

function findUserRow(sheetName, username) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  const colIndex = 1; // Username at Index 1 (Col B)
  const targetUser = String(username).toLowerCase().trim();
  
  for(let i=1; i<data.length; i++) {
    if(String(data[i][colIndex]).toLowerCase().trim() === targetUser) {
      return { sheet, rowIndex: i+1, data: data[i] };
    }
  }
  return null;
}

function saveUser(u) {
  const role = normalizeRole(u.role);
  const targetSheetName = (role === 'admin' || role === 'Guru') ? SHEET_ADMINS : SHEET_USERS;
  const otherSheetName = (targetSheetName === SHEET_ADMINS) ? SHEET_USERS : SHEET_ADMINS;
  const existingInOther = findUserRow(otherSheetName, u.username);
  if (existingInOther) existingInOther.sheet.deleteRow(existingInOther.rowIndex);
  const targetSheet = getSheet(targetSheetName);
  const existing = findUserRow(targetSheetName, u.username);
  const id = existing ? existing.data[0] : (u.id || (role === 'siswa' ? 'SIS-' : 'ADM-') + Date.now());
  const commonRow = [
      id,
      u.username,
      u.password,
      u.fullname,
      role,
      u.kelas || '',
      u.school || '',
      u.kecamatan || '',
      u.gender || 'L',
      u.photo_url || ''
  ];
  if (targetSheetName === SHEET_ADMINS) {
      if (existing) targetSheet.getRange(existing.rowIndex, 1, 1, commonRow.length).setValues([commonRow]);
      else targetSheet.appendRow(commonRow);
  } else {
      if (existing) {
          const current = existing.data;
          // Maintain existing state for students (ActiveExam, Session, Status, LastLogin, ActiveTP, ExamType)
          const fullRow = [...commonRow, current[10]||'', current[11]||'', current[12]||'OFFLINE', current[13]||'', current[14]||'', current[15]||''];
          targetSheet.getRange(existing.rowIndex, 1, 1, fullRow.length).setValues([fullRow]);
      } else {
          // New student, initialize extra columns with defaults
          targetSheet.appendRow([...commonRow, '', '', 'OFFLINE', '', '', '']);
      }
  }
  return { success: true };
}

function deleteUser(username) {
  let deleted = false;
  // Try finding in Admins
  const adminRow = findUserRow(SHEET_ADMINS, username);
  if (adminRow) { 
      adminRow.sheet.deleteRow(adminRow.rowIndex); 
      deleted = true; 
  }
  // Try finding in Users
  const userRow = findUserRow(SHEET_USERS, username);
  if (userRow) { 
      userRow.sheet.deleteRow(userRow.rowIndex); 
      deleted = true; 
  }
  return { success: deleted };
}

function importUsers(users) {
  const admins = [];
  const students = [];
  users.forEach(u => {
    const role = normalizeRole(u.role);
    const id = u.id || ((role === 'siswa' ? 'SIS-' : 'IMP-') + Math.floor(Math.random() * 1000000));
    // Explicit conversion to string to prevent null errors in setValues
    const row = [
        String(id || ""),
        String(u.username || ""), 
        String(u.password || ""), 
        String(u.fullname || ""), 
        String(role || ""),
        String(u.kelas || ""),
        String(u.school || ""), 
        String(u.kecamatan || ""), 
        String(u.gender || "L"),
        String(u.photo_url || "")
    ];
    if (role === 'admin' || role === 'Guru') {
        admins.push(row);
    } else {
        // Init students with empty exam data + examType (6 empty slots)
        students.push([...row, '', '', 'OFFLINE', '', '', '']);
    }
  });
  if (admins.length > 0) {
    const s = getSheet(SHEET_ADMINS);
    s.getRange(s.getLastRow() + 1, 1, admins.length, admins[0].length).setValues(admins);
  }
  if (students.length > 0) {
    const s = getSheet(SHEET_USERS);
    s.getRange(s.getLastRow() + 1, 1, students.length, students[0].length).setValues(students);
  }
  return { success: true };
}

// ... (Config, Questions, Subject List) ...
function getConfigMap() {
  const data = getData(SHEET_CONFIG);
  const map = {};
  data.forEach(d => map[d.Key] = d.Value);
  return map;
}

// NEW: Helper to get ALL config at once
function getAppConfig() {
  return getConfigMap();
}

function saveConfig(key, value) {
  const sheet = getSheet(SHEET_CONFIG);
  const data = sheet.getDataRange().getValues();
  let found = false;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      found = true;
      break;
    }
  }
  if (!found) sheet.appendRow([key, value]);
  return { success: true };
}

// Global Config
function saveBatchConfig(configObj) {
  const sheet = getSheet(SHEET_CONFIG);
  const data = sheet.getDataRange().getValues();
  const keyRowMap = {};
  for (let i = 1; i < data.length; i++) {
    keyRowMap[data[i][0]] = i + 1;
  }
  const newRows = [];
  for (const [key, value] of Object.entries(configObj)) {
    if (keyRowMap[key]) {
      sheet.getRange(keyRowMap[key], 2).setValue(value);
    } else {
      newRows.push([key, value]);
    }
  }
  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 2).setValues(newRows);
  }
  return { success: true };
}

// NEW: USER SPECIFIC CONFIG
function getUserConfig(username) {
  const sheet = getSheet(SHEET_USER_CONFIGS);
  const data = sheet.getDataRange().getDisplayValues();
  const targetUser = String(username).toLowerCase().trim();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase().trim() === targetUser) {
      try {
        return JSON.parse(data[i][1]); // ConfigJSON is in column 2
      } catch (e) {
        return {};
      }
    }
  }
  return {}; // Return empty object if no config found
}

function saveUserConfig(username, configObj) {
  const sheet = getSheet(SHEET_USER_CONFIGS);
  const data = sheet.getDataRange().getValues();
  const targetUser = String(username).toLowerCase().trim();
  const jsonString = JSON.stringify(configObj);
  const timestamp = new Date().toISOString();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase().trim() === targetUser) {
      sheet.getRange(i + 1, 2).setValue(jsonString);
      sheet.getRange(i + 1, 3).setValue(timestamp);
      return { success: true };
    }
  }
  // If not found, append new row
  sheet.appendRow([username, jsonString, timestamp]);
  return { success: true };
}

function getTokenFromConfig() {
  const map = getConfigMap();
  return map['TOKEN'] || 'TOKEN';
}

function getSubjectList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const subjects = [];
  sheets.forEach(s => {
    if (s.getName().startsWith("Questions_")) {
      subjects.push(s.getName().replace("Questions_", ""));
    }
  });
  const config = getConfigMap();
  return {
    subjects: subjects,
    duration: config['DURATION'] || 60,
    maxQuestions: config['MAX_QUESTIONS'] || 0,
    kktp: config['KKTP'] || 75
  };
}

function getQuestionsSheetName(subject) { return `Questions_${subject}`; }

function getRawQuestions(subject) {
  const sheetName = getQuestionsSheetName(subject);
  const sheet = getSheet(sheetName);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["ID", "Text", "Type", "Image", "OptA", "OptB", "OptC", "OptD", "Key", "Weight", "Kelas", "TP_ID"]);
    return [];
  }
  const data = sheet.getDataRange().getDisplayValues();
  const res = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    res.push({
      id: row[0], text_soal: row[1], tipe_soal: row[2], gambar: row[3],
      opsi_a: row[4], opsi_b: row[5], opsi_c: row[6], opsi_d: row[7],
      kunci_jawaban: row[8], bobot: Number(row[9]), kelas: row[10], tp_id: row[11]
    });
  }
  return res;
}

function getQuestionsFromSheet(subject) {
  if (subject.startsWith("Survey_")) {
      const surveyQ = [];
      if (subject === 'Survey_Karakter') {
          surveyQ.push({ id: 'Q1', text: 'Saya selalu berdoa sebelum belajar.', type: 'LIKERT' });
          surveyQ.push({ id: 'Q2', text: 'Saya menghormati teman yang berbeda agama.', type: 'LIKERT' });
      } else {
          surveyQ.push({ id: 'Q1', text: 'Ruang kelas saya bersih dan nyaman.', type: 'LIKERT' });
          surveyQ.push({ id: 'Q2', text: 'Guru menjelaskan pelajaran dengan jelas.', type: 'LIKERT' });
      }
      const options = [
          {id: '1', text: 'Sangat Kurang'}, {id: '2', text: 'Kurang'}, 
          {id: '3', text: 'Sesuai'}, {id: '4', text: 'Sangat Sesuai'}
      ];
      return surveyQ.map(q => ({ ...q, options }));
  }
  const sheetName = getQuestionsSheetName(subject);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getDisplayValues();
  const questions = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue; 
    const q = {
      id: row[0], text: row[1], type: row[2], image: row[3],
      options: [], kelas: row[10], tp_id: row[11]
    };
    if (q.type === 'PG' || q.type === 'PGK') {
      if (row[4]) q.options.push({ id: 'A', text: row[4] });
      if (row[5]) q.options.push({ id: 'B', text: row[5] });
      if (row[6]) q.options.push({ id: 'C', text: row[6] });
      if (row[7]) q.options.push({ id: 'D', text: row[7] });
    } else if (q.type === 'BS') {
       q.options.push({ id: 'opt1', text: row[4] });
       q.options.push({ id: 'opt2', text: row[5] });
       q.options.push({ id: 'opt3', text: row[6] });
    }
    questions.push(q);
  }
  return questions;
}

function saveQuestion(subject, q) {
  const sheetName = getQuestionsSheetName(subject);
  const sheet = getSheet(sheetName);
  if (sheet.getLastRow() === 0) sheet.appendRow(["ID", "Text", "Type", "Image", "OptA", "OptB", "OptC", "OptD", "Key", "Weight", "Kelas", "TP_ID"]);
  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(q.id)) { rowIndex = i + 1; break; }
  }
  const rowData = [q.id, q.text_soal, q.tipe_soal, q.gambar, q.opsi_a, q.opsi_b, q.opsi_c, q.opsi_d, q.kunci_jawaban, q.bobot, q.kelas, q.tp_id];
  if (rowIndex > 0) sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  else sheet.appendRow(rowData);
  return { success: true };
}

function deleteQuestion(subject, id) {
  const sheetName = getQuestionsSheetName(subject);
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false };
}

function importQuestions(subject, questions) {
  const sheetName = getQuestionsSheetName(subject);
  const sheet = getSheet(sheetName);
  if (sheet.getLastRow() === 0) sheet.appendRow(["ID", "Text", "Type", "Image", "OptA", "OptB", "OptC", "OptD", "Key", "Weight", "Kelas", "TP_ID"]);
  const rows = questions.map(q => [q.id, q.text_soal, q.tipe_soal, q.gambar, q.opsi_a, q.opsi_b, q.opsi_c, q.opsi_d, q.kunci_jawaban, q.bobot, q.kelas, q.tp_id]);
  if (rows.length > 0) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  return { success: true };
}

function getLearningObjectives() {
  const sheet = getSheet(SHEET_TP);
  const data = sheet.getDataRange().getDisplayValues();
  if (data.length <= 1) return [];
  // Skip header row (Slice 1) and map by Index
  return data.slice(1).map(row => ({
    id: row[0],
    mapel: row[1],
    materi: row[2],
    kelas: row[3],
    text_tujuan: row[4]
  }));
}

function saveLearningObjective(obj) {
  const sheet = getSheet(SHEET_TP);
  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) { if (String(data[i][0]) === String(obj.id)) { rowIndex = i + 1; break; } }
  const row = [obj.id, obj.mapel, obj.materi, obj.kelas, obj.text_tujuan];
  if (rowIndex > 0) sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
  return { success: true };
}

function deleteLearningObjective(id) {
  const sheet = getSheet(SHEET_TP);
  const data = sheet.getDataRange().getValues();
  const targetId = String(id).trim(); // Strict check
  for (let i = 1; i < data.length; i++) { 
      if (String(data[i][0]).trim() === targetId) { 
          sheet.deleteRow(i + 1); 
          return { success: true }; 
      } 
  }
  return { success: false };
}

function importLearningObjectives(list) {
  const sheet = getSheet(SHEET_TP);
  // Ensure strict string conversion to avoid null/undefined breaking setValues
  const rows = list.map(o => [
    String(o.id || ""), 
    String(o.mapel || ""), 
    String(o.materi || ""), 
    String(o.kelas || ""), 
    String(o.text_tujuan || "")
  ]);
  
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }
  return { success: true };
}

// Updated to accept examType
function assignTestGroup(usernames, examId, session, tpId, examType) {
  const sheet = getSheet(SHEET_USERS);
  const data = sheet.getDataRange().getValues();
  const userRowMap = {};
  for(let i=1; i<data.length; i++) userRowMap[data[i][1]] = i + 1;
  
  usernames.forEach(u => {
    const row = userRowMap[u];
    if (row) {
      if (examId !== undefined && examId !== null) sheet.getRange(row, 11).setValue(examId); 
      if (session !== undefined && session !== null) sheet.getRange(row, 12).setValue(session);
      if (tpId !== undefined && tpId !== null) sheet.getRange(row, 15).setValue(tpId); // ActiveTP Col 15
      if (examType !== undefined && examType !== null) sheet.getRange(row, 16).setValue(examType); // ExamType Col 16
    }
  });
  return { success: true };
}

function updateUserSessions(updates) {
  const sheet = getSheet(SHEET_USERS);
  const data = sheet.getDataRange().getValues();
  const userRowMap = {};
  for(let i=1; i<data.length; i++) userRowMap[data[i][1]] = i + 1;
  updates.forEach(upd => {
    const row = userRowMap[upd.username];
    if (row) sheet.getRange(row, 12).setValue(upd.session); 
  });
  return { success: true };
}

function getSchoolSchedules() {
  const data = getData(SHEET_SCHEDULES);
  return data.map(d => ({ school: d.Sekolah, gelombang: d.Gelombang, tanggal: d.TanggalMulai, tanggal_selesai: d.TanggalSelesai }));
}

function saveSchoolSchedules(schedules) {
  const sheet = getSheet(SHEET_SCHEDULES);
  if (sheet.getLastRow() > 1) sheet.deleteRows(2, sheet.getLastRow() - 1);
  const rows = schedules.map(s => [s.school, s.gelombang, s.tanggal, s.tanggal_selesai]);
  if (rows.length > 0) sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  return { success: true };
}

function startExam(username, fullname, subject) {
  const sheet = getSheet(SHEET_USERS);
  const data = sheet.getDataRange().getValues();
  for(let i=1; i<data.length; i++) {
    if(data[i][1] === username) {
      sheet.getRange(i+1, 13).setValue('WORKING'); 
      logActivity(username, 'START', { subject: subject });
      break;
    }
  }
  return { success: true, startTime: new Date().getTime() };
}

function submitAnswers(username, fullname, school, subject, answers, scoreInfo, startTime, qCount, qIds) {
  const rawQ = getRawQuestions(subject);
  let totalScore = 0;
  let maxScore = 0;
  const analysisObj = {};
  rawQ.forEach(q => {
    if (qIds && qIds.length > 0 && !qIds.includes(q.id)) return;
    maxScore += q.bobot;
    const userAns = answers[q.id];
    let isCorrect = 0; 
    if (q.tipe_soal === 'PG') {
      if (String(userAns || '').toUpperCase() === String(q.kunci_jawaban).toUpperCase()) {
        totalScore += q.bobot;
        isCorrect = 1;
      }
    } else if (q.tipe_soal === 'PGK') {
       const keys = q.kunci_jawaban.split(',').map(s=>s.trim().toUpperCase()).sort().join(',');
       const ans = Array.isArray(userAns) ? userAns.map(s=>s.toUpperCase()).sort().join(',') : '';
       if (keys === ans) {
         totalScore += q.bobot;
         isCorrect = 1;
       }
    } else if (q.tipe_soal === 'BS') {
       const keys = String(q.kunci_jawaban).toUpperCase().split(',').map(s=>s.trim());
       const ansObj = userAns || {};
       let match = true;
       const slots = ['opt1', 'opt2', 'opt3', 'opt4']; 
       for(let i=0; i<keys.length; i++) {
           const k = keys[i];
           const target = (k === 'B' || k === 'BENAR' || k === 'TRUE');
           if (ansObj[slots[i]] !== target) {
               match = false;
               break;
           }
       }
       if (match && keys.length > 0) {
           totalScore += q.bobot;
           isCorrect = 1;
       }
    }
    analysisObj[q.id] = isCorrect;
  });
  const finalGrade = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  const roundedGrade = Math.round(finalGrade * 100) / 100;
  const sheet = getSheet(SHEET_RESULTS);
  const durationSec = Math.floor((new Date().getTime() - startTime) / 1000);
  const h = Math.floor(durationSec / 3600).toString().padStart(2,'0');
  const m = Math.floor((durationSec % 3600) / 60).toString().padStart(2,'0');
  const s = (durationSec % 60).toString().padStart(2,'0');
  const durationStr = `${h}:${m}:${s}`;
  sheet.appendRow([
    new Date().toISOString(), username, fullname, school, subject,
    roundedGrade, JSON.stringify(analysisObj), durationStr
  ]);
  const uSheet = getSheet(SHEET_USERS);
  const uData = uSheet.getDataRange().getValues();
  for(let i=1; i<uData.length; i++) {
    if(uData[i][1] === username) {
      uSheet.getRange(i+1, 13).setValue('FINISHED'); 
      break;
    }
  }
  logActivity(username, 'FINISH', { subject: subject, score: roundedGrade });
  return { success: true };
}

function submitSurvey(username, fullname, school, surveyType, answers, startTime) {
    const sheet = getSheet(SHEET_SURVEY);
    let total = 0;
    let count = 0;
    Object.values(answers).forEach(v => { total += Number(v); count++; });
    const avg = count > 0 ? (total / count).toFixed(2) : 0;
    const durationSec = Math.floor((new Date().getTime() - startTime) / 1000);
    sheet.appendRow([
        new Date().toISOString(), username, fullname, school, surveyType,
        total, avg, JSON.stringify(answers), durationSec
    ]);
    const uSheet = getSheet(SHEET_USERS);
    const uData = uSheet.getDataRange().getValues();
    for(let i=1; i<uData.length; i++) {
        if(uData[i][1] === username) {
             uSheet.getRange(i+1, 13).setValue('FINISHED'); 
             break;
        }
    }
    return { success: true };
}

function getRecapData() {
  const data = getData(SHEET_RESULTS);
  return data.map(r => ({
    timestamp: r.Timestamp, username: r.Username, nama: r.Nama,
    sekolah: r.Sekolah, mapel: r.Mapel, nilai: r.Nilai,
    analisis: r.AnalisisJSON, durasi: r.Durasi
  }));
}

function getAnalysisData(subject) {
  const data = getRecapData();
  return data.filter(d => d.mapel === subject);
}

function getDashboardData() {
  const users = getUsers();
  const schedules = getSchoolSchedules();
  const subjectList = getSubjectList();
  const statusCounts = { OFFLINE: 0, LOGGED_IN: 0, WORKING: 0, FINISHED: 0 };
  users.forEach(u => {
    if (u.role === 'siswa') {
      const st = u.status || 'OFFLINE';
      if (statusCounts[st] !== undefined) statusCounts[st]++;
      else statusCounts['OFFLINE']++;
    }
  });
  const logSheet = getSheet(SHEET_LOGS);
  const logsRaw = logSheet.getDataRange().getDisplayValues();
  const logs = [];
  const start = Math.max(1, logsRaw.length - 20);
  for(let i = logsRaw.length - 1; i >= start; i--) {
     let detail = {};
     try { detail = JSON.parse(logsRaw[i][3]); } catch(e){}
     const user = users.find(u => u.username === logsRaw[i][1]);
     logs.push({
         timestamp: logsRaw[i][0], username: logsRaw[i][1],
         fullname: user ? user.fullname : logsRaw[i][1],
         school: user ? user.school : '',
         kecamatan: user ? user.kecamatan : '',
         action: logsRaw[i][2], ...detail
     });
  }
  const subjectStats = subjectList.subjects.map(sub => {
     const qs = getQuestionsSheetName(sub);
     const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(qs);
     return { name: sub, count: sheet ? sheet.getLastRow() - 1 : 0 };
  });
  return {
      allUsers: users,
      schedules: schedules,
      activityFeed: logs,
      statusCounts: statusCounts,
      subjects: subjectStats,
      token: getTokenFromConfig(),
      duration: subjectList.duration,
      maxQuestions: subjectList.maxQuestions,
      kktp: subjectList.kktp
  };
}
