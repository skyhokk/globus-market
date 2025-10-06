document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = "https://globus-market-backend.onrender.com";
    const token = localStorage.getItem('accessToken');

    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // --- ФУНКЦИИ ДЛЯ РАБОТЫ С НАСТРОЙКАМИ ---

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

    async function loadAndApplySettings(token) {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/settings`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Не удалось загрузить настройки');
            const settings = await response.json();
            
            const settingsInputs = document.querySelectorAll('.settings-panel input[data-key]');
            const settingsMap = new Map(settings.map(s => [s.key, s.value]));
            
            settingsInputs.forEach(input => {
                const key = input.dataset.key;
                if (settingsMap.has(key)) {
                    input.value = settingsMap.get(key);
                }
            });

            const showStockToggle = document.getElementById('show-stock-toggle');
            showStockToggle.checked = settingsMap.get('show_stock_publicly') === 'true' || false;
            updateToggleText(showStockToggle);

            const ignoreStockToggle = document.getElementById('ignore-stock-toggle');
            ignoreStockToggle.checked = settingsMap.get('ignore_stock_limits') === 'true' || false;
            updateToggleText(ignoreStockToggle);
        } catch (error) {
            console.error(error.message);
        }
    }

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
            await fetch(`${API_BASE_URL}/admin/settings/${key}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: newValue.toString() })
            });
        } catch (error) {
            alert(`Ошибка: ${error.message}`);
            toggle.checked = !newValue;
            updateToggleText(toggle);
        }
    }

    async function saveContactSettings() {
        const inputs = document.querySelectorAll('.settings-panel input[data-key]');
        const messageEl = document.getElementById('settings-saved-message');
        if (!messageEl) return;
        messageEl.textContent = 'Сохранение...';

        const promises = Array.from(inputs).map(input => {
            const key = input.dataset.key;
            const value = input.value;
            return fetch(`${API_BASE_URL}/admin/settings/${key}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: value })
            });
        });

        try {
            await Promise.all(promises);
            messageEl.textContent = 'Настройки успешно сохранены!';
            setTimeout(() => { messageEl.textContent = ''; }, 3000);
        } catch (error) {
            console.error('Ошибка сохранения настроек:', error);
            messageEl.textContent = 'Ошибка сохранения!';
            setTimeout(() => { messageEl.textContent = ''; }, 3000);
        }
    }

    // --- ПРИВЯЗКА СОБЫТИЙ ---
    document.getElementById('show-stock-toggle').addEventListener('change', handleToggleChange);
    document.getElementById('ignore-stock-toggle').addEventListener('change', handleToggleChange);
    document.getElementById('save-settings-btn').addEventListener('click', saveContactSettings);
    
    const toggleContactsBtn = document.getElementById('toggle-contacts-btn');
    const contactFieldsContainer = document.getElementById('contact-fields-container');
    if (toggleContactsBtn && contactFieldsContainer) {
        toggleContactsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isHidden = contactFieldsContainer.classList.toggle('hidden');
            e.target.textContent = isHidden ? 'Контакты [показать]' : 'Контакты [скрыть]';
        });
    }

    // --- ПЕРВЫЙ ЗАПУСК ---
    loadAndApplySettings(token);
});