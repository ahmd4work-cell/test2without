let currentActivePreview = null;
let currentAttachmentName = null; 
let pendingAttachment = null;
const LOGS_KEY = 'asgate_general_sales_logs';
// تم تعديل المفتاح ليطابق صفحة العملاء الجديدة المحدثة
const CUSTOMERS_STORAGE_KEY = 'asgate_customers_final_v2'; 
let saveTimeout;

function getTodayFormatted() { return new Date().toISOString().split('T')[0]; }
function getTimeFormatted() { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ":" + String(d.getMinutes()).padStart(2, '0'); }

// دالة لمعرفة اسم اليوم بالعربي
function getArabicDayName(dateString) {
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const d = dateString ? new Date(dateString) : new Date();
    return days[d.getDay()];
}

function initPage() {
    initStatsVisibility();
    loadSalesFromStorage();
}

function toggleStatsVisibility() {
    const container = document.getElementById('statsContainer');
    const btn = document.getElementById('eyeToggleBtn');
    const isHidden = container.classList.toggle('blur-active');
    
    if (isHidden) {
        btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
        localStorage.setItem('asgate_sales_stats_hidden', 'true');
    } else {
        btn.innerHTML = '<i class="fas fa-eye"></i>';
        localStorage.setItem('asgate_sales_stats_hidden', 'false');
    }
}

function initStatsVisibility() {
    const isHidden = localStorage.getItem('asgate_sales_stats_hidden') === 'true';
    if (isHidden) {
        document.getElementById('statsContainer').classList.add('blur-active');
        document.getElementById('eyeToggleBtn').innerHTML = '<i class="fas fa-eye-slash"></i>';
    }
}

function debouncedSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        autoSave();
    }, 500);
}

function toggleGeneralLogHeight() {
    const section = document.getElementById('generalActivityLogSection');
    const btn = document.getElementById('toggleGeneralLogBtn');
    if (section.classList.contains('expanded')) {
        section.classList.remove('expanded');
        btn.innerHTML = '<i class="fas fa-expand-alt"></i>';
    } else {
        section.classList.add('expanded');
        btn.innerHTML = '<i class="fas fa-compress-alt"></i>';
    }
}

function generateCustomOrderId() {
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2); 
    const month = String(now.getMonth() + 1).padStart(2, '0'); 
    const prefix = year + month; 
    const saved = JSON.parse(localStorage.getItem('asgate_sales_db') || '[]');
    let maxSequence = 0;
    saved.forEach(item => {
        const idStr = String(item.id);
        if (idStr.startsWith(prefix) && idStr.length === 8) {
            const seq = parseInt(idStr.slice(4), 10);
            if (seq > maxSequence) maxSequence = seq;
        }
    });
    return prefix + String(maxSequence + 1).padStart(4, '0');
}

function updateHeaderStats() {
    const saved = JSON.parse(localStorage.getItem('asgate_sales_db') || '[]');
    const currentMonthStr = getTodayFormatted().substring(0, 7);
    
    let totalComp = 0, totalPend = 0, monthCount = 0;
    let monthComp = 0, monthPend = 0;
    
    saved.forEach(item => {
        const sums = calculateOrderSums(item.id);
        totalComp += sums.completed; 
        totalPend += sums.pending;
        
        if (item.date && item.date.startsWith(currentMonthStr)) {
            monthCount++;
            monthComp += sums.completed;
            monthPend += sums.pending;
        }
    });
    
    document.getElementById('count-total').innerText = saved.length;
    document.getElementById('month-count').innerText = monthCount;
    document.getElementById('sum-completed').innerText = totalComp.toLocaleString('en-US', {minimumFractionDigits: 2});
    document.getElementById('sum-pending').innerText = totalPend.toLocaleString('en-US', {minimumFractionDigits: 2});
    document.getElementById('month-completed').innerText = monthComp.toLocaleString('en-US', {minimumFractionDigits: 2});
    document.getElementById('month-pending').innerText = monthPend.toLocaleString('en-US', {minimumFractionDigits: 2});
}

function calculateOrderSums(orderId) {
    const productsDb = JSON.parse(localStorage.getItem('asgate_products_db') || '{}');
    const products = productsDb[orderId] || [];
    let completed = 0, pending = 0;
    products.forEach(p => {
        const lineTotal = (parseFloat(p.qty) || 0) * (parseFloat(String(p.sub).replace(/[^\d.]/g, '')) || 0);
        if (p.status === "مكتمل") completed += lineTotal;
        if (p.status === "معلق") pending += lineTotal;
    });
    return { completed, pending };
}

function loadSalesFromStorage() {
    const tbody = document.getElementById('salesBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const saved = JSON.parse(localStorage.getItem('asgate_sales_db') || '[]');
    saved.forEach(obj => renderTableRow(obj));
    updateHeaderStats();
    renderGeneralLog();
}

function renderTableRow(obj) {
    const tbody = document.getElementById('salesBody');
    const sums = calculateOrderSums(obj.id);
    const row = tbody.insertRow(-1);
    row.className = 'main-row';
    row.id = `row-${obj.id}`;
    
    if (obj.status === "فقدان") row.classList.add('lost-row');
    
    row.innerHTML = `
        <td><input type="checkbox" class="select-check"></td>
        <td><a href="./order_details.html?id=${obj.id}" class="order-link" title="فتح التفاصيل">#${obj.id}</a></td>
        <td><input type="text" class="excel-input" value="${obj.type || ''}" data-old="${obj.type || ''}" onfocus="this.dataset.old=this.value" onkeyup="updateDateField(this); debouncedSave();" onblur="logEdit('اسم الطلب', this, '${obj.comp}', '${obj.id}')"></td>
        <td><input type="text" class="excel-input readonly-input" value="${obj.date}" readonly style="color:var(--text-muted); font-weight:700;"></td>
        <td><input type="text" class="excel-input" value="${obj.comp || ''}" data-old="${obj.comp || ''}" onfocus="this.dataset.old=this.value" onkeyup="updateDateField(this); debouncedSave();" onblur="logEdit('الشركة', this, '${obj.comp}', '${obj.id}')"></td>
        <td><input type="text" class="excel-input" value="${obj.cr || ''}" data-old="${obj.cr || ''}" onfocus="this.dataset.old=this.value" onkeyup="updateDateField(this); debouncedSave();" onblur="logEdit('السجل', this, '${obj.comp}', '${obj.id}')"></td>
        <td>
            <select class="excel-input status-select ${getStatusClass(obj.status)}" data-old="${obj.status || 'معلق'}" onchange="handleStatusChange(this, '${obj.id}', '${obj.comp}')">
                <option value="مكتمل" ${obj.status === 'مكتمل' ? 'selected' : ''}>مكتمل</option>
                <option value="معلق" ${obj.status === 'معلق' ? 'selected' : ''}>معلق</option>
                <option value="فقدان" ${obj.status === 'فقدان' ? 'selected' : ''}>فقدان</option>
            </select>
        </td>
        <td><input type="text" class="excel-input readonly-input" value="${sums.completed.toFixed(2)}" readonly style="color:var(--success); font-weight:800;"></td>
        <td><input type="text" class="excel-input readonly-input" value="${sums.pending.toFixed(2)}" readonly style="color:var(--danger); font-weight:800;"></td>
        <td><div class="notes-preview" onclick="openNote(this)" data-full-notes='${(obj.notes || '[]').replace(/'/g, "&apos;")}' title="عرض الملاحظات">${getLastNoteOnly(obj.notes || "[]")}</div></td>
        <td><input type="text" class="excel-input readonly-input last-mod-field" value="${obj.lastModifiedDate || '---'}" readonly style="color:var(--text-muted); font-weight:700;"></td>
        <td><input type="text" class="excel-input" value="${obj.owner || 'المستخدم'}" data-old="${obj.owner || ''}" onfocus="this.dataset.old=this.value" onkeyup="updateDateField(this); debouncedSave();" onblur="logEdit('المالك', this, '${obj.comp}', '${obj.id}')"></td>
    `;
}

function getStatusClass(status) {
    if(status === 'مكتمل') return 'status-complete';
    if(status === 'فقدان') return 'status-lost-badge';
    return 'status-pending';
}

function handleStatusChange(el, orderId, company) {
    const val = el.value; const oldVal = el.dataset.old;
    const row = el.closest('tr');
    el.className = `excel-input status-select ${getStatusClass(val)}`;
    
    if (val === "فقدان") row.classList.add('lost-row');
    else row.classList.remove('lost-row');
    
    // تسجيل حركة تغيير الحالة
    addGeneralLog(`تعديل الحالة من [${oldVal}] إلى [${val}] للعميل ( ${company} )`);
    
    updateDateField(el);
    el.dataset.old = val;
    debouncedSave();
}

function updateDateField(inputElement) {
    const row = inputElement.closest('tr');
    const modField = row.querySelector('.last-mod-field');
    if (modField) modField.value = getTodayFormatted();
}

function logEdit(fieldName, el, comp, id) {
    const newVal = el.value; const oldVal = el.dataset.old;
    if(newVal !== oldVal) {
        // تسجيل حركة التعديلات الأخرى
        addGeneralLog(`تعديل ${fieldName} من [${oldVal || 'فارغ'}] إلى [${newVal}] للعميل ( ${comp} )`);
        el.dataset.old = newVal;
    }
}

function autoSave() {
    const rows = document.querySelectorAll('#salesBody .main-row');
    const salesData = Array.from(rows).map(r => ({
        id: r.cells[1].innerText.replace('#', '').trim(),
        type: r.cells[2].querySelector('input').value,
        date: r.cells[3].querySelector('input').value,
        comp: r.cells[4].querySelector('input').value,
        cr: r.cells[5].querySelector('input').value,
        status: r.cells[6].querySelector('select').value,
        notes: r.cells[9].querySelector('.notes-preview').getAttribute('data-full-notes'),
        lastModifiedDate: r.cells[10].querySelector('input').value === '---' ? '' : r.cells[10].querySelector('input').value,
        owner: r.cells[11].querySelector('input').value
    }));
    localStorage.setItem('asgate_sales_db', JSON.stringify(salesData));
    updateHeaderStats();
}

function filterSalesTable() {
    const query = document.getElementById('globalSearch').value.toLowerCase().trim();
    const rows = document.querySelectorAll('#salesBody .main-row');
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
}

function toggleDropdown(e, btn) {
    e.stopPropagation();
    const menu = btn.nextElementSibling;
    document.querySelectorAll('.dropdown-menu').forEach(m => { if(m !== menu) m.classList.remove('show'); });
    menu.classList.toggle('show');
}

window.onclick = (e) => {
    if (!e.target.matches('.btn-bulk-trigger') && !e.target.matches('.fa-chevron-down')) {
        document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
    }
};

function toggleAllCheckboxes(source) {
    document.querySelectorAll('.select-check').forEach(chk => chk.checked = source.checked);
}

async function handleBulkAction(action) {
    const selected = document.querySelectorAll('.select-check:checked');
    if (selected.length === 0) { 
        Swal.fire({icon: 'info', text: 'يرجى تحديد صف واحد على الأقل', confirmButtonColor: '#3b82f6'}); 
        return; 
    }
    
    if (action === 'حذف') {
        const result = await Swal.fire({ title: 'تأكيد الحذف؟', text: "سيتم حذف الطلبات المحددة بشكل نهائي!", icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#94a3b8', confirmButtonText: 'نعم، احذف', cancelButtonText: 'إلغاء' });
        if (result.isConfirmed) {
            selected.forEach(chk => {
                const row = chk.closest('tr');
                const orderId = row.cells[1].innerText.replace('#', '').trim();
                const comp = row.cells[4].querySelector('input').value;
                addGeneralLog(`تم حذف الطلب #${orderId} للعميل ( ${comp} )`);
                row.remove();
            });
            autoSave();
            Swal.fire({icon: 'success', title: 'تم الحذف', showConfirmButton: false, timer: 1500});
        }
    } else {
        Swal.fire({icon: 'success', title: 'تم', text: 'تم تنفيذ الإجراء (' + action + ') على ' + selected.length + ' صف', showConfirmButton: false, timer: 1500});
    }
}

// دالة التسجيل بشكلها الجديد المماثل لصفحة العملاء
function addGeneralLog(description) {
    const logs = JSON.parse(localStorage.getItem(LOGS_KEY) || '[]');
    const timeStr = getTimeFormatted();
    const dateStr = getTodayFormatted();
    const dayName = getArabicDayName(dateStr);
    
    const logObj = {
        user: "المستخدم",
        day: dayName,
        date: dateStr,
        time: timeStr,
        action: description
    };
    
    logs.unshift(logObj);
    localStorage.setItem(LOGS_KEY, JSON.stringify(logs.slice(0, 100)));
    renderGeneralLog();
}

function renderGeneralLog() {
    const list = document.getElementById('activityLogs');
    if (!list) return;
    const logs = JSON.parse(localStorage.getItem(LOGS_KEY) || '[]');
    
    list.innerHTML = logs.map(log => {
        // حماية ودعم للبيانات القديمة إن وجدت
        if (typeof log === 'string') {
            return `<div class="log-entry"><span class="log-action">${log}</span></div>`; 
        }
        return `
        <div class="log-entry">
            <span class="log-badge-user"><i class="fas fa-user"></i> ${log.user}</span>
            <span class="log-divider">|</span>
            <span class="log-timestamp"><i class="far fa-clock"></i> ${log.day} ${log.date} ${log.time}</span>
            <span class="log-divider">|</span>
            <span class="log-action">${log.action}</span>
        </div>`;
    }).join('') || '<div style="color:#94a3b8; text-align:center; padding:10px;">لا يوجد نشاط مسجل</div>';
}

function openNote(el) {
    currentActivePreview = el;
    pendingAttachment = null;
    document.getElementById('filePreviewContainer').style.display = 'none';
    
    let arr = []; 
    try { arr = JSON.parse(el.getAttribute('data-full-notes') || "[]"); } catch(e) {}
    const historyLog = document.getElementById('historyLog');
    
    if (historyLog) {
        historyLog.innerHTML = arr.map(msg => {
            const attachHtml = msg.attachment ? `<br><a href="${msg.attachment.data}" download="${msg.attachment.name}" style="color:var(--accent-blue); font-size:10.5px; font-weight:800; text-decoration:none;"><i class="fas fa-download"></i> ${msg.attachment.name}</a>` : '';
            return `
            <div class="chat-msg-block">
                <div class="chat-msg-header">
                    <span><i class="fas fa-user-circle"></i> ${msg.user || 'المستخدم'}</span>
                    <span style="color:#94a3b8;"><i class="fas fa-clock"></i> ${msg.date} ${msg.time}</span>
                </div>
                <div class="chat-msg-text">${msg.text || ''}${attachHtml}</div>
            </div>`;
        }).join('') || '<div style="color:#64748b; text-align:center; font-size:10px; padding:20px; font-weight:700;">لا توجد ملاحظات سابقة</div>';
    }
    
    document.getElementById('noteModal').style.display = "flex";
    const modalTextArea = document.getElementById('modalTextArea');
    if (modalTextArea) { modalTextArea.value = ""; modalTextArea.focus(); }
}

function handleFileSelect(input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            pendingAttachment = { name: file.name, data: e.target.result };
            document.getElementById('fileNameDisplay').innerText = file.name;
            document.getElementById('filePreviewContainer').style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

function removeAttachment() {
    pendingAttachment = null;
    document.getElementById('modalFileAttachment').value = '';
    document.getElementById('filePreviewContainer').style.display = 'none';
}

function saveNote() {
    const txt = document.getElementById('modalTextArea').value.trim();
    if ((txt || pendingAttachment) && currentActivePreview) {
        let arr = []; 
        try { arr = JSON.parse(currentActivePreview.getAttribute('data-full-notes') || "[]"); } catch(e) {}
        
        const newNote = { 
            user: "المستخدم", 
            date: getTodayFormatted(), 
            time: getTimeFormatted(), 
            text: txt 
        };
        if(pendingAttachment) { newNote.attachment = pendingAttachment; }
        
        arr.push(newNote);
        currentActivePreview.setAttribute('data-full-notes', JSON.stringify(arr)); 
        currentActivePreview.innerText = txt ? txt : "مرفق";
        
        const row = currentActivePreview.closest('tr');
        updateDateField(currentActivePreview);
        
        // استخراج اسم الشركة من نفس الصف لإضافته في السجل
        const comp = row.cells[4].querySelector('input').value;
        addGeneralLog(`إضافة ملاحظة على الطلب للعميل ( ${comp} )`);

        autoSave();
    }
    removeAttachment();
    closeNote();
}

function closeNote() { document.getElementById('noteModal').style.display = "none"; }

function getLastNoteOnly(jsonStr) { 
    try { 
        const arr = JSON.parse(jsonStr); 
        if(arr.length > 0) {
            const last = arr[arr.length - 1];
            return last.text ? last.text : "مرفق";
        }
        return "أضف ملاحظة..."; 
    } catch(e) { return "أضف ملاحظة..."; } 
}

function openOrderModal() { document.getElementById('orderModal').style.display = 'flex'; }
function closeOrderModal() { 
    document.getElementById('orderModal').style.display = 'none'; 
    document.getElementById('mSearchField').value = ''; 
    document.getElementById('mType').value = ''; 
    document.getElementById('mComp').value = ''; 
    document.getElementById('mCr').value = ''; 
}

// دالة البحث المحدثة لتبحث في الاسم، السجل الرئيسي، والسجل الفرعي للعميل
function searchCustomerInModal(el) {
    const query = el.value.toLowerCase().trim();
    const resDiv = document.getElementById('mResults');
    const customers = JSON.parse(localStorage.getItem(CUSTOMERS_STORAGE_KEY) || '[]');
    
    if (query.length < 1) { resDiv.style.display='none'; return; }
    
    const filtered = customers.filter(c => {
        const cName = (c.comp || "").toLowerCase();
        const crMain = (c.cr1 || c.cr || "");
        const crSub = (c.cr2 || "");
        return cName.includes(query) || crMain.includes(query) || crSub.includes(query);
    });
    
    resDiv.innerHTML = filtered.map(c => {
        const displayCr = c.cr1 || c.cr || c.cr2 || 'بدون سجل';
        return `<div onclick="selectCustomer('${c.comp || ''}', '${displayCr}')"><i class="far fa-building"></i> ${c.comp || 'بدون اسم'} - ${displayCr}</div>`;
    }).join('');
    
    resDiv.style.display = filtered.length ? 'block' : 'none';
}

function selectCustomer(comp, record) { 
    document.getElementById('mComp').value = comp;
    document.getElementById('mCr').value = record; 
    document.getElementById('mSearchField').value = comp;
    document.getElementById('mResults').style.display = 'none';
}

function addOrderRow() {
    const comp = document.getElementById('mComp').value;
    const cr = document.getElementById('mCr').value;
    const type = document.getElementById('mType').value;
    
    if (!comp) { 
        Swal.fire({icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار شركة من نتائج البحث', confirmButtonColor: '#3b82f6'}); 
        return; 
    }

    const newOrder = {
        id: generateCustomOrderId(),
        type: type,
        date: getTodayFormatted(),
        comp: comp,
        cr: cr,
        status: "معلق",
        notes: "[]",
        lastModifiedDate: getTodayFormatted(),
        owner: "المستخدم"
    };

    const saved = JSON.parse(localStorage.getItem('asgate_sales_db') || '[]');
    saved.unshift(newOrder);
    localStorage.setItem('asgate_sales_db', JSON.stringify(saved));

    addGeneralLog(`إنشاء طلب مبيعات جديد برقم #${newOrder.id} للعميل ( ${comp} )`);

    closeOrderModal();
    Swal.fire({icon: 'success', title: 'تمت الإضافة بنجاح', showConfirmButton: false, timer: 1500});
    
    loadSalesFromStorage();
}