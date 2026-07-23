const urlParams = new URLSearchParams(window.location.search);
let currentOrderId = urlParams.get('id') || urlParams.get('orderId') || urlParams.get('code') || localStorage.getItem('current_order_id');

const statusOptions = ["مكتمل", "معلق", "جديد", "مرتجع", "فقدان"];
const statusOrder = { "مكتمل": 1, "معلق": 2, "جديد": 3, "مرتجع": 4, "فقدان": 5 };

const LOGS_KEY = 'asgate_order_logs_' + (currentOrderId || 'unknown');
const GLOBAL_NOTES_KEY = 'asgate_global_notes_' + (currentOrderId || 'unknown');

let currentStatusFilterValue = "all";

function formatNumberWithOneDecimal(num) {
    return Number(num).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function toggleLogExpansion() {
    const section = document.getElementById('activityLogSection');
    const btn = document.getElementById('toggleExpandBtn');
    if (section.classList.contains('expanded')) {
        section.classList.remove('expanded');
        btn.innerHTML = '<i class="fas fa-expand-alt"></i>';
    } else {
        section.classList.add('expanded');
        btn.innerHTML = '<i class="fas fa-compress-alt"></i>';
    }
}

function getTodayFormatted() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function generateStyledHeaderForNotes() {
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const d = new Date();
    const timeFormatted = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `<span class="activity-header-part">👤 أحمد  🗓️ ${days[d.getDay()]}  ${getTodayFormatted()}  <span class="activity-time-part">${timeFormatted}</span></span>`;
}

function generateInlineHeaderHTML() {
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const d = new Date();
    const timeFormatted = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `<span class="activity-header-part">👤 أحمد &nbsp;🗓️ ${days[d.getDay()]} &nbsp;${getTodayFormatted()} &nbsp;<span class="activity-time-part">${timeFormatted}</span></span>`;
}

function addToActivityLog(fieldName, oldVal, newVal, productIdentifier) {
    const allowedFields = ["تفاصيل المنتج", "العدد", "الاشتراك", "رقم السريال", "رقم الخدمة", "هوية المستخدم", "سجل المتابعة", "الحالة", "إضافة منتج جديد", "زر إجراء"];
    if (!allowedFields.includes(fieldName)) return; 

    if (oldVal === newVal && fieldName !== "إضافة منتج جديد" && fieldName !== "زر إجراء") return;
    const headerHTML = generateInlineHeaderHTML();
    
    let actionText = "";
    if (fieldName === "إضافة منتج جديد") {
        const cleanId = (productIdentifier && String(productIdentifier).trim() !== "") ? productIdentifier : "بدون رقم";
        actionText = `إضافة منتج جديد: ${newVal} للمنتج (${cleanId})`;
    } else if (fieldName === "زر إجراء") {
        actionText = `تم تنفيذ إجراء: [${newVal}] على الطلب الحالي`;
    } else {
        const cleanId = (productIdentifier && String(productIdentifier).trim() !== "") ? productIdentifier : "بدون رقم";
        const val1 = (oldVal && String(oldVal).trim() !== "") ? oldVal : "فارغ";
        const val2 = (newVal && String(newVal).trim() !== "") ? newVal : "فارغ";
        actionText = `تغيير ${fieldName} من [${val1}] إلى [${val2}] للمنتج (${cleanId})`;
    }
    
    const fullLogHTML = `<div class="activity-row-inline">${headerHTML} &nbsp; <span class="activity-text-part">${actionText}</span></div>`;
    
    let logs = JSON.parse(localStorage.getItem(LOGS_KEY) || '[]');
    logs.unshift(fullLogHTML);
    localStorage.setItem(LOGS_KEY, JSON.stringify(logs.slice(0, 100)));
    renderActivityLog();
}

function triggerActionLog(actionType) {
    if (actionType === 'تعديل البيانات الأساسية للطلب') {
        alert('تعديل البيانات الأساسية للطلب');
        addToActivityLog('زر إجراء', '', 'تعديل البيانات الأساسية للطلب', '');
    } else if (actionType === 'تصدير Excel') {
        exportToExcel();
        addToActivityLog('زر إجراء', '', 'تصدير لملف Excel', '');
    } else if (actionType === 'طباعة') {
        addToActivityLog('زر إجراء', '', 'طباعة الصفحة', '');
        window.print();
    } else if (actionType === 'حذف المختار') {
        deleteSelected();
    }
}

function renderActivityLog() {
    const list = document.getElementById('activityList');
    const logs = JSON.parse(localStorage.getItem(LOGS_KEY) || '[]');
    list.innerHTML = logs.map(log => `<div class="activity-item">${log}</div>`).join('');
}

function loadOrderDetails() {
    if (!currentOrderId) currentOrderId = "0000";

    try {
        let salesData = localStorage.getItem('asgate_sales_db');
        let sales = [];
        if (salesData) {
            let parsed = JSON.parse(salesData);
            sales = Array.isArray(parsed) ? parsed : Object.values(parsed);
        }

        const order = sales.find(o => String(o.id) === String(currentOrderId) || String(o.orderId) === String(currentOrderId) || String(o.code) === String(currentOrderId));
        if (order) {
            document.getElementById('orderId').innerText = '#' + (order.id || order.orderId || order.code || currentOrderId);
            document.getElementById('orderType').innerText = order.type || order.name || '-';
            document.getElementById('orderComp').innerText = order.comp || order.company || order.customer || '-';
            document.getElementById('orderCr').innerText = order.cr || order.commercialRecord || '-';
            document.getElementById('orderStatus').innerText = order.status || '-';
        } else {
            document.getElementById('orderId').innerText = '#' + currentOrderId;
        }
    } catch (e) {
        console.error("خطأ في جلب بيانات المبيعات: ", e);
        document.getElementById('orderId').innerText = '#' + currentOrderId;
    }

    renderProducts();
    renderActivityLog();
}

function validateNumberInput(el, isFloat = false) {
    let originalText = el.innerText;
    let cleanedText = originalText;
    if (isFloat) cleanedText = originalText.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, '$1');
    else cleanedText = originalText.replace(/[^0-9]/g, '');
    
    if (originalText !== cleanedText) {
        el.innerText = cleanedText;
        let range = document.createRange();
        let sel = window.getSelection();
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
    }
}

function renderProducts(filtered = null) {
    const db = JSON.parse(localStorage.getItem('asgate_products_db') || '{}');
    let baseItems = db[currentOrderId] || [];
    
    baseItems.forEach(p => { if (!statusOptions.includes(p.status)) p.status = "جديد"; });
    if (currentStatusFilterValue !== "all") baseItems = baseItems.filter(p => p.status === currentStatusFilterValue);
    
    let items = (filtered || baseItems).map((p, i) => ({...p, originalIndex: i}));
    
    // --- خوارزمية الفرز الذكية (حسب الحالة أولاً، ثم السريال تصاعدياً) ---
    items.sort((a, b) => {
        let weightA = statusOrder[a.status] || 99;
        let weightB = statusOrder[b.status] || 99;
        
        // 1. الفرز الأساسي حسب الحالة
        if (weightA !== weightB) return weightA - weightB;
        
        // 2. الفرز الثانوي حسب السريال (الرقم الأقل في الأعلى)
        let sA = a.serial || "";
        let sB = b.serial || "";
        if (sA !== sB) {
            // استخدام localeCompare لضمان قراءة الأرقام الطويلة كنصوص رقمية وترتيبها تصاعدياً
            return sA.localeCompare(sB, undefined, {numeric: true, sensitivity: 'base'});
        }
        
        // 3. ترتيب افتراضي حسب وقت الإنشاء إذا تساوى السريال
        return b.id - a.id; 
    });
    
    updateTableHeaders(items.length > 0 ? items[0].type : "جوال");
    const tbody = document.getElementById('productsBody');
    tbody.innerHTML = '';
    
    items.forEach((p) => {
        const subVal = parseFloat(p.sub) || 0;
        
        let sClass = "";
        if (p.status === "مكتمل") sClass = "status-mektamel";
        else if (p.status === "معلق") sClass = "status-moallaq";
        else if (p.status === "مرتجع") sClass = "status-mortaja";
        else if (p.status === "فقدان") sClass = "status-faqd";

        const isLocked = ["مكتمل", "معلق"].includes(p.status);
        const pIden = p.mobile || p.serial || p.name;
        const rNote = p.rowNote || '';

        let dynamic = (p.type === "جوال" || p.type === "بيانات") ? `
            <td contenteditable="${!isLocked}" data-old="${p.serial||''}" onfocus="this.setAttribute('data-old', this.innerText)" oninput="validateNumberInput(this, false)" onblur="if(this.getAttribute('data-old')!=this.innerText){ addToActivityLog('رقم السريال', this.getAttribute('data-old'), this.innerText, '${pIden}'); updateField(${p.originalIndex},'serial',this.innerText); }">${p.serial||''}</td>
            <td contenteditable="${!isLocked}" data-old="${p.mobile||''}" onfocus="this.setAttribute('data-old', this.innerText)" oninput="validateNumberInput(this, false)" onblur="if(this.getAttribute('data-old')!=this.innerText){ addToActivityLog('رقم الخدمة', this.getAttribute('data-old'), this.innerText, '${pIden}'); updateField(${p.originalIndex},'mobile',this.innerText); }">${p.mobile||''}</td>
            <td contenteditable="${!isLocked}" data-old="${p.user||''}" onfocus="this.setAttribute('data-old', this.innerText)" oninput="validateNumberInput(this, false)" onblur="if(this.getAttribute('data-old')!=this.innerText){ addToActivityLog('هوية المستخدم', this.getAttribute('data-old'), this.innerText, '${pIden}'); updateField(${p.originalIndex},'user',this.innerText); }">${p.user||''}</td>` : `
            <td contenteditable="${!isLocked}" data-old="${p.sai||''}" onfocus="this.setAttribute('data-old', this.innerText)" onblur="if(this.getAttribute('data-old')!=this.innerText){ updateField(${p.originalIndex},'sai',this.innerText); }">${p.sai||''}</td>
            <td contenteditable="${!isLocked}" data-old="${p.coords||''}" onfocus="this.setAttribute('data-old', this.innerText)" onblur="if(this.getAttribute('data-old')!=this.innerText){ updateField(${p.originalIndex},'coords',this.innerText); }">${p.coords||''}</td>
            <td contenteditable="${!isLocked}" data-old="${p.city||''}" onfocus="this.setAttribute('data-old', this.innerText)" onblur="if(this.getAttribute('data-old')!=this.innerText){ updateField(${p.originalIndex},'city',this.innerText); }">${p.city||''}</td>`;

        tbody.innerHTML += `<tr class="${isLocked ? 'row-locked' : ''}">
            <td class="not-locked"><input type="checkbox" class="row-checkbox" data-index="${p.originalIndex}" data-locked="${isLocked}" onchange=\"calculateTotals()\"></td>
            <td>${p.type}</td>
            <td contenteditable="${!isLocked}" data-old="${p.name}" onfocus="this.setAttribute('data-old', this.innerText)" onblur="if(this.getAttribute('data-old')!=this.innerText){ addToActivityLog('تفاصيل المنتج', this.getAttribute('data-old'), this.innerText, '${pIden}'); updateField(${p.originalIndex},'name',this.innerText); }">${p.name}</td>
            <td contenteditable="${!isLocked}" data-old="${p.qty}" onfocus="this.setAttribute('data-old', this.innerText)" oninput="validateNumberInput(this, false)" onblur="if(this.getAttribute('data-old')!=this.innerText){ addToActivityLog('العدد', this.getAttribute('data-old'), this.innerText, '${pIden}'); updateField(${p.originalIndex},'qty',this.innerText); }">${p.qty}</td>
            <td contenteditable="${!isLocked}" data-old="${subVal.toFixed(1)}" onfocus="this.setAttribute('data-old', this.innerText)" oninput="validateNumberInput(this, true)" onblur="if(this.getAttribute('data-old')!=this.innerText){ addToActivityLog('الاشتراك', this.getAttribute('data-old'), this.innerText, '${pIden}'); updateField(${p.originalIndex},'sub',this.innerText); }">${formatNumberWithOneDecimal(subVal)}</td>
            <td style="color:var(--header-green);font-weight:800;">${formatNumberWithOneDecimal(p.qty * subVal)}</td>
            ${dynamic}
            <td class="not-locked"><select class="status-select ${sClass}" data-old="${p.status}" onfocus="this.setAttribute('data-old', this.value)" onchange="changeStatus(${p.originalIndex},this.value)">
                ${statusOptions.map(s=>`<option value="${s}" ${p.status===s?'selected':''}>${s}</option>`).join('')}</select></td>
            <td style="font-size:10px">${p.date}</td>
            <td contenteditable="${!isLocked}" data-old="${rNote}" onfocus="this.setAttribute('data-old', this.innerText)" onblur="if(this.getAttribute('data-old')!=this.innerText){ addToActivityLog('سجل المتابعة', this.getAttribute('data-old'), this.innerText, '${pIden}'); updateField(${p.originalIndex},'rowNote',this.innerText); }">${rNote}</td>
            </tr>`;
    });
    calculateTotals();
    updateStatsBox();
}

function updateTableHeaders(type) {
    const header = document.getElementById('dynamicHeader');
    let dynamic = (type === "جوال" || type === "بيانات") ? `<th>رقم السريال</th><th>رقم الخدمة</th><th>هوية المستخدم</th>` : `<th>رقم الكبينة</th><th>الإحداثيات</th><th>المدينة</th>`;
    header.innerHTML = `<th style="width: 30px;"><input type="checkbox" id="checkAllBox" onclick="toggleAll(this)"></th><th style="width:100px;">نوع المنتج</th><th>تفاصيل المنتج</th><th style="width:50px;">العدد</th><th style="width:80px;">الاشتراك</th><th style="width:80px;">الإجمالي</th>${dynamic}<th style="width:110px;">الحالة <select id="colStatusFilter" class="status-header-filter" onchange="triggerStatusColumnFilter(this.value)"><option value="all" ${currentStatusFilterValue==='all'?'selected':''}>الكل</option>${statusOptions.map(opt=>`<option value="${opt}" ${currentStatusFilterValue===opt?'selected':''}>${opt}</option>`).join('')}</select></th><th style="width:80px;">تاريخ الحالة</th><th>سجل المتابعة</th>`;
}

function triggerStatusColumnFilter(val) { currentStatusFilterValue = val; applyFilters(); }

function updateStatsBox() {
    const db = JSON.parse(localStorage.getItem('asgate_products_db') || '{}')[currentOrderId] || [];
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    let totalOkAmount = 0, totalWaitAmount = 0, monthOkAmount = 0, monthWaitAmount = 0;
    db.forEach(p => {
        const productTotal = (parseInt(p.qty) || 0) * (parseFloat(p.sub) || 0);
        if (p.status === "مكتمل") totalOkAmount += productTotal;
        if (p.status === "معلق") totalWaitAmount += productTotal;
        const parts = (p.date || "").split('/');
        if (parts.length === 3 && parseInt(parts[1]) === currentMonth && parseInt(parts[2]) === currentYear) {
            if (p.status === "مكتمل") monthOkAmount += productTotal;
            if (p.status === "معلق") monthWaitAmount += productTotal;
        }
    });
    document.getElementById('stat_total_ok').innerText = formatNumberWithOneDecimal(totalOkAmount);
    document.getElementById('stat_total_wait').innerText = formatNumberWithOneDecimal(totalWaitAmount);
    document.getElementById('stat_month_ok').innerText = formatNumberWithOneDecimal(monthOkAmount);
    document.getElementById('stat_month_wait').innerText = formatNumberWithOneDecimal(monthWaitAmount);
}

function updateField(idx, f, v) {
    let db = JSON.parse(localStorage.getItem('asgate_products_db') || '{}');
    let item = db[currentOrderId][idx];
    item[f] = v.trim(); 
    item.updatedAt = Date.now(); 
    localStorage.setItem('asgate_products_db', JSON.stringify(db));
    if(['qty','sub'].includes(f)) syncSumsToSales();
    
    // تم الحفاظ على عدم تحريك الجدول عند الكتابة.. يتم تحديث الأرقام فقط.
    calculateTotals();
    updateStatsBox();
}

function changeStatus(idx, s) {
    let db = JSON.parse(localStorage.getItem('asgate_products_db') || '{}');
    let item = db[currentOrderId][idx];
    const oldS = item.status;
    
    const pIden = item.mobile || item.serial || item.name;
    addToActivityLog('الحالة', oldS, s, pIden);
    item.status = s; 
    item.updatedAt = Date.now(); 
    item.date = new Date().toLocaleDateString('en-GB');
    localStorage.setItem('asgate_products_db', JSON.stringify(db));
    syncSumsToSales(); 
    
    // الترتيب والتحريك يحدث فقط عند تغيير الحالة
    renderProducts(); 
}

function deleteSelected() {
    const chks = document.querySelectorAll('.row-checkbox:checked');
    if(chks.length===0) return;
    const validIdxs = Array.from(chks).filter(c => c.dataset.locked === "false").map(c => parseInt(c.dataset.index));
    if (validIdxs.length === 0) { alert("لا يمكن حذف الصفوف المغلقة"); return; }
    if(!confirm(`حذف (${validIdxs.length}) منتجات؟`)) return;
    let db = JSON.parse(localStorage.getItem('asgate_products_db') || '{}');
    
    validIdxs.forEach(originalIdx => {
        const item = db[currentOrderId][originalIdx];
        const pIden = item.mobile || item.serial || item.name;
        addToActivityLog('زر إجراء', '', `حذف المنتج: ${item.name} (${pIden})`, pIden);
    });

    db[currentOrderId] = db[currentOrderId].filter((_, i) => !validIdxs.includes(i));
    localStorage.setItem('asgate_products_db', JSON.stringify(db));
    syncSumsToSales(); renderProducts();
}

function syncSumsToSales() {
    const items = JSON.parse(localStorage.getItem('asgate_products_db') || '{}')[currentOrderId] || [];
    let tot = items.reduce((acc, p) => acc + (p.qty * p.sub), 0);
    document.getElementById('orderTotalSum').innerText = formatNumberWithOneDecimal(tot) + " ر.س";
}

function calculateTotals() {
    const db = JSON.parse(localStorage.getItem('asgate_products_db') || '{}')[currentOrderId] || [];
    let q=0, s=0, t=0; db.forEach(p=>{ q+=parseInt(p.qty)||0; s+=parseFloat(p.sub)||0; t+=(p.qty*p.sub); });
    document.getElementById('f_selection').innerText = document.querySelectorAll('.row-checkbox:checked').length;
    document.getElementById('f_count').innerText = db.length; 
    document.getElementById('f_qty').innerText = q; 
    document.getElementById('f_sub').innerText = formatNumberWithOneDecimal(s); 
    document.getElementById('f_total').innerText = formatNumberWithOneDecimal(t);
}

function saveProduct() {
    const type = document.getElementById('p_type').value, name = document.getElementById('p_name').value || "بدون تفاصيل", qty = parseInt(document.getElementById('p_qty').value) || 1, sub = parseFloat(document.getElementById('p_sub').value) || 0;
    let serial = document.getElementById('p_serial').value || "", isAuto = document.getElementById('auto_serial').checked;
    
    let db = JSON.parse(localStorage.getItem('asgate_products_db') || '{}');
    const orderKey = currentOrderId || "0000";
    if(!db[orderKey]) db[orderKey] = [];
    
    const baseTime = Date.now();
    
    if(isAuto && ["جوال", "بيانات"].includes(type) && serial !== "") {
        for(let i=0; i<qty; i++){ 
            db[orderKey].push({ id: baseTime + i, type, name, qty:1, sub, serial, status:"جديد", date:new Date().toLocaleDateString('en-GB'), updatedAt: baseTime - i, rowNote: "" });
            addToActivityLog('إضافة منتج جديد', '', `${name} (باقة: ${type})`, serial);
            serial = serial.replace(/(\d+)(?!.*\d)/, n => (BigInt(n)+1n).toString().padStart(n.length, '0')); 
        }
    } else { 
        const newItem = { id: baseTime, type, name, qty, sub, serial:(["جوال", "بيانات"].includes(type)?serial:""), status:"جديد", date:new Date().toLocaleDateString('en-GB'), updatedAt: baseTime, rowNote: "" };
        db[orderKey].push(newItem); 
        addToActivityLog('إضافة منتج جديد', '', `${name} (باقة: ${type})`, newItem.serial || newItem.name);
    }
    localStorage.setItem('asgate_products_db', JSON.stringify(db));
    syncSumsToSales(); renderProducts(); closeModal();
}

function applyFilters() {
    const q = document.getElementById('liveSearch').value.toLowerCase().trim();
    const db = JSON.parse(localStorage.getItem('asgate_products_db') || '{}')[currentOrderId] || [];
    
    const searchFiltered = db.filter(p => {
        const matchesSearch = 
            (p.serial || '').toLowerCase().includes(q) || 
            (p.mobile || '').toLowerCase().includes(q) || 
            (p.user || '').toLowerCase().includes(q);
            
        const matchesColumnStatus = (currentStatusFilterValue === "all" || p.status === currentStatusFilterValue);
        return matchesSearch && matchesColumnStatus;
    });
    renderProducts(searchFiltered);
}

function toggleAll(s) { document.querySelectorAll('.row-checkbox').forEach(c => c.checked = s.checked); calculateTotals(); }

function openModal() { 
    document.getElementById('productModal').style.display = 'flex'; 
    document.getElementById('p_qty').value = "1";
    document.getElementById('p_sub').value = "";
    document.getElementById('p_serial').value = "";
    handleTypeChange(); 
}
function closeModal() { document.getElementById('productModal').style.display = 'none'; }
function handleTypeChange() {
    const type = document.getElementById('p_type').value;
    const isMobile = (type === "جوال" || type === "بيانات");
    document.getElementById('p_serial').disabled = !isMobile;
    document.getElementById('auto_serial').disabled = !isMobile;
}
function exportToExcel() {
    const db = JSON.parse(localStorage.getItem('asgate_products_db') || '{}')[currentOrderId] || [];
    const ws = XLSX.utils.json_to_sheet(db);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Details");
    XLSX.writeFile(wb, `Order_${currentOrderId}.xlsx`);
}

// =========================================================================
// === دوال الملاحظات العامة للطلب والمرفقات ===
// =========================================================================

function renderGlobalNotes(notesText) {
    const logDiv = document.getElementById('historyLog');
    if (!notesText) {
        logDiv.innerHTML = '<div style="color:#94a3b8; text-align:center; padding-top:20px;">لا توجد ملاحظات سابقة لهذا الطلب.</div>';
        return;
    }
    logDiv.innerHTML = notesText.split('\n--------------------\n').filter(e=>e.trim()!=="").map(e => `<div class="activity-item">${e}</div>`).join('');
    logDiv.scrollTop = logDiv.scrollHeight;
}

function openGlobalNote() {
    let orderGlobalNotes = localStorage.getItem(GLOBAL_NOTES_KEY) || '';
    renderGlobalNotes(orderGlobalNotes);
    document.getElementById('noteModal').style.display = "flex";
}

function closeGlobalNote() {
    document.getElementById('noteModal').style.display = "none";
    document.getElementById('modalTextArea').value = "";
}

function saveGlobalNote() {
    const newText = document.getElementById('modalTextArea').value.trim();
    if (newText) {
        let oldNotes = localStorage.getItem(GLOBAL_NOTES_KEY) || "";
        let newEntry = `${generateStyledHeaderForNotes()}<span class="activity-text-part">${newText}</span>`;
        let updatedFullNotes = oldNotes === "" ? newEntry : oldNotes + "\n--------------------\n" + newEntry;
        
        localStorage.setItem(GLOBAL_NOTES_KEY, updatedFullNotes);
        renderGlobalNotes(updatedFullNotes);
        document.getElementById('modalTextArea').value = "";
    }
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    let fileName = prompt("أدخل اسم للمرفق لحفظه في السجل:", file.name);
    if (fileName === null) {
        event.target.value = ''; 
        return; 
    }
    if (fileName.trim() === "") fileName = file.name;

    let oldNotes = localStorage.getItem(GLOBAL_NOTES_KEY) || "";
    let newEntry = `${generateStyledHeaderForNotes()}<span class="activity-text-part" style="color:var(--accent-blue);"><i class="fas fa-file-alt"></i> تم إرفاق ملف: ${fileName}</span>`;
    let updatedFullNotes = oldNotes === "" ? newEntry : oldNotes + "\n--------------------\n" + newEntry;
    
    localStorage.setItem(GLOBAL_NOTES_KEY, updatedFullNotes);
    renderGlobalNotes(updatedFullNotes);
    
    event.target.value = ''; 
}

// =========================================================================
// === محرك النسخ واللصق والتحديد الشبيه بـ Excel ===
// =========================================================================

document.addEventListener('dragstart', function(e) { if (e.target.closest('#mainTable')) e.preventDefault(); });
document.addEventListener('drop', function(e) { if (e.target.closest('#mainTable')) e.preventDefault(); });

let isSelecting = false;
let startCell = null;

document.addEventListener('mousedown', function(e) {
    let td = e.target.closest('td');
    if (!td || !td.closest('#productsBody') || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
        if (!e.target.closest('#mainTable')) clearSelection();
        return;
    }
    isSelecting = true;
    startCell = td;
    clearSelection();
    td.classList.add('cell-selected');
});

document.addEventListener('mouseover', function(e) {
    if (!isSelecting) return;
    let td = e.target.closest('td');
    if (!td || !td.closest('#productsBody')) return;

    window.getSelection().removeAllRanges();
    clearSelection();

    let tbody = td.closest('tbody');
    let startRowIdx = startCell.parentElement.rowIndex - 1; 
    let endRowIdx = td.parentElement.rowIndex - 1;
    let startColIdx = startCell.cellIndex;
    let endColIdx = td.cellIndex;

    let minRow = Math.min(startRowIdx, endRowIdx);
    let maxRow = Math.max(startRowIdx, endRowIdx);
    let minCol = Math.min(startColIdx, endColIdx);
    let maxCol = Math.max(startColIdx, endColIdx);

    for (let r = minRow; r <= maxRow; r++) {
        let row = tbody.children[r];
        if (!row) continue;
        for (let c = minCol; c <= maxCol; c++) {
            let cell = row.children[c];
            if (cell && (cell.getAttribute('contenteditable') === "true" || minCol === maxCol)) {
                cell.classList.add('cell-selected');
            }
        }
    }
});

document.addEventListener('mouseup', function() { isSelecting = false; });
function clearSelection() { document.querySelectorAll('.cell-selected').forEach(el => el.classList.remove('cell-selected')); }

document.addEventListener('copy', function(e) {
    const selectedCells = document.querySelectorAll('.cell-selected');
    if (selectedCells.length === 0) return;

    let rowsMap = new Map();
    selectedCells.forEach(cell => {
        let rIdx = cell.parentElement.rowIndex;
        if (!rowsMap.has(rIdx)) rowsMap.set(rIdx, []);
        rowsMap.get(rIdx).push(cell);
    });

    let textRows = [];
    let sortedRowKeys = Array.from(rowsMap.keys()).sort((a, b) => a - b);
    
    sortedRowKeys.forEach(rIdx => {
        let cells = rowsMap.get(rIdx).sort((a, b) => a.cellIndex - b.cellIndex);
        let rowText = cells.map(c => c.innerText.trim()).join('\t');
        textRows.push(rowText);
    });

    e.clipboardData.setData('text/plain', textRows.join('\n'));
    e.preventDefault();
});

document.getElementById('mainTable').addEventListener('paste', function(e) {
    let targetTd = e.target.closest('td[contenteditable="true"]');
    if (!targetTd) return;

    e.preventDefault(); 
    let clipboardData = e.clipboardData || window.clipboardData;
    let pasteData = clipboardData.getData('text');
    if (!pasteData) return;

    let rowsData = pasteData.replace(/\r/g, '').split('\n');
    if (rowsData[rowsData.length - 1] === '') rowsData.pop();

    let startRowTr = targetTd.closest('tr');
    let tbody = startRowTr.parentElement;
    let startRowIndex = Array.from(tbody.children).indexOf(startRowTr);
    let startColIndex = targetTd.cellIndex;

    let pasteRowIdx = 0;
    let tableRowIdx = startRowIndex;

    while (pasteRowIdx < rowsData.length && tableRowIdx < tbody.children.length) {
        let rowTr = tbody.children[tableRowIdx];
        let cellTd = rowTr.children[startColIndex];
        
        if (!cellTd || cellTd.getAttribute('contenteditable') !== "true") {
            tableRowIdx++;
            continue;
        }

        let colsData = rowsData[pasteRowIdx].split('\t');
        for (let j = 0; j < colsData.length; j++) {
            let colTargetTd = rowTr.children[startColIndex + j];
            
            if (colTargetTd && colTargetTd.getAttribute('contenteditable') === "true") {
                let oldVal = colTargetTd.innerText;
                let newVal = colsData[j].trim();
                
                if (oldVal !== newVal) {
                    colTargetTd.setAttribute('data-old', oldVal);
                    colTargetTd.innerText = newVal;
                    colTargetTd.dispatchEvent(new Event('input', { bubbles: true }));
                    colTargetTd.dispatchEvent(new Event('blur', { bubbles: true })); 
                }
            }
        }
        
        pasteRowIdx++;
        tableRowIdx++;
    }
    // بعد الانتهاء من اللصق بالكامل، نعيد فرز الجدول حتى يأخذ السريال المضاف الجديد ترتيبه الصحيح
    renderProducts();
});
