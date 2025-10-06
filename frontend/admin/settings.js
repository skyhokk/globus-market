document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = "https://globus-market-backend.onrender.com"; // Убедитесь, что здесь ваш рабочий URL
    const token = localStorage.getItem('accessToken');

    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // --- ЭЛЕМЕНТЫ DOM ---
    const allToggles = document.querySelectorAll('.switch input[type="checkbox"]');
    const saveContactsBtn = document.getElementById('save-settings-btn');
    const savedMessage = document.getElementById('settings-saved-message');

    // --- ФУНКЦИИ ---

    // Функция для обновления текста у переключателей
    function updateToggleText(toggleElement) {
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

    // Загрузка и применение всех настроек
    async function loadAndApplySettings() {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/settings`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Не удалось загрузить настройки');
            const settings = await response.json();
            
            const settingsMap = new Map(settings.map(s => [s.key, s.value]));
            
            // Применяем значения к полям контактов
            document.querySelectorAll('input[data-key]').forEach(input => {
                const key = input.dataset.key;
                if (settingsMap.has(key)) {
                    input.value = settingsMap.get(key);
                }
            });

            // Применяем значения к переключателям
            const showStockToggle = document.getElementById('show-stock-toggle');
            showStockToggle.checked = settingsMap.get('show_stock_publicly') === 'true';
            updateToggleText(showStockToggle);

            const ignoreStockToggle = document.getElementById('ignore-stock-toggle');
            ignoreStockToggle.checked = settingsMap.get('ignore_stock_limits') === 'true';
            updateToggleText(ignoreStockToggle);

        } catch (error) {
            console.error(error.message);
            alert(`Ошибка загрузки настроек: ${error.message}`);
        }
    }

    // Обработчик изменения состояния переключателя
    async function handleToggleChange(event) {
        const toggle = event.target;
        const newValue = toggle.checked;
        updateToggleText(toggle); // Сразу обновляем текст
        
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
             if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Сервер ответил ошибкой');
            }
            // Можно добавить тихое уведомление об успехе
        } catch (error) {
            alert(`Ошибка сохранения настройки: ${error.message}`);
            // В случае ошибки возвращаем переключатель в исходное состояние
            toggle.checked = !newValue;
            updateToggleText(toggle);
        }
    }

    // Сохранение всех контактов
    async function saveAllContactSettings() {
        const inputs = document.querySelectorAll('#contact-fields-container input[data-key]');
        savedMessage.textContent = 'Сохранение...';
        savedMessage.style.color = 'black';

        // Создаем массив промисов для всех запросов
        const promises = Array.from(inputs).map(input => {
            const key = input.dataset.key;
            const value = input.value;
            return fetch(`${API_BASE_URL}/admin/settings/${key}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: value })
            }).then(response => {
                // Проверяем, что каждый отдельный запрос успешен
                if (!response.ok) {
                    return response.json().then(err => Promise.reject(err));
                }
                return response.json();
            });
        });

        try {
            // Ожидаем выполнения всех запросов
            await Promise.all(promises);
            savedMessage.textContent = 'Контакты успешно сохранены!';
            savedMessage.style.color = 'green';
        } catch (error) {
            console.error('Ошибка сохранения контактов:', error);
            const detail = error.detail || 'Произошла неизвестная ошибка';
            savedMessage.textContent = `Ошибка: ${detail}`;
            savedMessage.style.color = 'red';
        } finally {
            // Прячем сообщение через 3 секунды
            setTimeout(() => { savedMessage.textContent = ''; }, 3000);
        }
    }

    // --- ПРИВЯЗКА СОБЫТИЙ ---
    allToggles.forEach(toggle => {
        toggle.addEventListener('change', handleToggleChange);
    });
    saveContactsBtn.addEventListener('click', saveAllContactSettings);

    // --- ПЕРВЫЙ ЗАПУСК ---
    loadAndApplySettings();
});