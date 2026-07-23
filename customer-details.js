const urlParams = new URLSearchParams(window.location.search);
const clientCode = urlParams.get('code');
let clientName = '';

// مفاتيح التخزين (تُستخدم حالياً كمرحلة انتقالية قبل تفعيل Firebase)
const STORAGE_KEY = 'asgate_customers_final_v2';
const VISITS_KEY = 'asgate_visits_final_v21';

const contentBody = document.getElementById('contentBody');
const managerTableBody = document.getElementById('managerTableBody');

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

function safe(v, fallback = '-') {
  const val = v && String(v).trim() ? String(v).trim() : fallback;
  return escapeHTML(val);
}

function goBackAndFocus() {
  if (clientCode) sessionStorage.setItem('last_viewed_client_code', clientCode);
  window.location.href = 'customers.html';
}

function getTodayDateFormatted() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// الدالة مبنية لتكون Async لتسهيل عملية التحويل إلى Firebase مستقبلاً
async function loadClientData() {
  if (!clientCode) return;
  
  try {
    // TODO: استبدل السطرين التاليين بكود جلب البيانات من Firestore
    // const docRef = doc(db, 'customers', clientCode);
    // const docSnap = await getDoc(docRef);
    // const client = docSnap.exists() ? docSnap.data() : null;
    
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const client = data.find(c => c.code === clientCode);
    if (!client) return;

    clientName = client.comp || '';
    document.title = `${safe(client.comp, 'تفاصيل العميل')} | ASGate`;
    document.getElementById('c-name').innerText = safe(client.comp, 'غير محدد');
    document.getElementById('c-cr1').innerText = safe(client.cr1 || client.cr || client.record, '0000000');
    document.getElementById('c-cr2').innerText = safe(client.cr2, 'غير محدد');
    document.getElementById('c-city').innerText = safe(client.city || client.address, 'غير محدد');
    document.getElementById('c-district').innerText = safe(client.district, 'غير محدد');
    document.getElementById('c-source').innerText = safe(client.classification || client.source, 'غير محدد');
    document.getElementById('c-owner').innerText = safe(client.owner, 'غير محدد');
  } catch (error) {
    console.error("Error loading client data:", error);
  }
}

function renderEmptyMessage(message) {
  contentBody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:48px;color:#94a3b8;font-size:15px;background:#f8fafc;">${message}</td></tr>`;
}

// دالة مساعدة لتحديد لون الحالة
function getStatusBadge(statusStr) {
  const status = String(statusStr).toLowerCase();
  if (status.includes('مكتمل')) return `<span class="status-badge status-green">${statusStr}</span>`;
  if (status.includes('معلق')) return `<span class="status-badge status-yellow">${statusStr}</span>`;
  if (status.includes('جديد')) return `<span class="status-badge status-white">${statusStr}</span>`;
  if (status.includes('مرتجع')) return `<span class="status-badge status-light-red">${statusStr}</span>`;
  if (status.includes('مفقود') || status.includes('خسارة')) return `<span class="status-badge status-dark-red">${statusStr}</span>`;
  return `<span class="status-badge status-green">${statusStr}</span>`; // الافتراضي
}

async function openTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  
  if (tab === 'o-history') {
    document.getElementById('btn-o').classList.add('active');
    renderEmptyMessage('لا توجد طلبات سابقة مسجلة لهذا العميل حتى الآن.');
  } else if (tab === 'attachments') {
    document.getElementById('btn-a').classList.add('active');
    renderEmptyMessage('المنطقة المخصصة للمرفقات. سيتم عرض ملفات PDF و Excel المرفوعة سحابياً هنا.');
  } else if (tab === 'v-history') {
    document.getElementById('btn-v').classList.add('active');
    
    // TODO: جلب الزيارات من Firebase بناءً على clientCode
    const visits = JSON.parse(localStorage.getItem(VISITS_KEY) || '[]').filter(v => v.comp === clientName);
    
    if (!visits.length) {
      renderEmptyMessage('لا توجد سجلات زيارات مسجلة لهذا العميل حالياً.');
      return;
    }
    
    contentBody.innerHTML = visits.map(v => `
      <tr>
        <td>${safe(v.visitDate)}</td>
        <td>${safe(v.address || v.location || 'غير محدد')}</td>
        <td>${getStatusBadge(v.status || 'مكتملة')}</td>
        <td>${safe(v.notes || '-')}</td>
      </tr>
    `).join('');
  }
}

// --- نظام فريق المتابعة (بنية جاهزة للسحابة) ---
function getManagersKey() { return `asgate_customer_managers_${clientCode}`; }

async function loadManagersData() {
  if (!managerTableBody) return;
  // TODO: استبدال بـ Firebase Firestore
  const managers = JSON.parse(localStorage.getItem(getManagersKey()) || '[]');

  if (!managers.length) {
    managerTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:48px;color:#94a3b8;font-size:15px;background:#f8fafc;">لا توجد بيانات متابعة. اضغط على "إضافة صف جديد" للبدء.</td></tr>`;
    return;
  }

  managerTableBody.innerHTML = managers.map((m, index) => `
    <tr>
      <td><input type="text" class="edit-input" placeholder="أدخل الاسم..." value="${safe(m.name, '')}" onchange="updateManager(${index}, 'name', this.value)"></td>
      <td><input type="text" class="edit-input" placeholder="05XXXXXXXX" value="${safe(m.mob, '')}" onchange="updateManager(${index}, 'mob', this.value)" dir="ltr" style="text-align:right;"></td>
      <td><input type="email" class="edit-input" placeholder="email@example.com" value="${safe(m.email, '')}" onchange="updateManager(${index}, 'email', this.value)" dir="ltr" style="text-align:right;"></td>
      <td class="text-center">
        <input type="radio" name="main_contact" ${m.main ? 'checked' : ''} onchange="setMainManager(${index})" style="cursor:pointer; width:18px; height:18px; accent-color:var(--primary);">
      </td>
      <td style="color:var(--muted); text-align:center;">${safe(m.date || getTodayDateFormatted())}</td>
      <td class="text-center">
        <button class="btn btn-danger" onclick="removeManagerRow(${index})">حذف</button>
      </td>
    </tr>
  `).join('');
}

async function updateManager(index, field, value) {
  const managers = JSON.parse(localStorage.getItem(getManagersKey()) || '[]');
  if(managers[index]) {
    managers[index][field] = value;
    localStorage.setItem(getManagersKey(), JSON.stringify(managers));
    // TODO: تحديث المصفوفة في وثيقة Firestore
  }
}

async function setMainManager(index) {
  const managers = JSON.parse(localStorage.getItem(getManagersKey()) || '[]');
  managers.forEach((m, i) => m.main = (i === index));
  localStorage.setItem(getManagersKey(), JSON.stringify(managers));
}

async function addNewManagerRow() {
  const managers = JSON.parse(localStorage.getItem(getManagersKey()) || '[]');
  managers.push({ name: '', mob: '', email: '', main: managers.length === 0, date: getTodayDateFormatted() });
  localStorage.setItem(getManagersKey(), JSON.stringify(managers));
  await loadManagersData();
}

async function removeManagerRow(index) {
  if(!confirm('هل أنت متأكد من حذف هذا المسؤول؟')) return;
  const managers = JSON.parse(localStorage.getItem(getManagersKey()) || '[]');
  managers.splice(index, 1);
  localStorage.setItem(getManagersKey(), JSON.stringify(managers));
  await loadManagersData();
}

// --- نظام النافذة المنبثقة للأنشطة والمرفقات ---
const noteModal = document.getElementById('noteModal');
const fileUpload = document.getElementById('fileUpload');
const fileNameDisplay = document.getElementById('fileName');

function openNoteModal() { noteModal.classList.add('active'); }
function closeNoteModal() { 
  noteModal.classList.remove('active'); 
  document.getElementById('activityNote').value = '';
  fileUpload.value = '';
  fileNameDisplay.textContent = '';
}

fileUpload.addEventListener('change', function(e) {
  if (this.files && this.files.length > 0) {
    fileNameDisplay.textContent = this.files[0].name;
  } else {
    fileNameDisplay.textContent = '';
  }
});

async function saveActivity() {
  const note = document.getElementById('activityNote').value;
  const file = fileUpload.files[0];
  
  if (!note && !file) {
    alert("يرجى كتابة ملاحظة أو إرفاق ملف");
    return;
  }
  
  // TODO: هنا سيتم رفع الملف إلى Firebase Storage وحفظ الملاحظة في Firestore
  console.log("Saving Activity:", { note, file: file ? file.name : null });
  
  closeNoteModal();
  alert("تم تسجيل النشاط بنجاح!");
}

// التهيئة الأولية
document.addEventListener('DOMContentLoaded', async () => {
  await loadClientData();
  await loadManagersData();
  openTab('o-history');
});
