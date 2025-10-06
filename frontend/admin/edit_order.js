const API_BASE_URL = "https://globus-market-backend.onrender.com";
let currentOrderData = null; // Будем хранить исходные данные заказа

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('id');

    if (!orderId) {
        document.getElementById('edit-form-container').innerHTML = '<p>ID заказа не найден в URL.</p>';
        return;
    }

    loadOrderDetails(orderId, token);
});

async function loadOrderDetails(orderId, token) {
    const container = document.getElementById('edit-form-container');
    container.innerHTML = '<p>Загрузка данных заказа...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/admin/orders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Не удалось загрузить заказы');
        
        const orders = await response.json();
        const order = orders.find(o => o.id == orderId);

        if (!order) throw new Error('Заказ с таким ID не найден');

        currentOrderData = order;
        document.getElementById('order-title').textContent = `Редактирование заказа №${order.order_number}`;
        
        renderEditForm(order, token);
        updateTotals(); 

    } catch (error) {
        console.error("Ошибка:", error);
        container.innerHTML = `<p style="color: red;">${error.message}</p>`;
    }
}


function toggleReturnMode(isReturnMode) {
    const form = document.getElementById('edit-order-form');
    form.classList.toggle('return-mode', isReturnMode);

    const initReturnBtn = document.getElementById('init-return-btn');
    const confirmReturnBtn = document.getElementById('confirm-return-btn');
    const cancelReturnBtn = document.getElementById('cancel-return-btn');
    const printReturnBtn = document.getElementById('print-return-btn-dynamic');
    const editDiscountLink = document.getElementById('edit-discount-link');
    const returnTotals = document.getElementById('return-totals');

    if (isReturnMode) {
        if(initReturnBtn) initReturnBtn.style.display = 'none';
        if(printReturnBtn) printReturnBtn.style.display = 'inline-block';
        if(confirmReturnBtn) confirmReturnBtn.style.display = 'block';
        if(cancelReturnBtn) cancelReturnBtn.style.display = 'block';
        if(editDiscountLink) editDiscountLink.style.display = 'inline';
        if(returnTotals) returnTotals.style.display = 'block';

    } else {
        if(initReturnBtn) initReturnBtn.style.display = 'inline-block';
        if(printReturnBtn) printReturnBtn.style.display = 'none';
        if(confirmReturnBtn) confirmReturnBtn.style.display = 'none';
        if(cancelReturnBtn) cancelReturnBtn.style.display = 'none';
        if(editDiscountLink) editDiscountLink.style.display = 'none';
        if(returnTotals) returnTotals.style.display = 'none';
        
        form.querySelectorAll('.return-item-checkbox').forEach(cb => cb.checked = false);
        form.querySelectorAll('.return-quantity-input').forEach(input => {
            input.value = 0;
            input.disabled = true;
        });
        
        const discountInput = document.getElementById('discount');
        if (discountInput.dataset.originalValue) {
            discountInput.value = discountInput.dataset.originalValue;
        }
        discountInput.disabled = true;
    }
}

// D:\globus-market\frontend\admin\edit_order.js

async function processReturn() {
    const token = localStorage.getItem('accessToken');
    const itemsToReturn = [];
    const checkedItems = document.querySelectorAll('.return-item-checkbox:checked');

    if (checkedItems.length === 0) {
        alert('Отметьте хотя бы один товар для возврата.');
        return;
    }
    
    let hasInvalidQuantity = false;
    let returnedItemsDetails = [];
    checkedItems.forEach(checkbox => {
        const tr = checkbox.closest('tr');
        const quantityInput = tr.querySelector('.return-quantity-input');
        const quantity = parseInt(quantityInput.value) || 0;
        const originalQuantity = parseInt(tr.dataset.originalQuantity);
        const productName = tr.querySelector('.product-name-cell').textContent;

        if (quantity > (originalQuantity - (parseInt(tr.dataset.returnedQuantity) || 0) )) {
            alert(`Ошибка: Количество возврата для товара "${productName}" (${quantity}) не может превышать ранее заказанное и еще не возвращенное количество.`);
            hasInvalidQuantity = true;
        }
        
        if (quantity > 0) {
            itemsToReturn.push({
                order_item_id: parseInt(tr.dataset.itemId),
                quantity: quantity
            });
            returnedItemsDetails.push(`- ${productName}: ${quantity} шт.`);
        }
    });

    if (hasInvalidQuantity) return;

    if (itemsToReturn.length === 0) {
        alert('Укажите количество возвращаемого товара (больше нуля).');
        return;
    }

    if (!confirm('Вы уверены, что хотите оформить возврат для выбранных товаров? Они будут возвращены на склад.')) {
        return;
    }
    
    const finalReturnAmount = getFinalReturnTotal();
    // --- ИЗМЕНЕНИЕ №1: Получаем состояние чекбокса ---
    const returnWithoutDiscount = document.getElementById('return-no-discount').checked;

    try {
        const response = await fetch(`${API_BASE_URL}/admin/orders/${currentOrderData.id}/return`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                items_to_return: itemsToReturn,
                final_return_amount: finalReturnAmount,
                // --- ИЗМЕНЕНИЕ №2: Добавляем недостающее поле ---
                return_without_discount: returnWithoutDiscount
            })
        });
        
        if (!response.ok) {
            // Улучшенная обработка ошибок, чтобы не видеть '[object Object]'
            const err = await response.json();
            let errorMessage = 'Не удалось оформить возврат';
            if (err.detail && typeof err.detail === 'string') {
                errorMessage = err.detail;
            } else if (err.detail && Array.isArray(err.detail)) {
                errorMessage = err.detail.map(e => `Ошибка в поле '${e.loc.join('.')}': ${e.msg}`).join('\n');
            }
            throw new Error(errorMessage);
        }

        const successMessage = "Возврат успешно оформлен!\n\nВозвращены товары:\n" + returnedItemsDetails.join('\n');
        alert(successMessage);
        window.location.reload();

    } catch (error) {
        alert(`Ошибка: ${error.message}`);
    }
}

function renderEditForm(order, token) {
    const container = document.getElementById('edit-form-container');
    const isEditable = ['new', 'processed'].includes(order.status);
    const isCompleted = order.status === 'completed';
    const isReturned = ['returned', 'partially_returned'].includes(order.status);

    // --- НАЧАЛО ИЗМЕНЕНИЙ: Условное добавление блока с примечанием ---
    let commentHTML = '';
    if (order.customer_comment) {
        // Создаем HTML-блок, только если комментарий не пустой
        commentHTML = `<p><strong>Примечание клиента:</strong><br>${order.customer_comment.replace(/\n/g, '<br>')}</p>`;
    }
    // --- КОНЕЦ ИЗМЕНЕНИЙ ---

    let itemsHTML = '';
    order.items.forEach(item => {
        const rowTotal = item.quantity * item.price_per_item;
        itemsHTML += `
            <tr data-price="${item.price_per_item}" data-item-id="${item.id}" data-original-quantity="${item.quantity}" data-returned-quantity="${item.returned_quantity || 0}">
                <td class="return-checkbox-cell"><input type="checkbox" class="return-item-checkbox"></td>
                <td class="product-name-cell">${item.product.name}</td>
                <td class="original-qty-cell"><input type="number" class="item-quantity" value="${item.quantity}" min="0" ${!isEditable ? 'disabled' : ''}></td>
                <td class="returned-qty-cell">${item.returned_quantity || 0}</td>
                <td class="return-qty-input-cell"><input type="number" class="return-quantity-input" value="0" min="0" max="${item.quantity - (item.returned_quantity || 0)}" disabled></td>
                <td>${item.price_per_item.toFixed(2)} ₸</td>
                <td class="row-total">${rowTotal.toFixed(2)} ₸</td>
                <td class="action-cell">${isEditable ? '<a href="#" class="delete-item-link">Удалить</a>' : ''}</td>
            </tr>
        `;
    });

    const formHTML = `
        <form id="edit-order-form" class="edit-form">
            <div class="customer-details">
                <h3>Детали заказа</h3>
                <p><strong>Клиент:</strong> ${order.customer_name}</p>
                <p><strong>Телефон:</strong> ${order.customer_phone}</p>
                
                ${commentHTML} <div class="form-row">
                    <label for="discount">Скидка (%): <a href="#" id="edit-discount-link" class="edit-link" style="display:none;">[редакт. скидку]</a></label>
                    <input type="number" id="discount" value="${order.discount_percent}" min="0" max="100" ${!isEditable ? 'disabled' : ''} data-original-value="${order.discount_percent}">
                </div>
                <div class="action-buttons">
                    <button type="button" id="share-btn" class="action-btn">Копировать ссылку</button>
                    <button type="button" id="print-btn" class="action-btn">Печать</button>
                    ${isCompleted ? '<button type="button" id="init-return-btn" class="action-btn return-btn">Оформить возврат</button>' : ''}
                    ${isReturned ? '<button type="button" id="print-return-btn-static" class="action-btn">Печать возвратной накладной</button>' : ''}
                    <button type="button" id="print-return-btn-dynamic" class="action-btn" style="display:none;">Печать возвратной накладной</button>
                </div>
            </div>
            
            <div class="order-summary">
                <h3>Состав заказа</h3>
                <table class="order-items-table">
                    <thead>
                        <tr>
                            <th class="return-checkbox-cell">✔️</th>
                            <th>Наименование</th>
                            <th class="original-qty-cell">Кол-во ${isReturned ? '[изнач.]' : ''}</th>
                            <th class="returned-qty-cell">Кол-во возвращено</th>
                            <th class="return-qty-input-cell">Возврат</th>
                            <th>Цена</th>
                            <th>Сумма</th>
                            <th class="action-cell">Действие</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHTML}</tbody>
                </table>
                <div class="order-totals">
                    <p class="order-total" id="subtotal">Сумма без скидки: 0.00 ₸</p>
                    <p class="order-total" id="discount-amount"></p>
                    <p class="order-total" id="final-total">Итого со скидкой: 0.00 ₸</p>
                    <div id="return-totals" style="display:none;">
                        <div class="return-discount-option">
                            <input type="checkbox" id="return-no-discount">
                            <label for="return-no-discount">Возврат без учёта скидки</label>
                        </div>
                        <p class="order-total return-total" id="return-total-amount">Итого возврат за товар: 0.00 ₸</p>
                    </div>
                </div>
            </div>
            <div class="form-footer">
                ${isEditable ? '<button type="submit" id="save-changes-btn" class="save-button">Сохранить изменения</button>' : ''}
                <button type="button" id="confirm-return-btn" class="save-button return-btn" style="display:none;">Завершить возврат</button>
                <button type="button" id="cancel-return-btn" class="action-btn" style="display:none; width: auto; margin-top: 10px;">Отменить</button>
            </div>
        </form>
    `;
    container.innerHTML = formHTML;

    
    document.getElementById('edit-order-form').classList.toggle('is-returned-view', isReturned);
    
    const form = document.getElementById('edit-order-form');
    if (isEditable) {
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            saveOrderChanges(order.id, token);
        });
        form.querySelectorAll('.delete-item-link').forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                if (confirm('Вы уверены, что хотите удалить эту позицию?')) {
                    const row = event.target.closest('tr');
                    row.style.display = 'none';
                    updateTotals();
                }
            });
        });
    }

    form.addEventListener('input', updateTotals);
    form.addEventListener('change', updateTotals);
    
    document.getElementById('print-btn').addEventListener('click', () => {
        renderPrintableInvoice(gatherDataFromForm(), 'Расходная накладная');
        window.print();
    });
    
    document.getElementById('share-btn').addEventListener('click', () => {
        const pdfUrl = `${API_BASE_URL}${currentOrderData.invoice_path_pdf}`;
        const shareText = `Здравствуйте! Ваша накладная по заказу №${currentOrderData.order_number}:\n${pdfUrl}`;
        navigator.clipboard.writeText(shareText).then(() => alert('Текст с ссылкой на PDF скопирован!'));
    });

    const initReturnBtn = document.getElementById('init-return-btn');
    if (initReturnBtn) {
        initReturnBtn.addEventListener('click', () => toggleReturnMode(true));
    }
    
    const confirmReturnBtn = document.getElementById('confirm-return-btn');
    if(confirmReturnBtn) confirmReturnBtn.addEventListener('click', processReturn);
    
    const cancelReturnBtn = document.getElementById('cancel-return-btn');
    if(cancelReturnBtn) cancelReturnBtn.addEventListener('click', () => toggleReturnMode(false));
    
    const editDiscountLink = document.getElementById('edit-discount-link');
    if(editDiscountLink) {
        editDiscountLink.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('discount').disabled = false;
        });
    }

    const printReturnBtnDynamic = document.getElementById('print-return-btn-dynamic');
    if(printReturnBtnDynamic) {
        printReturnBtnDynamic.addEventListener('click', () => {
            const dataForReturnSlip = gatherReturnData(true);
            if (dataForReturnSlip.items.length === 0) {
                alert('Сначала выберите товары для возврата, чтобы сформировать накладную.');
                return;
            }
            renderPrintableInvoice(dataForReturnSlip, 'Возвратная накладная', true);
            window.print();
        });
    }

    const printReturnBtnStatic = document.getElementById('print-return-btn-static');
    if(printReturnBtnStatic) {
        printReturnBtnStatic.addEventListener('click', () => {
            const dataForReturnSlip = gatherReturnData(false);
            renderPrintableInvoice(dataForReturnSlip, 'Возвратная накладная', true);
            window.print();
        });
    }

    form.querySelector('tbody').addEventListener('change', (event) => {
        if (event.target.classList.contains('return-item-checkbox')) {
            const tr = event.target.closest('tr');
            const returnQuantityInput = tr.querySelector('.return-quantity-input');
            returnQuantityInput.disabled = !event.target.checked;
            if (event.target.checked) {
                const maxReturn = parseInt(tr.dataset.originalQuantity) - parseInt(tr.dataset.returnedQuantity);
                returnQuantityInput.value = maxReturn;
            } else {
                returnQuantityInput.value = 0;
            }
        }
    });

    if (isReturned) {
        const returnTotalsDiv = document.getElementById('return-totals');
        const returnTotalAmountEl = document.getElementById('return-total-amount');

        if (returnTotalsDiv && returnTotalAmountEl && order.total_returned_amount != null) {
            returnTotalAmountEl.textContent = `Итого возврат за товар: ${order.total_returned_amount.toFixed(2)} ₸`;
            returnTotalsDiv.style.display = 'block';
            const returnDiscountOption = document.querySelector('.return-discount-option');
            if (returnDiscountOption) {
                returnDiscountOption.style.display = 'none';
            }
        }
    }
}

function updateTotals() {
    let subtotal = 0;
    const itemsTableBody = document.querySelector('.order-items-table tbody');
    if (!itemsTableBody) return;
    itemsTableBody.querySelectorAll('tr').forEach(row => {
        if (row.style.display === 'none') return;
        const quantityInput = row.querySelector('.item-quantity');
        const quantity = parseInt(quantityInput.value) || 0;
        const price = parseFloat(row.dataset.price);
        const rowTotal = quantity * price;
        row.querySelector('.row-total').textContent = `${rowTotal.toFixed(2)} ₸`;
        subtotal += rowTotal;
    });
    document.getElementById('subtotal').textContent = `Сумма без скидки: ${subtotal.toFixed(2)} ₸`;
    const discountInput = document.getElementById('discount');
    const discountPercent = parseFloat(discountInput.value) || 0;
    const discountAmountElement = document.getElementById('discount-amount');
    if (discountPercent > 0) {
        const discountAmount = subtotal * (discountPercent / 100);
        discountAmountElement.textContent = `Сумма скидки (${discountPercent}%): -${discountAmount.toFixed(2)} ₸`;
        discountAmountElement.style.display = 'block';
    } else {
        discountAmountElement.style.display = 'none';
    }
    const finalTotal = subtotal * (1 - discountPercent / 100);
    document.getElementById('final-total').textContent = `Итого со скидкой: ${finalTotal.toFixed(2)} ₸`;
    
    calculateAndDisplayReturnTotal();
    renderPrintableInvoice(gatherDataFromForm(), 'Расходная накладная');
}

function getFinalReturnTotal() {
    let returnSubtotal = 0;
    const checkedItems = document.querySelectorAll('.return-item-checkbox:checked');
    checkedItems.forEach(checkbox => {
        const tr = checkbox.closest('tr');
        const returnQtyInput = tr.querySelector('.return-quantity-input');
        const returnQty = parseInt(returnQtyInput.value) || 0;
        const price = parseFloat(tr.dataset.price);
        returnSubtotal += returnQty * price;
    });
    const discountPercent = parseFloat(document.getElementById('discount').value) || 0;
    const noDiscountCheckbox = document.getElementById('return-no-discount');
    const noDiscount = noDiscountCheckbox ? noDiscountCheckbox.checked : false;
    let finalReturnTotal = returnSubtotal;
    if (!noDiscount && discountPercent > 0) {
        finalReturnTotal *= (1 - discountPercent / 100);
    }
    return finalReturnTotal;
}

function calculateAndDisplayReturnTotal() {
    const returnTotalAmountEl = document.getElementById('return-total-amount');
    if (!returnTotalAmountEl) return;
    if (document.getElementById('edit-order-form').classList.contains('is-returned-view')) return;
    const finalReturnTotal = getFinalReturnTotal();
    returnTotalAmountEl.textContent = `Итого возврат за товар: ${finalReturnTotal.toFixed(2)} ₸`;
}


async function saveOrderChanges(orderId, token) {
    const updateData = {
        items: {},
        items_to_delete: [],
        discount_percent: parseFloat(document.getElementById('discount').value) || 0
    };
    document.querySelectorAll('.order-items-table tbody tr').forEach(row => {
        const itemId = row.dataset.itemId;
        if (row.style.display !== 'none') {
            const quantityInput = row.querySelector('.item-quantity');
            const quantity = parseInt(quantityInput.value) || 0;
            updateData.items[itemId] = { quantity: quantity };
        } else {
            updateData.items_to_delete.push(parseInt(itemId));
        }
    });

    try {
        const response = await fetch(`${API_BASE_URL}/admin/orders/${orderId}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        if (!response.ok) {
            const errorData = await response.json();
            if (errorData.detail && Array.isArray(errorData.detail)) {
                const firstError = errorData.detail[0];
                const errorMessage = `Поле: ${firstError.loc.join(' -> ')}, Ошибка: ${firstError.msg}`;
                throw new Error(errorMessage);
            }
            throw new Error(errorData.detail || 'Не удалось сохранить изменения');
        }
        alert('Заказ успешно обновлён!');
        window.location.href = 'index.html';
    } catch (error) {
        console.error("Ошибка сохранения:", error);
        alert(`Ошибка: ${error.message}`);
    }
}

function gatherDataFromForm() {
    const items = [];
    if (currentOrderData && currentOrderData.items) {
        currentOrderData.items.forEach(originalItem => {
            const row = document.querySelector(`tr[data-item-id="${originalItem.id}"]`);
            if (row && row.style.display !== 'none') {
                const quantityInput = row.querySelector('.item-quantity');
                items.push({ ...originalItem, quantity: parseInt(quantityInput.value) || 0 });
            }
        });
    }
    return { ...currentOrderData, items: items, discount_percent: parseFloat(document.getElementById('discount').value) || 0 };
}

function gatherReturnData(isDynamic = true) {
    const items = [];
    if (isDynamic) {
        const checkedItems = document.querySelectorAll('.return-item-checkbox:checked');
        checkedItems.forEach(checkbox => {
            const tr = checkbox.closest('tr');
            const returnQty = parseInt(tr.querySelector('.return-quantity-input').value) || 0;
            if (returnQty > 0) {
                const originalItemId = parseInt(tr.dataset.itemId);
                const originalItem = currentOrderData.items.find(i => i.id === originalItemId);
                if (originalItem) {
                    items.push({ ...originalItem, quantity: returnQty });
                }
            }
        });
    } else {
        currentOrderData.items.forEach(item => {
            if (item.returned_quantity > 0) {
                items.push({ ...item, quantity: item.returned_quantity });
            }
        });
    }
    
    const actualDiscount = parseFloat(document.getElementById('discount').value) || 0;
    return { ...currentOrderData, items: items, discount_percent: actualDiscount };
}


function renderPrintableInvoice(orderData, title = 'Расходная накладная', isReturn = false) {
    const container = document.getElementById('printable-invoice-container');
    if (!container || !orderData) return;

    let subtotal = 0;
    let itemsHTML = '';
    const quantityColumnHeader = isReturn ? 'Кол-во на возврат' : 'Кол-во';

    orderData.items.forEach((item, index) => {
        const itemTotal = item.quantity * item.price_per_item;
        subtotal += itemTotal;
        const imageUrl = item.product.image_url ? `${API_BASE_URL}${item.product.image_url}` : '';
        const imageCell = imageUrl ? `<img src="${imageUrl}" alt="Фото товара">` : '';

        itemsHTML += `
            <tr>
                <td>${index + 1}</td>
                <td>${item.product.sku}</td>
                <td>${imageCell}</td>
                <td>${item.product.name}</td>
                <td class="text-right">${item.quantity}</td>
                <td class="text-right">${item.price_per_item.toFixed(2)}</td>
                <td class="text-right">${itemTotal.toFixed(2)}</td>
            </tr>
        `;
    });
    
    let discountPercent = orderData.discount_percent;

    if (isReturn) {
        const noDiscountCheckbox = document.getElementById('return-no-discount');
        if (orderData.return_processed_without_discount === true) {
            discountPercent = 0;
        } 
        else if (noDiscountCheckbox && noDiscountCheckbox.checked) {
            discountPercent = 0;
        }
    }

    const discountAmount = subtotal * (discountPercent / 100);
    const finalTotal = subtotal - discountAmount;

    // --- ИЗМЕНЕНИЕ: Определяем правильный текст для итоговой суммы ---
    const finalTotalLabel = isReturn ? 'Итого к возврату:' : 'Итого к оплате:';

    const invoiceHTML = `
        <div class="invoice-print-box">
            <h2>${title} № ${orderData.order_number}</h2>
            <p><strong>Дата:</strong> ${new Date().toLocaleString('ru-RU', {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'})}</p>
            <p><strong>Клиент:</strong> ${orderData.customer_name}, <strong>Телефон:</strong> ${orderData.customer_phone}</p>
            
            <table>
                <thead>
                    <tr>
                        <th>№</th>
                        <th>Артикул</th>
                        <th>Фото</th>
                        <th>Наименование товара</th>
                        <th class="text-right">${quantityColumnHeader}</th>
                        <th class="text-right">Цена</th>
                        <th class="text-right">Сумма</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHTML}
                </tbody>
            </table>

            <div class="totals-section">
                <p><span>Сумма:</span> <span>${subtotal.toFixed(2)} ₸</span></p>
                ${discountAmount > 0 ? `<p><span>Скидка (${discountPercent.toFixed(1)}%):</span> <span>-${discountAmount.toFixed(2)} ₸</span></p>` : ''}
                <p class="final-total"><span>${finalTotalLabel}</span> <span>${finalTotal.toFixed(2)} ₸</span></p>
            </div>
        </div>
    `;
    container.innerHTML = invoiceHTML;
}