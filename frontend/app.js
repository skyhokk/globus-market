// D:\globus-market\frontend\app.js - ПОЛНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ

const API_BASE_URL = "https://globus-market-backend.onrender.com";
const PLACEHOLDER_IMAGE = "https://placehold.co/600x400?text=No+Image";

let cart = []; // Глобальная переменная для корзины

// --- Ссылки на DOM-элементы ---
const cartModal = document.getElementById('cart-modal');
const closeCartBtn = document.getElementById('close-cart-btn');
const minimizedCart = document.getElementById('minimized-cart');
const openCartLink = document.getElementById('open-cart-link');
const cartItemsContainer = document.getElementById('cart-items-container'); 
const checkoutForm = document.getElementById('checkout-form');
const productsGrid = document.getElementById('products-grid');

// --- ФУНКЦИИ ---

/**
 * Загружает и отображает контакты в шапке сайта
 */
// D:\globus-market\frontend\app.js

async function loadContacts() {
    try {
        const response = await fetch(`${API_BASE_URL}/settings/public`);
        if (!response.ok) return;

        const settings = await response.json();
        const contactBar = document.getElementById('contact-bar');
        if (!contactBar) return;
        
        let contactsHTML = '';

        if (settings.contact_whatsapp && settings.contact_whatsapp_display) {
            contactsHTML += `
                <a href="${settings.contact_whatsapp}" target="_blank">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" class="contact-icon" alt="WhatsApp"> 
                    ${settings.contact_whatsapp_display}
                </a>`;
        }
        if (settings.contact_instagram) {
            contactsHTML += `
                <a href="${settings.contact_instagram}" target="_blank">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png" class="contact-icon" alt="Instagram">
                    Instagram
                </a>`;
        }
        if (settings.contact_telegram) {
            contactsHTML += `
                <a href="${settings.contact_telegram}" target="_blank">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg" class="contact-icon" alt="Telegram">
                    Telegram
                </a>`;
        }

        contactBar.innerHTML = contactsHTML;
    } catch (error) {
        console.error('Не удалось загрузить контакты:', error);
    }
}

/**
 * Загружает и отображает категории и подкатегории
 */
async function loadCategories() {
    const desktopContainer = document.getElementById('categories-container');
    const mobileNavContainer = document.getElementById('category-navigation');

    try {
        const response = await fetch(`${API_BASE_URL}/categories`);
        if (!response.ok) throw new Error('Ошибка сети');
        const categories = await response.json();

        // --- 1. ГЕНЕРАЦИЯ ДЛЯ ДЕСКТОПНОГО САЙДБАРА ---
        let desktopHTML = `<h2>Категории</h2><ul>
            <li><a href="#" class="category-link all-products-link active">Все товары</a></li>
        `;
        categories.forEach(cat => {
            desktopHTML += `<li class="category-item">
                <span class="category-link" data-category-id="${cat.id}">${cat.name}</span>`;
            if (cat.subcategories && cat.subcategories.length > 0) {
                desktopHTML += '<ul>';
                cat.subcategories.forEach(sub => {
                    desktopHTML += `<li>
                        <a href="#" class="subcategory-link" data-subcategory-id="${sub.id}">
                            ${sub.name} (${sub.product_count})
                        </a>
                    </li>`;
                });
                desktopHTML += '</ul>';
            }
            desktopHTML += '</li>';
        });
        desktopHTML += '</ul>';
        desktopContainer.innerHTML = desktopHTML;

        // --- 2. ГЕНЕРАЦИЯ ДЛЯ МОБИЛЬНОЙ НАВИГАЦИИ ---
        mobileNavContainer.innerHTML = '';
        const mainTabsContainer = document.createElement('div');
        mainTabsContainer.className = 'main-categories';
        const subTabsContainer = document.createElement('div');
        subTabsContainer.className = 'sub-categories';

        const allProductsTab = document.createElement('button');
        allProductsTab.className = 'main-category-tab active';
        allProductsTab.textContent = 'Все товары';
        allProductsTab.onclick = () => {
            loadProducts();
            setActiveTab(allProductsTab, '.main-category-tab');
            subTabsContainer.innerHTML = '';
        };
        mainTabsContainer.appendChild(allProductsTab);

        const renderSubTabs = (category) => {
            subTabsContainer.innerHTML = '';
            const allSubTab = document.createElement('button');
            allSubTab.className = 'sub-category-tab active';
            allSubTab.textContent = `Все в "${category.name}"`;
            allSubTab.onclick = () => {
                loadProducts(null, null, category.id);
                setActiveTab(allSubTab, '.sub-category-tab');
            };
            subTabsContainer.appendChild(allSubTab);

            category.subcategories.forEach(sub => {
                const subTab = document.createElement('button');
                subTab.className = 'sub-category-tab';
                subTab.textContent = `${sub.name} (${sub.product_count})`;
                subTab.onclick = () => {
                    loadProducts(null, sub.id);
                    setActiveTab(subTab, '.sub-category-tab');
                };
                subTabsContainer.appendChild(subTab);
            });
        };

        categories.forEach((cat, index) => {
            const mainTab = document.createElement('button');
            mainTab.className = 'main-category-tab';
            mainTab.textContent = cat.name;
            mainTab.onclick = () => {
                renderSubTabs(cat);
                setActiveTab(mainTab, '.main-category-tab');
                // --- ВОТ ИСПРАВЛЕНИЕ --- 
                // Загружаем товары для всей родительской категории при клике на неё
                loadProducts(null, null, cat.id); 
            };
            mainTabsContainer.appendChild(mainTab);

            if (index === 0 && categories.length > 0) {
                renderSubTabs(categories[0]);
            }
        });

        mobileNavContainer.appendChild(mainTabsContainer);
        mobileNavContainer.appendChild(subTabsContainer);

    } catch (error) {
        console.error("Не удалось загрузить категории:", error);
        desktopContainer.innerHTML = '<p>Не удалось загрузить категории.</p>';
        mobileNavContainer.innerHTML = '<p>Не удалось загрузить категории.</p>';
    }
}

// ДОБАВЬ ЭТУ НОВУЮ ФУНКЦИЮ ПОД loadCategories
function setActiveTab(activeButton, tabSelector) {
    // Убираем класс 'active' со всех вкладок того же уровня
    document.querySelectorAll(tabSelector).forEach(btn => {
        btn.classList.remove('active');
    });
    // Добавляем класс 'active' нажатой кнопке
    activeButton.classList.add('active');
}

/**
 * Загружает и отображает товары с учетом фильтров
 */
async function loadProducts(searchQuery = null, subcategoryId = null, categoryId = null) {
    const grid = document.getElementById('products-grid');
    grid.innerHTML = '<p>Загрузка товаров...</p>';
    let url = new URL(`${API_BASE_URL}/products`);
    if (searchQuery) url.searchParams.append('search', searchQuery);
    if (subcategoryId) url.searchParams.append('subcategory_id', subcategoryId);
    if (categoryId) url.searchParams.append('category_id', categoryId);

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Ошибка сети');
        const products = await response.json();
        grid.innerHTML = '';
        if (products.length === 0) {
            grid.innerHTML = '<p>Товары не найдены.</p>';
            return;
        }

        products.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';
            
            const itemInCart = cart.find(item => item.id === product.id);
            const escapedProductName = product.name.replace(/"/g, '&quot;');
            let imageUrl = product.image_url ? `${API_BASE_URL}${product.image_url}` : PLACEHOLDER_IMAGE;
            if (product.image_url && product.updated_at) {
                imageUrl += `?v=${new Date(product.updated_at).getTime()}`;
            }
            
            let stockHTML = product.stock !== null ? `<p class="product-stock">В наличии: ${product.stock} шт.</p>` : '';
            const maxStock = product.stock !== null ? product.stock : 999;

            // --- ОБНОВЛЕННЫЙ БЛОК ДЛЯ КНОПКИ/СЧЁТЧИКА ---
            let actionBlockHTML = '';
            if (itemInCart) {
                // Если товар в корзине, показываем счётчик
                actionBlockHTML = `
                    <div class="product-quantity-controls active" data-id="${product.id}">
                        <button class="quantity-btn quantity-decrease" aria-label="Уменьшить">-</button>
                        <input type="number" class="quantity-input" value="${itemInCart.quantity}" min="0" max="${maxStock}" readonly>
                        <button class="quantity-btn quantity-increase" aria-label="Увеличить">+</button>
                    </div>
                `;
            } else {
                // Если товара нет в корзине, показываем кнопку
                actionBlockHTML = `
                    <button class="add-to-cart-btn" data-id="${product.id}" data-name="${escapedProductName}" data-price="${product.price}">
                        В корзину
                    </button>
                `;
            }

            card.innerHTML = `
                <img src="${imageUrl}" alt="${escapedProductName}">
                <p class="product-name">${product.name}</p>
                <p class="product-price">${product.price} ₸</p>
                ${stockHTML}
                <div class="product-action-area">
                    ${actionBlockHTML}
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (error) {
        console.error("Не удалось загрузить товары:", error);
        grid.innerHTML = '<p>Не удалось загрузить товары.</p>';
    }
}

/**
 * Устанавливает класс 'active' для выбранной категории/подкатегории
 */
function setActiveCategory(activeElement) {
    document.querySelectorAll('.category-link.active, .subcategory-link.active').forEach(el => {
        el.classList.remove('active');
    });
    activeElement.classList.add('active');
}

/**
 * Обновляет состояние карточки товара (переключает между кнопкой и счётчиком)
 */
function updateProductCard(productId) {
    const card = document.querySelector(`.product-quantity-controls[data-id="${productId}"]`)?.closest('.product-card') || 
                 document.querySelector(`.add-to-cart-btn[data-id="${productId}"]`)?.closest('.product-card');

    if (!card) return;

    // Перерисовываем только блок с кнопками
    const actionArea = card.querySelector('.product-action-area');
    const productData = {
        id: parseInt(card.querySelector('[data-id]').dataset.id, 10),
        name: card.querySelector('.product-name').textContent,
        price: parseFloat(card.querySelector('.product-price').textContent),
        stock: parseInt(card.querySelector('.product-stock')?.textContent.replace(/\D/g, '') || 999, 10)
    };
    
    const itemInCart = cart.find(item => item.id === productData.id);
    const escapedProductName = productData.name.replace(/"/g, '&quot;');
    
    if (itemInCart) {
        actionArea.innerHTML = `
            <div class="product-quantity-controls active" data-id="${productData.id}">
                <button class="quantity-btn quantity-decrease" aria-label="Уменьшить">-</button>
                <input type="number" class="quantity-input" value="${itemInCart.quantity}" min="0" max="${productData.stock}" readonly>
                <button class="quantity-btn quantity-increase" aria-label="Увеличить">+</button>
            </div>
        `;
    } else {
        actionArea.innerHTML = `
            <button class="add-to-cart-btn" data-id="${productData.id}" data-name="${escapedProductName}" data-price="${productData.price}">
                В корзину
            </button>
        `;
    }
}

/**
 * Добавляет/изменяет/удаляет товар в корзине
 */
function updateCart(productId, quantityChange) {
    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity += quantityChange;
        if (existingItem.quantity <= 0) {
            cart = cart.filter(item => item.id !== productId);
        }
    } else if (quantityChange > 0) {
        const button = document.querySelector(`.add-to-cart-btn[data-id="${productId}"]`);
        cart.push({
            id: productId,
            name: button.dataset.name,
            price: parseFloat(button.dataset.price),
            quantity: 1
        });
    }
    updateCartUI();
    updateProductCard(productId);
}



/**
 * Главная функция обновления всего интерфейса корзины.
 */
function updateCartUI() {
    renderFullCart(); 
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (totalItems > 0 && cartModal.classList.contains('hidden')) {
        document.getElementById('minimized-cart-info').textContent = `Выбрано ${totalItems} тов. (${totalPrice.toFixed(2)} ₸)`;
        minimizedCart.classList.remove('hidden');
    } else {
        minimizedCart.classList.add('hidden');
    }
}

/**
 * Отрисовывает содержимое модального окна корзины.
 */
function renderFullCart() {
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const cartEmptyMessage = document.getElementById('cart-empty-message');
    const cartSummary = document.getElementById('cart-summary');
    cartItemsContainer.innerHTML = ''; 
    if (cart.length === 0) {
        cartEmptyMessage.classList.remove('hidden');
        cartSummary.classList.add('hidden');
    } else {
        cartEmptyMessage.classList.add('hidden');
        cartSummary.classList.remove('hidden');
        cart.forEach(item => {
            const li = document.createElement('li');
            li.className = 'cart-item';
            li.innerHTML = `
                <span class="cart-item-name">${item.name}</span>
                <input type="number" min="1" value="${item.quantity}" data-id="${item.id}" class="cart-quantity-input">
                <span class="price-info">x ${item.price.toFixed(2)} ₸</span>
                <button data-id="${item.id}" class="cart-remove-btn">&times;</button>
            `;
            cartItemsContainer.appendChild(li);
        });
        document.getElementById('cart-total').textContent = totalPrice.toFixed(2);
    }
}



document.addEventListener('DOMContentLoaded', () => {
    // Первоначальная загрузка данных
    loadContacts();
    loadCategories();
    loadProducts();

    // Поиск с задержкой
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            loadProducts(searchInput.value, null);
        }, 300); // Задержка в 300 мс
    });
    
    // --- ОБНОВЛЕННЫЙ БЛОК --- Обработчики кликов для десктопного сайдбара
    const sidebar = document.getElementById('categories-container');
    sidebar.addEventListener('click', (event) => {
        const target = event.target;
        
        // Сначала проверяем клик по "Все товары"
        if (target.classList.contains('all-products-link')) {
            event.preventDefault();
            loadProducts(); // Загрузка всех товаров без фильтра
            setActiveCategory(target);
        }
        // Клик по главной категории
        else if (target.classList.contains('category-link')) {
            event.preventDefault();
            loadProducts(null, null, target.dataset.categoryId);
            setActiveCategory(target);
        }
        // Клик по подкатегории
        else if (target.classList.contains('subcategory-link')) {
            event.preventDefault();
            loadProducts(null, target.dataset.subcategoryId);
            setActiveCategory(target);
        }
    });

    // Обработчик для карточек товаров
    productsGrid.addEventListener('click', (event) => {
        const target = event.target;
        const controls = target.closest('.product-quantity-controls');
        
        // Кнопка "В корзину"
        if (target.classList.contains('add-to-cart-btn')) {
            const productId = parseInt(target.dataset.id, 10);
            updateCart(productId, 1);
            return;
        }

        // Кнопки +/-
        if (controls) {
            const productId = parseInt(controls.dataset.id, 10);
            if (target.classList.contains('quantity-increase')) {
                updateCart(productId, 1);
            }
            if (target.classList.contains('quantity-decrease')) {
                updateCart(productId, -1);
            }
        }
    });

    // --- Обработчики для модального окна корзины ---
    cartItemsContainer.addEventListener('change', (event) => {
        if (event.target.classList.contains('cart-quantity-input')) {
            const item = cart.find(i => i.id === parseInt(event.target.dataset.id));
            if (item) item.quantity = Math.max(1, parseInt(event.target.value));
            updateCartUI();
        }
    });
    cartItemsContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('cart-remove-btn')) {
            cart = cart.filter(i => i.id !== parseInt(event.target.dataset.id));
            updateCartUI();
        }
    });
    openCartLink.addEventListener('click', (e) => {
        e.preventDefault();
        minimizedCart.classList.add('hidden');
        cartModal.classList.remove('hidden');
    });
    minimizedCart.addEventListener('click', (e) => {
        if (e.target.tagName !== 'A') {
            minimizedCart.classList.add('hidden');
            cartModal.classList.remove('hidden');
        }
    });
    closeCartBtn.addEventListener('click', () => {
        cartModal.classList.add('hidden');
        updateCartUI();
    });
    cartModal.addEventListener('click', (event) => {
        if (event.target === cartModal) {
            cartModal.classList.add('hidden');
            updateCartUI();
        }
    });
    checkoutForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const customerName = document.getElementById('customer-name').value;
        const customerPhone = document.getElementById('customer-phone').value;
        const customerComment = document.getElementById('customer-comment').value;

        const orderData = {
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_comment: customerComment,
            items: cart.map(item => ({ product_id: item.id, quantity: item.quantity }))
        };
        
        try {
            const response = await fetch(`${API_BASE_URL}/orders`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(orderData)
            });
            if (!response.ok) throw new Error('Ошибка при создании заказа');
            
            const result = await response.json();
            alert(`Заказ №${result.order_number} успешно создан!`);
            
            cart = [];
            checkoutForm.reset();
            updateCartUI();
            cartModal.classList.add('hidden');

        } catch (error) {
            console.error(error);
            alert('Не удалось создать заказ.');
        }
    });
});