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

function handleUnlockUI(container, label, text) {
    if (container) {
        container.classList.remove('view-locked');
        var overlay = document.querySelector('.leaderboard-lock-overlay');
        if (overlay) overlay.remove();
    }
    if (label) label.innerHTML = text;
    var timerDisplay = document.querySelector('.leaderboard-countdown-display');
    if (timerDisplay && !window.leaderboardTimerInterval) timerDisplay.style.display = 'none';
}

function applyLockBasedOnRole(role, container, profile, label, isTimeExpired) {
    if (role === 'User' || profile) {
        applyLeaderboardLockOverlay();
        if (label && isTimeExpired) label.innerHTML = "🔴 المتصدرين مخفي (انتهى وقت الجدولة)";
    }
}

function startUserCountdown(closeTimeISO) {
    var timerDisplay = document.querySelector('.leaderboard-countdown-display');
    if (!timerDisplay) return;
    if (window._userCountdownInterval) clearInterval(window._userCountdownInterval);
    window._userCountdownInterval = setInterval(function () {
        var now = new Date().getTime();
        var deadline = new Date(closeTimeISO).getTime();
        var distance = deadline - now;
        if (distance < 0) {
            clearInterval(window._userCountdownInterval);
            timerDisplay.innerHTML = "🔒 تم إغلاق الفترة المحددة";
            return;
        }
        var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        var seconds = Math.floor((distance % (1000 * 60)) / 1000);
        timerDisplay.innerHTML = "⏰ يغلق الترتيب تلقائياً بعد: " + minutes + " دقيقة و " + seconds + " ثانية";
    }, 1000);
}

function startLiveLeaderboardScheduler() {
    if (!CONFIG.useFirebase || typeof firebase === 'undefined') return;
    if (window._mainSchedulerRef) {
        window._mainSchedulerRef.off('value');
    }
    window._mainSchedulerRef = firebase.database().ref('/ithopiia/settings/leaderboard');
    window._mainSchedulerRef.on('value', function (snapshot) {
        var schedule = snapshot.val();
        var leaderboardContainer = document.querySelector('.leaderboard-page-container');
        var profileLeaderboard = document.querySelector('.profile-leaderboard-section');
        var statusLabel = document.querySelector('.status-text-container');
        var currentRole = getCurrentUserRole();

        if (window.leaderboardTimerInterval) {
            clearInterval(window.leaderboardTimerInterval);
            window.leaderboardTimerInterval = null;
        }
        if (window._userCountdownInterval) {
            clearInterval(window._userCountdownInterval);
            window._userCountdownInterval = null;
        }

        // Fallback if no database configuration exists yet
        if (!schedule) {
            window.isLeaderboardOpen = false;
            window._leaderboardWritesBlocked = true;
            applyLockBasedOnRole(currentRole, leaderboardContainer, profileLeaderboard, statusLabel, false);
            return;
        }

        // 1. HIGHEST PRIORITY: Check Explicit Manual Overrides First
        if (schedule.manualStatus === "open") {
            window.isLeaderboardOpen = true;
            window._leaderboardWritesBlocked = false;
            handleUnlockUI(leaderboardContainer, statusLabel, "🟢 المتصدرين ظاهر الآن للمستخدمين (بأمر متاح)");
            return;
        }
        if (schedule.manualStatus === "closed") {
            window.isLeaderboardOpen = false;
            window._leaderboardWritesBlocked = true;
            applyLockBasedOnRole(currentRole, leaderboardContainer, profileLeaderboard, statusLabel, false);
            if (statusLabel) statusLabel.innerHTML = "🔴 المتصدرين مخفي عن المستخدمين";
            return;
        }

        // 2. SECONDARY PRIORITY: Automated Scheduler (only runs if manualStatus is "scheduled")
        if (schedule.manualStatus === "scheduled" && schedule.autoOpenDateTime && schedule.autoCloseDateTime) {
            // Evaluate immediately first
            var now = new Date();
            var openTime = new Date(schedule.autoOpenDateTime);
            var closeTime = new Date(schedule.autoCloseDateTime);
            var isInsideWindow = (now >= openTime && now <= closeTime);

            if (isInsideWindow) {
                window.isLeaderboardOpen = true;
                window._leaderboardWritesBlocked = false;
                handleUnlockUI(leaderboardContainer, statusLabel, "🟢 المتصدرين ظاهر الآن (جدولة تلقائية)");
                if (typeof startUserCountdown === "function") startUserCountdown(schedule.autoCloseDateTime);
            } else {
                window.isLeaderboardOpen = false;
                window._leaderboardWritesBlocked = true;
                applyLockBasedOnRole(currentRole, leaderboardContainer, profileLeaderboard, statusLabel, true);
            }

            // Then start 1-second interval to re-evaluate
            window.leaderboardTimerInterval = setInterval(function () {
                var now2 = new Date();
                var openTime2 = new Date(schedule.autoOpenDateTime);
                var closeTime2 = new Date(schedule.autoCloseDateTime);
                var isInsideWindow2 = (now2 >= openTime2 && now2 <= closeTime2);

                if (isInsideWindow2) {
                    window.isLeaderboardOpen = true;
                    window._leaderboardWritesBlocked = false;
                    handleUnlockUI(leaderboardContainer, statusLabel, "🟢 المتصدرين ظاهر الآن (جدولة تلقائية)");
                    if (typeof startUserCountdown === "function") startUserCountdown(schedule.autoCloseDateTime);
                } else {
                    window.isLeaderboardOpen = false;
                    window._leaderboardWritesBlocked = true;
                    applyLockBasedOnRole(currentRole, leaderboardContainer, profileLeaderboard, statusLabel, true);
                }
            }, 1000);
        } else {
            // Default safe fallback if settings are broken/missing
            window.isLeaderboardOpen = false;
            window._leaderboardWritesBlocked = true;
            applyLockBasedOnRole(currentRole, leaderboardContainer, profileLeaderboard, statusLabel, false);
        }
    });
}
