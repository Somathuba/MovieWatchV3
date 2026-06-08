const BASE_URL = 'https://api.themoviedb.org/3';
const API_KEY = 'api_key=3fd2be6f0c70a2a598f084ddfb75487c';
const IMG_PATH = 'https://image.tmdb.org/t/p/w500';
const BACKDROP_PATH = 'https://image.tmdb.org/t/p/w1280';

// Global State Management
let activeMode = 'movie'; 
let viewContext = 'home'; 
let currentGenreId = '';
let currentRegionCode = ''; 
let searchDebounceTimer;

let localWatchlist = JSON.parse(localStorage.getItem('mw_watchlist')) || [];
let registeredUsersDB = JSON.parse(localStorage.getItem('mw_users_db')) || [];
let activeLoggedInUser = localStorage.getItem('mw_current_user') || null;

let countriesCache = {};

// UI Element Selections
const mainContentArea = document.getElementById('main-content-area');
const heroSpotlightBanner = document.getElementById('hero-spotlight-banner');
const searchInput = document.getElementById('search-input');
const genreSelect = document.getElementById('genre-select');
const regionSelect = document.getElementById('region-select');
const switchMovies = document.getElementById('switch-movies');
const switchTV = document.getElementById('switch-tv');
const navHome = document.getElementById('nav-home');
const navWatchlist = document.getElementById('nav-watchlist');
const brandHome = document.getElementById('brand-home');
const watchlistCount = document.getElementById('watchlist-count');
const authTriggerBtn = document.getElementById('auth-trigger-btn');
const rouletteBtn = document.getElementById('roulette-btn');

// Modals
const detailsModal = document.getElementById('details-modal');
const closeModal = document.getElementById('close-modal');
const modalHero = document.getElementById('modal-hero');
const modalTitle = document.getElementById('modal-title');
const modalWatchlistToggle = document.getElementById('modal-watchlist-toggle');
const modalRating = document.getElementById('modal-rating');
const modalDate = document.getElementById('modal-date');
const modalRuntime = document.getElementById('modal-runtime');
const modalCountry = document.getElementById('modal-country');
const modalGenres = document.getElementById('modal-genres');
const modalOverview = document.getElementById('modal-overview');
let targetedItemData = null;

const authModal = document.getElementById('auth-modal');
const closeAuthModal = document.getElementById('close-auth-modal');
const signupBox = document.getElementById('signup-box');
const signinBox = document.getElementById('signin-box');
const goToSignin = document.getElementById('go-to-signin');
const goToSignup = document.getElementById('go-to-signup');
const signupForm = document.getElementById('signup-form');
const signinForm = document.getElementById('signin-form');
const googleAuthBtn = document.getElementById('google-auth-btn');

// Boot Application Up
initializeApp();

async function initializeApp() {
    updateWatchlistCountBadge();
    checkLoginStateStatus();
    await loadGlobalCountriesList(); 
    await loadGenreOptionsList();
    renderPageUI();
}

function checkLoginStateStatus() {
    if (!authTriggerBtn) return;
    if (activeLoggedInUser) {
        authTriggerBtn.innerText = Hi, ${activeLoggedInUser.split('@')[0]};
        authTriggerBtn.style.background = '#1a1a1a';
        authTriggerBtn.style.color = '#38bdf8';
        authTriggerBtn.style.border = '1px solid #333';
    } else {
        authTriggerBtn.innerText = 'Sign In';
        authTriggerBtn.style.background = '#38bdf8';
        authTriggerBtn.style.color = '#000';
        authTriggerBtn.style.border = 'none';
    }
}

async function loadGlobalCountriesList() {
    const url = ${BASE_URL}/configuration/countries?${API_KEY};
    try {
        const response = await fetch(url);
        const countries = await response.json();
        countries.sort((a, b) => a.english_name.localeCompare(b.english_name));
        
        if (regionSelect) {
            regionSelect.innerHTML = '<option value="">🌍 All Regions</option>';
            const priorityHubs = [
                { iso_3166_1: 'ZA', english_name: '🇿🇦 South Africa' },
                { iso_3166_1: 'US', english_name: '🇺🇸 United States' },
                { iso_3166_1: 'NG', english_name: '🇳🇬 Nigeria' }
            ];
            priorityHubs.forEach(hub => {
                countriesCache[hub.iso_3166_1] = hub.english_name;
                let opt = document.createElement('option');
                opt.value = hub.iso_3166_1; opt.innerText = hub.english_name;
                regionSelect.appendChild(opt);
            });
            countries.forEach(c => {
                countriesCache[c.iso_3166_1] = c.english_name;
                if(!['ZA','US','NG'].includes(c.iso_3166_1)) {
                    let opt = document.createElement('option');
                    opt.value = c.iso_3166_1; opt.innerText = c.english_name;
                    regionSelect.appendChild(opt);
                }
            });
        }
    } catch (e) { console.error(e); }
}

async function loadGenreOptionsList() {
    const url = ${BASE_URL}/genre/${activeMode}/list?${API_KEY};
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (genreSelect) {
            genreSelect.innerHTML = '<option value="">🎭 All Genres</option>';
            data.genres.forEach(g => {
                let opt = document.createElement('option');
                opt.value = g.id; opt.innerText = g.name;
                if(currentGenreId == g.id) opt.selected = true;
                genreSelect.appendChild(opt);
            });
        }
    } catch(e) { console.error(e); }
}

function renderPageUI() {
    if (viewContext === 'home') {
        if(heroSpotlightBanner) heroSpotlightBanner.style.display = 'flex';
        renderNetflixStyleDashboard();
    } else {
        if(heroSpotlightBanner) heroSpotlightBanner.style.display = 'none';
        if (viewContext === 'search') renderVerticalSearchGrid();
        if (viewContext === 'watchlist') renderWatchlistGrid();
    }
}

// Animated Skeleton Loader Generator
function injectSkeletonLoadingTrack(targetElement, count = 6) {
    targetElement.innerHTML = '';
    for(let i=0; i<count; i++) {
        let block = document.createElement('div');
        block.classList.add('skeleton-card');
        targetElement.appendChild(block);
    }
}

async function renderNetflixStyleDashboard() {
    if (!mainContentArea) return;
    mainContentArea.innerHTML = '';
    
    let filterParams = '';
    if (currentGenreId) filterParams += &with_genres=${currentGenreId};
    if (currentRegionCode) filterParams += &with_origin_country=${currentRegionCode};

    const categories = {
        "Trending Content Right Now": ${BASE_URL}/discover/${activeMode}?sort_by=popularity.desc&${API_KEY}${filterParams},
        "Top Rated Critics' Picks": ${BASE_URL}/${activeMode}/top_rated?${API_KEY}${filterParams},
        "Fresh New Releases": ${BASE_URL}/discover/${activeMode}?sort_by=primary_release_date.desc&${API_KEY}${filterParams}
    };

    let values = Object.entries(categories);
    
    try {
        let firstRowRes = await fetch(values[0][1]);
        let firstRowData = await firstRowRes.json();
        if(firstRowData.results && firstRowData.results.length > 0) {
            buildHeroBannerLayout(firstRowData.results[0]);
        }
    } catch(e) { console.error(e); }

    for (const [title, url] of values) {
        const row = document.createElement('div');
        row.classList.add('slider-row-container');
        row.innerHTML = <h2 class="row-title">${title}</h2><div class="slider-track-viewport"></div>;
        const viewport = row.querySelector('.slider-track-viewport');
        injectSkeletonLoadingTrack(viewport);
        mainContentArea.appendChild(row);

        fetch(url).then(res => res.json()).then(data => {
            viewport.innerHTML = '';
            let items = data.results ? data.results.filter(i => i.poster_path) : [];
            if(items.length === 0) { row.remove(); return; }
            items.forEach(item => viewport.appendChild(buildMediaCardElement(item)));
        }).catch(() => row.remove());
    }
}

function buildHeroBannerLayout(item) {
    if(!heroSpotlightBanner) return;
    const titleText = item.title || item.name;
    heroSpotlightBanner.style.backgroundImage = url(${BACKDROP_PATH + item.backdrop_path});
    heroSpotlightBanner.innerHTML = `
        <div class="hero-content">
            <span class="hero-trending-tag"><i class="fas fa-fire"></i> #1 Spotlight</span>
            <h1 class="hero-title">${titleText}</h1>
            <p class="hero-overview">${item.overview || 'No overview text found.'}</p>
            <button class="hero-btn" onclick="openDetailModalWindow(${item.id}, '${activeMode}')">
                <i class="fas fa-info-circle"></i> View Details
            </button>
        </div>
    `;
}

function buildMediaCardElement(item) {
    const isSaved = localWatchlist.some(w => w.id === item.id && w.media_type === activeMode);
    const card = document.createElement('div');
    card.classList.add('movie-card');

    const titleText = item.title || item.name;
    const dateText = item.release_date || item.first_air_date;
    const year = dateText ? dateText.split('-')[0] : 'N/A';
    const score = item.vote_average ? item.vote_average.toFixed(1) : '0.0';

    card.innerHTML = `
        <button class="card-badge-bookmark ${isSaved ? 'saved' : ''}"><i class="${isSaved ? 'fas' : 'far'} fa-bookmark"></i></button>
        <img src="${IMG_PATH + item.poster_path}" alt="${titleText}" loading="lazy">
        <div class="card-details">
            <p class="title" title="${titleText}">${titleText}</p>
            <div class="meta-row">
                <span class="year">${year}</span>
                <span class="score">⭐ ${score}</span>
            </div>
        </div>
    `;

    card.addEventListener('click', (e) => {
        if(e.target.closest('.card-badge-bookmark')) {
            e.stopPropagation();
            toggleItemFromWatchlist(item, activeMode);
            const btn = card.querySelector('.card-badge-bookmark');
            btn.classList.toggle('saved');
            btn.querySelector('i').className = btn.classList.contains('saved') ? 'fas fa-bookmark' : 'far fa-bookmark';
            return;
        }
        openDetailModalWindow(item.id, activeMode);
    });

    return card;
}

// Dynamic Predictive Instant Search Engine
if (searchInput) {
    searchInput.addEventListener('input', () => {
        clearTimeout(searchDebounceTimer);
        const query = searchInput.value.trim();
        
        if (query === '') {
            viewContext = 'home';
            renderPageUI();
            return;
        }

        searchDebounceTimer = setTimeout(() => {
            viewContext = 'search';
            renderPageUI();
        }, 400);
    });
}

async function renderVerticalSearchGrid() {
    if (!mainContentArea) return;
    const query = encodeURIComponent(searchInput.value.trim());
    const url = ${BASE_URL}/search/${activeMode}?${API_KEY}&query=${query};
    
    mainContentArea.innerHTML = <h2 class="row-title">Results for "${searchInput.value}"</h2><div class="vertical-display-grid" id="search-grid"></div>;
    const grid = document.getElementById('search-grid');
    injectSkeletonLoadingTrack(grid, 12);

    try {
        const response = await fetch(url);
        const data = await response.json();
        grid.innerHTML = '';
        let items = data.results ? data.results.filter(i => i.poster_path) : [];
        if(items.length === 0) {
            grid.innerHTML = <p class="no-results">No media discovered matching that query.</p>;
            return;
        }
        items.forEach(item => grid.appendChild(buildMediaCardElement(item)));
    } catch(e) { console.error(e); }
}

function renderWatchlistGrid() {
    if (!mainContentArea) return;
    mainContentArea.innerHTML = <h2 class="row-title">My Saved Watchlist Items</h2><div class="vertical-display-grid" id="watchlist-grid"></div>;
    const grid = document.getElementById('watchlist-grid');

    const filtered = localWatchlist.filter(w => w.media_type === activeMode);
    if(filtered.length === 0) {
        grid.innerHTML = <p class="no-results">No titles saved in your list yet.</p>;
        return;
    }

    filtered.forEach(item => {
        grid.appendChild(buildMediaCardElement({
            id: item.id, poster_path: item.poster_path,
            title: item.title, name: item.title,
            release_date: item.date, first_air_date: item.date,
            vote_average: parseFloat(item.score)
        }));
    });
}

// "Surprise Me" Movie Roulette Engine
if (rouletteBtn) {
    rouletteBtn.addEventListener('click', async () => {
        let filterParams = '';
        if (currentGenreId) filterParams += &with_genres=${currentGenreId};
        if (currentRegionCode) filterParams += &with_origin_country=${currentRegionCode};
        
        const url = ${BASE_URL}/discover/${activeMode}?sort_by=popularity.desc&${API_KEY}${filterParams};
        try {
            rouletteBtn.innerHTML = <i class="fas fa-spinner fa-spin"></i> Picking...;
            const response = await fetch(url);
            const data = await response.json();
            if(data.results && data.results.length > 0) {
                let index = Math.floor(Math.random() * data.results.length);
                let selectedItem = data.results[index];
                openDetailModalWindow(selectedItem.id, activeMode);
            } else {
                alert("No titles found inside these filters to choose from!");
            }
        } catch(e) { console.error(e); }
        rouletteBtn.innerHTML = <i class="fas fa-dice"></i> <span>Surprise Me</span>;
    });
}

async function openDetailModalWindow(id, type) {
    const url = ${BASE_URL}/${type}/${id}?${API_KEY};
    try {
        const response = await fetch(url);
        targetedItemData = await response.json();
        
        if (modalHero) modalHero.style.backgroundImage = targetedItemData.backdrop_path ? url(${BACKDROP_PATH + targetedItemData.backdrop_path}) : 'none';
        if (modalTitle) modalTitle.innerText = targetedItemData.title || targetedItemData.name;
        if (modalOverview) modalOverview.innerText = targetedItemData.overview || "No localized synopsis text logged for this profile.";
        if (modalRating) modalRating.innerText = ⭐ ${targetedItemData.vote_average ? targetedItemData.vote_average.toFixed(1) : '0.0'};
        
        const rawDate = targetedItemData.release_date || targetedItemData.first_air_date;
        if (modalDate) modalDate.innerText = rawDate ? rawDate.split('-')[0] : 'N/A';
        
        const runtimeValue = targetedItemData.runtime || (targetedItemData.episode_run_time ? targetedItemData.episode_run_time[0] : null);
        if (modalRuntime) {
            modalRuntime.innerText = runtimeValue ? ${runtimeValue} min : '-- min';
        }

        if (modalCountry) {
            const countryCode = targetedItemData.origin_country ? targetedItemData.origin_country[0] : (targetedItemData.production_countries && targetedItemData.production_countries[0] ? targetedItemData.production_countries[0].iso_3166_1 : '');
            modalCountry.innerText = countryCode ? Origin: ${countryCode} : 'Origin: Global';
        }

        if (modalGenres) modalGenres.innerText = targetedItemData.genres ? targetedItemData.genres.map(g => g.name).join(', ') : 'Unclassified';

        if (modalWatchlistToggle) {
            const isAlreadySaved = localWatchlist.some(w => w.id === targetedItemData.id && w.media_type === type);
            modalWatchlistToggle.className = isAlreadySaved ? 'modal-bookmark-btn saved' : 'modal-bookmark-btn';
            modalWatchlistToggle.innerHTML = isAlreadySaved ? <i class="fas fa-bookmark"></i> Saved : <i class="far fa-bookmark"></i> Add to Watchlist;
        }

        if (detailsModal) detailsModal.classList.add('open');
        document.body.style.overflow = 'hidden';
    } catch(e) { console.error(e); }
}

function closeDetailModalWindow() {
    if (detailsModal) detailsModal.classList.remove('open');
    document.body.style.overflow = 'auto';
}

function toggleItemFromWatchlist(item, type) {
    const matchIndex = localWatchlist.findIndex(w => w.id === item.id && w.media_type === type);
    if (matchIndex > -1) {
        localWatchlist.splice(matchIndex, 1);
    } else {
        localWatchlist.push({
            id: item.id, media_type: type,
            title: item.title || item.name, poster_path: item.poster_path,
            date: item.release_date || item.first_air_date,
            score: item.vote_average ? item.vote_average.toFixed(1) : '0.0'
        });
    }
    localStorage.setItem('mw_watchlist', JSON.stringify(localWatchlist));
    updateWatchlistCountBadge();
    if(viewContext === 'watchlist') renderWatchlistGrid();
}

function updateWatchlistCountBadge() {
    if(watchlistCount) watchlistCount.innerText = localWatchlist.filter(w => w.media_type === activeMode).length;
}

// Authentication Actions Engine
if (authTriggerBtn) {
    authTriggerBtn.addEventListener('click', () => {
        if (activeLoggedInUser) {
            if(confirm("Would you like to sign out?")) {
                activeLoggedInUser = null;
                localStorage.removeItem('mw_current_user');
                checkLoginStateStatus();
            }
            return;
        }
        if (authModal) { signupBox.style.display = 'none'; signinBox.style.display = 'block'; authModal.classList.add('open'); }
    });
}
if (closeAuthModal) closeAuthModal.addEventListener('click', () => authModal.classList.remove('open'));
if (goToSignin) goToSignin.addEventListener('click', () => { signupBox.style.display = 'none'; signinBox.style.display = 'block'; });
if (goToSignup) goToSignup.addEventListener('click', () => { signinBox.style.display = 'none'; signupBox.style.display = 'block'; });

// Sign Up Handler
if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('signup-username').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;

        if (registeredUsersDB.some(u => u.email.toLowerCase() === email.toLowerCase())) { 
            alert("An account with this email address already exists!"); 
            return; 
        }

        registeredUsersDB.push({ username, email, password });
        localStorage.setItem('mw_users_db', JSON.stringify(registeredUsersDB));
        alert("Account ready! Redirecting you to Sign In.");
        signupForm.reset(); 
        signupBox.style.display = 'none'; 
        signinBox.style.display = 'block';
    });
}

// Email/Password Sign In Handler
if (signinForm) {
    signinForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('signin-email').value.trim();
        const password = document.getElementById('signin-password').value;

        const match = registeredUsersDB.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
        if (!match) { 
            alert("Invalid Email Address or Password. Please try again."); 
            return; 
        }

        activeLoggedInUser = match.email;
        localStorage.setItem('mw_current_user', activeLoggedInUser);
        checkLoginStateStatus(); 
        signinForm.reset(); 
        authModal.classList.remove('open');
    });
}

// Simulation for Continue with Google Button
if (googleAuthBtn) {
    googleAuthBtn.addEventListener('click', () => {
        activeLoggedInUser = "googleuser@gmail.com";
        localStorage.setItem('mw_current_user', activeLoggedInUser);
        checkLoginStateStatus();
        if (authModal) authModal.classList.remove('open');
        alert("Successfully signed in with Google!");
    });
}

// General Controls Binding Setup
if (closeModal) closeModal.addEventListener('click', closeDetailModalWindow);
if (switchMovies) {
    switchMovies.addEventListener('click', () => {
        if(activeMode === 'movie') return; activeMode = 'movie';
        switchTV.classList.remove('active'); switchMovies.classList.add('active');
        currentGenreId = ''; loadGenreOptionsList(); updateWatchlistCountBadge(); renderPageUI();
    });
}
if (switchTV) {
    switchTV.addEventListener('click', () => {
        if(activeMode === 'tv') return; activeMode = 'tv';
        switchMovies.classList.remove('active'); switchTV.classList.add('active');
        currentGenreId = ''; loadGenreOptionsList(); updateWatchlistCountBadge(); renderPageUI();
    });
}
if (genreSelect) genreSelect.addEventListener('change', (e) => { currentGenreId = e.target.value; viewContext = 'home'; renderPageUI(); });
if (regionSelect) regionSelect.addEventListener('change', (e) => { currentRegionCode = e.target.value; viewContext = 'home'; renderPageUI(); });

if (navHome) navHome.addEventListener('click', () => { viewContext = 'home'; if(searchInput) searchInput.value = ''; navWatchlist.classList.remove('active'); navHome.classList.add('active'); renderPageUI(); });
if (brandHome) brandHome.addEventListener('click', () => { viewContext = 'home'; if(searchInput) searchInput.value = ''; navWatchlist.classList.remove('active'); navHome.classList.add('active'); renderPageUI(); });
if (navWatchlist) navWatchlist.addEventListener('click', () => { viewContext = 'watchlist'; if(searchInput) searchInput.value = ''; navHome.classList.remove('active'); navWatchlist.classList.add('active'); renderPageUI(); });