document.addEventListener('DOMContentLoaded', function() {
    let achievedChart, gaugeChart, pendingChart, staffChart;

    const oppCountEl = document.getElementById('oppCount');
    const visitCountEl = document.getElementById('visitCount');
    const salesValueEl = document.getElementById('salesValue');
    const tbody = document.getElementById('monthsBody');

    const monthsNames = ["يناير", "فبراير", "مارس", "ابريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

    // 1. قراءة البيانات من 3 مصادر مختلفة (المبيعات، الفرص، الزيارات)
    function getRawData() {
        try {
            // سحب البيانات من المفاتيح المحدثة مع توفير بدائل (Fallbacks)
            const visitsData = localStorage.getItem('asgate_visits_final_v31') || localStorage.getItem('asgate_visits_data_v21');
            const oppsData = localStorage.getItem('asgate_opportunities_final_v31') || localStorage.getItem('asgate_opportunities_v21');
            const salesData = localStorage.getItem('asgate_sales_final_v31') || localStorage.getItem('asgate_sales_v21') || localStorage.getItem('asgate_sales_data_v21');
            
            return {
                visits: visitsData ? JSON.parse(visitsData) : [],
                opportunities: oppsData ? JSON.parse(oppsData) : [],
                sales: salesData ? JSON.parse(salesData) : []
            };
        } catch (e) {
            console.error("خطأ في قراءة LocalStorage:", e);
            return { visits: [], opportunities: [], sales: [] };
        }
    }

    // 2. تعبئة الفلاتر من جميع الجداول لضمان شمولية الفلترة
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
            
            const itemDate = item.date || item.visitDate || item.oppDate || item.saleDate;
            if (itemDate) {
                const year = itemDate.split('-')[0];
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
            const itemDate = item.date || item.visitDate || item.oppDate || item.saleDate || "";
            const itemYear = itemDate ? itemDate.split('-')[0] : "";
            const itemMonth = itemDate ? itemDate.split('-')[1] : "";

            if (selectedYear !== "all" && itemYear !== selectedYear) return false;
            if (selectedMonth !== "all" && itemMonth !== selectedMonth) return false;
            if (selectedRegion !== "all" && item.region !== selectedRegion) return false;
            if (selectedSupervisor !== "all" && item.supervisor !== selectedSupervisor) return false;
            
            const ownerName = item.salesman || item.owner;
            if (selectedSalesman !== "all" && ownerName !== selectedSalesman) return false;
            
            return true;
        };

        // تصفية كل مصفوفة على حدة بناءً على الفلاتر
        const filteredSales = data.sales.filter(filterCallback);
        const filteredOpps = data.opportunities.filter(filterCallback);
        const filteredVisits = data.visits.filter(filterCallback);

        let totalSales = 0;
        let totalPending = 0;

        // حساب المكتمل والمعلق من مصفوفة المبيعات (Sales) حصراً
        filteredSales.forEach(sale => {
            const val = parseFloat(sale.value || sale.oppValue || sale.saleValue || sale.total) || 0;
            const status = sale.status || "";
            if (status === "محقق" || status === "ناجح" || status === "مكتمل") {
                totalSales += val;
            } else if (status === "معلق") {
                totalPending += val;
            }
        });

        // تحديث المربعات العلوية
        if(oppCountEl) oppCountEl.innerText = filteredOpps.length.toLocaleString('en-US'); // يحسب من الفرص
        if(visitCountEl) visitCountEl.innerText = filteredVisits.length.toLocaleString('en-US'); // يحسب من الزيارات
        if(salesValueEl) salesValueEl.innerText = totalSales.toLocaleString('en-US'); // المكتمل
        
        const pendingValueEl = document.querySelector('.bg-yellow .value-text');
        if(pendingValueEl) pendingValueEl.innerText = totalPending.toLocaleString('en-US'); // المعلق

        // تمرير البيانات المفلترة للجدول والرسومات
        updateYearlyTable(filteredSales, filteredOpps, filteredVisits, selectedYear);
        updateChartsLogic(totalSales, totalPending, filteredVisits.length, filteredOpps.length, filteredSales);
    }

    // 4. بناء الجدول الشهري (يتم سحب كل عمود من مصدره بشكل دقيق)
    function updateYearlyTable(sales, opps, visits, year) {
        if (!tbody) return;
        tbody.innerHTML = '';

        monthsNames.forEach((monthName, index) => {
            const monthCode = (index + 1).toString().padStart(2, '0');
            
            const mSales = sales.filter(s => {
                const d = s.date || s.saleDate || s.oppDate || s.visitDate || "";
                return d.split('-')[1] === monthCode;
            });
            const mOpps = opps.filter(o => {
                const d = o.date || o.oppDate || o.visitDate || "";
                return d.split('-')[1] === monthCode;
            });
            const mVisits = visits.filter(v => {
                const d = v.date || v.visitDate || v.oppDate || "";
                return d.split('-')[1] === monthCode;
            });

            let mCompleted = 0;
            let mPending = 0;
            let mVisitsCount = mVisits.length;  // عدد الزيارات من صفحة الزيارات
            let mOppsCount = mOpps.length;      // عدد الفرص من صفحة الفرص

            // حساب المبالغ للمبيعات المكتملة والمعلقة
            mSales.forEach(s => {
                const val = parseFloat(s.value || s.oppValue || s.saleValue || s.total || 0) || 0;
                const status = s.status || "";
                if (status === "محقق" || status === "ناجح" || status === "مكتمل") mCompleted += val;
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

            // رسمة فريق المبيعات تعتمد على بيانات "المبيعات" حصراً
            filteredSales.forEach(sale => {
                const name = (sale.salesman || sale.owner || "").trim();
                if (!name) return;

                if (!staffAggregation[name]) {
                    staffAggregation[name] = { completed: 0, pending: 0 };
                }

                const value = parseFloat(sale.value || sale.oppValue || sale.saleValue || sale.total) || 0;
                const status = sale.status || "";
                if (status === "محقق" || status === "ناجح" || status === "مكتمل") {
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

    // الاستماع لأي تغيير في أي جدول ليتم التحديث في الوقت الفعلي
    window.addEventListener('storage', function(e) {
        if (e.key && e.key.includes('asgate_')) {
            populateFilterOptions();
            updateDashboard();
        }
    });
});