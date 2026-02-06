[file content begin]
let currentUserId = null;
let currentProfile = null;
let stopwatchInterval = null;
let stopwatchTime = 0;
let stopwatchRunning = false;

// Получаем ID пользователя из URL
function getUserIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('user');
}

// Загрузка данных профиля
async function loadProfileData() {
    try {
        currentUserId = getUserIdFromUrl();
        
        if (!currentUserId) {
            window.location.href = 'index.html';
            return;
        }

        // Загружаем все профили
        const sheetData = await GoogleSheets.readSheet('Профили');
        const profiles = GoogleSheets.sheetToObjects(sheetData);
        
        // Находим текущий профиль
        currentProfile = profiles.find(p => p.ID === currentUserId);
        
        if (!currentProfile) {
            alert('Профиль не найден!');
            window.location.href = 'index.html';
            return;
        }
        
        // Проверяем корректность данных - ВСЕ должны начинать с 50
        const initialGoal = 50;
        if (parseInt(currentProfile.Цель_сегодня) !== initialGoal) {
            console.log(`⚠️ Исправляем цель для ${currentProfile.Имя} с ${currentProfile.Цель_сегодня} на ${initialGoal}`);
            currentProfile.Цель_сегодня = initialGoal.toString();
        }
        
        // Обновляем данные на странице
        document.getElementById('userGreeting').textContent = `Привет, ${currentProfile.Имя}!`;
        document.getElementById('dailyGoal').textContent = currentProfile.Цель_сегодня;
        document.getElementById('tomorrowGoal').textContent = parseInt(currentProfile.Цель_сегодня) + 5;
        document.getElementById('streakDays').textContent = currentProfile.Серия_дней;
        document.getElementById('totalDays').textContent = currentProfile.Всего_дней;
        
        // Устанавливаем текущую дату
        const today = new Date();
        document.getElementById('currentDate').textContent = today.toLocaleDateString('ru-RU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        // Загружаем сессии за сегодня
        await loadTodaySessions();
        
        // Обновляем время последнего обновления
        document.getElementById('lastUpdate').textContent = 'только что';
        
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        alert('Не удалось загрузить данные профиля');
    }
}

// Загрузка сессий за сегодня
async function loadTodaySessions() {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // Загружаем все сессии
        const sheetData = await GoogleSheets.readSheet('Сессии');
        const sessions = GoogleSheets.sheetToObjects(sheetData);
        
        // Находим сессии за сегодня для текущего пользователя
        const todaySessions = sessions.filter(s => 
            s.ID_профиля === currentUserId && s.Дата === today
        );
        
        let sessionCount = 0;
        
        if (todaySessions.length > 0) {
            // Берем последнюю сессию
            const lastSession = todaySessions[todaySessions.length - 1];
            sessionCount = parseInt(lastSession.Кол_сессий) || 0;
        }
        
        // Обновляем отображение сессий
        updateSessionDisplay(sessionCount);
        
        return sessionCount;
        
    } catch (error) {
        console.error('Ошибка загрузки сессий:', error);
        updateSessionDisplay(0);
        return 0;
    }
}

// Отметка сессии (СИМУЛЯЦИЯ - без записи в таблицу)
async function markSession() {
    try {
        const sessionCount = await loadTodaySessions();
        
        if (sessionCount >= 2) {
            alert('Вы уже отметили 2 сессии сегодня!');
            return;
        }
        
        const newSessionCount = sessionCount + 1;
        
        // Показываем подтверждение
        if (confirm(`Отметить ${newSessionCount}-ю сессию?\n\nПосле отметки второй сессии сегодня, завтра цель увеличится на 5 секунд.`)) {
            
            // ВТОРАЯ СЕССИЯ - НЕ УВЕЛИЧИВАЕМ СЕГОДНЯШНЮЮ ЦЕЛЬ!
            // Увеличиваем ЗАВТРАШНЮЮ цель
            if (newSessionCount === 2) {
                const tomorrowGoal = parseInt(currentProfile.Цель_сегодня) + 5;
                const newStreak = parseInt(currentProfile.Серия_дней) + 1;
                const newTotalDays = parseInt(currentProfile.Всего_дней) + 1;
                
                // Обновляем отображение ЗАВТРАШНЕЙ цели
                document.getElementById('tomorrowGoal').textContent = tomorrowGoal;
                document.getElementById('streakDays').textContent = newStreak;
                document.getElementById('totalDays').textContent = newTotalDays;
                
                // Обновляем "локальный профиль"
                currentProfile.Серия_дней = newStreak.toString();
                currentProfile.Всего_дней = newTotalDays.toString();
                
                alert('🎉 Вы выполнили 2 сессии сегодня!\n📈 Завтрашняя цель увеличена на 5 секунд!');
            } else {
                alert(`✅ Сессия ${newSessionCount}/2 отмечена!\n👉 Выполните вторую сессию для увеличения завтрашней цели.`);
            }
            
            // Обновляем счетчик сессий
            updateSessionDisplay(newSessionCount);
            
            // Сохраняем в localStorage
            saveToLocalStorage(newSessionCount);
        }
        
    } catch (error) {
        console.error('Ошибка при отметке сессии:', error);
        alert('Произошла ошибка при отметке сессии');
    }
}

// Отмена сессии
async function undoSession() {
    try {
        const sessionCount = await loadTodaySessions();
        
        if (sessionCount <= 0) {
            alert('Нет сессий для отмены');
            return;
        }
        
        if (confirm('Отменить последнюю сессию?\n\nЕсли это была вторая сессия, завтрашняя цель не увеличится.')) {
            
            const newSessionCount = sessionCount - 1;
            
            // Если отменяем вторую сессию - уменьшаем ЗАВТРАШНЮЮ цель
            if (sessionCount === 2) {
                const tomorrowGoal = parseInt(currentProfile.Цель_сегодня); // Остается сегодняшняя цель
                const newStreak = Math.max(0, parseInt(currentProfile.Серия_дней) - 1);
                
                document.getElementById('tomorrowGoal').textContent = tomorrowGoal + 5;
                document.getElementById('streakDays').textContent = newStreak;
                
                currentProfile.Серия_дней = newStreak.toString();
            }
            
            updateSessionDisplay(newSessionCount);
            
            // Сохраняем в localStorage
            saveToLocalStorage(newSessionCount);
            
            alert('↩️ Последняя сессия отменена');
        }
        
    } catch (error) {
        console.error('Ошибка при отмене сессии:', error);
        alert('Произошла ошибка при отмене сессии');
    }
}

// Обновление отображения сессий
function updateSessionDisplay(count) {
    document.getElementById('sessionsToday').textContent = count;
    
    const bubble1 = document.getElementById('bubble1');
    const bubble2 = document.getElementById('bubble2');
    
    bubble1.classList.toggle('active', count >= 1);
    bubble2.classList.toggle('active', count >= 2);
    
    const markBtn = document.getElementById('markSessionBtn');
    markBtn.disabled = count >= 2;
    markBtn.innerHTML = count >= 2 
        ? '<i class="fas fa-check-double"></i> Лимит достигнут' 
        : `<i class="fas fa-check"></i> Отметить сессию (${count + 1}/2)`;
        
    document.getElementById('undoSessionBtn').disabled = count === 0;
}

// Сохранение данных в localStorage (для синхронизации между вкладками)
function saveToLocalStorage(sessionCount) {
    const userData = {
        profile: currentProfile,
        lastUpdated: new Date().toISOString(),
        sessions: {
            date: new Date().toISOString().split('T')[0],
            count: sessionCount
        }
    };
    
    localStorage.setItem(`user_${currentUserId}`, JSON.stringify(userData));
    
    // Обновляем время последнего обновления
    const now = new Date();
    document.getElementById('lastUpdate').textContent = now.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Проверка данных из localStorage при загрузке
function checkLocalStorage() {
    const storedData = localStorage.getItem(`user_${currentUserId}`);
    
    if (storedData) {
        try {
            const data = JSON.parse(storedData);
            const today = new Date().toISOString().split('T')[0];
            
            // Если данные за сегодня - обновляем счетчик сессий
            if (data.sessions && data.sessions.date === today) {
                updateSessionDisplay(data.sessions.count);
            }
            
            // Если профиль обновлялся недавно - обновляем данные
            const lastUpdated = new Date(data.lastUpdated);
            const now = new Date();
            const diffHours = (now - lastUpdated) / (1000 * 60 * 60);
            
            // Обновляем только серии и общие дни
            if (diffHours < 24) {
                document.getElementById('streakDays').textContent = data.profile.Серия_дней;
                document.getElementById('totalDays').textContent = data.profile.Всего_дней;
                
                // Цель сегодня всегда берется из Google Sheets
                // Завтрашняя цель = сегодняшняя + 5
                const tomorrowGoal = parseInt(currentProfile.Цель_сегодня) + 5;
                document.getElementById('tomorrowGoal').textContent = tomorrowGoal;
            }
        } catch (e) {
            console.error('Ошибка при чтении localStorage:', e);
        }
    }
}

// Кнопка принудительного сброса цели к 50
function resetGoalTo50() {
    if (confirm('Сбросить цель к 50 секундам?\n\nЭто исправит проблему если у кого-то цель не 50.')) {
        // Обновляем отображение
        document.getElementById('dailyGoal').textContent = '50';
        document.getElementById('tomorrowGoal').textContent = '55';
        
        // Обновляем локальный профиль
        currentProfile.Цель_сегодня = '50';
        
        // Сохраняем в localStorage
        saveToLocalStorage(parseInt(document.getElementById('sessionsToday').textContent));
        
        alert('✅ Цель сброшена к 50 секундам!');
    }
}

// Секундомер
function startStopwatch() {
    if (!stopwatchRunning) {
        stopwatchRunning = true;
        document.getElementById('startBtn').disabled = true;
        document.getElementById('pauseBtn').disabled = false;
        
        stopwatchInterval = setInterval(() => {
            stopwatchTime++;
            updateStopwatchDisplay();
        }, 1000);
    }
}

function pauseStopwatch() {
    if (stopwatchRunning) {
        stopwatchRunning = false;
        clearInterval(stopwatchInterval);
        document.getElementById('startBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
    }
}

function resetStopwatch() {
    pauseStopwatch();
    stopwatchTime = 0;
    updateStopwatchDisplay();
}

function updateStopwatchDisplay() {
    const minutes = Math.floor(stopwatchTime / 60);
    const seconds = stopwatchTime % 60;
    document.getElementById('stopwatch').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function saveStopwatchTime() {
    if (stopwatchTime === 0) {
        alert('Секундомер показывает 0 секунд. Запустите его сначала.');
        return;
    }
    
    if (confirm(`Сохранить результат ${stopwatchTime} секунд?`)) {
        // Сохраняем в localStorage
        const recordKey = `record_${currentUserId}`;
        
        localStorage.setItem(recordKey, stopwatchTime.toString());
        
        // Обновляем отображение рекорда
        document.getElementById('recordTime').textContent = `${stopwatchTime} сек`;
        
        // Сбрасываем секундомер
        resetStopwatch();
        
        alert(`🏆 Рекорд ${stopwatchTime} секунд сохранен!`);
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    await loadProfileData();
    checkLocalStorage();
    
    // Добавляем обработчики кнопок
    document.getElementById('markSessionBtn').addEventListener('click', markSession);
    document.getElementById('undoSessionBtn').addEventListener('click', undoSession);
    document.getElementById('startBtn').addEventListener('click', startStopwatch);
    document.getElementById('pauseBtn').addEventListener('click', pauseStopwatch);
    document.getElementById('resetBtn').addEventListener('click', resetStopwatch);
    document.getElementById('saveBtn').addEventListener('click', saveStopwatchTime);
    document.getElementById('refreshBtn').addEventListener('click', async () => {
        await loadProfileData();
        checkLocalStorage();
        alert('Данные обновлены!');
    });
    
    // Добавляем скрытую кнопку для сброса цели (для отладки)
    const resetBtn = document.createElement('button');
    resetBtn.innerHTML = '<i class="fas fa-redo"></i> Сбросить цель к 50';
    resetBtn.style = 'position: fixed; bottom: 10px; right: 10px; background: #e74c3c; color: white; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer; z-index: 1000;';
    resetBtn.onclick = resetGoalTo50;
    document.body.appendChild(resetBtn);
    
    // Отключаем кнопку паузы по умолчанию
    document.getElementById('pauseBtn').disabled = true;
});
[file content end]