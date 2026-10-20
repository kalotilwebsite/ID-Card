/**
 * =========================================================================================
 * GOOGLE APPS SCRIPT BACKEND FOR ID CARD GENERATOR
 * =========================================================================================
 * Host: Google Apps Script Web App
 * Database: Google Sheets (MasterEmployees, Submissions, Users, Settings)
 * Storage: Google Drive (ID Card Photos and Signatures)
 *
 * INSTRUCTIONS FOR DEPLOYMENT:
 * 1. Open Google Sheets (create a new blank spreadsheet).
 * 2. In Google Sheets, click Extensions > Apps Script.
 * 3. Replace all existing code in Code.gs with this entire file.
 * 4. Run setupInitialDatabase() once from the editor to initialize tabs, headers, and default admin.
 * 5. Click Deploy > New deployment.
 * 6. Select type: "Web app".
 * 7. Set:
 *    - Description: "ID Card Generator Web App"
 *    - Execute as: "Me" (your Google account)
 *    - Who has access: "Anyone" (crucial for GitHub Pages access without Google sign-in)
 * 8. Click "Deploy", authorize the permissions when prompted, and copy the Web App URL.
 * 9. Paste the copied URL into script.js at: const APPS_SCRIPT_URL = '...';
 * =========================================================================================
 */

// Global Sheet Tab Names
const SHEET_MASTER = 'MasterEmployees';
const SHEET_SUBMISSIONS = 'Submissions';
const SHEET_USERS = 'Users';
const SHEET_SETTINGS = 'Settings';

// Google Drive folder name for storing captured images
const DRIVE_FOLDER_NAME = 'ID_Card_Generator_Uploads';

/**
 * Handle HTTP GET Requests
 */
function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    const action = params.action || 'ping';

    let result;
    switch (action) {
      case 'ping':
        result = { success: true, message: 'Google Apps Script ID Card Service is online', timestamp: new Date().toISOString() };
        break;
      case 'getSettings':
        result = handleGetSettings();
        break;
      case 'getMasterEmployee':
        result = handleGetMasterEmployee(params.enrollId);
        break;
      case 'getSubmissions':
        result = handleGetSubmissions();
        break;
      case 'getMasterEmployees':
        result = handleGetMasterEmployees();
        break;
      default:
        result = { success: false, error: 'Unknown GET action: ' + action };
    }

    return createJsonResponse(result);
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * Handle HTTP POST Requests
 */
function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        // Fallback for form-encoded or raw strings
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action;
    let result;

    switch (action) {
      case 'login':
        result = handleLogin(payload.username, payload.password, payload.role);
        break;

      case 'getMasterEmployee':
        result = handleGetMasterEmployee(payload.enrollId);
        break;

      case 'submitData':
        result = handleSubmitData(payload.data, payload.user);
        break;

      case 'getSubmissions':
        result = handleGetSubmissions();
        break;

      case 'updatePrintStatus':
        result = handleUpdatePrintStatus(payload.submissionId, payload.status);
        break;

      case 'batchUpdatePrintStatus':
        result = handleBatchUpdatePrintStatus(payload.submissionIds, payload.status);
        break;

      case 'editSubmission':
        result = handleEditSubmission(payload.submissionId, payload.data);
        break;

      case 'deleteSubmission':
        result = handleDeleteSubmission(payload.submissionId);
        break;

      case 'getMasterEmployees':
        result = handleGetMasterEmployees();
        break;

      case 'addMasterEmployee':
        result = handleAddMasterEmployee(payload.employee);
        break;

      case 'bulkImportMaster':
        result = handleBulkImportMaster(payload.employees, payload.skipDuplicates !== false);
        break;

      case 'editMasterEmployee':
        result = handleEditMasterEmployee(payload.enrollId, payload.employee);
        break;

      case 'deleteMasterEmployee':
        result = handleDeleteMasterEmployee(payload.enrollId);
        break;

      case 'getSettings':
        result = handleGetSettings();
        break;

      case 'updateSettings':
        result = handleUpdateSettings(payload.settings);
        break;

      case 'initDatabase':
        result = setupInitialDatabase();
        break;

      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }

    return createJsonResponse(result);
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString(), stack: err.stack });
  }
}

/**
 * Helper to build standard JSON response with permissive CORS
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Get or create a spreadsheet sheet with headers
 */
function getOrCreateSheet(sheetName, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#F1F5F9');
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

/**
 * Convert 2D sheet rows into array of objects matching header keys
 */
function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const rowObj = {};
    for (let j = 0; j < headers.length; j++) {
      rowObj[headers[j]] = data[i][j];
    }
    rowObj._rowIndex = i + 1; // 1-indexed sheet row
    rows.push(rowObj);
  }
  return rows;
}

/**
 * 1. AUTHENTICATION HANDLER
 * Supports:
 * - Admin email / username + password
 * - Supervisor Enrollment ID + password
 */
function handleLogin(username, password, requestedRole) {
  if (!username || !password) {
    return { success: false, error: 'Username/Enrollment ID and Password are required.' };
  }

  const cleanUser = String(username).trim().toLowerCase();
  const cleanPass = String(password).trim();
  const usersSheet = getOrCreateSheet(SHEET_USERS, [
    'User ID', 'Username / Email / Enroll ID', 'Password', 'Role', 'Full Name', 'Status'
  ]);

  const users = sheetToObjects(usersSheet);

  // If no users exist, seed default admin
  if (users.length === 0) {
    setupInitialDatabase();
    return handleLogin(username, password, requestedRole);
  }

  const matched = users.find(u => {
    const uName = String(u['Username / Email / Enroll ID'] || '').trim().toLowerCase();
    const uPass = String(u['Password'] || '').trim();
    const uRole = String(u['Role'] || '').toLowerCase();
    const uStatus = String(u['Status'] || 'Active').toLowerCase();

    if (uStatus !== 'active') return false;
    if (requestedRole && uRole !== requestedRole.toLowerCase()) return false;

    return uName === cleanUser && uPass === cleanPass;
  });

  if (!matched) {
    return { success: false, error: 'Invalid credentials or inactive account.' };
  }

  return {
    success: true,
    user: {
      userId: matched['User ID'],
      username: matched['Username / Email / Enroll ID'],
      role: String(matched['Role']).toLowerCase() === 'admin' ? 'admin' : 'supervisor',
      name: matched['Full Name'] || matched['Username / Email / Enroll ID'],
      enrollId: matched['Username / Email / Enroll ID']
    }
  };
}

/**
 * 2. MASTER EMPLOYEE LOOKUP
 */
function handleGetMasterEmployee(enrollId) {
  if (!enrollId) {
    return { success: false, error: 'Enrollment ID is required' };
  }

  const cleanId = String(enrollId).trim();
  const sheet = getOrCreateSheet(SHEET_MASTER, [
    'Enrollment ID', 'Name', 'Designation', 'Department', 'Job Type',
    'Joining Date', 'Card Issue Date', 'NID Number', 'Blood Group',
    'Contact Number', 'Photo URL', 'Signature URL', 'Created At'
  ]);

  const records = sheetToObjects(sheet);
  const employee = records.find(r => String(r['Enrollment ID']).trim() === cleanId);

  if (!employee) {
    return { success: false, error: 'Employee not found in Master Database' };
  }

  return {
    success: true,
    employee: {
      enrollId: String(employee['Enrollment ID']),
      name: String(employee['Name'] || ''),
      designation: String(employee['Designation'] || ''),
      department: String(employee['Department'] || ''),
      jobType: String(employee['Job Type'] || 'PERMANENT'),
      joiningDate: formatDateValue(employee['Joining Date']),
      cardIssueDate: formatDateValue(employee['Card Issue Date']),
      nidNumber: String(employee['NID Number'] || ''),
      bloodGroup: String(employee['Blood Group'] || 'O+'),
      contactNumber: String(employee['Contact Number'] || ''),
      photoUrl: employee['Photo URL'] || '',
      signatureUrl: employee['Signature URL'] || ''
    }
  };
}

/**
 * 3. SUPERVISOR SUBMISSION HANDLER
 * Saves base64 images into Google Drive, returns public links, adds record to Submissions sheet
 */
function handleSubmitData(data, user) {
  // Check settings if supervisor form is enabled
  const settings = getSettingsMap();
  if (settings.supervisorFormEnabled === 'false' || settings.supervisorFormEnabled === false) {
    return {
      success: false,
      error: settings.supervisorFormDisabledMessage || 'Submissions are currently closed by the administrator.'
    };
  }

  if (!data || !data.enrollId || !data.name) {
    return { success: false, error: 'Missing required employee submission data.' };
  }

  const enrollId = String(data.enrollId).trim();
  const subSheet = getOrCreateSheet(SHEET_SUBMISSIONS, [
    'Submission ID', 'Enrollment ID', 'Name', 'Designation', 'Department',
    'Job Type', 'Joining Date', 'Card Issue Date', 'NID Number', 'Blood Group',
    'Emergency Contact', 'Photo URL', 'Signature URL', 'Submitted By',
    'Submitted At', 'Print Status', 'Printed At', 'Print Count'
  ]);

  // Check duplicate pending submission
  const existingSubmissions = sheetToObjects(subSheet);
  const alreadyPending = existingSubmissions.find(s =>
    String(s['Enrollment ID']).trim() === enrollId &&
    String(s['Print Status']).toLowerCase() === 'pending'
  );

  if (alreadyPending) {
    return {
      success: false,
      error: `A submission for Enrollment ID ${enrollId} is already pending print approval.`
    };
  }

  // Handle image upload to Google Drive if provided as Base64 data URI
  let finalPhotoUrl = data.photoUrl || '';
  if (finalPhotoUrl && finalPhotoUrl.startsWith('data:image')) {
    finalPhotoUrl = saveBase64ImageToDrive(finalPhotoUrl, `photo_${enrollId}_${Date.now()}.jpg`);
  }

  let finalSigUrl = data.signatureUrl || '';
  if (finalSigUrl && finalSigUrl.startsWith('data:image')) {
    finalSigUrl = saveBase64ImageToDrive(finalSigUrl, `sig_${enrollId}_${Date.now()}.png`);
  }

  const submissionId = 'SUB-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  const submittedAt = new Date().toISOString();
  const submittedBy = (user && (user.enrollId || user.username)) || 'Supervisor';

  subSheet.appendRow([
    submissionId,
    enrollId,
    data.name || '',
    data.designation || '',
    data.department || '',
    data.jobType || 'PERMANENT',
    data.joiningDate || '',
    data.cardIssueDate || '',
    data.nidNumber || '',
    data.bloodGroup || 'O+',
    data.contactNumber || data.emergencyContact || '',
    finalPhotoUrl,
    finalSigUrl,
    submittedBy,
    submittedAt,
    'Pending',
    '',
    0
  ]);

  return {
    success: true,
    submissionId: submissionId,
    message: settings.supervisorSuccessMessage || 'Employee ID card submitted successfully. The card is queued for printing.'
  };
}

/**
 * 4. GET SUBMISSIONS (For Admin Dashboard)
 */
function handleGetSubmissions() {
  const sheet = getOrCreateSheet(SHEET_SUBMISSIONS, [
    'Submission ID', 'Enrollment ID', 'Name', 'Designation', 'Department',
    'Job Type', 'Joining Date', 'Card Issue Date', 'NID Number', 'Blood Group',
    'Emergency Contact', 'Photo URL', 'Signature URL', 'Submitted By',
    'Submitted At', 'Print Status', 'Printed At', 'Print Count'
  ]);

  const rows = sheetToObjects(sheet);
  const submissions = rows.map(r => ({
    id: r['Submission ID'],
    enrollId: String(r['Enrollment ID']),
    name: r['Name'],
    designation: r['Designation'],
    department: r['Department'],
    jobType: r['Job Type'],
    joiningDate: formatDateValue(r['Joining Date']),
    cardIssueDate: formatDateValue(r['Card Issue Date']),
    nidNumber: r['NID Number'],
    bloodGroup: r['Blood Group'],
    emergencyContact: r['Emergency Contact'],
    contactNumber: r['Emergency Contact'],
    photoUrl: r['Photo URL'],
    signatureUrl: r['Signature URL'],
    submittedBy: r['Submitted By'],
    submittedAt: r['Submitted At'],
    printStatus: String(r['Print Status'] || 'Pending').toLowerCase(),
    printedAt: r['Printed At'] || null,
    printCount: Number(r['Print Count']) || 0
  }));

  // Reverse so newest submissions appear first
  submissions.reverse();

  return { success: true, submissions: submissions };
}

/**
 * 5. UPDATE PRINT STATUS
 */
function handleUpdatePrintStatus(submissionId, newStatus) {
  if (!submissionId) return { success: false, error: 'Submission ID is required' };

  const sheet = getOrCreateSheet(SHEET_SUBMISSIONS);
  const rows = sheetToObjects(sheet);
  const target = rows.find(r => r['Submission ID'] === submissionId);

  if (!target) return { success: false, error: 'Submission not found' };

  const rowIndex = target._rowIndex;
  const statusCol = 16; // 'Print Status' column
  const printedAtCol = 17; // 'Printed At' column
  const printCountCol = 18; // 'Print Count' column

  const currentCount = Number(target['Print Count']) || 0;
  const now = new Date().toISOString();

  sheet.getRange(rowIndex, statusCol).setValue(newStatus || 'Printed');
  sheet.getRange(rowIndex, printedAtCol).setValue(now);
  sheet.getRange(rowIndex, printCountCol).setValue(currentCount + 1);

  return {
    success: true,
    message: 'Print status updated to ' + newStatus,
    printCount: currentCount + 1,
    printedAt: now
  };
}

/**
 * 5b. BATCH UPDATE PRINT STATUS
 */
function handleBatchUpdatePrintStatus(submissionIds, newStatus) {
  if (!submissionIds || !submissionIds.length) {
    return { success: false, error: 'Submission IDs array is required' };
  }

  const sheet = getOrCreateSheet(SHEET_SUBMISSIONS);
  const rows = sheetToObjects(sheet);
  const idSet = new Set(submissionIds);
  const now = new Date().toISOString();
  let updatedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (idSet.has(row['Submission ID'])) {
      const rowIndex = row._rowIndex;
      const count = Number(row['Print Count']) || 0;
      sheet.getRange(rowIndex, 16).setValue(newStatus || 'Printed');
      sheet.getRange(rowIndex, 17).setValue(now);
      sheet.getRange(rowIndex, 18).setValue(count + 1);
      updatedCount++;
    }
  }

  return { success: true, updatedCount: updatedCount };
}

/**
 * 6. EDIT SUBMISSION
 */
function handleEditSubmission(submissionId, updateData) {
  if (!submissionId || !updateData) return { success: false, error: 'Missing parameters' };

  const sheet = getOrCreateSheet(SHEET_SUBMISSIONS);
  const rows = sheetToObjects(sheet);
  const target = rows.find(r => r['Submission ID'] === submissionId);
  if (!target) return { success: false, error: 'Record not found' };

  const rowIndex = target._rowIndex;
  if (updateData.name !== undefined) sheet.getRange(rowIndex, 3).setValue(updateData.name);
  if (updateData.designation !== undefined) sheet.getRange(rowIndex, 4).setValue(updateData.designation);
  if (updateData.department !== undefined) sheet.getRange(rowIndex, 5).setValue(updateData.department);
  if (updateData.jobType !== undefined) sheet.getRange(rowIndex, 6).setValue(updateData.jobType);
  if (updateData.joiningDate !== undefined) sheet.getRange(rowIndex, 7).setValue(updateData.joiningDate);
  if (updateData.cardIssueDate !== undefined) sheet.getRange(rowIndex, 8).setValue(updateData.cardIssueDate);
  if (updateData.nidNumber !== undefined) sheet.getRange(rowIndex, 9).setValue(updateData.nidNumber);
  if (updateData.bloodGroup !== undefined) sheet.getRange(rowIndex, 10).setValue(updateData.bloodGroup);
  if (updateData.emergencyContact !== undefined || updateData.contactNumber !== undefined) {
    sheet.getRange(rowIndex, 11).setValue(updateData.emergencyContact || updateData.contactNumber);
  }
  if (updateData.photoUrl !== undefined) sheet.getRange(rowIndex, 12).setValue(updateData.photoUrl);
  if (updateData.signatureUrl !== undefined) sheet.getRange(rowIndex, 13).setValue(updateData.signatureUrl);
  if (updateData.printStatus !== undefined) sheet.getRange(rowIndex, 16).setValue(updateData.printStatus);

  return { success: true, message: 'Record updated successfully' };
}

/**
 * 7. DELETE SUBMISSION
 */
function handleDeleteSubmission(submissionId) {
  if (!submissionId) return { success: false, error: 'Submission ID is required' };
  const sheet = getOrCreateSheet(SHEET_SUBMISSIONS);
  const rows = sheetToObjects(sheet);
  const target = rows.find(r => r['Submission ID'] === submissionId);
  if (!target) return { success: false, error: 'Record not found' };

  sheet.deleteRow(target._rowIndex);
  return { success: true, message: 'Submission deleted' };
}

/**
 * 8. MASTER DATABASE HANDLERS
 */
function handleGetMasterEmployees() {
  const sheet = getOrCreateSheet(SHEET_MASTER);
  const rows = sheetToObjects(sheet);
  const employees = rows.map(r => ({
    enrollId: String(r['Enrollment ID']),
    name: r['Name'],
    designation: r['Designation'],
    department: r['Department'],
    jobType: r['Job Type'],
    joiningDate: formatDateValue(r['Joining Date']),
    cardIssueDate: formatDateValue(r['Card Issue Date']),
    nidNumber: r['NID Number'],
    bloodGroup: r['Blood Group'],
    contactNumber: r['Contact Number'],
    photoUrl: r['Photo URL'] || '',
    signatureUrl: r['Signature URL'] || '',
    createdAt: r['Created At'] || ''
  }));
  return { success: true, employees: employees };
}

function handleAddMasterEmployee(emp) {
  if (!emp || !emp.enrollId || !emp.name) {
    return { success: false, error: 'Enrollment ID and Name are required' };
  }
  const sheet = getOrCreateSheet(SHEET_MASTER);
  const rows = sheetToObjects(sheet);
  const exists = rows.find(r => String(r['Enrollment ID']).trim() === String(emp.enrollId).trim());
  if (exists) {
    return { success: false, error: `Enrollment ID ${emp.enrollId} already exists in Master Database.` };
  }

  sheet.appendRow([
    String(emp.enrollId).trim(),
    emp.name || '',
    emp.designation || '',
    emp.department || '',
    emp.jobType || 'PERMANENT',
    emp.joiningDate || '',
    emp.cardIssueDate || '',
    emp.nidNumber || '',
    emp.bloodGroup || 'O+',
    emp.contactNumber || '',
    emp.photoUrl || '',
    emp.signatureUrl || '',
    new Date().toISOString()
  ]);

  return { success: true, message: 'Master employee record added.' };
}

function handleBulkImportMaster(employees, skipDuplicates) {
  if (!employees || !employees.length) {
    return { success: false, error: 'No employee records provided.' };
  }

  const sheet = getOrCreateSheet(SHEET_MASTER);
  const existingRows = sheetToObjects(sheet);
  const existingSet = new Set(existingRows.map(r => String(r['Enrollment ID']).trim().toLowerCase()));

  const addedRows = [];
  let addedCount = 0;
  let skippedDuplicates = 0;
  let invalidCount = 0;

  for (let i = 0; i < employees.length; i++) {
    const e = employees[i];
    const enrollId = e.enrollId || e.enrollmentId || e['Enrollment ID'] || e['Enroll ID'];
    const name = e.name || e['Name'];

    if (!enrollId || !name) {
      invalidCount++;
      continue;
    }

    const cleanId = String(enrollId).trim();
    const lookupKey = cleanId.toLowerCase();

    if (existingSet.has(lookupKey)) {
      skippedDuplicates++;
      if (skipDuplicates) continue;
    }

    existingSet.add(lookupKey);
    addedRows.push([
      cleanId,
      name,
      e.designation || e['Designation'] || '',
      e.department || e['Department'] || '',
      e.jobType || e['Job Type'] || 'PERMANENT',
      e.joiningDate || e['Joining Date'] || '',
      e.cardIssueDate || e['Card Issue Date'] || '',
      e.nidNumber || e['NID Number'] || '',
      e.bloodGroup || e['Blood Group'] || 'O+',
      e.contactNumber || e['Contact Number'] || '',
      e.photoUrl || e['Photo URL'] || '',
      e.signatureUrl || e['Signature URL'] || '',
      new Date().toISOString()
    ]);
    addedCount++;
  }

  if (addedRows.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, addedRows.length, addedRows[0].length).setValues(addedRows);
  }

  return {
    success: true,
    added: addedCount,
    duplicates: skippedDuplicates,
    invalid: invalidCount,
    totalProcessed: employees.length
  };
}

function handleEditMasterEmployee(enrollId, emp) {
  if (!enrollId) return { success: false, error: 'Enrollment ID is required' };
  const sheet = getOrCreateSheet(SHEET_MASTER);
  const rows = sheetToObjects(sheet);
  const target = rows.find(r => String(r['Enrollment ID']).trim() === String(enrollId).trim());
  if (!target) return { success: false, error: 'Employee not found' };

  const rIdx = target._rowIndex;
  if (emp.name !== undefined) sheet.getRange(rIdx, 2).setValue(emp.name);
  if (emp.designation !== undefined) sheet.getRange(rIdx, 3).setValue(emp.designation);
  if (emp.department !== undefined) sheet.getRange(rIdx, 4).setValue(emp.department);
  if (emp.jobType !== undefined) sheet.getRange(rIdx, 5).setValue(emp.jobType);
  if (emp.joiningDate !== undefined) sheet.getRange(rIdx, 6).setValue(emp.joiningDate);
  if (emp.cardIssueDate !== undefined) sheet.getRange(rIdx, 7).setValue(emp.cardIssueDate);
  if (emp.nidNumber !== undefined) sheet.getRange(rIdx, 8).setValue(emp.nidNumber);
  if (emp.bloodGroup !== undefined) sheet.getRange(rIdx, 9).setValue(emp.bloodGroup);
  if (emp.contactNumber !== undefined) sheet.getRange(rIdx, 10).setValue(emp.contactNumber);
  if (emp.photoUrl !== undefined) sheet.getRange(rIdx, 11).setValue(emp.photoUrl);
  if (emp.signatureUrl !== undefined) sheet.getRange(rIdx, 12).setValue(emp.signatureUrl);

  return { success: true, message: 'Master record updated.' };
}

function handleDeleteMasterEmployee(enrollId) {
  if (!enrollId) return { success: false, error: 'Enrollment ID is required' };
  const sheet = getOrCreateSheet(SHEET_MASTER);
  const rows = sheetToObjects(sheet);
  const target = rows.find(r => String(r['Enrollment ID']).trim() === String(enrollId).trim());
  if (!target) return { success: false, error: 'Employee not found' };

  sheet.deleteRow(target._rowIndex);
  return { success: true, message: 'Master record deleted.' };
}

/**
 * 9. SETTINGS HANDLERS
 */
function getSettingsMap() {
  const sheet = getOrCreateSheet(SHEET_SETTINGS, ['Key', 'Value', 'Description']);
  const rows = sheetToObjects(sheet);
  const map = {
    supervisorFormEnabled: true,
    supervisorSuccessMessage: 'Employee ID card submitted successfully. The card is queued for printing.',
    supervisorFormDisabledMessage: 'Employee ID Card submissions are currently closed by the administrator.',
    pdfPrintLayout: 'side_by_side'
  };

  rows.forEach(r => {
    const k = r['Key'];
    const v = r['Value'];
    if (k) {
      if (v === 'true' || v === true) map[k] = true;
      else if (v === 'false' || v === false) map[k] = false;
      else map[k] = v;
    }
  });

  return map;
}

function handleGetSettings() {
  return { success: true, settings: getSettingsMap() };
}

function handleUpdateSettings(newSettings) {
  if (!newSettings) return { success: false, error: 'Settings object is required' };
  const sheet = getOrCreateSheet(SHEET_SETTINGS, ['Key', 'Value', 'Description']);
  const rows = sheetToObjects(sheet);
  const keyMap = {};
  rows.forEach(r => { keyMap[r['Key']] = r._rowIndex; });

  for (const key in newSettings) {
    const val = String(newSettings[key]);
    if (keyMap[key]) {
      sheet.getRange(keyMap[key], 2).setValue(val);
    } else {
      sheet.appendRow([key, val, 'System configuration']);
    }
  }

  return { success: true, settings: getSettingsMap() };
}

/**
 * 10. GOOGLE DRIVE IMAGE UPLOADER
 * Converts Base64 data URI -> Blob -> Saves in Drive Folder -> Returns Direct Viewable URL
 */
function saveBase64ImageToDrive(base64Data, filename) {
  try {
    const folder = getOrCreateDriveFolder(DRIVE_FOLDER_NAME);
    const parts = base64Data.split(',');
    const meta = parts[0];
    const rawBase64 = parts[1];

    let mimeType = 'image/jpeg';
    if (meta.indexOf('image/png') !== -1) mimeType = 'image/png';
    else if (meta.indexOf('image/webp') !== -1) mimeType = 'image/webp';

    const decoded = Utilities.base64Decode(rawBase64);
    const blob = Utilities.newBlob(decoded, mimeType, filename);
    const file = folder.createFile(blob);

    // Make file accessible by anyone with the link
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // Return the high-performance Google UserContent thumbnail link
    return 'https://lh3.googleusercontent.com/d/' + file.getId();
  } catch (err) {
    Logger.log('Drive upload failed: ' + err.toString());
    // Fallback: return the original base64 string so data is never lost
    return base64Data;
  }
}

function getOrCreateDriveFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(folderName);
}

/**
 * Format Date objects cleanly as YYYY-MM-DD or DD/MM/YYYY
 */
function formatDateValue(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone() || 'UTC', 'dd/MM/yyyy');
  }
  return String(val);
}

/**
 * INITIAL DATABASE BOOTSTRAPPER
 * Run this function once manually or via 'initDatabase' action to initialize the entire structure!
 */
function setupInitialDatabase() {
  // 1. MasterEmployees Sheet
  const masterSheet = getOrCreateSheet(SHEET_MASTER, [
    'Enrollment ID', 'Name', 'Designation', 'Department', 'Job Type',
    'Joining Date', 'Card Issue Date', 'NID Number', 'Blood Group',
    'Contact Number', 'Photo URL', 'Signature URL', 'Created At'
  ]);

  if (masterSheet.getLastRow() <= 1) {
    masterSheet.appendRow([
      '586665',
      'MD. NUR ALAM',
      'SR. EXECUTIVE',
      'INFORMATION TECHNOLOGY',
      'PERMANENT',
      '01/01/2023',
      '01/01/2026',
      '01643970731',
      'O+',
      '01920-694100',
      '',
      '',
      new Date().toISOString()
    ]);
  }

  // 2. Submissions Sheet
  getOrCreateSheet(SHEET_SUBMISSIONS, [
    'Submission ID', 'Enrollment ID', 'Name', 'Designation', 'Department',
    'Job Type', 'Joining Date', 'Card Issue Date', 'NID Number', 'Blood Group',
    'Emergency Contact', 'Photo URL', 'Signature URL', 'Submitted By',
    'Submitted At', 'Print Status', 'Printed At', 'Print Count'
  ]);

  // 3. Users Sheet
  const usersSheet = getOrCreateSheet(SHEET_USERS, [
    'User ID', 'Username / Email / Enroll ID', 'Password', 'Role', 'Full Name', 'Status'
  ]);

  if (usersSheet.getLastRow() <= 1) {
    usersSheet.appendRow([
      'USR-ADMIN-01',
      'Idcard@nuralam.com',
      '@466035$',
      'Admin',
      'Primary System Administrator',
      'Active'
    ]);
    usersSheet.appendRow([
      'USR-SUP-01',
      '586665',
      '@466035$',
      'Supervisor',
      'Field Supervisor 586665',
      'Active'
    ]);
  }

  // 4. Settings Sheet
  const settingsSheet = getOrCreateSheet(SHEET_SETTINGS, ['Key', 'Value', 'Description']);
  if (settingsSheet.getLastRow() <= 1) {
    settingsSheet.appendRow(['supervisorFormEnabled', 'true', 'Master switch for supervisor form submissions']);
    settingsSheet.appendRow(['supervisorSuccessMessage', 'Employee ID card submitted successfully. The card is queued for printing.', 'Popup message shown upon submission']);
    settingsSheet.appendRow(['supervisorFormDisabledMessage', 'Employee ID Card submissions are currently closed by the administrator.', 'Notice shown when submissions are disabled']);
    settingsSheet.appendRow(['pdfPrintLayout', 'side_by_side', 'Print PDF orientation: side_by_side or top_bottom']);
  }

  return { success: true, message: 'Google Sheets database initialized successfully!' };
}
