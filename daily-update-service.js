// daily-update-service.js
class DailyUpdateService {
    constructor() {
        this.today = new Date().toISOString().split('T')[0];
        this.lastProcessed = localStorage.getItem('last_processed_day');
    }
    
    async checkAndUpdate() {
        // Если сегодняшний день уже обработан - выходим
        if (this.lastProcessed === this.today) {
            console.log('Сегодняшний день уже обновлен');
            return;
        }
        
        const yesterday = this.getYesterdayDate();
        console.log('Проверяем обновления за', yesterday);
        
        // 1. Получаем все сессии за вчера
        const sessionsData = await GoogleSheets.readSheet('Сессии');
        const sessions = GoogleSheets.sheetToObjects(sessionsData);
        
        const yesterdaySessions = sessions.filter(s => s.Дата === yesterday);
        
        // 2. Группируем по пользователям
        const userStats = {};
        yesterdaySessions.forEach(session => {
            const userId = session.ID_профиля;
            if (!userStats[userId]) {
                userStats[userId] = {
                    sessions: [],
                    maxCount: 0
                };
            }
            userStats[userId].sessions.push(session);
            userStats[userId].maxCount = Math.max(
                userStats[userId].maxCount, 
                parseInt(session.Кол_сессий) || 0
            );
        });
        
        // 3. Обновляем профили
        const profilesData = await GoogleSheets.readSheet('Профили');
        const profiles = GoogleSheets.sheetToObjects(profilesData);
        
        for (const profile of profiles) {
            const userId = profile.ID;
            const stats = userStats[userId];
            
            if (stats) {
                if (stats.maxCount >= 2) {
                    // Увеличиваем цель
                    const newGoal = parseInt(profile.Цель_сегодня) + 5;
                    const newStreak = parseInt(profile.Серия_дней) + 1;
                    const newTotalDays = parseInt(profile.Всего_дней) + 1;
                    
                    // Обновляем строку
                    const updatedRow = [
                        profile.ID,
                        profile.Имя,
                        newGoal.toString(),
                        newStreak.toString(),
                        newTotalDays.toString(),
                        profile.Дата_начала,
                        new Date().toISOString()
                    ];
                    
                    await GoogleSheets.writeData('Профили', updatedRow);
                    console.log(`Обновлен профиль ${profile.Имя}: +5 секунд`);
                } else {
                    // Сбрасываем серию
                    const updatedRow = [
                        profile.ID,
                        profile.Имя,
                        profile.Цель_сегодня,
                        '0', // Сбрасываем серию
                        profile.Всего_дней,
                        profile.Дата_начала,
                        new Date().toISOString()
                    ];
                    
                    await GoogleSheets.writeData('Профили', updatedRow);
                    console.log(`Сброшена серия для ${profile.Имя}`);
                }
            }
        }
        
        // 4. Помечаем день как обработанный
        localStorage.setItem('last_processed_day', this.today);
        console.log('Ежедневное обновление завершено');
    }
    
    getYesterdayDate() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
    }
    
    // Запускаем проверку при загрузке страницы
    async init() {
        // Проверяем раз в час
        setInterval(() => this.checkAndUpdate(), 60 * 60 * 1000);
        
        // И сразу при запуске
        await this.checkAndUpdate();
    }
}

// Инициализируем при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    const dailyService = new DailyUpdateService();
    dailyService.init();
});