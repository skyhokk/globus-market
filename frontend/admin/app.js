// D:\globus-market\frontend\admin\app.js - ПОЛНАЯ ВЕРСИЯ С ИНТЕГРАЦИЕЙ МОБИЛЬНОГО РЕДАКТОРА И НАСТРОЕКАМИ

document.addEventListener('DOMContentLoaded', () => {
    
    // --- КОНСТАНТЫ И ПЕРЕМЕННЫЕ ---
    const API_BASE_URL = "https://globus-market-backend.onrender.com";
    let currentDate = new Date();

    // --- ССЫЛКИ НА HTML-ЭЛЕМЕНТЫ ---
    const loginSection = document.getElementById('login-section');
    const adminSection = document.getElementById('admin-section');
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');
    const logoutButton = document.getElementById('logout-button');
    const prevDayBtn = document.getElementById('prev-day-btn');
    const nextDayBtn = document.getElementById('next-day-btn');
    const currentDateDisplay = document.getElementById('current-date-display');
    
    // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

    function formatDateTime(isoString) {
        if (!isoString) return '';
        const date = new Date(isoString);
        if (isNaN(date)) return 'Invalid Date';
        return date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function formatDateForAPI(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function updateDateDisplay() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        currentDate.setHours(0, 0, 0, 0);

        if (currentDate.getTime() === today.getTime()) {
            currentDateDisplay.textContent = 'Сегодня';
        } else {
            currentDateDisplay.textContent = currentDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
    }
    
    function calculateFinalSum(order) {
        const totalSum = order.items.reduce((sum, item) => sum + (item.quantity * item.price_per_item), 0);
        return totalSum - (totalSum * order.discount_percent / 100);
    }

    // --- ФУНКЦИИ УПРАВЛЕНИЯ ИНТЕРФЕЙСОМ ---

    function showLoginPanel() {
        loginSection.classList.remove('hidden');
        adminSection.classList.add('hidden');
        document.body.classList.add('login-view');
    }

    function showAdminPanel(token) {
        loginSection.classList.add('hidden');
        adminSection.classList.remove('hidden');
        document.body.classList.remove('login-view');
        loadOrders(token, currentDate);
        initializeSettingsPanel(token); // <--- ДОБАВЛЕН ВЫЗОВ ФУНКЦИИ НАСТРОЕК
    }

    // --- ФУНКЦИИ-ОБРАБОТЧИКИ СОБЫТИЙ ---

    async function handleLogin(event) {
        event.preventDefault();
        errorMessage.textContent = '';
        const formData = new URLSearchParams();
        formData.append('username', loginForm.username.value);
        formData.append('password', loginForm.password.value);
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, { method: 'POST', body: formData });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Не удалось войти');
            localStorage.setItem('accessToken', data.access_token);
            showAdminPanel(data.access_token);
        } catch (error) {
            errorMessage.textContent = 'Ошибка: ' + error.message;
        }
    }

    function handleLogout() {
        localStorage.removeItem('accessToken');
        showLoginPanel();
    }

    // --- ОСНОВНАЯ ЛОГИКА ЗАГРУЗКИ И ОТОБРАЖЕНИЯ ---

    async function loadOrders(token, date) {
        currentDate = date;
        updateDateDisplay();
        
        const tbodyIds = ['new-orders-tbody', 'processed-orders-tbody', 'completed-orders-tbody', 'returned-orders-tbody', 'deleted-orders-tbody'];
        tbodyIds.forEach(id => {
            const tbody = document.getElementById(id);
            if(tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Загрузка...</td></tr>`;
        });

        const dateString = formatDateForAPI(date);
        
        try {
            // --- НАЧАЛО ИЗМЕНЕНИЙ ---
            // 1. Создаем два запроса: один для активных, второй для удалённых
            const activeOrdersPromise = fetch(`${API_BASE_URL}/admin/orders?date_str=${dateString}`, { 
                headers: { 'Authorization': `Bearer ${token}` } 
            });
            const deletedOrdersPromise = fetch(`${API_BASE_URL}/admin/orders?status=deleted&date_str=${dateString}`, { 
                headers: { 'Authorization': `Bearer ${token}` } 
            });

            // 2. Выполняем их параллельно и ждем оба ответа
            const [activeResponse, deletedResponse] = await Promise.all([activeOrdersPromise, deletedOrdersPromise]);

            if (activeResponse.status === 401 || activeResponse.status === 403) { handleLogout(); return; }
            if (!activeResponse.ok || !deletedResponse.ok) throw new Error('Не удалось загрузить часть заказов');
            
            const activeOrders = await activeResponse.json();
            const deletedOrders = await deletedResponse.json();

            // 3. Объединяем результаты в один массив
            const allOrders = [...activeOrders, ...deletedOrders];
            // --- КОНЕЦ ИЗМЕНЕНИЙ ---
            
            renderOrderTables(allOrders);
            initializeStatusFilters(allOrders);

        } catch (error) {
            console.error("Ошибка при загрузке заказов:", error);
            tbodyIds.forEach(id => {
                const tbody = document.getElementById(id);
                if(tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Ошибка загрузки заказов.</td></tr>`;
            });
        }
    }


    function renderOrderTables(orders) {
        const tbodies = {
            new: document.getElementById('new-orders-tbody'),
            processed: document.getElementById('processed-orders-tbody'),
            completed: document.getElementById('completed-orders-tbody'),
            returned: document.getElementById('returned-orders-tbody'),
            deleted: document.getElementById('deleted-orders-tbody')
        };
        
        if (window.innerWidth > 768) {
            Object.values(tbodies).forEach(tbody => { if(tbody) tbody.innerHTML = ''; });
        }

        const ordersByStatus = { new: [], processed: [], completed: [], returned: [], partially_returned: [], deleted: [] };
        orders.forEach(order => {
            if (ordersByStatus[order.status] !== undefined) {
                ordersByStatus[order.status].push(order);
            }
        });
        
        renderTableSection(tbodies.new, ordersByStatus.new, 'new');
        renderTableSection(tbodies.processed, ordersByStatus.processed, 'processed');
        renderTableSection(tbodies.completed, ordersByStatus.completed, 'completed');
        const allReturns = [...ordersByStatus.returned, ...ordersByStatus.partially_returned];
        renderTableSection(tbodies.returned, allReturns, 'returned');
        renderDeletedTableSection(tbodies.deleted, ordersByStatus.deleted);
    }

    function renderTableSection(tbody, orders, status) {
        if (!tbody) return;
        const desktopContainer = tbody;
        const mobileContainerId = desktopContainer.id.replace('-tbody', '-mobile');
        const mobileContainer = document.getElementById(mobileContainerId);

        desktopContainer.innerHTML = '';
        if (mobileContainer) mobileContainer.innerHTML = '';

        if (orders.length === 0) {
            desktopContainer.innerHTML = `<tr><td colspan="6" style="text-align:center;">Нет заказов в этом статусе.</td></tr>`;
            if (mobileContainer) mobileContainer.innerHTML = `<div class="no-orders-message">Нет заказов в этом статусе</div>`;
            return;
        }

        orders.forEach((order, index) => {
            const finalSum = calculateFinalSum(order);
            
            let desktopDateToShow = '';
            switch(status) {
                case 'new': desktopDateToShow = formatDateTime(order.created_at); break;
                case 'processed': desktopDateToShow = formatDateTime(order.processed_at); break;
                case 'completed': desktopDateToShow = formatDateTime(order.completed_at); break;
                case 'returned': desktopDateToShow = formatDateTime(order.returned_at) || formatDateTime(order.completed_at); break;
            }
            
            const desktopActionsHTML = generateActionButtons(order);
            const tr = document.createElement('tr');
            tr.dataset.orderId = order.id;
            tr.innerHTML = `
                <td>${index + 1}</td> <td>${order.order_number}</td>
                <td>${order.customer_name}<br><small>${order.customer_phone}</small></td>
                <td>${finalSum.toFixed(2)} ₸</td> <td>${desktopDateToShow}</td>
                <td class="action-btn-group">${desktopActionsHTML}</td>
            `;
            desktopContainer.appendChild(tr);

            if (mobileContainer) {
                let dateLabel = '', dateValue = '', statusInfo = {};
                switch(order.status) {
                    case 'new': 
                        dateLabel = 'Дата создания:'; dateValue = formatDateTime(order.created_at);
                        statusInfo = { text: 'Новый', className: 'new' }; break;
                    case 'processed': 
                        dateLabel = 'Дата обработки:'; dateValue = formatDateTime(order.processed_at);
                        statusInfo = { text: 'Обработанный', className: 'processed' }; break;
                    case 'completed': 
                        dateLabel = 'Дата завершения:'; dateValue = formatDateTime(order.completed_at);
                        statusInfo = { text: 'Завершён', className: 'completed' }; break;
                    case 'returned':
                    case 'partially_returned':
                        dateLabel = 'Дата возврата:'; dateValue = formatDateTime(order.returned_at) || formatDateTime(order.completed_at);
                        statusInfo = { text: 'Возврат', className: 'returned' }; break;
                }

                const mobileActionsHTML = generateMobileActionButtons(order);
                const card = document.createElement('div');
                card.className = 'order-card-mobile';
                card.dataset.orderId = order.id;
                card.innerHTML = `
                    <div class="card-header">
                        <span class="order-number">#${order.order_number}</span>
                        <span class="card-status-badge status-${statusInfo.className}">${statusInfo.text}</span>
                    </div>
                    <div class="card-details">
                        <div class="detail-item"><span>Клиент:</span> <strong>${order.customer_name}<br>${order.customer_phone}</strong></div>
                        <div class="detail-item"><span>Сумма:</span> <strong>${finalSum.toFixed(2)} ₸</strong></div>
                        <div class="detail-item"><span>${dateLabel}</span> <strong>${dateValue}</strong></div>
                    </div>
                    <div class="card-actions">${mobileActionsHTML}</div>
                `;
                mobileContainer.appendChild(card);
            }
        });
    }

    // +++ ДОБАВЬТЕ ЭТУ НОВУЮ ФУНКЦИЮ +++
    function renderDeletedTableSection(tbody, orders) {
        if (!tbody) return;
        tbody.innerHTML = '';

        if (orders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Нет заказов в этом статусе.</td></tr>`;
            return;
        }

        orders.forEach((order, index) => {
            const finalSum = calculateFinalSum(order);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${order.order_number}</td>
                <td>${order.customer_name}<br><small>${order.customer_phone}</small></td>
                <td>${finalSum.toFixed(2)} ₸</td>
                <td>${formatDateTime(order.deleted_at)}</td>
                <td>${order.deletion_reason || 'Не указана'}</td>
            `;
            tbody.appendChild(tr);
        });
    }


    function generateActionButtons(order) {
        const editUrl = `edit_order.html?id=${order.id}`;
        const pdfUrl = `${API_BASE_URL}${order.invoice_path_pdf}`;
        const excelUrl = `${API_BASE_URL}${order.invoice_path_xlsx}`;
        
        const pdfLink = `<a href="${pdfUrl}" class="action-link pdf" download>PDF</a>`;
        const excelLink = `<a href="${excelUrl}" class="action-link excel" download>Excel</a>`;
        
        let buttons = '';
        // Добавляем data-order-id и data-order-number ко всем кнопкам для доступа в обработчике
        const orderDataAttrs = `data-order-id="${order.id}" data-order-number="${order.order_number}"`;

        switch(order.status) {
            case 'new':
                buttons = `<button class="process-btn" ${orderDataAttrs}>Обработать</button> <button class="delete-btn" ${orderDataAttrs}>Удалить</button>`;
                break;
            case 'processed':
                buttons = `<button class="complete-btn" ${orderDataAttrs}>Выполнено</button> <a href="${editUrl}" class="edit-btn">Редакт.</a> <button class="delete-btn" ${orderDataAttrs}>Удалить</button>`;
                break;
            case 'completed':
                buttons = `<a href="${editUrl}" class="return-btn-table">Возврат</a>`;
                break;
            case 'returned':
            case 'partially_returned':
                buttons = `<a href="${editUrl}" class="edit-btn">Подробнее</a>`;
                break;
        }
        return `${buttons} ${pdfLink} ${excelLink}`;
    }

    function generateMobileActionButtons(order) {
        const pdfUrl = `${API_BASE_URL}${order.invoice_path_pdf}`;
        const excelUrl = `${API_BASE_URL}${order.invoice_path_xlsx}`;
        
        const pdfBtn = `<a href="${pdfUrl}" class="order-btn pdf" download>PDF</a>`;
        const excelBtn = `<a href="${excelUrl}" class="order-btn excel" download>Excel</a>`;
        
        let actionButtons = '';
        // Добавляем data-атрибуты для кнопок
        const orderDataAttrs = `data-order-id="${order.id}" data-order-number="${order.order_number}"`;

        switch(order.status) {
            case 'new':
                // Добавляем кнопку "Удалить"
                actionButtons = `<button class="order-btn process open-editor-btn" ${orderDataAttrs}>Обработать</button> <button class="order-btn return delete-btn" ${orderDataAttrs}>Удалить</button>`;
                break;
            case 'processed':
                // Добавляем кнопку "Удалить"
                actionButtons = `<button class="order-btn complete" ${orderDataAttrs}>Выполнено</button> <button class="order-btn edit open-editor-btn" ${orderDataAttrs}>Редакт.</button> <button class="order-btn return delete-btn" ${orderDataAttrs}>Удалить</button>`;
                break;
            case 'completed':
                actionButtons = `<button class="order-btn return open-editor-btn" ${orderDataAttrs}>Возврат</button>`;
                break;
            case 'returned':
            case 'partially_returned':
                actionButtons = `<button class="order-btn details open-editor-btn" ${orderDataAttrs}>Подробнее</button>`;
                break;
        }
        return `${actionButtons} ${pdfBtn} ${excelBtn}`;
    }

    function initializeStatusFilters(orders) {
        const filtersContainer = document.querySelector('.status-filters');
        if (!filtersContainer) return;

        const counts = { new: 0, processed: 0, completed: 0, returned: 0, partially_returned: 0 };
        orders.forEach(order => { if (counts[order.status] !== undefined) { counts[order.status]++; } });
        
        const totalReturns = counts.returned + counts.partially_returned;

        filtersContainer.innerHTML = `
            <button class="status-filter-btn active" data-filter="all"><span class="status-filter-label">Все</span><span class="status-filter-count">${orders.length}</span></button>
            <button class="status-filter-btn" data-filter="new"><span class="status-filter-label">Новые</span><span class="status-filter-count">${counts.new}</span></button>
            <button class="status-filter-btn" data-filter="processed"><span class="status-filter-label">Обработанные</span><span class="status-filter-count">${counts.processed}</span></button>
            <button class="status-filter-btn" data-filter="completed"><span class="status-filter-label">Завершённые</span><span class="status-filter-count">${counts.completed}</span></button>
            <button class="status-filter-btn" data-filter="returned"><span class="status-filter-label">Возвратные</span><span class="status-filter-count">${totalReturns}</span></button>
        `;

        filtersContainer.addEventListener('click', (event) => {
            const button = event.target.closest('.status-filter-btn');
            if (!button) return;

            document.querySelectorAll('.status-filter-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const filter = button.dataset.filter;
            const sections = document.querySelectorAll('.orders-section');

            sections.forEach(section => {
                if (filter === 'all' || section.dataset.status === filter || (filter === 'returned' && (section.dataset.status === 'returned' || section.dataset.status === 'partially_returned'))) {
                    section.style.display = 'block';
                } else {
                    section.style.display = 'none';
                }
            });
        });
    }

    // --- ПРИВЯЗКА ОБРАБОТЧИКОВ И ПЕРВЫЙ ЗАПУСК ---
    loginForm.addEventListener('submit', handleLogin);
    logoutButton.addEventListener('click', handleLogout);
    
    prevDayBtn.addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() - 1);
        loadOrders(localStorage.getItem('accessToken'), currentDate);
    });
    nextDayBtn.addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() + 1);
        loadOrders(localStorage.getItem('accessToken'), currentDate);
    });
    currentDateDisplay.addEventListener('click', () => {
        currentDate = new Date();
        loadOrders(localStorage.getItem('accessToken'), currentDate);
    });

    document.body.addEventListener('click', async (event) => {
        const token = localStorage.getItem('accessToken');
        const target = event.target;

        // Ищем ближайший элемент с данными заказа (карточка или строка таблицы)
        const orderElement = target.closest('[data-order-id]');
        if (!orderElement) return; // Если клик был не по заказу, выходим

        // Получаем данные заказа из атрибутов
        const orderId = orderElement.dataset.orderId;
        const orderNumber = orderElement.dataset.orderNumber;
        const isMobile = window.innerWidth <= 768;

        // --- ОБРАБОТЧИК КНОПКИ "УДАЛИТЬ" ---
        if (target.matches('.delete-btn')) {
            event.preventDefault();
            const reason = prompt(`Пожалуйста, укажите причину удаления заказа №${orderNumber}:`);

            if (reason && reason.trim() !== "") {
                if (confirm(`Вы уверены, что хотите удалить заказ №${orderNumber}?\nПричина: ${reason}\n\nЭто действие нельзя отменить.`)) {
                    try {
                        const response = await fetch(`${API_BASE_URL}/admin/orders/${orderId}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ reason: reason.trim() })
                        });
                        if (!response.ok) { 
                            const err = await response.json(); 
                            throw new Error(err.detail || 'Не удалось удалить заказ'); 
                        }
                        alert('Заказ успешно перемещен в "Удалённые".');
                        loadOrders(token, currentDate); // Обновляем список заказов
                    } catch (error) {
                        alert(`Ошибка: ${error.message}`);
                    }
                }
            } else if (reason !== null) { // Если пользователь нажал "ОК", но оставил поле пустым
                alert("Причина удаления не может быть пустой.");
            }
            return; // Завершаем, чтобы не сработали другие клики
        }

        // --- ОБРАБОТЧИК КНОПКИ "ВЫПОЛНЕНО" ---
        if (target.matches('.complete-btn') || target.matches('.complete')) {
            if (confirm(`Вы уверены, что хотите завершить заказ №${orderNumber}? Это действие спишет товары со склада.`)) {
                try {
                    const response = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/status`, {
                        method: 'PATCH',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'completed' })
                    });
                    if (!response.ok) { const err = await response.json(); throw new Error(err.detail); }
                    alert('Заказ успешно завершён!');
                    loadOrders(token, currentDate);
                } catch (error) { alert(`Ошибка: ${error.message}`); }
            }
            return;
        }

        // --- ОБРАБОТЧИКИ НАВИГАЦИИ (переход в редактор) ---
        if (!isMobile) { // Для десктопа
            if (target.matches('.process-btn') || target.matches('.return-btn-table') || target.matches('.edit-btn') || (target.closest('tr') && !target.closest('a, button'))) {
                window.location.href = `edit_order.html?id=${orderId}`;
            }
        } 
        else { // Для мобильной версии
            if (target.matches('.open-editor-btn') || (target.closest('.order-card-mobile') && !target.closest('a, button'))) {
                openOrderEditor(orderId);
            }
        }
    });

    const addProductBtn = document.getElementById('add-product-btn');
    if(addProductBtn) { addProductBtn.addEventListener('click', () => { window.location.href = 'add_product.html'; }); }
    
    const revisionBtn = document.getElementById('revision-btn');
    if(revisionBtn) { revisionBtn.addEventListener('click', () => { window.location.href = 'revision.html'; }); }

    const initialToken = localStorage.getItem('accessToken');
    if (initialToken) {
        showAdminPanel(initialToken);
    } else {
        showLoginPanel();
    }
    
    // =================================================================================================
    // ===== БЛОК: ГЛОБАЛЬНЫЕ НАСТРОЙКИ =====
    // =================================================================================================
    
    function initializeSettingsPanel(token) {
        
        // --- Вспомогательная функция для обновления текста у переключателей ---
        function updateToggleText(toggleElement) {
            if (!toggleElement) return; // Добавлена проверка на существование элемента
            const isChecked = toggleElement.checked;
            let statusTextElement, onText, offText;
            if (toggleElement.id === 'show-stock-toggle') {
                statusTextElement = document.getElementById('show-stock-status-text');
                onText = '[отображать]';
                offText = '[не отображать]';
            } else if (toggleElement.id === 'ignore-stock-toggle') {
                statusTextElement = document.getElementById('ignore-stock-status-text');
                onText = '[разрешено]';
                offText = '[запрещено]';
            }
            if (statusTextElement) {
                statusTextElement.textContent = isChecked ? onText : offText;
            }
        }

        // --- 1. Загрузка и применение всех настроек ---
        async function loadAndApplySettings() {
            try {
                const response = await fetch(`${API_BASE_URL}/admin/settings`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Не удалось загрузить настройки');
                const settings = await response.json();
                
                const settingsMap = new Map(settings.map(s => [s.key, s.value]));
                
                // Применяем значения к полям контактов
                document.querySelectorAll('#contact-fields-container input[data-key]').forEach(input => {
                    const key = input.dataset.key;
                    if (settingsMap.has(key)) {
                        input.value = settingsMap.get(key);
                    }
                });

                // Применяем значения к переключателям
                const showStockToggle = document.getElementById('show-stock-toggle');
                if (showStockToggle) {
                    showStockToggle.checked = settingsMap.get('show_stock_publicly') === 'true';
                    updateToggleText(showStockToggle);
                }

                const ignoreStockToggle = document.getElementById('ignore-stock-toggle');
                if (ignoreStockToggle) {
                    ignoreStockToggle.checked = settingsMap.get('ignore_stock_limits') === 'true';
                    updateToggleText(ignoreStockToggle);
                }

            } catch (error) {
                console.error(error.message);
                // alert(`Ошибка загрузки настроек: ${error.message}`);
            }
        }

        // --- 2. Логика сохранения настроек ---

        // Сохранение для переключателей
        async function handleToggleChange(event) {
            const toggle = event.target;
            const newValue = toggle.checked;
            updateToggleText(toggle);
            
            const keyMap = {
                'show-stock-toggle': 'show_stock_publicly',
                'ignore-stock-toggle': 'ignore_stock_limits'
            };
            const key = keyMap[toggle.id];
            if (!key) return;

            try {
                const response = await fetch(`${API_BASE_URL}/admin/settings/${key}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ value: newValue.toString() })
                });
                if (!response.ok) throw new Error('Ошибка сохранения');
            } catch (error) {
                alert(`Ошибка: ${error.message}`);
                toggle.checked = !newValue;
                updateToggleText(toggle);
            }
        }

        // Сохранение для всех контактов
        async function saveAllContactSettings() {
            const inputs = document.querySelectorAll('#contact-fields-container input[data-key]');
            const savedMessage = document.getElementById('settings-saved-message');
            if (!savedMessage) return;

            savedMessage.textContent = 'Сохранение...';
            savedMessage.style.color = 'black';

            const promises = Array.from(inputs).map(input => {
                const key = input.dataset.key;
                const value = input.value;
                return fetch(`${API_BASE_URL}/admin/settings/${key}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ value: value })
                }).then(response => {
                    if (!response.ok) return Promise.reject('Ошибка сервера');
                });
            });

            try {
                await Promise.all(promises);
                savedMessage.textContent = 'Контакты успешно сохранены!';
                savedMessage.style.color = 'green';
            } catch (error) {
                savedMessage.textContent = `Ошибка: ${error}`;
                savedMessage.style.color = 'red';
            } finally {
                setTimeout(() => { savedMessage.textContent = ''; }, 3000);
            }
        }

        // --- 3. Привязка событий ---
        const showStockToggle = document.getElementById('show-stock-toggle');
        const ignoreStockToggle = document.getElementById('ignore-stock-toggle'); // <-- ИСПРАВЛЕН ID
        const saveContactsBtn = document.getElementById('save-contacts-btn');

        if (showStockToggle) showStockToggle.addEventListener('change', handleToggleChange);
        if (ignoreStockToggle) ignoreStockToggle.addEventListener('change', handleToggleChange);
        if (saveContactsBtn) saveContactsBtn.addEventListener('click', saveAllContactSettings);

        // --- 4. Первый запуск ---
        loadAndApplySettings();
    }

    // =================================================================================================
    // ===== БЛОК: ЛОГИКА ЭКРАНА РЕДАКТИРОВАНИЯ ЗАКАЗА (МОБИЛЬНАЯ ВЕРСИЯ) =====
    // =================================================================================================
    
    const orderEditorScreen = document.getElementById('order-editor-screen');
    let mobileCurrentOrderData = null; 

    async function openOrderEditor(orderId) {
        const token = localStorage.getItem('accessToken');
        try {
            const response = await fetch(`${API_BASE_URL}/admin/orders`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Не удалось загрузить данные заказа');
            
            const orders = await response.json();
            const order = orders.find(o => o.id == orderId);
            if (!order) throw new Error('Заказ с таким ID не найден');
            
            mobileCurrentOrderData = order;
            renderMobileEditor(order);

            document.getElementById('admin-section').classList.add('hidden');
            orderEditorScreen.classList.remove('hidden');
            
            recalculateMobileTotals();
        } catch (error) {
            alert(`Ошибка: ${error.message}`);
        }
    }

    function renderMobileEditor(order) {
        const isEditable = ['new', 'processed'].includes(order.status);
        const isCompleted = order.status === 'completed';
        const isReturned = ['returned', 'partially_returned'].includes(order.status);
        const isViewOnly = !isEditable;

        orderEditorScreen.className = 'screen';
        if (isViewOnly) orderEditorScreen.classList.add('view-only-mode');

        document.getElementById('editor-order-number').textContent = `Заказ №${order.order_number}`;
        document.getElementById('editor-order-status').textContent = {
            'new': 'Новый, редактирование', 'processed': 'Обработанный, редактирование',
            'completed': 'Завершённый', 'returned': 'Возвратный', 'partially_returned': 'Частичный возврат'
        }[order.status] || 'Просмотр';

        document.getElementById('editor-customer-name').textContent = order.customer_name;
        document.getElementById('editor-customer-phone').textContent = order.customer_phone;
        document.getElementById('editor-customer-phone').href = `tel:${order.customer_phone}`;
        
        const commentLabel = document.getElementById('editor-comment-label');
        const commentValue = document.getElementById('editor-customer-comment');
        if (order.customer_comment) {
            commentValue.textContent = order.customer_comment;
            commentLabel.classList.remove('hidden');
            commentValue.classList.remove('hidden');
        } else {
            commentLabel.classList.add('hidden');
            commentValue.classList.add('hidden');
        }

        const discountInput = document.getElementById('editor-discount');
        discountInput.value = order.discount_percent || 0;
        discountInput.disabled = isViewOnly;

        const itemsContainer = document.getElementById('editor-items-container');
        itemsContainer.innerHTML = '';
        order.items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'editor-item-card';
            card.dataset.itemId = item.id;
            card.dataset.price = item.price_per_item;
            card.dataset.originalQuantity = item.quantity;
            card.dataset.returnedQuantity = item.returned_quantity || 0;
            
            card.innerHTML = `
                <div class="item-card-header">${item.product.name}</div>
                <div class="item-card-inputs">
                    <div>
                        <label>Кол-во</label>
                        <div class="quantity-control">
                            <button type="button" class="quantity-btn quantity-minus">-</button>
                            <input type="number" class="editor-quantity-input" value="${item.quantity}" min="0" ${!isEditable ? 'disabled' : ''}>
                            <button type="button" class="quantity-btn quantity-plus">+</button>
                        </div>
                    </div>
                    <div class="return-quantity-wrapper">
                        <label>На возврат</label>
                        <input type="number" class="editor-return-quantity-input" value="0" min="0" max="${item.quantity - (item.returned_quantity || 0)}">
                    </div>
                </div>
                <button class="item-card-delete-btn">🗑️</button>
            `;
            itemsContainer.appendChild(card);
        });
        
        const footer = document.querySelector('.editor-footer');
        footer.querySelectorAll('.dynamic-btn').forEach(btn => btn.remove());

        if (isEditable) {
            const saveBtn = document.createElement('button');
            saveBtn.id = 'editor-btn-save';
            saveBtn.className = 'editor-btn editor-btn-save dynamic-btn';
            saveBtn.textContent = 'Сохранить изменения';
            footer.appendChild(saveBtn);
        }
        if (isCompleted) {
            const initReturnBtn = document.createElement('button');
            initReturnBtn.id = 'editor-btn-init-return';
            initReturnBtn.className = 'editor-btn editor-btn-return dynamic-btn';
            initReturnBtn.textContent = 'Оформить возврат';
            footer.appendChild(initReturnBtn);
        }
        if (isReturned) {
            document.getElementById('editor-return-section').classList.remove('hidden');
            const printReturnBtn = document.createElement('button');
            printReturnBtn.id = 'editor-btn-print-return-static';
            printReturnBtn.className = 'editor-btn editor-btn-outline dynamic-btn';
            printReturnBtn.textContent = 'Печать возвратной накладной';
            footer.appendChild(printReturnBtn);
        } else {
             document.getElementById('editor-return-section').classList.add('hidden');
        }
    }

    function toggleMobileReturnMode(isReturnMode) {
        orderEditorScreen.classList.toggle('return-mode', isReturnMode);
        document.getElementById('editor-return-section').classList.toggle('hidden', !isReturnMode);
        
        document.getElementById('editor-btn-init-return').style.display = isReturnMode ? 'none' : 'block';
        const footer = document.querySelector('.editor-footer');

        if (isReturnMode) {
            const confirmBtn = document.createElement('button');
            confirmBtn.id = 'editor-btn-confirm-return';
            confirmBtn.className = 'editor-btn editor-btn-return dynamic-btn';
            confirmBtn.textContent = 'Завершить возврат';
            footer.appendChild(confirmBtn);

            const cancelBtn = document.createElement('button');
            cancelBtn.id = 'editor-btn-cancel-return';
            cancelBtn.className = 'editor-btn editor-btn-outline dynamic-btn';
            cancelBtn.textContent = 'Отменить';
            footer.appendChild(cancelBtn);
        } else {
            footer.querySelector('#editor-btn-confirm-return')?.remove();
            footer.querySelector('#editor-btn-cancel-return')?.remove();
            document.querySelectorAll('.editor-return-quantity-input').forEach(input => input.value = 0);
            recalculateMobileTotals();
        }
    }

    function recalculateMobileTotals() {
        let subtotal = 0;
        document.querySelectorAll('#editor-items-container .editor-item-card').forEach(card => {
            if (card.style.display === 'none') return;
            const quantity = parseInt(card.querySelector('.editor-quantity-input').value) || 0;
            const price = parseFloat(card.dataset.price);
            subtotal += quantity * price;
        });

        const discountPercent = parseFloat(document.getElementById('editor-discount').value) || 0;
        const discountAmount = subtotal * (discountPercent / 100);
        const finalTotal = subtotal - discountAmount;

        document.getElementById('summary-gross-total').textContent = `${subtotal.toFixed(2)} ₸`;
        const discountLabel = document.getElementById('summary-discount-label');
        const discountValue = document.getElementById('summary-discount-amount');
        
        if (discountAmount > 0) {
            discountLabel.textContent = `Скидка (${discountPercent}%):`;
            discountValue.textContent = `-${discountAmount.toFixed(2)} ₸`;
            discountLabel.classList.remove('hidden');
            discountValue.classList.remove('hidden');
        } else {
            discountLabel.classList.add('hidden');
            discountValue.classList.add('hidden');
        }
        document.getElementById('summary-net-total').textContent = `${finalTotal.toFixed(2)} ₸`;

        let returnSubtotal = 0;
        document.querySelectorAll('#editor-items-container .editor-item-card').forEach(card => {
            const returnQty = parseInt(card.querySelector('.editor-return-quantity-input').value) || 0;
            const price = parseFloat(card.dataset.price);
            returnSubtotal += returnQty * price;
        });

        const noDiscount = document.getElementById('editor-return-no-discount').checked;
        let finalReturnTotal = returnSubtotal;
        if (!noDiscount && discountPercent > 0) {
            finalReturnTotal *= (1 - discountPercent / 100);
        }
        document.getElementById('summary-return-total').textContent = `${finalReturnTotal.toFixed(2)} ₸`;
        
        if (mobileCurrentOrderData && ['returned', 'partially_returned'].includes(mobileCurrentOrderData.status)) {
            document.getElementById('summary-return-total').textContent = `${(mobileCurrentOrderData.total_returned_amount || 0).toFixed(2)} ₸`;
            document.getElementById('editor-return-no-discount').closest('label').style.display = 'none';
        } else {
             document.getElementById('editor-return-no-discount').closest('label').style.display = 'flex';
        }
    }

    async function saveMobileOrderChanges() {
        const token = localStorage.getItem('accessToken');
        const updateData = {
            items: {}, items_to_delete: [],
            discount_percent: parseFloat(document.getElementById('editor-discount').value) || 0
        };

        document.querySelectorAll('#editor-items-container .editor-item-card').forEach(card => {
            const itemId = card.dataset.itemId;
            if (card.dataset.deleted === 'true') {
                updateData.items_to_delete.push(parseInt(itemId));
            } else {
                const quantity = parseInt(card.querySelector('.editor-quantity-input').value) || 0;
                updateData.items[itemId] = { quantity: quantity };
            }
        });

        try {
            const response = await fetch(`${API_BASE_URL}/admin/orders/${mobileCurrentOrderData.id}`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });
            if (!response.ok) { const err = await response.json(); throw new Error(err.detail || 'Не удалось сохранить изменения'); }
            alert('Заказ успешно обновлён!');
            window.location.reload();
        } catch (error) {
            alert(`Ошибка: ${error.message}`);
        }
    }

    async function processMobileReturn() {
        const token = localStorage.getItem('accessToken');
        const itemsToReturn = [];
        
        document.querySelectorAll('#editor-items-container .editor-item-card').forEach(card => {
            const quantity = parseInt(card.querySelector('.editor-return-quantity-input').value) || 0;
            if (quantity > 0) {
                itemsToReturn.push({ order_item_id: parseInt(card.dataset.itemId), quantity: quantity });
            }
        });

        if (itemsToReturn.length === 0) {
            alert('Укажите количество хотя бы для одного товара для возврата.'); return;
        }
        if (!confirm('Вы уверены, что хотите оформить возврат? Товары будут возвращены на склад.')) return;

        let returnSubtotal = 0;
        itemsToReturn.forEach(itemToReturn => {
            const card = document.querySelector(`.editor-item-card[data-item-id="${itemToReturn.order_item_id}"]`);
            returnSubtotal += itemToReturn.quantity * parseFloat(card.dataset.price);
        });
        const discountPercent = parseFloat(document.getElementById('editor-discount').value) || 0;
        const returnWithoutDiscount = document.getElementById('editor-return-no-discount').checked;
        let finalReturnAmount = returnSubtotal;
        if (!returnWithoutDiscount && discountPercent > 0) {
            finalReturnAmount *= (1 - discountPercent / 100);
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/admin/orders/${mobileCurrentOrderData.id}/return`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items_to_return: itemsToReturn,
                    final_return_amount: finalReturnAmount,
                    return_without_discount: returnWithoutDiscount
                })
            });
            if (!response.ok) { const err = await response.json(); throw new Error(err.detail || 'Не удалось оформить возврат'); }
            alert('Возврат успешно оформлен!');
            window.location.reload();
        } catch (error) {
            alert(`Ошибка: ${error.message}`);
        }
    }

    orderEditorScreen.addEventListener('click', (event) => {
        const target = event.target;
        if (target.matches('.back-to-list-btn')) {
            orderEditorScreen.classList.add('hidden');
            document.getElementById('admin-section').classList.remove('hidden');
            loadOrders(localStorage.getItem('accessToken'), currentDate);
        } 
        else if (target.matches('.item-card-delete-btn')) {
            if (confirm('Вы уверены, что хотите удалить товар из заказа?')) {
                const card = target.closest('.editor-item-card');
                card.style.display = 'none';
                card.dataset.deleted = 'true';
                recalculateMobileTotals();
            }
        } 
        else if (target.matches('.quantity-plus') || target.matches('.quantity-minus')) {
            const input = target.parentElement.querySelector('.editor-quantity-input');
            let currentValue = parseInt(input.value) || 0;
            if (target.matches('.quantity-plus')) {
                currentValue++;
            } else {
                currentValue = Math.max(0, currentValue - 1);
            }
            input.value = currentValue;
            recalculateMobileTotals();
        }
        else if (target.matches('#editor-btn-save')) saveMobileOrderChanges();
        else if (target.matches('#editor-btn-init-return')) toggleMobileReturnMode(true);
        else if (target.matches('#editor-btn-cancel-return')) toggleMobileReturnMode(false);
        else if (target.matches('#editor-btn-confirm-return')) processMobileReturn();
        else if (target.matches('#editor-btn-copy')) {
            const pdfUrl = `${API_BASE_URL}${mobileCurrentOrderData.invoice_path_pdf}`;
            const shareText = `Здравствуйте! Ваша накладная по заказу №${mobileCurrentOrderData.order_number}:\n${pdfUrl}`;
            navigator.clipboard.writeText(shareText).then(() => alert('Текст с ссылкой на PDF скопирован!'));
        }
    });

    orderEditorScreen.addEventListener('input', (event) => {
        if (event.target.matches('.editor-quantity-input, .editor-return-quantity-input, #editor-discount, #editor-return-no-discount')) {
            recalculateMobileTotals();
        }
    });

});