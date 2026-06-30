function getCurrentUserRole() {
    var user = Auth.currentUser();
    if (!user) return 'User';
    if (user.role === 'admin') return 'Admin';
    if (user.role === 'member') return 'Member';
    return 'User';
}

function applyLeaderboardLockOverlay() {
    if (window.Dashboard && typeof Dashboard.updateLeaderboardLockState === 'function') {
        Dashboard.updateLeaderboardLockState();
    }
}

function startLiveLeaderboardScheduler() {
    if (!CONFIG.useFirebase) return;

    if (window.leaderboardTimerInterval) {
        clearInterval(window.leaderboardTimerInterval);
    }

    window.leaderboardTimerInterval = setInterval(function () {
        var now = new Date();
        var schedule = (Store._data && Store._data.settings && Store._data.settings.leaderboard) || {};

        var openDateTimeStr = schedule.openDate && schedule.openHour !== undefined
            ? schedule.openDate + 'T' + String(schedule.openHour).padStart(2, '0') + ':' + String(schedule.openMinute).padStart(2, '0') + ':' + String(schedule.openSecond).padStart(2, '0')
            : null;
        var closeDateTimeStr = schedule.closeDate && schedule.closeHour !== undefined
            ? schedule.closeDate + 'T' + String(schedule.closeHour).padStart(2, '0') + ':' + String(schedule.closeMinute).padStart(2, '0') + ':' + String(schedule.closeSecond).padStart(2, '0')
            : null;

        var openDateTime = openDateTimeStr ? new Date(openDateTimeStr) : null;
        var closeDateTime = closeDateTimeStr ? new Date(closeDateTimeStr) : null;

        var leaderboardContainer = document.querySelector('.leaderboard-page-container');
        var statusLabel = document.querySelector('.status-text-container');
        var currentRole = getCurrentUserRole();

        var isInsideOpenWindow = openDateTime && closeDateTime && (now >= openDateTime && now <= closeDateTime);

        if (schedule.forceOverride === 'open') isInsideOpenWindow = true;
        if (schedule.forceOverride === 'closed') isInsideOpenWindow = false;

        if (currentRole === 'Admin' || isInsideOpenWindow || schedule.manualStatus === 'open') {
            if (leaderboardContainer) {
                leaderboardContainer.classList.remove('view-locked');
                var overlay = document.querySelector('.leaderboard-lock-overlay');
                if (overlay) overlay.remove();
            }
            if (statusLabel && isInsideOpenWindow) {
                statusLabel.innerHTML = '🟢 المتصدرين ظاهر الآن للمستخدمين';
            }
        } else if (currentRole === 'User') {
            applyLeaderboardLockOverlay();
            if (statusLabel) {
                statusLabel.innerHTML = '🔴 المتصدرين مخفي عن المستخدمين';
            }
        }
    }, 1000);
}
