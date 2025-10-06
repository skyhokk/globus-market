document.addEventListener('DOMContentLoaded', () => {

    // --- КОНСТАНТЫ И ПЕРЕМЕННЫЕ ---
    const API_BASE_URL = "http://127.0.0.1:8000";
    const token = localStorage.getItem('accessToken');
    let categoriesData = []; // Сохраняем загруженные категории здесь

    // --- ПРОВЕРКА АВТОРИЗАЦИИ ---
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // --- ССЫЛКИ НА HTML-ЭЛЕМЕНТЫ ---
    const categorySelect = document.getElementById('category');
    const subcategorySelect = document.getElementById('subcategory');
    const newCategoryBtn = document.getElementById('new-category-btn');
    const newSubcategoryBtn = document.getElementById('new-subcategory-btn');
    const form = document.getElementById('add-product-form');
    const formError = document.getElementById('form-error');

    // --- ФУНКЦИИ ---

    // --- НОВАЯ ФУНКЦИЯ: Очистка формы ---
    function resetForm() {
        form.reset(); // Встроенный метод для очистки полей формы
        
        // Дополнительно сбрасываем состояние подкатегорий
        subcategorySelect.innerHTML = '<option value="">-- Сначала выберите категорию --</option>';
        subcategorySelect.disabled = true;
        newSubcategoryBtn.disabled = true;

        // Возвращаем фокус на первое поле для удобства
        document.getElementById('sku').focus();
    }


    // Загрузка и отрисовка категорий
    async function loadCategories() {
        try {
            const response = await fetch(`${API_BASE_URL}/categories`);
            if (!response.ok) throw new Error('Не удалось загрузить категории');
            categoriesData = await response.json();
            
            categorySelect.innerHTML = '<option value="">-- Выберите категорию --</option>';
            categoriesData.forEach(cat => {
                const option = new Option(cat.name, cat.id);
                categorySelect.add(option);
            });
        } catch (error) {
            formError.textContent = `Ошибка: ${error.message}`;
        }
    }

    // Обновление списка подкатегорий при выборе категории
    function updateSubcategories() {
        const selectedCategoryId = categorySelect.value;
        subcategorySelect.innerHTML = '<option value="">-- Сначала выберите категорию --</option>';
        subcategorySelect.disabled = true;
        newSubcategoryBtn.disabled = true;

        if (selectedCategoryId) {
            const selectedCategory = categoriesData.find(cat => cat.id == selectedCategoryId);
            if (selectedCategory && selectedCategory.subcategories) {
                subcategorySelect.innerHTML = '<option value="">-- Выберите подкатегорию --</option>';
                selectedCategory.subcategories.forEach(sub => {
                    const option = new Option(sub.name, sub.id);
                    subcategorySelect.add(option);
                });
                subcategorySelect.disabled = false;
                newSubcategoryBtn.disabled = false;
            }
        }
    }

    // Создание новой категории
    async function handleNewCategory() {
        const categoryName = prompt('Введите название новой категории:');
        if (!categoryName || categoryName.trim() === '') return;

        try {
            const response = await fetch(`${API_BASE_URL}/categories`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: categoryName.trim() })
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Не удалось создать категорию');
            }
            const newCategory = await response.json();
            alert(`Категория "${newCategory.name}" успешно создана!`);
            await loadCategories(); // Перезагружаем список
            categorySelect.value = newCategory.id; // Выбираем новую категорию
            updateSubcategories();
        } catch (error) {
            alert(`Ошибка: ${error.message}`);
        }
    }

    // Создание новой подкатегории
    async function handleNewSubcategory() {
        const categoryId = categorySelect.value;
        if (!categoryId) {
            alert('Сначала выберите родительскую категорию!');
            return;
        }
        const subcategoryName = prompt('Введите название новой подкатегории:');
        if (!subcategoryName || subcategoryName.trim() === '') return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/categories/subcategories/`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: subcategoryName.trim(), category_id: parseInt(categoryId) })
            });
             if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Не удалось создать подкатегорию');
            }
            const newSubcategory = await response.json();
            alert(`Подкатегория "${newSubcategory.name}" успешно создана!`);
            await loadCategories(); // Перезагружаем все данные
            categorySelect.value = categoryId; // Восстанавливаем выбор категории
            updateSubcategories(); // Обновляем список подкатегорий
            subcategorySelect.value = newSubcategory.id; // Выбираем новую

        } catch (error) {
            alert(`Ошибка: ${error.message}`);
        }
    }

    // Отправка формы
    async function handleFormSubmit(event) {
        event.preventDefault();
        formError.textContent = '';
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Сохранение...';

        // 1. Создаем товар с текстовыми данными
        const productData = {
            sku: document.getElementById('sku').value,
            name: document.getElementById('name').value,
            price: parseFloat(document.getElementById('price').value),
            stock: parseInt(document.getElementById('stock').value),
            subcategory_id: parseInt(subcategorySelect.value)
        };
        
        try {
            const productResponse = await fetch(`${API_BASE_URL}/products`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(productData)
            });

            if (!productResponse.ok) {
                const err = await productResponse.json();
                throw new Error(err.detail || 'Ошибка при создании товара');
            }
            const newProduct = await productResponse.json();

            // 2. Если есть фото, загружаем его
            const imageFile = document.getElementById('image').files[0];
            if (imageFile) {
                const formData = new FormData();
                formData.append('file', imageFile);

                const imageResponse = await fetch(`${API_BASE_URL}/products/${newProduct.id}/image`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });

                if (!imageResponse.ok) {
                   throw new Error('Товар создан, но не удалось загрузить фото.');
                }
            }

            alert(`Товар "${newProduct.name}" успешно создан!`);
            
            // --- ИЗМЕНЕНИЕ: Вместо редиректа очищаем форму ---
            resetForm();

        } catch (error) {
            formError.textContent = `Ошибка: ${error.message}`;
        } finally {
            // Этот блок выполнится в любом случае - и при успехе, и при ошибке
            submitButton.disabled = false;
            submitButton.textContent = 'Сохранить товар';
        }
    }


    // --- ПРИВЯЗКА ОБРАБОТЧИКОВ И ПЕРВЫЙ ЗАПУСК ---
    categorySelect.addEventListener('change', updateSubcategories);
    newCategoryBtn.addEventListener('click', handleNewCategory);
    newSubcategoryBtn.addEventListener('click', handleNewSubcategory);
    form.addEventListener('submit', handleFormSubmit);

    loadCategories(); // Запускаем загрузку категорий при открытии страницы
});