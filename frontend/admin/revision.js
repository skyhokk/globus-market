document.addEventListener('DOMContentLoaded', () => {

    const API_BASE_URL = "https://globus-market-backend.onrender.com";
    const token = localStorage.getItem('accessToken');

    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    const revisionTbody = document.getElementById('revision-tbody');
    const saveButton = document.getElementById('save-revision-btn');
    const printButton = document.getElementById('print-btn');

    /**
     * Загружает данные для ревизии с бэкенда и отрисовывает таблицу
     */
    async function loadRevisionData() {
        revisionTbody.innerHTML = `<tr><td colspan="9" style="text-align:center;">Загрузка данных...</td></tr>`;
        try {
            const response = await fetch(`${API_BASE_URL}/admin/inventory/revision-list`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Не удалось получить данные для ревизии');
            
            const data = await response.json();
            renderTable(data);

        } catch (error) {
            revisionTbody.innerHTML = `<tr><td colspan="9" style="color:red; text-align:center;">${error.message}</td></tr>`;
        }
    }

    /**
     * Отрисовывает строки таблицы или карточки на основе полученных данных
     */
    function renderTable(products) {
        revisionTbody.innerHTML = '';
        if (products.length === 0) {
            revisionTbody.innerHTML = `<tr><td colspan="8" style="text-align:center;">Товары не найдены.</td></tr>`;
            return;
        }

        if (window.innerWidth > 768) {
            // --- ЛОГИКА ДЛЯ ДЕСКТОПНОЙ ВЕРСИИ (ВАШ ОРИГИНАЛЬНЫЙ КОД) ---
            products.forEach(p => {
                const tr = document.createElement('tr');
                tr.dataset.productId = p.product_id;
                tr.dataset.dbStock = p.db_stock;

                tr.innerHTML = `
                    <td>${p.sku}</td>
                    <td>${p.name}</td>
                    <td>${p.price.toFixed(2)} ₸</td>
                    <td style="text-align:center;">${p.reserved.new}</td>
                    <td style="text-align:center;">${p.reserved.processed}</td>
                    <td style="text-align:center;">${p.db_stock}</td>
                    <td><input type="number" class="actual-stock-input" min="0"></td>
                    <td class="diff-cell"></td>
                `;
                revisionTbody.appendChild(tr);
            });
        } else {
            // --- ЛОГИКА ДЛЯ МОБИЛЬНЫХ КАРТОЧЕК ---
            products.forEach(p => {
                const tr = document.createElement('tr');
                tr.dataset.productId = p.product_id;
                tr.dataset.dbStock = p.db_stock;
                tr.innerHTML = `
                    <td class="card-cell">
                        <div class="revision-card-mobile">
                            <div class="revision-card-header">
                                <span class="revision-sku">${p.sku}</span>
                                <span class="revision-price">${p.price.toFixed(2)} ₸</span>
                            </div>
                            <p class="revision-name">${p.name}</p>
                            <div class="revision-grid">
                                <div class="revision-item"><div class="revision-label">В базе</div><div class="revision-value">${p.db_stock}</div></div>
                                <div class="revision-item"><div class="revision-label">В заказах (новые)</div><div class="revision-value">${p.reserved.new}</div></div>
                                <div class="revision-item"><div class="revision-label">В заказах (обр.)</div><div class="revision-value">${p.reserved.processed}</div></div>
                                <div class="revision-item diff-cell-mobile"><div class="revision-label">Разница</div><div class="revision-value diff-value"></div></div>
                            </div>
                            <div class="revision-input-group">
                                <label>Фактическое кол-во</label>
                                <input type="number" class="actual-stock-input" min="0" placeholder="Введите кол-во">
                            </div>
                        </div>
                    </td>
                `;
                revisionTbody.appendChild(tr);
            });
        }
    }

    /**
     * Обновляет ячейку "Разница" при вводе в поле "факт"
     */
    function updateDifference(inputElement) {
        const tr = inputElement.closest('tr');
        
        // --- ИЗМЕНЕНИЕ: Ищем правильный элемент для отображения разницы ---
        let diffCell = tr.querySelector('.diff-cell'); // для десктопа
        let diffValueElement = null;
        if (!diffCell) {
            // для мобильных
            diffCell = tr.querySelector('.diff-cell-mobile'); 
            diffValueElement = diffCell.querySelector('.diff-value');
        }
        // --- КОНЕЦ ИЗМЕНЕНИЯ ---

        const dbStock = parseInt(tr.dataset.dbStock);
        const actualStock = inputElement.value;

        const targetElement = diffValueElement || diffCell;

        if (actualStock === '') {
            targetElement.textContent = '';
            diffCell.classList.remove('diff-positive', 'diff-negative');
            if (diffValueElement) {
                 diffValueElement.classList.remove('diff-positive', 'diff-negative');
            }
            return;
        }

        const difference = parseInt(actualStock) - dbStock;
        targetElement.textContent = difference > 0 ? `+${difference}` : difference;
        
        const elementToStyle = diffValueElement || diffCell;
        elementToStyle.classList.toggle('diff-positive', difference > 0);
        elementToStyle.classList.toggle('diff-negative', difference < 0);
    }

    /**
     * Собирает данные и отправляет на сервер
     */
    async function saveRevision() {
        const updates = [];
        const allInputs = revisionTbody.querySelectorAll('.actual-stock-input');

        allInputs.forEach(input => {
            if (input.value !== '') { // Отправляем только те, что были заполнены
                const tr = input.closest('tr');
                updates.push({
                    product_id: parseInt(tr.dataset.productId),
                    new_stock: parseInt(input.value)
                });
            }
        });

        if (updates.length === 0) {
            alert('Не введено ни одного значения для обновления.');
            return;
        }
        
        if (!confirm(`Вы уверены, что хотите обновить остатки для ${updates.length} товаров? Это действие нельзя отменить.`)) {
            return;
        }

        saveButton.disabled = true;
        saveButton.textContent = 'Сохранение...';

        try {
            const response = await fetch(`${API_BASE_URL}/admin/inventory/update`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates: updates })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Произошла ошибка при сохранении');
            }

            const result = await response.json();
            alert(result.message);
            loadRevisionData(); // Обновляем данные на странице

        } catch (error) {
            alert(`Ошибка: ${error.message}`);
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = 'Сохранить результаты ревизии';
        }
    }


    // --- ПРИВЯЗКА СОБЫТИЙ ---
    
    // Делегирование событий для инпутов
    revisionTbody.addEventListener('input', (event) => {
        if (event.target.classList.contains('actual-stock-input')) {
            updateDifference(event.target);
        }
    });

    // Кнопка Сохранить
    saveButton.addEventListener('click', saveRevision);

    // Кнопка Распечатать
    printButton.addEventListener('click', () => {
        window.print();
    });

    // --- ПЕРВЫЙ ЗАПУСК ---
    loadRevisionData();
});