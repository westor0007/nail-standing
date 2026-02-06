// daily-update.js - Система автоматического обновления

// Главная функция, которую нужно вызвать при загрузке страницы
function initDailySystem() {
    console.log('⏰ Инициализация системы ежедневного обновления');
    
    // 1. Проверяем текущую дату
    const today = getTodayDate();
    const lastUpdate = localStorage.getItem('system_last_update_date');
    
    // 2. Если дата изменилась - обновляем все
    if (lastUpdate !== today) {
        console.log('🔄 Обнаружен новый день!');
        processNewDay();
        localStorage.setItem('system_last_update_date', today);
    }
}

// Обработка нового дня
function processNewDay() {
    // Обновляем цели для всех пользователей
    updateAllGoals();
    
    // Очищаем сессии предыдущего дня (опционально)
    clearOldSessions();
    
    // Сохраняем историю
    saveDailyHistory();
}

// Обновление целей
function updateAllGoals() {
    const users = [
        { id: '1', name: 'Илья' },
        { id: '2', name: 'Полина' },
        { id: '3', name: 'Лиза' }
    ];
    
    const yesterday = getYesterdayDate();
    
    users.forEach(user => {
        // Проверяем сессии за вчера
        const sessionsKey = `sessions_${user.id}_${yesterday}`;
        const sessionsData = localStorage.getItem(sessionsKey);
        
        if (sessionsData) {
            try {
                const sessions = JSON.parse(sessionsData);
                
                if (sessions.count >= 2) {
                    // Увеличиваем цель
                    increaseUserGoal(user.id);
                    console.log(`✅ ${user.name}: цель увеличена (+5 сек)`);
                } else {
                    // Сбрасываем серию
                    resetUserStreak(user.id);
                    console.log(`⚠️ ${user.name}: серия сброшена`);
                }
            } catch (e) {
                console.error(`Ошибка обработки ${user.name}:`, e);
            }
        } else {
            console.log(`➖ ${user.name}: не было сессий вчера`);
        }
    });
}

// Увеличить цель пользователя
function increaseUserGoal(userId) {
    const profileKey = `profile_${userId}`;
    const profile = JSON.parse(localStorage.getItem(profileKey) || '{}');
    
    profile.goal = (profile.goal || 40) + 5;
    profile.streak = (profile.streak || 0) + 1;
    profile.totalDays = (profile.totalDays || 0) + 1;
    profile.lastUpdated = new Date().toISOString();
    
    localStorage.setItem(profileKey, JSON.stringify(profile));
}

// Сбросить серию
function resetUserStreak(userId) {
    const profileKey = `profile_${userId}`;
    const profile = JSON.parse(localStorage.getItem(profileKey) || '{}');
    
    profile.streak = 0;
    profile.lastUpdated = new Date().toISOString();
    
    localStorage.setItem(profileKey, JSON.stringify(profile));
}

// Очистка старых сессий (храним только последние 7 дней)
function clearOldSessions() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thresholdDate = sevenDaysAgo.toISOString().split('T')[0];
    
    // Находим все ключи сессий
    const allKeys = Object.keys(localStorage);
    
    allKeys.forEach(key => {
        if (key.startsWith('sessions_')) {
            const date = key.split('_')[2]; // Извлекаем дату из ключа
            if (date && date < thresholdDate) {
                localStorage.removeItem(key);
                console.log(`🧹 Удалены старые сессии за ${date}`);
            }
        }
    });
}

// Сохраняем историю дня
function saveDailyHistory() {
    const yesterday = getYesterdayDate();
    const historyKey = `history_${yesterday}`;
    
    const users = ['1', '2', '3'];
    const dailyHistory = {
        date: yesterday,
        users: {}
    };
    
    users.forEach(userId => {
        const sessionsKey = `sessions_${userId}_${yesterday}`;
        const sessionsData = localStorage.getItem(sessionsKey);
        
        dailyHistory.users[userId] = {
            sessions: sessionsData ? JSON.parse(sessionsData).count : 0,
            goal: (JSON.parse(localStorage.getItem(`profile_${userId}`) || '{}')).goal || 40
        };
    });
    
    localStorage.setItem(historyKey, JSON.stringify(dailyHistory));
    console.log('📊 История дня сохранена');
}

// Вспомогательные функции
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

function getYesterdayDate() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
}

// Экспортируем главную функцию
window.initDailySystem = initDailySystem;