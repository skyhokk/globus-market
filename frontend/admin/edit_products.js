// D:\globus-market\frontend\admin\edit_products.js - ФИНАЛЬНАЯ ВЕРСИЯ

/**
 * Вспомогательная функция для экранирования кавычек в HTML-атрибутах
 */
function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', () => {
    // --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И НАСТРОЙКИ ---
    const API_BASE_URL = "https://globus-market-backend.onrender.com";
    const token = localStorage.getItem('accessToken');

    // --- ЭЛЕМЕНТЫ DOM ---
    const productsTbody = document.getElementById('products-tbody');
    const saveStatus = document.getElementById('save-status');
    const saveButton = document.getElementById('save-products-btn');
    const stockToggle = document.getElementById('toggle-stock-edit');

    /**
     * Загружает все товары с сервера и отрисовывает таблицу или карточки
     */
    async function loadAndRenderProducts() {
        if (!token) {
            window.location.href = 'index.html';
            return;
        }

        // Примечание: для админ-панели в идеале нужен отдельный эндпоинт, 
        // который отдает ВСЕ товары, включая скрытые. Сейчас мы используем публичный,
        // который отдает только видимые.
        productsTbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Загрузка товаров...</td></tr>`;

        try {
            const response = await fetch(`${API_BASE_URL}/admin/products/all`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Не удалось загрузить список товаров');
            
            const products = await response.json();
            productsTbody.innerHTML = ''; 

            if (products.length === 0) {
                productsTbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Товары не найдены.</td></tr>`;
                return;
            }
            
            // Рендер в зависимости от ширины экрана
            if (window.innerWidth > 768) {
                // --- РЕНДЕР ТАБЛИЦЫ ДЛЯ ДЕСКТОПА ---
                products.forEach(product => {
                    const tr = document.createElement('tr');
                    tr.dataset.productId = product.id; 
                    
                    tr.innerHTML = `
                        <td><input type="text" class="product-sku" value="${escapeHTML(product.sku || '')}" data-original-value="${escapeHTML(product.sku || '')}"></td>
                        <td><textarea class="product-name" rows="1" data-original-value="${escapeHTML(product.name || '')}">${product.name || ''}</textarea></td>
                        <td><input type="number" class="product-price" value="${product.price || 0}" min="0" step="0.01" data-original-value="${escapeHTML(product.price || 0)}"></td>
                        <td style="text-align: center;">
                            <input type="file" class="image-upload-input" style="display: none;" accept="image/*">
                            <button type="button" class="upload-image-btn">Обновить</button>
                        </td>
                        <td><input type="number" class="product-stock" value="${product.stock || 0}" min="0" disabled data-original-value="${escapeHTML(product.stock || 0)}"></td>
                        <td>
                            <label class="switch">
                                <input type="checkbox" class="product-visible-toggle" ${product.is_visible ? 'checked' : ''} data-original-value="${product.is_visible}">
                                <span class="slider round"></span>
                            </label>
                        </td>
                    `;
                    productsTbody.appendChild(tr);
                });
            } else {
                // --- РЕНДЕР КАРТОЧЕК ДЛЯ МОБИЛЬНЫХ ---
                products.forEach(product => {
                    const tr = document.createElement('tr');
                    tr.dataset.productId = product.id;
                    tr.innerHTML = `
                        <td class="card-cell">
                            <div class="product-card-mobile">
                                <div class="product-card-header">
                                    <input type="text" class="product-sku product-sku-badge" value="${escapeHTML(product.sku || '')}" data-original-value="${escapeHTML(product.sku || '')}">
                                    <button type="button" class="upload-image-btn mobile-btn">📷 Изображение</button>
                                    <input type="file" class="image-upload-input" style="display: none;" accept="image/*">
                                </div>
                                <div class="product-card-body">
                                    <textarea class="product-name" rows="1" data-original-value="${escapeHTML(product.name || '')}">${product.name || ''}</textarea>
                                    <div class="product-card-inputs">
                                        <div class="input-group">
                                            <label>Цена</label>
                                            <input type="number" class="product-price" value="${product.price || 0}" min="0" step="0.01" data-original-value="${escapeHTML(product.price || 0)}">
                                        </div>
                                        <div class="input-group">
                                            <label>На складе</label>
                                            <input type="number" class="product-stock" value="${product.stock || 0}" min="0" disabled data-original-value="${escapeHTML(product.stock || 0)}">
                                        </div>
                                    </div>
                                </div>
                                <div class="product-card-footer">
                                     <label>Отображать на сайте</label>
                                     <label class="switch">
                                        <input type="checkbox" class="product-visible-toggle" ${product.is_visible ? 'checked' : ''} data-original-value="${product.is_visible}">
                                        <span class="slider round"></span>
                                     </label>
                                </div>
                            </div>
                        </td>
                    `;
                    productsTbody.appendChild(tr);
                });
            }

            

        } catch (error) {
            productsTbody.innerHTML = `<tr><td colspan="6" style="color: red; text-align:center;">${error.message}</td></tr>`;
        }
    }

    /**
     * Функция #1: ЛОГИКА ПЕРЕКЛЮЧАТЕЛЯ ОСТАТКОВ
     */
    function handleStockToggle() {
        const isEnabled = stockToggle.checked;
        productsTbody.querySelectorAll('.product-stock').forEach(input => {
            input.disabled = !isEnabled;
        });
    }

    /**
     * Функция #2: ЛОГИКА ЗАГРУЗКИ ИЗОБРАЖЕНИЙ
     */
    async function uploadImage(productId, file) {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const response = await fetch(`${API_BASE_URL}/products/${productId}/image`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (!response.ok) throw new Error('Ошибка при загрузке изображения.');
            alert('Изображение успешно обновлено!');
        } catch (error) {
            alert(error.message);
        }
    }

    /**
     * Функция #3: ЛОГИКА СОХРАНЕНИЯ ВСЕХ ИЗМЕНЕНИЙ
     */
    async function saveAllChanges() {
        saveButton.disabled = true;
        saveStatus.textContent = 'Проверка изменений...';
        
        const updates = [];
        const changedProductNames = [];
        const rows = productsTbody.querySelectorAll('tr[data-product-id]');

        rows.forEach(row => {
            const skuInput = row.querySelector('.product-sku');
            const nameTextarea = row.querySelector('.product-name');
            const priceInput = row.querySelector('.product-price');
            const stockInput = row.querySelector('.product-stock');
            const visibleToggle = row.querySelector('.product-visible-toggle');

            const isSkuChanged = skuInput.value !== skuInput.dataset.originalValue;
            const isNameChanged = nameTextarea.value !== nameTextarea.dataset.originalValue;
            const isPriceChanged = priceInput.value !== priceInput.dataset.originalValue;
            const isStockChanged = stockInput.value !== stockInput.dataset.originalValue;
            const isVisibleChanged = visibleToggle.checked.toString() !== visibleToggle.dataset.originalValue;
            
            if (isSkuChanged || isNameChanged || isPriceChanged || isStockChanged || isVisibleChanged) {
                updates.push({
                    id: parseInt(row.dataset.productId),
                    sku: skuInput.value,
                    name: nameTextarea.value,
                    price: parseFloat(priceInput.value),
                    stock: parseInt(stockInput.value),
                    is_visible: visibleToggle.checked
                });
                changedProductNames.push(nameTextarea.value);
            }
        });

        if (updates.length === 0) {
            saveStatus.textContent = 'Нет изменений для сохранения.';
            saveButton.disabled = false;
            setTimeout(() => { saveStatus.textContent = ''; }, 3000);
            return;
        }
        
        saveStatus.textContent = 'Сохранение...';

        try {
            const response = await fetch(`${API_BASE_URL}/admin/products/bulk-update`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates: updates })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Произошла неизвестная ошибка');
            }

            saveStatus.textContent = `Успешно обновлено ${updates.length} товар(ов).`;
            saveStatus.style.color = 'green';
            
            // Обновляем "оригинальные" значения после успешного сохранения
            updates.forEach(update => {
                const row = productsTbody.querySelector(`tr[data-product-id="${update.id}"]`);
                if (row) {
                    row.querySelector('.product-sku').dataset.originalValue = update.sku;
                    row.querySelector('.product-name').dataset.originalValue = update.name;
                    row.querySelector('.product-price').dataset.originalValue = update.price;
                    row.querySelector('.product-stock').dataset.originalValue = update.stock;
                    row.querySelector('.product-visible-toggle').dataset.originalValue = update.is_visible;
                }
            });

        } catch (error) {
            saveStatus.textContent = `Ошибка: ${error.message}`;
            saveStatus.style.color = 'red';
        } finally {
            saveButton.disabled = false;
            setTimeout(() => { saveStatus.textContent = ''; }, 10000);
        }
    }


    // --- ПРИВЯЗКА ОБРАБОТЧИКОВ СОБЫТИЙ ---
    saveButton.addEventListener('click', saveAllChanges);
    stockToggle.addEventListener('change', handleStockToggle);

    productsTbody.addEventListener('click', event => {
        if (event.target.classList.contains('upload-image-btn')) {
            const fileInput = event.target.closest('td, .product-card-mobile').querySelector('.image-upload-input');
            if (fileInput) fileInput.click();
        }
    });

    productsTbody.addEventListener('change', event => {
        if (event.target.classList.contains('image-upload-input')) {
            const file = event.target.files[0];
            if (file) {
                const productId = event.target.closest('tr[data-product-id]').dataset.productId;
                uploadImage(productId, file);
            }
        }
    });

    // --- ПЕРВЫЙ ЗАПУСК ---
    loadAndRenderProducts();
});