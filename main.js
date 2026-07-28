document.addEventListener('DOMContentLoaded', function() {
    let achievedChart, gaugeChart, pendingChart, staffChart;

    const oppCountEl = document.getElementById('oppCount');
    const visitCountEl = document.getElementById('visitCount');
    const salesValueEl = document.getElementById('salesValue');
    const tbody = document.getElementById('monthsBody');

    const monthsNames = ["يناير", "فبراير", "مارس", "ابريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

    // 1. قراءة البيانات وربط المبيعات بمنتجات تفاصيل الطلب
    function getRawData() {
        try {
            const visitsData = localStorage.getItem('asgate_visits_final_v31') || localStorage.getItem('asgate_visits_data_v21');
            const oppsData = localStorage.getItem('asgate_opportunities_final_v31') || localStorage.getItem('asgate_opportunities_v21');
            
            // جلب البيانات من صفحة تفاصيل الطلبات لربط الإحصائيات بدقة
            const productsDb = JSON.parse(localStorage.getItem('asgate_products_db') || '{}');
            const salesDb = JSON.parse(localStorage.getItem('asgate_sales_db') || '{}');
            const salesArray = Array.isArray(salesDb) ? salesDb : Object.values(salesDb);

            let linkedSales = [];
            for (let orderId in productsDb) {
                const parentOrder = salesArray.find(o => String(o.id) === String(orderId) || String(o.orderId) === String(orderId) || String(o.code) === String(orderId)) || {};
                productsDb[orderId].forEach(p => {
                    linkedSales.push({
                        ...p,
                        region: parentOrder.region || '',
                        supervisor: parentOrder.supervisor || '',
                        salesman: parentOrder.salesman || parentOrder.owner || ''
                    });
                });
            }
            
            return {
                visits: visitsData ? JSON.parse(visitsData) : [],
                opportunities: oppsData ? JSON.parse(oppsData) : [],
                sales: linkedSales 
            };
        } catch (e) {
            console.error("خطأ في قراءة LocalStorage:", e);
            return { visits: [], opportunities: [], sales: [] };
        }
    }

    // 2. تعبئة الفلاتر 
    function populateFilterOptions() {
        const data = getRawData();
        const allData = [...data.sales, ...data.opportunities, ...data.visits];
        
        const regions = new Set();
        const supervisors = new Set();
        const salesmen = new Set();
        const years = new Set(["2026"]);

        allData.forEach(item => {
            if (item.region) regions.add(item.region);
            if (item.supervisor) supervisors.add(item.supervisor);
            if (item.salesman || item.owner) salesmen.add(item.salesman || item.owner);
            
            let itemDate = item.date || item.visitDate || item.oppDate || item.saleDate;
            if (itemDate) {
                let year;
                if (itemDate.includes('/')) year = itemDate.split('/')[2];
                else if (itemDate.includes('-')) year = itemDate.split('-')[0];
                
                if(year && year.length === 4) years.add(year);
            }
        });

        fillSelect(document.querySelector('.filters-grid .filter-card:nth-child(1) select'), years, "2026");
        fillSelect(document.querySelector('.filters-grid .filter-card:nth-child(2) select'), monthsNames, "الكل", true);
        fillSelect(document.querySelector('.filters-grid .filter-card:nth-child(3) select'), regions, "الكل");
        fillSelect(document.querySelector('.filters-grid .filter-card:nth-child(4) select'), supervisors, "الكل");
        fillSelect(document.querySelector('.filters-grid .filter-card:nth-child(5) select'), salesmen, "الكل");
    }

    function fillSelect(selectElement, setOrArray, defaultVal, isMonth = false) {
        if (!selectElement) return;
        const currentValue = selectElement.value;
        selectElement.innerHTML = '';
        
        const defaultOpt = document.createElement('option');
        defaultOpt.text = defaultVal;
        defaultOpt.value = defaultVal === "الكل" ? "all" : defaultVal;
        selectElement.appendChild(defaultOpt);

        setOrArray.forEach((val, index) => {
            if(isMonth && val === defaultVal) return;
            const opt = document.createElement('option');
            opt.text = val;
            opt.value = isMonth ? (index + 1).toString().padStart(2, '0') : val; 
            if(val !== defaultVal) selectElement.appendChild(opt);
        });

        if (currentValue && selectElement.querySelector(`option[value="${currentValue}"]`)) {
            selectElement.value = currentValue;
        }
    }

    // 3. التحديث الشامل للوحة القيادة
    function updateDashboard() {
        const data = getRawData();

        const selectedYear = document.querySelector('.filters-grid .filter-card:nth-child(1) select')?.value || "2026";
        const selectedMonth = document.querySelector('.filters-grid .filter-card:nth-child(2) select')?.value || "all";
        const selectedRegion = document.querySelector('.filters-grid .filter-card:nth-child(3) select')?.value || "all";
        const selectedSupervisor = document.querySelector('.filters-grid .filter-card:nth-child(4) select')?.value || "all";
        const selectedSalesman = document.querySelector('.filters-grid .filter-card:nth-child(5) select')?.value || "all";

        const filterCallback = (item) => {
            let itemYear = "";
            let itemMonth = "";
            const itemDate = item.date || item.visitDate || item.oppDate || item.saleDate || "";
            
            if (itemDate.includes('/')) {
                itemYear = itemDate.split('/')[2];
                itemMonth = itemDate.split('/')[1];
            } else if (itemDate.includes('-')) {
                itemYear = itemDate.split('-')[0];
                itemMonth = itemDate.split('-')[1];
            }

            if (selectedYear !== "all" && itemYear !== selectedYear) return false;
            if (selectedMonth !== "all" && itemMonth !== selectedMonth) return false;
            if (selectedRegion !== "all" && item.region !== selectedRegion) return false;
            if (selectedSupervisor !== "all" && item.supervisor !== selectedSupervisor) return false;
            
            const ownerName = item.salesman || item.owner;
            if (selectedSalesman !== "all" && ownerName !== selectedSalesman) return false;
            
            return true;
        };

        const filteredSales = data.sales.filter(filterCallback);
        const filteredOpps = data.opportunities.filter(filterCallback);
        const filteredVisits = data.visits.filter(filterCallback);

        let totalSales = 0;
        let totalPending = 0;

        filteredSales.forEach(sale => {
            let val = 0;
            if (sale.qty !== undefined && sale.sub !== undefined) {
                val = (parseInt(sale.qty) || 0) * (parseFloat(sale.sub) || 0);
            } else {
                val = parseFloat(sale.value || sale.oppValue || sale.saleValue || sale.total) || 0;
            }
            
            const status = sale.status || "";
            if (status === "مكتمل" || status === "محقق" || status === "ناجح") {
                totalSales += val;
            } else if (status === "معلق") {
                totalPending += val;
            }
        });

        if(oppCountEl) oppCountEl.innerText = filteredOpps.length.toLocaleString('en-US'); 
        if(visitCountEl) visitCountEl.innerText = filteredVisits.length.toLocaleString('en-US'); 
        if(salesValueEl) salesValueEl.innerText = totalSales.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        
        const pendingValueEl = document.querySelector('.bg-warning .value-text');
        if(pendingValueEl) pendingValueEl.innerText = totalPending.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

        updateYearlyTable(filteredSales, filteredOpps, filteredVisits, selectedYear);
        updateChartsLogic(totalSales, totalPending, filteredVisits.length, filteredOpps.length, filteredSales);
    }

    // 4. بناء الجدول الشهري
    function updateYearlyTable(sales, opps, visits, year) {
        if (!tbody) return;
        tbody.innerHTML = '';

        monthsNames.forEach((monthName, index) => {
            const monthCode = (index + 1).toString().padStart(2, '0');
            
            const mSales = sales.filter(s => {
                const d = s.date || s.saleDate || s.oppDate || s.visitDate || "";
                const m = d.includes('/') ? d.split('/')[1] : d.split('-')[1];
                return m === monthCode;
            });
            const mOpps = opps.filter(o => {
                const d = o.date || o.oppDate || o.visitDate || "";
                const m = d.includes('/') ? d.split('/')[1] : d.split('-')[1];
                return m === monthCode;
            });
            const mVisits = visits.filter(v => {
                const d = v.date || v.visitDate || v.oppDate || "";
                const m = d.includes('/') ? d.split('/')[1] : d.split('-')[1];
                return m === monthCode;
            });

            let mCompleted = 0;
            let mPending = 0;
            let mVisitsCount = mVisits.length;  
            let mOppsCount = mOpps.length;      

            mSales.forEach(s => {
                let val = 0;
                if (s.qty !== undefined && s.sub !== undefined) {
                    val = (parseInt(s.qty) || 0) * (parseFloat(s.sub) || 0);
                } else {
                    val = parseFloat(s.value || s.oppValue || s.saleValue || s.total || 0) || 0;
                }
                const status = s.status || "";
                if (status === "مكتمل" || status === "محقق" || status === "ناجح") mCompleted += val;
                else if (status === "معلق") mPending += val;
            });

            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${monthName}</td>
                <td>15k</td>
                <td>${mCompleted > 0 ? (mCompleted/1000).toFixed(1) + 'k' : '-'}</td>
                <td class="thick-border">${mPending > 0 ? (mPending/1000).toFixed(1) + 'k' : '-'}</td>
                <td style="color:#3b82f6; font-weight:800; background:#eff6ff">${mVisitsCount > 0 ? mVisitsCount : '-'}</td>
                <td style="color:#22c55e; font-weight:800; background:#f0fdf4">${mOppsCount > 0 ? mOppsCount : '-'}</td>
            `;
        });
    }

    // 5. تهيئة الرسومات البيانية
    function initCharts() {
        const achievedEl = document.getElementById('achievedChart');
        if (achievedEl) {
            achievedChart = new Chart(achievedEl, {
                type: 'doughnut',
                data: { datasets: [{ data: [0, 100], backgroundColor: ['#22c55e', '#f1f5f9'], borderWidth: 0, borderRadius: 10 }] },
                options: { cutout: '85%', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
        }

        const gaugeEl = document.getElementById('gaugeChart');
        if (gaugeEl) {
            gaugeChart = new Chart(gaugeEl.getContext('2d'), {
                type: 'doughnut',
                data: { datasets: [{ data: [25, 25, 25, 25], backgroundColor: ['#ef4444', '#fbbf24', '#4ade80', '#15803d'], borderWidth: 0 }] },
                options: { rotation: 270, circumference: 180, cutout: '90%', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
        }

        const pendingEl = document.getElementById('pendingChart');
        if (pendingEl) {
            pendingChart = new Chart(pendingEl, {
                type: 'doughnut',
                data: { datasets: [{ data: [0, 100], backgroundColor: ['#facc15', '#f1f5f9'], borderWidth: 0, borderRadius: 10 }] },
                options: { cutout: '85%', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
        }

        const staffEl = document.getElementById('staffChart');
        if (staffEl) {
            staffChart = new Chart(staffEl.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: Array.from({length: 30}, (_, i) => `موظف مبيعات ${i + 1}`), 
                    datasets: [
                        { label: 'مكتمل', data: Array.from({length: 30}, () => 0), backgroundColor: '#22c55e', barPercentage: 0.85, categoryPercentage: 0.6 },
                        { label: 'معلق', data: Array.from({length: 30}, () => 0), backgroundColor: '#facc15', barPercentage: 0.85, categoryPercentage: 0.6 }
                    ]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false, 
                    plugins: { tooltip: { callbacks: { label: function(context) { let label = context.dataset.label || ''; if (label) label += ': '; if (context.parsed.y !== undefined) { label += Number(context.parsed.y).toLocaleString('en-US') + ' ريال'; } return label; } } } },
                    scales: { x: { grid: { display: false }, ticks: { font: { family: 'Cairo', size: 9 }, maxRotation: 45, minRotation: 45 } } } 
                }
            });
        }
    }

    // 6. تحديث بيانات الرسومات البيانية
    function updateChartsLogic(salesTotal, pendingTotal, totalVisits, successVisits, filteredSales = []) {
        const grandTotal = salesTotal + pendingTotal || 1; 
        const salesPercent = Math.round((salesTotal / grandTotal) * 100) || 0;
        const pendingPercent = Math.round((pendingTotal / grandTotal) * 100) || 0;

        const achievedText = document.querySelector('.chart-container-reduced:has(#achievedChart) .chart-percentage');
        if(achievedText) achievedText.innerText = `${salesPercent}%`;

        const pendingText = document.querySelector('.chart-container-reduced:has(#pendingChart) .chart-percentage');
        if(pendingText) pendingText.innerText = `${pendingPercent}%`;

        const targetYearly = 180000;
        const gaugePercent = Math.min(Math.round((salesTotal / targetYearly) * 100), 200);
        const gaugeValueText = document.querySelector('.gauge-container-reduced .gauge-value');
        if(gaugeValueText) gaugeValueText.innerText = `${gaugePercent}%`;

        if (achievedChart) { achievedChart.data.datasets[0].data = [salesPercent, 100 - salesPercent]; achievedChart.update(); }
        if (pendingChart) { pendingChart.data.datasets[0].data = [pendingPercent, 100 - pendingPercent]; pendingChart.update(); }
        if (gaugeChart) { const part = gaugePercent / 4; gaugeChart.data.datasets[0].data = [part, part, part, part]; gaugeChart.update(); }

        if (staffChart) {
            const staffAggregation = {};

            filteredSales.forEach(sale => {
                const name = (sale.salesman || sale.owner || "").trim();
                if (!name) return;

                if (!staffAggregation[name]) {
                    staffAggregation[name] = { completed: 0, pending: 0 };
                }

                let value = 0;
                if (sale.qty !== undefined && sale.sub !== undefined) {
                    value = (parseInt(sale.qty) || 0) * (parseFloat(sale.sub) || 0);
                } else {
                    value = parseFloat(sale.value || sale.oppValue || sale.saleValue || sale.total) || 0;
                }

                const status = sale.status || "";
                if (status === "مكتمل" || status === "محقق" || status === "ناجح") {
                    staffAggregation[name].completed += value;
                } else if (status === "معلق") {
                    staffAggregation[name].pending += value;
                }
            });

            const realStaffNames = Object.keys(staffAggregation);
            const finalLabels = Array.from({length: 30}, (_, i) => realStaffNames[i] || `موظف مبيعات ${i + 1}`);
            
            const salesDataset = Array.from({length: 30}, (_, i) => {
                const name = realStaffNames[i];
                return name ? staffAggregation[name].completed : (salesTotal === 0 ? 0 : Math.floor(salesTotal * (Math.random() * 0.15)));
            });

            const pendingDataset = Array.from({length: 30}, (_, i) => {
                const name = realStaffNames[i];
                return name ? staffAggregation[name].pending : (pendingTotal === 0 ? 0 : Math.floor(pendingTotal * (Math.random() * 0.10)));
            });

            staffChart.data.labels = finalLabels;
            staffChart.data.datasets[0].data = salesDataset;
            staffChart.data.datasets[1].data = pendingDataset;
            staffChart.update();
        }
    }

    initCharts();
    populateFilterOptions();
    updateDashboard();

    document.querySelectorAll('.filters-grid select').forEach(select => {
        select.addEventListener('change', updateDashboard);
    });

    window.addEventListener('storage', function(e) {
        if (e.key && e.key.includes('asgate_')) {
            populateFilterOptions();
            updateDashboard();
        }
    });
});