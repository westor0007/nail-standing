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

        // Загружаем все профили из Google Sheets
        const sheetData = await GoogleSheets.readSheet('Профили');
        const profiles = GoogleSheets.sheetToObjects(sheetData);
        
        // Находим текущий профиль
        currentProfile = profiles.find(p => p.ID === currentUserId);
        
        if (!currentProfile) {
            alert('Профиль не найден!');
            window.location.href = 'index.html';
            return;
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
        
        // Загружаем сессии за сегодня ИЗ GOOGLE SHEETS
        await loadTodaySessions();
        
        // Загружаем статистику команды ИЗ GOOGLE SHEETS
        await loadTeamStats();
        
        // Обновляем время последнего обновления
        document.getElementById('lastUpdate').textContent = 'только что';
        
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        alert('Не удалось загрузить данные профиля');
    }
}

// Загрузка сессий за сегодня ИЗ GOOGLE SHEETS
async function loadTodaySessions() {
    try {
        const today = GoogleSheets.getTodayDate();
        
        // Загружаем все сессии из Google Sheets
        const sheetData = await GoogleSheets.readSheet('Сессии');
        const allSessions = GoogleSheets.sheetToObjects(sheetData);
        
        // Находим сессии за сегодня для текущего пользователя
        const todaySessions = allSessions.filter(s => 
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

// ОТМЕТКА СЕССИИ - ЗАПИСЬ В GOOGLE SHEETS
async function markSession() {
    try {
        const sessionCount = await loadTodaySessions();
        
        if (sessionCount >= 2) {
            alert('Вы уже отметили 2 сессии сегодня!');
            return;
        }
        
        const newSessionCount = sessionCount + 1;
        
        if (confirm(`Отметить ${newSessionCount}-ю сессию?\n\nПосле отметки второй сессии сегодня, завтра цель увеличится на 5 секунд.`)) {
            
            const today = GoogleSheets.getTodayDate();
            
            // ПОДГОТОВКА ДАННЫХ ДЛЯ ЗАПИСИ В GOOGLE SHEETS
            const sessionData = [
                currentUserId,           // ID_профиля
                today,                   // Дата
                newSessionCount,         // Кол_сессий
                stopwatchTime || '0',    // Время_сессии
                'Стандартная',           // Тип_тренировки
                `Сессия ${newSessionCount}`, // Комментарий
                new Date().toISOString() // Таймстемп
            ];
            
            // ЗАПИСЬ В GOOGLE SHEETS (через симуляцию пока что)
            await simulateWriteToGoogleSheets('Сессии', sessionData);
            
            // Если это вторая сессия - обновляем профиль для ЗАВТРА
            if (newSessionCount === 2) {
                // Завтрашняя цель = сегодняшняя + 5
                const tomorrowGoal = parseInt(currentProfile.Цель_сегодня) + 5;
                const newStreak = parseInt(currentProfile.Серия_дней) + 1;
                const newTotalDays = parseInt(currentProfile.Всего_дней) + 1;
                
                // Обновляем отображение
                document.getElementById('tomorrowGoal').textContent = tomorrowGoal;
                document.getElementById('streakDays').textContent = newStreak;
                document.getElementById('totalDays').textContent = newTotalDays;
                
                // Записываем обновленный профиль
                const updatedProfileData = [
                    currentUserId,
                    currentProfile.Имя,
                    currentProfile.Цель_сегодня, // СЕГОДНЯШНЯЯ цель не меняется
                    newStreak.toString(),
                    newTotalDays.toString(),
                    new Date().toISOString(),
                    currentProfile.Дата_начала || today
                ];
                
                await simulateUpdateProfileInGoogleSheets(currentUserId, updatedProfileData);
                
                alert('🎉 Вы выполнили 2 сессии сегодня!\n📈 Завтрашняя цель увеличена на 5 секунд!');
            } else {
                alert(`✅ Сессия ${newSessionCount}/2 отмечена!\n👉 Выполните вторую сессию для увеличения завтрашней цели.`);
            }
            
            // Обновляем отображение
            await loadTodaySessions();
            await loadTeamStats();
            
            updateLastUpdateTime();
        }
        
    } catch (error) {
        console.error('Ошибка при отметке сессии:', error);
        alert('Произошла ошибка при отметке сессии');
    }
}

// СИМУЛЯЦИЯ записи в Google Sheets (пока не настроен Apps Script)
async function simulateWriteToGoogleSheets(sheetName, data) {
    console.log('Симуляция записи в Google Sheets:', { sheetName, data });
    
    // Сохраняем в localStorage, но с меткой для всех устройств
    const storageKey = `sync_${sheetName}_${currentUserId}_${GoogleSheets.getTodayDate()}`;
    const storedData = {
        data,
        timestamp: new Date().toISOString(),
        synced: false // Помечаем как не синхронизированное
    };
    
    localStorage.setItem(storageKey, JSON.stringify(storedData));
    
    // Также сохраняем в общую историю для синхронизации
    const syncHistory = JSON.parse(localStorage.getItem('sync_history') || '[]');
    syncHistory.push({
        sheet: sheetName,
        data: data,
        userId: currentUserId,
        date: GoogleSheets.getTodayDate(),
        timestamp: new Date().toISOString()
    });
    localStorage.setItem('sync_history', JSON.stringify(syncHistory));
    
    return { success: true };
}

// СИМУЛЯЦИЯ обновления профиля в Google Sheets
async function simulateUpdateProfileInGoogleSheets(userId, profileData) {
    console.log('Симуляция обновления профиля:', { userId, profileData });
    
    // Сохраняем профиль в localStorage
    localStorage.setItem(`profile_${userId}`, JSON.stringify({
        ID: profileData[0],
        Имя: profileData[1],
        Цель_сегодня: profileData[2],
        Серия_дней: profileData[3],
        Всего_дней: profileData[4],
        Последнее_обновление: profileData[5],
        Дата_начала: profileData[6],
        lastSynced: new Date().toISOString()
    }));
    
    return { success: true };
}

// Загрузка статистики команды ИЗ GOOGLE SHEETS
async function loadTeamStats() {
    try {
        const today = GoogleSheets.getTodayDate();
        
        // Загружаем все профили
        const profilesData = await GoogleSheets.readSheet('Профили');
        const allProfiles = GoogleSheets.sheetToObjects(profilesData);
        
        // Загружаем все сессии за сегодня
        const sessionsData = await GoogleSheets.readSheet('Сессии');
        const allSessions = GoogleSheets.sheetToObjects(sessionsData);
        
        const teamStatsContainer = document.getElementById('teamStats');
        if (!teamStatsContainer) return;
        
        let teamStatsHTML = '';
        
        // Для каждого пользователя
        allProfiles.forEach(profile => {
            const userId = profile.ID;
            
            // Находим сессии за сегодня для этого пользователя
            const todaySessions = allSessions.filter(s => 
                s.ID_профиля === userId && s.Дата === today
            );
            
            let sessionCount = 0;
            if (todaySessions.length > 0) {
                const lastSession = todaySessions[todaySessions.length - 1];
                sessionCount = parseInt(lastSession.Кол_сессий) || 0;
            }
            
            // Определяем цвет для аватара
            const userColors = {
                '1': '#3498db', // Илья
                '2': '#2ecc71', // Полина
                '3': '#e74c3c'  // Лиза
            };
            
            const isCurrentUser = userId === currentUserId;
            
            teamStatsHTML += `
                <div class="team-member-card ${isCurrentUser ? 'current-user' : ''}">
                    <div class="member-avatar" style="background: ${userColors[userId] || '#667eea'};">
                        ${profile.Имя.charAt(0)}
                    </div>
                    <div class="member-name">${profile.Имя}</div>
                    <div class="member-stats">
                        <div>Цель: ${profile.Цель_сегодня} сек</div>
                        <div>Серия: ${profile.Серия_дней} дн.</div>
                        <div>Всего дней: ${profile.Всего_дней}</div>
                    </div>
                    <div class="member-sessions">
                        <div>
                            <span class="session-indicator ${sessionCount >= 1 ? 'active' : 'inactive'}" title="Сессия 1"></span>
                            <span class="session-indicator ${sessionCount >= 2 ? 'active' : 'inactive'}" title="Сессия 2"></span>
                        </div>
                        <div class="today-label">
                            ${sessionCount === 0 ? 'Не начинал(а)' : 
                              sessionCount === 1 ? '1 сессия' : 
                              '2 сессии ✅'}
                        </div>
                    </div>
                </div>
            `;
        });
        
        teamStatsContainer.innerHTML = teamStatsHTML;
        
    } catch (error) {
        console.error('Ошибка загрузки статистики команды:', error);
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
            
            // Обновляем данные в "Google Sheets"
            const today = GoogleSheets.getTodayDate();
            const sessionData = [
                currentUserId,
                today,
                newSessionCount,
                '0',
                'Отмена сессии',
                `Отмена сессии ${sessionCount}`,
                new Date().toISOString()
            ];
            
            await simulateWriteToGoogleSheets('Сессии', sessionData);
            
            // Если отменяем вторую сессию
            if (sessionCount === 2) {
                const newStreak = Math.max(0, parseInt(currentProfile.Серия_дней) - 1);
                document.getElementById('streakDays').textContent = newStreak;
                
                // Обновляем профиль
                const updatedProfileData = [
                    currentUserId,
                    currentProfile.Имя,
                    currentProfile.Цель_сегодня,
                    newStreak.toString(),
                    currentProfile.Всего_дней,
                    new Date().toISOString(),
                    currentProfile.Дата_начала
                ];
                
                await simulateUpdateProfileInGoogleSheets(currentUserId, updatedProfileData);
            }
            
            // Обновляем отображение
            await loadTodaySessions();
            await loadTeamStats();
            
            alert('↩️ Последняя сессия отменена');
            updateLastUpdateTime();
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
    
    if (bubble1) bubble1.classList.toggle('active', count >= 1);
    if (bubble2) bubble2.classList.toggle('active', count >= 2);
    
    if (bubble1) bubble1.textContent = count >= 1 ? '✓' : '1';
    if (bubble2) bubble2.textContent = count >= 2 ? '✓' : '2';
    
    const markBtn = document.getElementById('markSessionBtn');
    if (markBtn) {
        markBtn.disabled = count >= 2;
        markBtn.innerHTML = count >= 2 
            ? '<i class="fas fa-check-double"></i> Лимит достигнут' 
            : `<i class="fas fa-check"></i> Отметить сессию (${count + 1}/2)`;
    }
        
    const undoBtn = document.getElementById('undoSessionBtn');
    if (undoBtn) {
        undoBtn.disabled = count === 0;
    }
}

// Обновление времени последнего обновления
function updateLastUpdateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    document.getElementById('lastUpdate').textContent = timeString;
}

// Секундомер (остается без изменений)
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
        localStorage.setItem(`record_${currentUserId}`, stopwatchTime.toString());
        document.getElementById('recordTime').textContent = `${stopwatchTime} сек`;
        resetStopwatch();
        alert(`🏆 Рекорд ${stopwatchTime} секунд сохранен!`);
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    await loadProfileData();
    
    // Добавляем обработчики кнопок
    document.getElementById('markSessionBtn')?.addEventListener('click', markSession);
    document.getElementById('undoSessionBtn')?.addEventListener('click', undoSession);
    document.getElementById('startBtn')?.addEventListener('click', startStopwatch);
    document.getElementById('pauseBtn')?.addEventListener('click', pauseStopwatch);
    document.getElementById('resetBtn')?.addEventListener('click', resetStopwatch);
    document.getElementById('saveBtn')?.addEventListener('click', saveStopwatchTime);
    
    if (document.getElementById('refreshBtn')) {
        document.getElementById('refreshBtn').addEventListener('click', async () => {
            await loadProfileData();
            alert('Данные обновлены!');
        });
    }
    
    // Отключаем кнопку паузы по умолчанию
    document.getElementById('pauseBtn').disabled = true;
});
[file content end]