const fs = require('fs');

const b64 = JSON.parse(fs.readFileSync('public/assets/assets_base64.json', 'utf8'));

const code = `/**
 * =========================================================================================
 * ID CARD GENERATOR - CLIENT APPLICATION SCRIPT
 * Compatible with GitHub Pages and Google Apps Script Web App (Google Sheets DB)
 * =========================================================================================
 */

// -----------------------------------------------------------------------------
// 1. BACKEND CONFIGURATION
// Paste your deployed Google Apps Script Web App URL below:
// (You can also configure this dynamically from the Admin Settings tab in the app)
// -----------------------------------------------------------------------------
let APPS_SCRIPT_URL = 'YOUR_DEPLOYED_URL_HERE';

// Check if user previously saved a custom URL in localStorage
const storedUrl = localStorage.getItem("id_card_apps_script_url");
if (storedUrl && storedUrl.trim() !== "") {
  APPS_SCRIPT_URL = storedUrl.trim();
}

// -----------------------------------------------------------------------------
// 2. EMBEDDED HIGH-RESOLUTION BRAND ASSETS (Self-contained for GitHub Pages)
// -----------------------------------------------------------------------------
const ASSETS = {
  frontLogo: "data:image/png;base64,${b64.frontLogo}",
  issuingSig: "data:image/png;base64,${b64.issuingSig}",
  footerPillar: "data:image/png;base64,${b64.footerPillar}",
  backFooterLogo: "data:image/png;base64,${b64.backFooterLogo}"
};

// -----------------------------------------------------------------------------
// 3. APPLICATION STATE
// -----------------------------------------------------------------------------
let currentUser = null;
let currentSettings = {
  supervisorFormEnabled: true,
  supervisorSuccessMessage: "Employee ID card submitted successfully. The card is queued for printing.",
  supervisorFormDisabledMessage: "Employee ID Card submissions are currently closed by the administrator.",
  pdfPrintLayout: "side_by_side"
};
let submissionsList = [];
let masterEmployeesList = [];
let capturedPhotoBase64 = "";
let capturedSignatureBase64 = "";
let cameraStream = null;
let activePreviewRecord = null;

// -----------------------------------------------------------------------------
// 4. API COMMUNICATION LAYER (Google Apps Script POST helper)
// -----------------------------------------------------------------------------
async function apiCall(action, payload = {}) {
  const isDemo = (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === "YOUR_DEPLOYED_URL_HERE");

  if (isDemo) {
    return handleLocalDemoCall(action, payload);
  }

  try {
    const postBody = {
      action: action,
      ...payload,
      user: currentUser
    };

    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(postBody),
      redirect: "follow"
    });

    if (!response.ok) {
      throw new Error("HTTP error " + response.status + ": " + response.statusText);
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.warn("Apps Script API call failed, falling back to local storage:", err);
    return handleLocalDemoCall(action, payload);
  }
}

// Local mock handler if Google Apps Script URL has not been deployed yet
function handleLocalDemoCall(action, payload) {
  let mockMaster = JSON.parse(localStorage.getItem("mock_master_employees") || "[]");
  if (mockMaster.length === 0) {
    mockMaster = [
      {
        enrollId: "586665",
        name: "MD. NUR ALAM",
        designation: "SR. EXECUTIVE",
        department: "INFORMATION TECHNOLOGY",
        jobType: "PERMANENT",
        joiningDate: "01/01/2023",
        cardIssueDate: "01/01/2026",
        nidNumber: "01643970731",
        bloodGroup: "O+",
        contactNumber: "01920-694100"
      }
    ];
    localStorage.setItem("mock_master_employees", JSON.stringify(mockMaster));
  }

  let mockSubmissions = JSON.parse(localStorage.getItem("mock_submissions") || "[]");
  let mockSettings = JSON.parse(localStorage.getItem("mock_settings") || JSON.stringify(currentSettings));

  switch (action) {
    case "login":
      const u = (payload.username || "").trim().toLowerCase();
      const p = (payload.password || "").trim();
      const r = (payload.role || "admin").toLowerCase();

      if (r === "admin" && (u === "idcard@nuralam.com" || u === "admin") && p === "@466035$") {
        return { success: true, user: { role: "admin", username: "Idcard@nuralam.com", name: "Administrator" } };
      }
      if (r === "supervisor" && (u === "586665" || u === "supervisor") && p === "@466035$") {
        return { success: true, user: { role: "supervisor", username: u, name: "Field Supervisor " + u, enrollId: u } };
      }
      return { success: false, error: "Invalid credentials. Admin: Idcard@nuralam.com / @466035$, Supervisor: 586665 / @466035$" };

    case "getMasterEmployee":
      const emp = mockMaster.find(m => String(m.enrollId).trim() === String(payload.enrollId).trim());
      if (emp) return { success: true, employee: emp };
      return { success: false, error: "Employee not found in Master Database" };

    case "submitData":
      if (!mockSettings.supervisorFormEnabled) {
        return { success: false, error: mockSettings.supervisorFormDisabledMessage };
      }
      const existing = mockSubmissions.find(s => String(s.enrollId).trim() === String(payload.data.enrollId).trim() && s.printStatus === "pending");
      if (existing) {
        return { success: false, error: "A submission for this Enrollment ID is already pending." };
      }
      const newSub = {
        id: "SUB-" + Date.now(),
        ...payload.data,
        submittedAt: new Date().toISOString(),
        printStatus: "pending",
        printCount: 0
      };
      mockSubmissions.unshift(newSub);
      localStorage.setItem("mock_submissions", JSON.stringify(mockSubmissions));
      return { success: true, submissionId: newSub.id, message: mockSettings.supervisorSuccessMessage };

    case "getSubmissions":
      return { success: true, submissions: mockSubmissions };

    case "updatePrintStatus":
      const sub = mockSubmissions.find(s => s.id === payload.submissionId);
      if (sub) {
        sub.printStatus = payload.status || "printed";
        sub.printedAt = new Date().toISOString();
        sub.printCount = (sub.printCount || 0) + 1;
        localStorage.setItem("mock_submissions", JSON.stringify(mockSubmissions));
        return { success: true, message: "Status updated" };
      }
      return { success: false, error: "Record not found" };

    case "batchUpdatePrintStatus":
      const idSet = new Set(payload.submissionIds || []);
      mockSubmissions.forEach(s => {
        if (idSet.has(s.id)) {
          s.printStatus = payload.status || "printed";
          s.printedAt = new Date().toISOString();
          s.printCount = (s.printCount || 0) + 1;
        }
      });
      localStorage.setItem("mock_submissions", JSON.stringify(mockSubmissions));
      return { success: true, updatedCount: idSet.size };

    case "deleteSubmission":
      mockSubmissions = mockSubmissions.filter(s => s.id !== payload.submissionId);
      localStorage.setItem("mock_submissions", JSON.stringify(mockSubmissions));
      return { success: true };

    case "getMasterEmployees":
      return { success: true, employees: mockMaster };

    case "addMasterEmployee":
      mockMaster.push(payload.employee);
      localStorage.setItem("mock_master_employees", JSON.stringify(mockMaster));
      return { success: true };

    case "deleteMasterEmployee":
      mockMaster = mockMaster.filter(m => m.enrollId !== payload.enrollId);
      localStorage.setItem("mock_master_employees", JSON.stringify(mockMaster));
      return { success: true };

    case "bulkImportMaster":
      let added = 0, duplicates = 0;
      const set = new Set(mockMaster.map(m => String(m.enrollId).trim().toLowerCase()));
      payload.employees.forEach(e => {
        const id = String(e.enrollId || "").trim();
        if (!id) return;
        if (set.has(id.toLowerCase())) {
          duplicates++;
        } else {
          set.add(id.toLowerCase());
          mockMaster.push(e);
          added++;
        }
      });
      localStorage.setItem("mock_master_employees", JSON.stringify(mockMaster));
      return { success: true, added, duplicates, invalid: 0 };

    case "getSettings":
      return { success: true, settings: mockSettings };

    case "updateSettings":
      mockSettings = { ...mockSettings, ...payload.settings };
      localStorage.setItem("mock_settings", JSON.stringify(mockSettings));
      return { success: true, settings: mockSettings };

    default:
      return { success: false, error: "Unknown action: " + action };
  }
}

// -----------------------------------------------------------------------------
// 5. DOM INITIALIZATION
// -----------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  initLoginTabs();
  initLoginForm();
  initSupervisorForm();
  initSignatureCanvas();
  initAdminTabs();
  initModals();
  initSettingsForm();

  // Load backend settings
  const settingsRes = await apiCall("getSettings");
  if (settingsRes && settingsRes.success) {
    currentSettings = { ...currentSettings, ...settingsRes.settings };
  }

  // Check connection status
  updateBackendStatusBadge();

  // Auto restore session if available
  const savedUser = sessionStorage.getItem("id_card_user");
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      showAuthenticatedView();
    } catch (e) {
      sessionStorage.removeItem("id_card_user");
    }
  }
});

function updateBackendStatusBadge() {
  const badge = document.getElementById("connectionStatusBadge");
  if (!badge) return;
  const isDemo = (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === "YOUR_DEPLOYED_URL_HERE");
  if (isDemo) {
    badge.textContent = "Local Storage (Demo)";
    badge.className = "status-badge status-pending";
  } else {
    badge.textContent = "Google Sheets Connected";
    badge.className = "status-badge status-printed";
  }
}

// -----------------------------------------------------------------------------
// 6. AUTHENTICATION MODULE
// -----------------------------------------------------------------------------
let activeLoginRole = "admin";

function initLoginTabs() {
  const tabAdmin = document.getElementById("tabAdminLogin");
  const tabSupervisor = document.getElementById("tabSupervisorLogin");
  const userLabel = document.getElementById("loginUserLabel");
  const usernameInput = document.getElementById("loginUsername");
  const errorMsg = document.getElementById("loginErrorMsg");

  tabAdmin.addEventListener("click", () => {
    activeLoginRole = "admin";
    tabAdmin.classList.add("active");
    tabSupervisor.classList.remove("active");
    userLabel.textContent = "Email Address";
    usernameInput.placeholder = "Enter email address";
    errorMsg.style.display = "none";
  });

  tabSupervisor.addEventListener("click", () => {
    activeLoginRole = "supervisor";
    tabSupervisor.classList.add("active");
    tabAdmin.classList.remove("active");
    userLabel.textContent = "Enrollment ID";
    usernameInput.placeholder = "Enter Enrollment ID";
    errorMsg.style.display = "none";
  });
}

function initLoginForm() {
  const form = document.getElementById("loginForm");
  const usernameInput = document.getElementById("loginUsername");
  const passwordInput = document.getElementById("loginPassword");
  const errorMsg = document.getElementById("loginErrorMsg");
  const submitBtn = document.getElementById("loginSubmitBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorMsg.style.display = "none";
    submitBtn.disabled = true;
    submitBtn.textContent = "Verifying...";

    try {
      const res = await apiCall("login", {
        username: usernameInput.value,
        password: passwordInput.value,
        role: activeLoginRole
      });

      if (res && res.success && res.user) {
        currentUser = res.user;
        sessionStorage.setItem("id_card_user", JSON.stringify(currentUser));
        form.reset();
        showAuthenticatedView();
      } else {
        errorMsg.textContent = (res && res.error) || "Authentication failed. Check credentials.";
        errorMsg.style.display = "block";
      }
    } catch (err) {
      errorMsg.textContent = "Connection error: " + err.message;
      errorMsg.style.display = "block";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Login to Portal";
    }
  });

  logoutBtn.addEventListener("click", () => {
    currentUser = null;
    sessionStorage.removeItem("id_card_user");
    document.getElementById("appHeader").style.display = "none";
    document.getElementById("appWorkspace").style.display = "none";
    document.getElementById("loginScreen").style.display = "flex";
  });
}

function showAuthenticatedView() {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("appHeader").style.display = "block";
  document.getElementById("appWorkspace").style.display = "block";

  const rolePill = document.getElementById("userRolePill");
  const nameDisplay = document.getElementById("userNameDisplay");
  rolePill.textContent = currentUser.role.toUpperCase();
  nameDisplay.textContent = currentUser.name || currentUser.username;

  const supView = document.getElementById("supervisorView");
  const adminView = document.getElementById("adminView");

  if (currentUser.role === "admin") {
    supView.classList.remove("active");
    adminView.classList.add("active");
    loadAdminDashboard();
  } else {
    adminView.classList.remove("active");
    supView.classList.add("active");
    loadSupervisorFormState();
  }
}

// -----------------------------------------------------------------------------
// 7. SUPERVISOR DATA ENTRY MODULE
// -----------------------------------------------------------------------------
function loadSupervisorFormState() {
  const disabledNotice = document.getElementById("supervisorDisabledNotice");
  const activeCard = document.getElementById("supervisorActiveCard");
  const disabledMsgText = document.getElementById("supervisorDisabledMsgText");

  if (!currentSettings.supervisorFormEnabled) {
    activeCard.style.display = "none";
    disabledNotice.style.display = "block";
    disabledMsgText.textContent = currentSettings.supervisorFormDisabledMessage;
  } else {
    disabledNotice.style.display = "none";
    activeCard.style.display = "block";
  }
}

function initSupervisorForm() {
  const enrollInput = document.getElementById("supEnrollId");
  const lookupBtn = document.getElementById("lookupMasterBtn");
  const form = document.getElementById("supervisorEntryForm");
  const errorBox = document.getElementById("supFormError");
  const submitBtn = document.getElementById("supSubmitBtn");

  const performLookup = async () => {
    const id = enrollInput.value.trim();
    if (!id) return;
    errorBox.style.display = "none";
    lookupBtn.disabled = true;
    lookupBtn.textContent = "Searching...";

    try {
      const res = await apiCall("getMasterEmployee", { enrollId: id });
      if (res && res.success && res.employee) {
        const emp = res.employee;
        document.getElementById("supName").value = emp.name || "";
        document.getElementById("supDesignation").value = emp.designation || "";
        document.getElementById("supDepartment").value = emp.department || "";
        document.getElementById("supJobType").value = emp.jobType || "PERMANENT";
        document.getElementById("supJoiningDate").value = emp.joiningDate || "";
        document.getElementById("supCardIssueDate").value = emp.cardIssueDate || "";
        document.getElementById("supNidNumber").value = emp.nidNumber || "";
        document.getElementById("supBloodGroup").value = emp.bloodGroup || "O+";
        document.getElementById("supEmergencyContact").value = emp.contactNumber || "";

        if (emp.photoUrl) {
          setPhotoPreview(emp.photoUrl);
        }
      } else {
        errorBox.textContent = (res && res.error) || "Employee ID not found in Master Database.";
        errorBox.style.display = "block";
      }
    } catch (e) {
      errorBox.textContent = "Lookup failed: " + e.message;
      errorBox.style.display = "block";
    } finally {
      lookupBtn.disabled = false;
      lookupBtn.textContent = "Search";
    }
  };

  lookupBtn.addEventListener("click", performLookup);
  enrollInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      performLookup();
    }
  });

  document.getElementById("supPhotoFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoPreview(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  });

  document.getElementById("clearPhotoBtn").addEventListener("click", () => {
    setPhotoPreview("");
  });

  document.getElementById("supSignatureFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        capturedSignatureBase64 = event.target.result;
        drawSignatureToCanvas(capturedSignatureBase64);
      };
      reader.readAsDataURL(file);
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.style.display = "none";

    const enrollId = enrollInput.value.trim();
    const name = document.getElementById("supName").value.trim();
    const nid = document.getElementById("supNidNumber").value.trim();

    if (!enrollId || !name) {
      errorBox.textContent = "Please enter an Enrollment ID and retrieve employee details first.";
      errorBox.style.display = "block";
      return;
    }

    if (!capturedPhotoBase64) {
      errorBox.textContent = "Employee passport photo is required.";
      errorBox.style.display = "block";
      return;
    }

    const sigCanvas = document.getElementById("supSignatureCanvas");
    if (!capturedSignatureBase64 && !isCanvasBlank(sigCanvas)) {
      capturedSignatureBase64 = sigCanvas.toDataURL("image/png");
    }

    if (!capturedSignatureBase64) {
      errorBox.textContent = "Employee signature is required.";
      errorBox.style.display = "block";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting Entry...";

    const payload = {
      enrollId: enrollId,
      name: name,
      designation: document.getElementById("supDesignation").value.trim(),
      department: document.getElementById("supDepartment").value.trim(),
      jobType: document.getElementById("supJobType").value.trim(),
      joiningDate: document.getElementById("supJoiningDate").value.trim(),
      cardIssueDate: document.getElementById("supCardIssueDate").value.trim(),
      nidNumber: nid,
      bloodGroup: document.getElementById("supBloodGroup").value.trim(),
      emergencyContact: document.getElementById("supEmergencyContact").value.trim(),
      photoUrl: capturedPhotoBase64,
      signatureUrl: capturedSignatureBase64
    };

    try {
      const res = await apiCall("submitData", { data: payload });
      if (res && res.success) {
        const modal = document.getElementById("supervisorSuccessModal");
        const modalText = document.getElementById("supervisorSuccessModalText");
        modalText.textContent = res.message || currentSettings.supervisorSuccessMessage;
        modal.classList.add("active");

        form.reset();
        setPhotoPreview("");
        clearSignatureCanvas();
      } else {
        errorBox.textContent = (res && res.error) || "Submission was not processed.";
        errorBox.style.display = "block";
      }
    } catch (err) {
      errorBox.textContent = "Submission error: " + err.message;
      errorBox.style.display = "block";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Employee ID Card";
    }
  });
}

function setPhotoPreview(url) {
  capturedPhotoBase64 = url;
  const img = document.getElementById("supPhotoPreview");
  const placeholder = document.getElementById("supPhotoPlaceholder");
  if (url) {
    img.src = url;
    img.style.display = "block";
    placeholder.style.display = "none";
  } else {
    img.src = "";
    img.style.display = "none";
    placeholder.style.display = "block";
  }
}

// -----------------------------------------------------------------------------
// 8. SIGNATURE CANVAS DRAWING PAD
// -----------------------------------------------------------------------------
let isDrawing = false;
let sigCtx = null;

function initSignatureCanvas() {
  const canvas = document.getElementById("supSignatureCanvas");
  sigCtx = canvas.getContext("2d");
  sigCtx.lineWidth = 2.2;
  sigCtx.lineCap = "round";
  sigCtx.lineJoin = "round";
  sigCtx.strokeStyle = "#000000";

  const getCanvasPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches && e.touches[0]) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDraw = (e) => {
    e.preventDefault();
    isDrawing = true;
    const pos = getCanvasPos(e);
    sigCtx.beginPath();
    sigCtx.moveTo(pos.x, pos.y);
  };

  const moveDraw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getCanvasPos(e);
    sigCtx.lineTo(pos.x, pos.y);
    sigCtx.stroke();
  };

  const endDraw = () => {
    if (isDrawing) {
      isDrawing = false;
      capturedSignatureBase64 = canvas.toDataURL("image/png");
    }
  };

  canvas.addEventListener("mousedown", startDraw);
  canvas.addEventListener("mousemove", moveDraw);
  window.addEventListener("mouseup", endDraw);

  canvas.addEventListener("touchstart", startDraw, { passive: false });
  canvas.addEventListener("touchmove", moveDraw, { passive: false });
  window.addEventListener("touchend", endDraw);

  document.getElementById("clearSignatureBtn").addEventListener("click", clearSignatureCanvas);
}

function clearSignatureCanvas() {
  const canvas = document.getElementById("supSignatureCanvas");
  if (sigCtx && canvas) {
    sigCtx.clearRect(0, 0, canvas.width, canvas.height);
  }
  capturedSignatureBase64 = "";
}

function drawSignatureToCanvas(dataUrl) {
  const canvas = document.getElementById("supSignatureCanvas");
  const img = new Image();
  img.onload = () => {
    clearSignatureCanvas();
    sigCtx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  img.src = dataUrl;
}

function isCanvasBlank(canvas) {
  const blank = document.createElement("canvas");
  blank.width = canvas.width;
  blank.height = canvas.height;
  return canvas.toDataURL() === blank.toDataURL();
}

// -----------------------------------------------------------------------------
// 9. ADMIN DASHBOARD & SUBMISSIONS QUEUE
// -----------------------------------------------------------------------------
function initAdminTabs() {
  const tabSub = document.getElementById("tabSubmissions");
  const tabMaster = document.getElementById("tabMasterDatabase");
  const tabSettings = document.getElementById("tabAdminSettings");

  const paneSub = document.getElementById("submissionsTabPane");
  const paneMaster = document.getElementById("masterDatabaseTabPane");
  const paneSettings = document.getElementById("adminSettingsTabPane");

  tabSub.addEventListener("click", () => {
    tabSub.classList.add("active");
    tabMaster.classList.remove("active");
    tabSettings.classList.remove("active");
    paneSub.style.display = "block";
    paneMaster.style.display = "none";
    paneSettings.style.display = "none";
    loadSubmissions();
  });

  tabMaster.addEventListener("click", () => {
    tabMaster.classList.add("active");
    tabSub.classList.remove("active");
    tabSettings.classList.remove("active");
    paneSub.style.display = "none";
    paneMaster.style.display = "block";
    paneSettings.style.display = "none";
    loadMasterEmployees();
  });

  tabSettings.addEventListener("click", () => {
    tabSettings.classList.add("active");
    tabSub.classList.remove("active");
    tabMaster.classList.remove("active");
    paneSub.style.display = "none";
    paneMaster.style.display = "none";
    paneSettings.style.display = "block";
    loadSettingsIntoForm();
  });

  document.getElementById("refreshSubmissionsBtn").addEventListener("click", loadSubmissions);
  document.getElementById("filterPrintStatus").addEventListener("change", renderSubmissionsTable);
  document.getElementById("searchSubmissions").addEventListener("input", renderSubmissionsTable);
  document.getElementById("batchPrintBtn").addEventListener("click", handleBatchPrint);

  document.getElementById("selectAllSubmissions").addEventListener("change", (e) => {
    const checked = e.target.checked;
    document.querySelectorAll(".sub-row-check").forEach(cb => { cb.checked = checked; });
  });

  document.getElementById("refreshMasterBtn").addEventListener("click", loadMasterEmployees);
  document.getElementById("searchMasterDb").addEventListener("input", renderMasterTable);
  document.getElementById("masterCsvFileInput").addEventListener("change", handleCsvUpload);
}

async function loadAdminDashboard() {
  await loadSubmissions();
}

async function loadSubmissions() {
  const tbody = document.getElementById("submissionsTableBody");
  tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem;">Loading submissions from Google Sheets...</td></tr>';

  try {
    const res = await apiCall("getSubmissions");
    if (res && res.success) {
      submissionsList = res.submissions || [];
      renderSubmissionsTable();
    } else {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--danger); padding: 1.5rem;">Failed to load submissions.</td></tr>';
    }
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--danger); padding: 1.5rem;">Error: ' + e.message + '</td></tr>';
  }
}

function renderSubmissionsTable() {
  const tbody = document.getElementById("submissionsTableBody");
  const filter = document.getElementById("filterPrintStatus").value;
  const search = document.getElementById("searchSubmissions").value.trim().toLowerCase();

  const filtered = submissionsList.filter(s => {
    const statusMatch = (filter === "all") || (s.printStatus === filter);
    const textMatch = !search ||
      (s.name && s.name.toLowerCase().includes(search)) ||
      (s.enrollId && s.enrollId.toLowerCase().includes(search)) ||
      (s.department && s.department.toLowerCase().includes(search));
    return statusMatch && textMatch;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem; color: var(--text-muted);">No records found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(item => \`
    <tr>
      <td><input type="checkbox" class="sub-row-check" data-id="\${item.id}"></td>
      <td><span style="font-family: monospace; font-size: 0.75rem;">\${item.id}</span></td>
      <td><strong>\${item.enrollId}</strong></td>
      <td>\${item.name}</td>
      <td>\${item.designation || "-"}</td>
      <td>\${item.department || "-"}</td>
      <td><span style="font-size: 0.8rem; color: var(--text-muted);">\${formatDate(item.submittedAt)}</span></td>
      <td>
        <span class="status-badge \${item.printStatus === "printed" ? "status-printed" : "status-pending"}">
          \${item.printStatus}
        </span>
      </td>
      <td><span style="font-weight: 700;">\${item.printCount || 0}</span></td>
      <td style="text-align: right; white-space: nowrap;">
        <button class="btn btn-secondary btn-sm" onclick="openPreviewModal('\${item.id}')">View & Print</button>
        \${item.printStatus === "pending"
          ? \`<button class="btn btn-primary btn-sm" onclick="markAsPrinted('\${item.id}')">Mark Printed</button>\`
          : \`<button class="btn btn-secondary btn-sm" onclick="reprintSubmission('\${item.id}')">Reprint</button>\`
        }
        <button class="btn btn-danger btn-sm" onclick="deleteSubmissionRecord('\${item.id}')">&times;</button>
      </td>
    </tr>
  \`).join("");
}

// -----------------------------------------------------------------------------
// 10. AUTHENTIC CARD GENERATOR ENGINE (Pixel-perfect CR80 layout)
// -----------------------------------------------------------------------------
function buildCardFrontHtml(emp) {
  const photoSrc = emp.photoUrl || "";
  const sigSrc = emp.signatureUrl || "";

  return \`
    <div class="id-card card-front" data-id="\${emp.id || emp.enrollId}">
      <!-- Top Pink Header -->
      <div class="front-header">
        <img src="\${ASSETS.frontLogo}" alt="ROSA Beyond Beauty" class="front-logo-img">
      </div>

      <!-- Front Middle Body -->
      <div class="front-body">
        <div class="emp-name">\${emp.name || ""}</div>
        <div class="emp-designation">\${emp.designation || ""}</div>
        <div class="emp-department">\${emp.department || ""}</div>

        <!-- 2x2 Info Grid -->
        <div class="info-grid">
          <div class="info-item">
            <span class="item-label">JOB TYPE</span>
            <span class="item-value">\${emp.jobType || "PERMANENT"}</span>
          </div>
          <div class="info-item">
            <span class="item-label">JOINING DATE</span>
            <span class="item-value">\${emp.joiningDate || ""}</span>
          </div>
          <div class="info-item">
            <span class="item-label">ENROLL ID</span>
            <span class="item-value">\${emp.enrollId || ""}</span>
          </div>
          <div class="info-item">
            <span class="item-label">CARD ISSUE</span>
            <span class="item-value">\${emp.cardIssueDate || ""}</span>
          </div>
        </div>
      </div>

      <!-- Lower Section (Photo, Signatures, Red Banner, Footer Logo) -->
      <div class="front-lower">
        <div class="red-footer-banner"></div>

        <!-- Employee Photo (170px, 2px, 94x104px) -->
        <div class="emp-photo-frame">
          \${photoSrc ? \`<img src="\${photoSrc}" alt="\${emp.name}">\` : \`<span style="font-size: 8px; color: #94a3b8; font-weight: bold;">PHOTO</span>\`}
        </div>

        <!-- Employee Signature Box -->
        <div class="emp-signature-box">
          \${sigSrc ? \`<img src="\${sigSrc}" alt="Signature">\` : ""}
        </div>
        <div class="emp-sig-caption">
          <div class="sig-line"></div>
          <span class="sig-text">Employee</span>
        </div>

        <!-- Issuing Authority Signature -->
        <div class="authority-sig-box">
          <img src="\${ASSETS.issuingSig}" alt="Authorized Signature">
        </div>

        <!-- Black Pillar Logo Icon (Transparent PNG replacement) -->
        <div class="footer-logo-box">
          <img src="\${ASSETS.footerPillar}" alt="Footer Logo">
        </div>

        <!-- BEYOND TOMORROW Typography -->
        <div class="footer-text-box">
          <span>BEYOND</span>
          <span>TOMORROW</span>
        </div>
      </div>
    </div>
  \`;
}

function buildCardBackHtml(emp) {
  const nid = emp.nidNumber || emp.nationalId || "";
  const blood = emp.bloodGroup || "O+";
  const contact = emp.emergencyContact || emp.contactNumber || "01920-694100";

  return \`
    <div class="id-card card-back" data-id="\${emp.id || emp.enrollId}">
      <!-- Top Pink Return Notice -->
      <div class="back-header">
        <span>If found please return to:</span>
      </div>

      <!-- AKIJ CERAMICS Address Info -->
      <div class="back-company-info">
        <div class="back-company-title">AKIJ CERAMICS LIMITED.</div>
        <div class="back-company-line">Mukkhopur, Trishal, Mymensingh Bangladesh</div>
        <div class="back-company-line">Call: 01920-694100, 01833-636610</div>
      </div>

      <!-- Terracotta Rounded Container -->
      <div class="back-terracotta-box">
        <div class="terracotta-title">EMPLOYEE INFORMATION</div>

        <span class="back-field-label">PERMANENT ADDRESS</span>
        <span class="back-field-value">Mukkhopur, Trishal, Mymensingh</span>

        <span class="back-field-label">EMERGENCY CONTACT</span>
        <span class="back-field-value">\${contact}</span>

        <div style="display: flex; justify-content: space-between; margin-top: 6px;">
          <div>
            <span class="back-field-label">NATIONAL ID</span>
            <span class="back-field-value">\${nid}</span>
          </div>
          <div>
            <span class="back-field-label">BLOOD GROUP</span>
            <span class="back-field-value">\${blood}</span>
          </div>
        </div>
      </div>

      <!-- Validity Notice -->
      <div class="back-validity">VALID UNTILL REVOKED</div>

      <!-- Disclaimer -->
      <div class="back-disclaimer">
        In case of losing this identity card, please<br>
        notify your managing authortity promotly.
      </div>

      <!-- Bottom Black Banner with Akij Bashir Group Logo -->
      <div class="back-footer-banner">
        <img src="\${ASSETS.backFooterLogo}" alt="Akij Bashir Group">
      </div>
    </div>
  \`;
}

// -----------------------------------------------------------------------------
// 11. PRINTING ENGINE (Side-by-Side & Top-Bottom Customizable PDF Printing)
// -----------------------------------------------------------------------------
function openPreviewModal(subId) {
  const sub = submissionsList.find(s => s.id === subId);
  if (!sub) return;
  activePreviewRecord = sub;

  const container = document.getElementById("modalCardPreviewContainer");
  const title = document.getElementById("cardPreviewTitle");
  title.textContent = "Card Preview: " + sub.name + " (" + sub.enrollId + ")";

  container.innerHTML = buildCardFrontHtml(sub) + buildCardBackHtml(sub);
  document.getElementById("cardPreviewModal").classList.add("active");
}

function handleBatchPrint() {
  const checked = Array.from(document.querySelectorAll(".sub-row-check:checked")).map(cb => cb.dataset.id);
  if (checked.length === 0) {
    alert("Please select at least one employee card to print.");
    return;
  }

  const selectedSubs = submissionsList.filter(s => checked.includes(s.id));
  printCards(selectedSubs);
}

function printCards(employees) {
  const printContainer = document.getElementById("printSheetContainer");
  const layoutClass = (currentSettings.pdfPrintLayout === "top_bottom") ? "layout-top-bottom" : "layout-side-by-side";

  printContainer.innerHTML = employees.map(emp => \`
    <div class="print-page \${layoutClass}">
      \${buildCardFrontHtml(emp)}
      \${buildCardBackHtml(emp)}
    </div>
  \`).join("");

  window.print();

  const ids = employees.map(e => e.id);
  apiCall("batchUpdatePrintStatus", { submissionIds: ids, status: "printed" }).then(() => {
    loadSubmissions();
  });
}

async function markAsPrinted(subId) {
  await apiCall("updatePrintStatus", { submissionId: subId, status: "printed" });
  loadSubmissions();
}

async function reprintSubmission(subId) {
  await apiCall("updatePrintStatus", { submissionId: subId, status: "printed" });
  const sub = submissionsList.find(s => s.id === subId);
  if (sub) {
    printCards([sub]);
  }
}

async function deleteSubmissionRecord(subId) {
  if (confirm("Are you sure you want to delete this submission record?")) {
    await apiCall("deleteSubmission", { submissionId: subId });
    loadSubmissions();
  }
}

// -----------------------------------------------------------------------------
// 12. MASTER DATABASE MANAGEMENT MODULE
// -----------------------------------------------------------------------------
async function loadMasterEmployees() {
  const tbody = document.getElementById("masterTableBody");
  tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem;">Loading Master Database...</td></tr>';

  try {
    const res = await apiCall("getMasterEmployees");
    if (res && res.success) {
      masterEmployeesList = res.employees || [];
      renderMasterTable();
    } else {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--danger);">Failed to load master records.</td></tr>';
    }
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--danger);">' + e.message + '</td></tr>';
  }
}

function renderMasterTable() {
  const tbody = document.getElementById("masterTableBody");
  const search = document.getElementById("searchMasterDb").value.trim().toLowerCase();

  const filtered = masterEmployeesList.filter(m => {
    return !search ||
      (m.name && m.name.toLowerCase().includes(search)) ||
      (m.enrollId && m.enrollId.toLowerCase().includes(search)) ||
      (m.department && m.department.toLowerCase().includes(search));
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem; color: var(--text-muted);">No records found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(m => \`
    <tr>
      <td><strong>\${m.enrollId}</strong></td>
      <td>\${m.name}</td>
      <td>\${m.designation || "-"}</td>
      <td>\${m.department || "-"}</td>
      <td>\${m.jobType || "PERMANENT"}</td>
      <td>\${m.joiningDate || "-"}</td>
      <td>\${m.cardIssueDate || "-"}</td>
      <td>\${m.bloodGroup || "O+"}</td>
      <td>\${m.contactNumber || "-"}</td>
      <td style="text-align: right;">
        <button class="btn btn-danger btn-sm" onclick="deleteMasterRecord('\${m.enrollId}')">&times;</button>
      </td>
    </tr>
  \`).join("");
}

async function deleteMasterRecord(enrollId) {
  if (confirm("Delete employee " + enrollId + " from Master Database?")) {
    await apiCall("deleteMasterEmployee", { enrollId });
    loadMasterEmployees();
  }
}

function handleCsvUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    const text = event.target.result;
    const lines = text.split(/\\r?\\n/).filter(l => l.trim() !== "");
    if (lines.length <= 1) {
      alert("CSV file is empty or missing data rows.");
      return;
    }

    const headers = lines[0].split(",").map(h => h.trim().replace(/^[\\"\\xEF\\xBB\\xBF]+|[\\"]+$/g, ""));
    const employees = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",").map(p => p.trim().replace(/^\\"|\\"$/g, ""));
      if (parts.length < 2) continue;
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = parts[idx] || "";
      });
      employees.push({
        enrollId: row["Enrollment ID"] || row["Enroll ID"] || row["enrollId"] || parts[0],
        name: row["Name"] || row["name"] || parts[1],
        designation: row["Designation"] || row["designation"] || parts[2] || "",
        department: row["Department"] || row["department"] || parts[3] || "",
        jobType: row["Job Type"] || row["jobType"] || parts[4] || "PERMANENT",
        joiningDate: row["Joining Date"] || row["joiningDate"] || parts[5] || "",
        cardIssueDate: row["Card Issue Date"] || row["cardIssueDate"] || parts[6] || "",
        nidNumber: row["NID Number"] || row["nidNumber"] || parts[7] || "",
        bloodGroup: row["Blood Group"] || row["bloodGroup"] || parts[8] || "O+",
        contactNumber: row["Contact Number"] || row["contactNumber"] || parts[9] || ""
      });
    }

    if (employees.length === 0) {
      alert("No valid employee rows found.");
      return;
    }

    const res = await apiCall("bulkImportMaster", { employees, skipDuplicates: true });
    if (res && res.success) {
      alert("Import complete! Added: " + res.added + ", Duplicates skipped: " + res.duplicates + ", Invalid: " + res.invalid);
      loadMasterEmployees();
    } else {
      alert("Import error: " + ((res && res.error) || "Unknown error"));
    }
  };
  reader.readAsText(file);
}

// -----------------------------------------------------------------------------
// 13. SETTINGS & APP CONFIGURATION MODULE
// -----------------------------------------------------------------------------
function initSettingsForm() {
  const form = document.getElementById("adminSettingsForm");
  const testBtn = document.getElementById("testScriptConnBtn");
  const testResult = document.getElementById("connTestResult");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("saveSettingsBtn");
    btn.disabled = true;
    btn.textContent = "Saving...";

    const newUrl = document.getElementById("settingAppsScriptUrl").value.trim();
    if (newUrl) {
      APPS_SCRIPT_URL = newUrl;
      localStorage.setItem("id_card_apps_script_url", newUrl);
    } else {
      localStorage.removeItem("id_card_apps_script_url");
    }

    const selectedLayout = document.querySelector('input[name="settingPrintLayout"]:checked').value;
    const updateObj = {
      supervisorFormEnabled: document.getElementById("settingFormEnabled").checked,
      supervisorSuccessMessage: document.getElementById("settingSuccessMsg").value.trim(),
      supervisorFormDisabledMessage: document.getElementById("settingDisabledMsg").value.trim(),
      pdfPrintLayout: selectedLayout
    };

    try {
      const res = await apiCall("updateSettings", { settings: updateObj });
      if (res && res.success) {
        currentSettings = { ...currentSettings, ...res.settings };
        updateBackendStatusBadge();
        alert("Settings saved successfully!");
      }
    } catch (err) {
      alert("Failed to save settings: " + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "Save Settings";
    }
  });

  testBtn.addEventListener("click", async () => {
    const url = document.getElementById("settingAppsScriptUrl").value.trim();
    if (!url) {
      testResult.textContent = "Please enter an Apps Script URL first.";
      testResult.style.color = "var(--danger)";
      return;
    }
    testResult.textContent = "Testing...";
    testResult.style.color = "var(--text-muted)";

    try {
      const res = await fetch(url + "?action=ping", { redirect: "follow" });
      const data = await res.json();
      if (data && data.success) {
        testResult.textContent = "Online & Connected!";
        testResult.style.color = "var(--success)";
      } else {
        testResult.textContent = "Script replied with error.";
        testResult.style.color = "var(--danger)";
      }
    } catch (err) {
      testResult.textContent = "Connection failed: " + err.message;
      testResult.style.color = "var(--danger)";
    }
  });
}

function loadSettingsIntoForm() {
  document.getElementById("settingFormEnabled").checked = !!currentSettings.supervisorFormEnabled;
  document.getElementById("settingSuccessMsg").value = currentSettings.supervisorSuccessMessage || "";
  document.getElementById("settingDisabledMsg").value = currentSettings.supervisorFormDisabledMessage || "";
  document.getElementById("settingAppsScriptUrl").value = APPS_SCRIPT_URL !== "YOUR_DEPLOYED_URL_HERE" ? APPS_SCRIPT_URL : "";

  const layout = currentSettings.pdfPrintLayout || "side_by_side";
  const rad = document.querySelector('input[name="settingPrintLayout"][value="' + layout + '"]');
  if (rad) rad.checked = true;
}

// -----------------------------------------------------------------------------
// 14. MODAL CONTROLS & CAMERA SNAPSHOT
// -----------------------------------------------------------------------------
function initModals() {
  document.getElementById("closeSuccessModalBtn").addEventListener("click", () => {
    document.getElementById("supervisorSuccessModal").classList.remove("active");
  });

  document.getElementById("closeCardPreviewBtn").addEventListener("click", () => {
    document.getElementById("cardPreviewModal").classList.remove("active");
  });
  document.getElementById("closePreviewBtn").addEventListener("click", () => {
    document.getElementById("cardPreviewModal").classList.remove("active");
  });
  document.getElementById("printFromPreviewBtn").addEventListener("click", () => {
    if (activePreviewRecord) {
      printCards([activePreviewRecord]);
    }
  });

  const cameraModal = document.getElementById("cameraModal");
  const video = document.getElementById("cameraVideo");

  document.getElementById("openCameraBtn").addEventListener("click", async () => {
    cameraModal.classList.add("active");
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: "user" }
      });
      video.srcObject = cameraStream;
    } catch (err) {
      alert("Unable to access camera: " + err.message);
      cameraModal.classList.remove("active");
    }
  });

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
    cameraModal.classList.remove("active");
  };

  document.getElementById("closeCameraModalBtn").addEventListener("click", stopCamera);
  document.getElementById("cancelCameraBtn").addEventListener("click", stopCamera);

  document.getElementById("takeSnapshotBtn").addEventListener("click", () => {
    const canvas = document.getElementById("cameraCanvas");
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setPhotoPreview(dataUrl);
    stopCamera();
  });

  const masterModal = document.getElementById("masterEmployeeModal");
  document.getElementById("openAddMasterModalBtn").addEventListener("click", () => {
    document.getElementById("masterEmployeeForm").reset();
    masterModal.classList.add("active");
  });
  document.getElementById("closeMasterModalBtn").addEventListener("click", () => {
    masterModal.classList.remove("active");
  });
  document.getElementById("cancelMasterModalBtn").addEventListener("click", () => {
    masterModal.classList.remove("active");
  });

  document.getElementById("masterEmployeeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const emp = {
      enrollId: document.getElementById("masterEnrollId").value.trim(),
      name: document.getElementById("masterName").value.trim(),
      designation: document.getElementById("masterDesignation").value.trim(),
      department: document.getElementById("masterDepartment").value.trim(),
      jobType: document.getElementById("masterJobType").value.trim(),
      joiningDate: document.getElementById("masterJoiningDate").value.trim(),
      cardIssueDate: document.getElementById("masterCardIssueDate").value.trim(),
      nidNumber: document.getElementById("masterNid").value.trim(),
      bloodGroup: document.getElementById("masterBlood").value.trim(),
      contactNumber: document.getElementById("masterContact").value.trim()
    };

    const res = await apiCall("addMasterEmployee", { employee: emp });
    if (res && res.success) {
      masterModal.classList.remove("active");
      loadMasterEmployees();
    } else {
      alert("Error adding employee: " + ((res && res.error) || "Duplicate ID"));
    }
  });
}

// -----------------------------------------------------------------------------
// 15. UTILITIES
// -----------------------------------------------------------------------------
function formatDate(isoStr) {
  if (!isoStr) return "-";
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return isoStr;
  }
}

window.openPreviewModal = openPreviewModal;
window.markAsPrinted = markAsPrinted;
window.reprintSubmission = reprintSubmission;
window.deleteSubmissionRecord = deleteSubmissionRecord;
window.deleteMasterRecord = deleteMasterRecord;
`;

fs.writeFileSync('github-pages/script.js', code);
console.log('Successfully wrote github-pages/script.js. Bytes:', fs.statSync('github-pages/script.js').size);
