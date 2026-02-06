// google-sheets.js (полная версия)
const SPREADSHEET_ID = 'ТВОЙ_ID_ТАБЛИЦЫ'; // Из URL таблицы
const API_KEY = 'ТВОЙ_API_КЛЮЧ'; // Получи на https://console.cloud.google.com

// Apps Script URL (для записи данных)
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/ТВОЙ_APPS_SCRIPT_ID/exec';

class GoogleSheetsAPI {
    constructor() {
        this.baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;
    }

    // Чтение данных
    async readSheet(sheetName, range = 'A:Z') {
        try {
            const response = await fetch(
                `${this.baseUrl}/values/${sheetName}!${range}?key=${API_KEY}`
            );
            
            if (!response.ok) {
                throw new Error(`Ошибка HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            return data.values || [];
        } catch (error) {
            console.error('Ошибка чтения таблицы:', error);
            
            // Fallback на localStorage
            const fallbackData = this.getFromLocalStorage(sheetName);
            if (fallbackData) {
                console.log('Используем локальные данные для', sheetName);
                return fallbackData;
            }
            
            return [];
        }
    }

    // Запись данных через Apps Script
    async writeData(sheetName, rowData) {
        try {
            const response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors', // Важно для Google Apps Script
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'append',
                    sheet: sheetName,
                    data: rowData
                })
            });
            
            // Сохраняем локально для синхронизации позже
            this.saveToLocalStorage(sheetName, rowData);
            
            return { success: true };
        } catch (error) {
            console.error('Ошибка записи. Сохраняем локально:', error);
            
            // Сохраняем в localStorage для синхронизации позже
            this.saveToLocalStorage(sheetName, rowData);
            
            return { success: false, local: true };
        }
    }

    // Обновление данных
    async updateProfile(userId, updates) {
        try {
            // Сначала читаем все профили
            const profilesData = await this.readSheet('Профили');
            const profiles = this.sheetToObjects(profilesData);
            
            // Находим индекс пользователя
            const profileIndex = profiles.findIndex(p => p.ID === userId);
            
            if (profileIndex === -1) {
                throw new Error('Профиль не найден');
            }
            
            // Обновляем данные
            const updatedRow = this.createProfileRow(profiles[profileIndex], updates);
            
            // Отправляем обновление
            return await this.writeData('Профили', updatedRow, profileIndex + 2); // +2 т.к. шапка и 0-based индекс
        } catch (error) {
            console.error('Ошибка обновления профиля:', error);
            return { success: false };
        }
    }

    // Вспомогательные методы
    sheetToObjects(sheetData) {
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

    getTodayDate() {
        return new Date().toISOString().split('T')[0];
    }

    // Локальное хранение для оффлайн-режима
    saveToLocalStorage(sheetName, data) {
        const key = `pending_sync_${sheetName}`;
        const pending = JSON.parse(localStorage.getItem(key) || '[]');
        pending.push({
            data,
            timestamp: new Date().toISOString(),
            sheet: sheetName
        });
        localStorage.setItem(key, JSON.stringify(pending));
        
        // Сохраняем в общую очередь синхронизации
        this.addToSyncQueue(sheetName, data);
    }

    getFromLocalStorage(sheetName) {
        const key = `cache_${sheetName}`;
        const cached = localStorage.getItem(key);
        return cached ? JSON.parse(cached) : null;
    }

    addToSyncQueue(sheetName, data) {
        const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
        queue.push({
            type: 'write',
            sheet: sheetName,
            data: data,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('sync_queue', JSON.stringify(queue));
    }

    // Автоматическая синхронизация при восстановлении соединения
    async syncPendingData() {
        const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
        
        if (queue.length === 0) return;
        
        console.log('Начинаем синхронизацию...', queue.length, 'записей в очереди');
        
        for (const item of queue) {
            try {
                await this.writeData(item.sheet, item.data);
                
                // Удаляем успешно синхронизированную запись
                const newQueue = queue.filter(q => q.timestamp !== item.timestamp);
                localStorage.setItem('sync_queue', JSON.stringify(newQueue));
                
                console.log('Синхронизировано:', item);
            } catch (error) {
                console.error('Ошибка синхронизации:', error);
            }
        }
    }

    createProfileRow(profile, updates) {
        // Формируем строку для записи в таблицу
        return [
            profile.ID || updates.ID,
            profile.Имя || updates.Имя,
            updates.Цель_сегодня || profile.Цель_сегодня,
            updates.Серия_дней || profile.Серия_дней,
            updates.Всего_дней || profile.Всего_дней,
            profile.Дата_начала || new Date().toISOString().split('T')[0],
            new Date().toISOString()
        ];
    }
}

// Создаем глобальный экземпляр
window.GoogleSheets = new GoogleSheetsAPI();

// Периодическая синхронизация
setInterval(() => {
    if (navigator.onLine) {
        GoogleSheets.syncPendingData();
    }
}, 30000); // Каждые 30 секунд

// Синхронизация при восстановлении соединения
window.addEventListener('online', () => {
    console.log('Соединение восстановлено, запускаем синхронизацию');
    GoogleSheets.syncPendingData();
});