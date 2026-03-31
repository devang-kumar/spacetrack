document.addEventListener('DOMContentLoaded', () => {
    initCountdown();
    initCharts();
    initMap();
    initAISummary();
    initNotifications();
    initFavorites();
    initMobileMenu();
    initHomepageFilters();
});

// Homepage Filters
function initHomepageFilters() {
    const filters = document.querySelectorAll('[data-filter]');
    const cards = document.querySelectorAll('.mission-card');
    if (filters.length === 0) return;

    filters.forEach(filter => {
        filter.addEventListener('click', () => {
            const status = filter.dataset.filter;
            
            // Update UI
            filters.forEach(f => {
                f.classList.remove('bg-blue-600', 'text-white');
                f.classList.add('text-gray-400');
            });
            filter.classList.add('bg-blue-600', 'text-white');
            filter.classList.remove('text-gray-400');

            // Filter cards
            cards.forEach(card => {
                if (status === 'all' || card.dataset.status === status) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });
}

// Mobile Menu
function initMobileMenu() {
    const btn = document.getElementById('mobile-menu-btn');
    const menu = document.querySelector('.md\\:flex.space-x-8');
    if (!btn || !menu) return;

    btn.addEventListener('click', () => {
        menu.classList.toggle('hidden');
        menu.classList.toggle('flex');
        menu.classList.toggle('flex-col');
        menu.classList.toggle('absolute');
        menu.classList.toggle('top-full');
        menu.classList.toggle('left-0');
        menu.classList.toggle('w-full');
        menu.classList.toggle('bg-black/90');
        menu.classList.toggle('p-8');
        menu.classList.toggle('space-y-4');
        menu.classList.toggle('space-x-0');
    });
}

// Favorites
function initFavorites() {
    const favBtn = document.querySelector('[data-favorite-btn]');
    if (!favBtn) return;

    favBtn.addEventListener('click', async () => {
        // Request notification permission if not yet decided
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

        const id = favBtn.dataset.favoriteBtn;
        try {
            const res = await fetch(`/launches/${id}/favorite`, { method: 'POST' });
            if (res.status === 401) {
                window.location.href = '/auth/login';
                return;
            }
            const data = await res.json();
            if (data.success) {
                const isFav = data.favorites.includes(id);
                favBtn.classList.toggle('bg-blue-600', !isFav);
                favBtn.classList.toggle('bg-red-600', isFav);
                favBtn.querySelector('span').innerText = isFav ? 'Remove Favorite' : 'Save Mission';
                
                // Show notification
                if (isFav && Notification.permission === "granted") {
                    const name = (typeof missionData !== 'undefined' && missionData.name) ? missionData.name : 'this mission';
                    new Notification("Mission Saved", {
                        body: `You'll receive updates for ${name}`,
                        icon: "/img/favicon.png"
                    });
                }
            }
        } catch (err) {
            console.error('Error toggling favorite:', err);
        }
    });
}

// Countdown Timer
function initCountdown() {
    const counters = document.querySelectorAll('.countdown');
    if (counters.length === 0) return;

    setInterval(() => {
        counters.forEach(counter => {
            const launchDate = new Date(counter.dataset.date).getTime();
            const now = new Date().getTime();
            const diff = launchDate - now;

            if (diff <= 0) {
                counter.innerText = "LIFTOFF!";
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            counter.innerText = `${days}D ${hours}H ${minutes}M ${seconds}S`;
        });
    }, 1000);
}

// Charts
function initCharts() {
    if (typeof chartData === 'undefined') return;

    // Launches per Year
    const yearCtx = document.getElementById('launchesYearChart');
    if (yearCtx) {
        const years = Object.keys(chartData.byYear).sort();
        const counts = years.map(y => chartData.byYear[y]);

        new Chart(yearCtx, {
            type: 'line',
            data: {
                labels: years,
                datasets: [{
                    label: 'Missions',
                    data: counts,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointRadius: 4,
                    pointBackgroundColor: '#3b82f6'
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                }
            }
        });
    }

    // Rocket Usage
    const rocketCtx = document.getElementById('rocketUsageChart');
    if (rocketCtx) {
        const rockets = Object.keys(chartData.byRocket);
        const counts = rockets.map(r => chartData.byRocket[r]);

        new Chart(rocketCtx, {
            type: 'doughnut',
            data: {
                labels: rockets,
                datasets: [{
                    data: counts,
                    backgroundColor: [
                        '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'
                    ],
                    borderWidth: 0,
                    hoverOffset: 20
                }]
            },
            options: {
                responsive: true,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#94a3b8', padding: 20, font: { size: 12 } }
                    }
                }
            }
        });
    }
}

// Maps — 2D detail page map only
async function initMap() {
    const launchMapEl = document.getElementById('launch-map');
    if (!launchMapEl) return;

    const lat = parseFloat(launchMapEl.dataset.lat);
    const lng = parseFloat(launchMapEl.dataset.lng);
    if (isNaN(lat) || isNaN(lng)) return;

    const map = L.map('launch-map').setView([lat, lng], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    L.marker([lat, lng]).addTo(map).bindPopup('Launch Site').openPopup();
}

// AI Summary Generation
function initAISummary() {
    const summaryEl = document.getElementById('ai-summary');
    if (!summaryEl) return;
    if (typeof missionData === 'undefined') {
        summaryEl.innerHTML = 'Mission details unavailable.';
        return;
    }
    setTimeout(() => {
        const { name, details, rocket, launchpad } = missionData;
        const summary = `Mission ${name} utilizes the ${rocket || 'launch vehicle'} from ${launchpad || 'the launch site'}. ${details && details.length > 50 ? details.substring(0, 200) + '...' : 'This mission continues the expansion of global space infrastructure.'}`;
        summaryEl.innerHTML = summary;
        summaryEl.classList.remove('italic');
    }, 1500);
}

// Notifications
function initNotifications() {
    if ("Notification" in window) {
        if (Notification.permission !== "granted" && Notification.permission !== "denied") {
            // Optional: Show a small UI button to enable notifications instead of auto-requesting
            console.log("Notifications available");
        }
    }
}
