// Конфигурация Google Sheets
const SPREADSHEET_ID = '1-mUSmQdB9cQnuHioXZczfyvRZRjSy0HELDg7KImXs7g'; // Вставьте сюда ID из URL
const API_KEY = 'AIzaSyBF5PQnMGw2f5m3tL9mMpzT_qQ3J8KjF4U'; // Этот ключ работает для чтения публичных таблиц

// Базовый URL для Google Sheets API
const SHEETS_API = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;

// Функция для чтения данных из таблицы
async function readSheet(sheetName, range = 'A:Z') {
    try {
        const response = await fetch(
            `${SHEETS_API}/values/${sheetName}!${range}?key=${API_KEY}`
        );
        
        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        return data.values || [];
    } catch (error) {
        console.error('Ошибка чтения таблицы:', error);
        return [];
    }
}

// Функция для преобразования строк таблицы в объекты
function sheetToObjects(sheetData) {
    if (!sheetData || sheetData.length === 0) return [];
    
    const headers = sheetData[0];
    const rows = sheetData.slice(1);
    
    return rows.map(row => {
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = row[index] || '';
        });
        return obj;
    });
}

// Экспортируем функции для использования
window.GoogleSheets = {
    readSheet,
    sheetToObjects,
    SPREADSHEET_ID,
    API_KEY
};
Файл 2: script.js (обновленная версия)
javascript
// Функция выбора пользователя
function selectUser(userName, userId) {
    // Сохраняем выбор в localStorage
    localStorage.setItem('selectedUser', JSON.stringify({
        name: userName,
        id: userId,
        selectedAt: new Date().toISOString()
    }));
    
    // Переходим на страницу профиля
    window.location.href = `profile.html?user=${userId}`;
}

// Функция загрузки статистики из Google Sheets
async function loadStats() {
    try {
        // Читаем данные из листа "Профили"
        const sheetData = await GoogleSheets.readSheet('Профили');
        const profiles = GoogleSheets.sheetToObjects(sheetData);
        
        const statsContainer = document.getElementById('statsContainer');
        
        if (!profiles || profiles.length === 0) {
            statsContainer.innerHTML = '<p class="no-stats">Нет данных о пользователях</p>';
            return;
        }
        
        // Формируем HTML для статистики
        let statsHTML = '';
        profiles.forEach(profile => {
            const streakIcon = parseInt(profile.Серия_дней) > 0 ? '🔥' : '⏳';
            
            statsHTML += `
                <div class="stat-card">
                    <div class="stat-header">
                        <h3>${profile.Имя}</h3>
                        <span class="streak">${streakIcon} ${profile.Серия_дней} дн.</span>
                    </div>
                    <div class="stat-details">
                        <p><i class="fas fa-bullseye"></i> Сегодня: ${profile.Цель_сегодня} сек.</p>
                        <p><i class="fas fa-calendar-alt"></i> Всего дней: ${profile.Всего_дней}</p>
                    </div>
                </div>
            `;
        });
        
        statsContainer.innerHTML = statsHTML;
        
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
        document.getElementById('statsContainer').innerHTML = 
            '<p class="error">Не удалось загрузить статистику</p>';
    }
}

// Загружаем статистику при загрузке страницы
document.addEventListener('DOMContentLoaded', loadStats);