document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialisation
    const dateSelector = document.getElementById('dateSelector');
    const today = new Date().toISOString().split('T')[0];
    dateSelector.value = today;

    // Lucide Icons Render
    lucide.createIcons();

    // Sidebar Mobile Toggle (Betclic Style)
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    const mainSidebar = document.getElementById('mainSidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    const toggleSidebar = () => {
        if (mainSidebar && sidebarOverlay) {
            mainSidebar.classList.toggle('-translate-x-full');
            sidebarOverlay.classList.toggle('hidden');
            setTimeout(() => sidebarOverlay.classList.toggle('opacity-0'), 10);
        }
    };

    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleSidebar);
    if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', toggleSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', toggleSidebar);

    // Event Listeners
    dateSelector.addEventListener('change', (e) => loadFixtures(e.target.value));
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);

    // Filtres de Status (Tous, Live, Terminés)
    const statusBtns = document.querySelectorAll('.status-btn');
    statusBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Activer visuellement le bouton cliqué
            statusBtns.forEach(b => {
                b.classList.remove('active', 'bg-slate-', 'text-white');
                b.classList.add('bg-slate-', 'text-slate-');
            });
            const target = e.currentTarget;
            target.classList.remove('bg-slate-', 'text-slate-');
            target.classList.add('active', 'bg-slate-', 'text-white');

            const filterStatus = target.getAttribute('data-status');
            filterMatches(filterStatus);
        });
    });

    function filterMatches(status) {
        const matchItems = document.querySelectorAll('.match-item');
        const historyItems = document.querySelectorAll('.history-item');
        const leagues = document.querySelectorAll('.league-section');

        const applyFilter = (items) => {
            items.forEach(item => {
                const itemStatus = item.getAttribute('data-match-status');
                let shouldShow = false;

                if (status === 'all') shouldShow = true;
                else if (status === 'finished' && (itemStatus === 'finished' || itemStatus === 'canceled' || itemStatus === 'postponed')) shouldShow = true;
                else if (status === 'live' && itemStatus === 'inprogress') shouldShow = true;
                else if (status === 'notstarted' && itemStatus === 'notstarted') shouldShow = true;

                if (shouldShow) {
                    item.classList.remove('hidden');
                    item.classList.add('flex');
                } else {
                    item.classList.add('hidden');
                    item.classList.remove('flex');
                }
            });
        };

        applyFilter(matchItems);
        applyFilter(historyItems);

        // Masquer les ligues entières si elles ne contiennent aucun match visible
        leagues.forEach(league => {
            const visibleMatches = league.querySelectorAll('.match-item:not(.hidden)');
            if (visibleMatches.length === 0) {
                league.classList.add('hidden');
            } else {
                league.classList.remove('hidden');
            }
        });
    }

    // Gestion des onglets de la modale
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Reset tous les onglets
            tabBtns.forEach(b => {
                b.classList.remove('active', 'border-accent_gold', 'text-accent_gold');
                b.classList.add('inactive', 'border-transparent', 'text-slate-400');
            });
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.add('hidden'));

            // Activer le cliqué
            const target = e.target.getAttribute('data-target');
            e.target.classList.remove('inactive', 'border-transparent', 'text-slate-400');
            e.target.classList.add('active', 'border-accent_gold', 'text-accent_gold');
            document.getElementById(target).classList.remove('hidden');
        });
    });

    // Initialisation Autocomplete Duels
    let selectedHomeTeam = null;
    let selectedAwayTeam = null;

    const setupAutocomplete = (inputId, dropdownId, type) => {
        const input = document.getElementById(inputId);
        const dropdown = document.getElementById(dropdownId);
        let timeout = null;

        input.addEventListener('input', (e) => {
            clearTimeout(timeout);
            const val = e.target.value.trim();
            if (val.length < 2) {
                dropdown.classList.add('hidden');
                return;
            }
            timeout = setTimeout(async () => {
                try {
                    const res = await fetch(`http://localhost:10000/api/teams/search?q=${val}`);
                    const data = await res.json();
                    if (data.teams && data.teams.length > 0) {
                        dropdown.innerHTML = '';
                        data.teams.forEach(t => {
                            const div = document.createElement('div');
                            div.className = 'px-4 py-2 hover:bg-slate-700 cursor-pointer flex items-center gap-3 text-white text-sm';
                            div.innerHTML = `<img src="${t.logo}" class="w-6 h-6 object-contain"> ${t.name}`;
                            div.onclick = () => {
                                input.value = t.name;
                                dropdown.classList.add('hidden');
                                if (type === 'home') selectedHomeTeam = t;
                                if (type === 'away') selectedAwayTeam = t;
                                checkDuelBtn();
                            };
                            dropdown.appendChild(div);
                        });
                        dropdown.classList.remove('hidden');
                    } else {
                        dropdown.classList.add('hidden');
                    }
                } catch (err) {
                    console.error('Erreur recherche equipe', err);
                }
            }, 300);
        });

        // Fermer le dropdown si on clique ailleurs
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
    };

    setupAutocomplete('homeTeamSearch', 'homeTeamDropdown', 'home');
    setupAutocomplete('awayTeamSearch', 'awayTeamDropdown', 'away');

    const scanBtn = document.getElementById('scanDuelBtn');

    const checkDuelBtn = () => {
        if (selectedHomeTeam && selectedAwayTeam) {
            scanBtn.disabled = false;
            scanBtn.classList.remove('cursor-not-allowed', 'opacity-50');
            scanBtn.classList.add('shadow-lg', 'shadow-accent_gold/20');
        } else {
            scanBtn.disabled = true;
            scanBtn.classList.add('cursor-not-allowed', 'opacity-50');
            scanBtn.classList.remove('shadow-lg', 'shadow-accent_gold/20');
        }
    };

    scanBtn.addEventListener('click', () => {
        if (!selectedHomeTeam || !selectedAwayTeam) return;
        const duelDateInput = document.getElementById('dateSelector').value;
        openDuelModal(selectedHomeTeam, selectedAwayTeam, duelDateInput);
    });

    // Mobile Custom Duel Search
    const mobileHomeTeamInput = document.getElementById('mobileHomeTeamSearch');
    const mobileAwayTeamInput = document.getElementById('mobileAwayTeamSearch');
    const mobileScanBtn = document.getElementById('mobileScanDuelBtn');

    let mobileSelectedHome = null;
    let mobileSelectedAway = null;

    if (mobileHomeTeamInput) {
        setupAutocomplete('mobileHomeTeamSearch', 'homeTeamDropdown', t => { mobileSelectedHome = t; checkMobileScan(); });
        setupAutocomplete('mobileAwayTeamSearch', 'awayTeamDropdown', t => { mobileSelectedAway = t; checkMobileScan(); });
    }

    const checkMobileScan = () => {
        if (mobileScanBtn && mobileSelectedHome && mobileSelectedAway) {
            mobileScanBtn.disabled = false;
            mobileScanBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    };

    if (mobileScanBtn) {
        mobileScanBtn.addEventListener('click', () => {
            if (mobileSelectedHome && mobileSelectedAway) {
                const duelDate = dateSelector.value;
                openDuelModal(mobileSelectedHome, mobileSelectedAway, duelDate);
            }
        });
    }

    // History UI Tabs
    const historyCompletedBtn = document.getElementById('historyCompletedBtn');
    const historyPendingBtn = document.getElementById('historyPendingBtn');
    const historyNotStartedBtn = document.getElementById('historyNotStartedBtn');

    if (historyCompletedBtn && historyPendingBtn && historyNotStartedBtn) {
        const updateHistoryTabs = (tab) => {
            currentHistoryTab = tab;
            [historyCompletedBtn, historyPendingBtn, historyNotStartedBtn].forEach(btn => {
                btn.classList.replace('text-white', 'text-slate-400');
                btn.classList.replace('bg-slate-700', 'hover:text-white');
            });
            const activeBtn = tab === 'completed' ? historyCompletedBtn : (tab === 'pending' ? historyPendingBtn : historyNotStartedBtn);
            activeBtn.classList.replace('text-slate-400', 'text-white');
            activeBtn.classList.replace('hover:text-white', 'bg-slate-700');
            renderHistory({ data: globalHistoryData });
        };

        historyCompletedBtn.addEventListener('click', () => updateHistoryTabs('completed'));
        historyPendingBtn.addEventListener('click', () => updateHistoryTabs('pending'));
        historyNotStartedBtn.addEventListener('click', () => updateHistoryTabs('notstarted'));
    }

    // Load initial data
    loadFixtures(today);
    fetchHistoryData();
});

async function loadFixtures(date) {
    const container = document.getElementById('dashboardContainer');
    document.getElementById('matchCount').textContent = 'Chargement...';

    // Skeleton temp
    container.innerHTML = `
        <div class="flex justify-center py-20">
            <i data-lucide="loader-2" class="w-10 h-10 animate-spin text-accent_gold"></i>
        </div>
    `;
    lucide.createIcons();

    try {
        const response = await fetch(`http://localhost:10000/api/fixtures?date=${date}`);
        if (!response.ok) throw new Error("Erreur réseau");

        const data = await response.json();
        renderDashboard(data.fixtures || []);
    } catch (error) {
        container.innerHTML = `<div class="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-lg text-center">Impossible de charger les matchs : ${error.message}</div>`;
        document.getElementById('matchCount').textContent = 'Erreur';
    }
}

function renderDashboard(fixtures) {
    const container = document.getElementById('dashboardContainer');
    container.innerHTML = '';

    if (fixtures.length === 0) {
        container.innerHTML = `<div class="text-center py-10 text-slate-400">Aucun match disponible à cette date via votre plan API actuel.</div>`;
        document.getElementById('matchCount').textContent = '0 Match';
        return;
    }

    document.getElementById('matchCount').textContent = `${fixtures.length} Match${fixtures.length > 1 ? 's' : ''}`;

    // Group by League
    const leagues = {};
    fixtures.forEach(f => {
        const ln = f.league_name;
        if (!leagues[ln]) {
            leagues[ln] = { logo: f.league_logo, matches: [], country: f.league_country || 'International' };
        }
        leagues[ln].matches.push(f);
    });

    // Build Sidebar HTML
    buildSidebarNavigation(leagues);

    // Render HTML
    for (const [leagueName, leagueData] of Object.entries(leagues)) {
        const leagueSection = document.createElement('div');
        const sectionId = 'league-section-' + leagueName.replace(/\s+/g, '');
        leagueSection.id = sectionId;
        leagueSection.className = 'bg-[#18181b]/60 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden mb-4 league-section shadow-lg transition-transform hover:-translate-y-0.5 scroll-mt-28';

        // Header League (Accordion Trigger)
        const headerHTML = `
            <div class="px-4 py-3 bg-transparent flex justify-between items-center cursor-pointer hover:bg-white/5 transition-all" onclick="toggleAccordion('acc-${leagueName.replace(/\s+/g, '')}')">
                <div class="flex items-center gap-2.5">
                    <img src="${leagueData.logo || ''}" alt="Ligue" class="w-5 h-5 object-contain drop-shadow-md">
                    <h2 class="font-bold text-white text-[13px] uppercase tracking-wider">${leagueName}</h2>
                </div>
                <i data-lucide="chevron-down" class="w-4 h-4 text-slate-400 transition-transform duration-300 transform rotate-180" id="icon-acc-${leagueName.replace(/\s+/g, '')}"></i>
            </div>
        `;

        // Matches List
        let matchesHTML = `<div id="acc-${leagueName.replace(/\s+/g, '')}" class="accordion-wrapper bg-transparent border-t border-white/5 min-h-0"><div class="accordion-inner divide-y divide-white/5">`;

        let timeOptions = { hour: '2-digit', minute: '2-digit' };

        // Si la liste est longue et dépasse la date d'aujourd'hui, on ne met pas le displayLive
        leagueData.matches.forEach(m => {
            const hasStarted = m.event_final_result !== "" && m.event_final_result != null && m.event_final_result !== '-';
            let statusBadge = '';
            let rawStatusType = m.event_status;

            // Parser la date (DD/MM) depuis (YYYY-MM-DD)
            let dateStr = '';
            if (m.event_date) {
                const parts = m.event_date.split('-');
                if (parts.length === 3) dateStr = `${parts[2]}/${parts[1]}`;
            }

            // Sofascore minimalist status formatting - Translated to French
            if (m.event_status === 'finished') {
                statusBadge = `<div class="flex flex-col items-center"><span class="text-[11px] font-bold text-sofa_text_muted uppercase">FIN</span><span class="text-[10px] text-sofa_text_muted">${dateStr}</span></div>`;
                rawStatusType = 'finished';
            } else if (m.event_status === 'notstarted') {
                statusBadge = `<div class="flex flex-col items-center"><span class="text-[12px] font-medium text-sofa_text_muted">${m.event_time}</span><span class="text-[10px] text-sofa_text_muted">${dateStr}</span></div>`;
                rawStatusType = 'notstarted';
            } else if (m.event_status === 'canceled' || m.event_status === 'postponed') {
                statusBadge = `<div class="flex flex-col items-center"><span class="text-[11px] font-bold text-sofa_text_muted uppercase">Annulé</span><span class="text-[10px] text-sofa_text_muted">${dateStr}</span></div>`;
                rawStatusType = 'finished'; // Treat cancelled as finished to hide from live
            } else {
                // Live match (HT, Minuté, etc)
                let displayLive = m.event_status_info || 'En Cours';
                if (displayLive === 'HT') displayLive = 'MT'; // Mi-temps

                // If it is Halftime, DO NOT attach data-live-ts so the setInterval ignores it and it stays paused at 'MT'
                let dataTs = '';
                if (displayLive !== 'MT' && displayLive !== 'MT Prol.' && m.live_timestamp) {
                    dataTs = `data-live-ts="${m.live_timestamp}" data-live-init="${m.live_initial || 0}" data-live-desc="${m.live_desc || ''}"`;
                }

                statusBadge = `<div class="flex flex-col items-center"><span class="live-minute-pulse text-[11px] font-bold text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.8)] animate-pulse uppercase" ${dataTs}>${displayLive}</span><span class="text-[10px] text-red-400/80">${dateStr}</span></div>`;
                rawStatusType = 'inprogress';
            }

            matchesHTML += `
                <div class="match-item px-4 py-3 hover:bg-white/5 transition-colors flex items-center gap-4 cursor-pointer group" data-match-status="${rawStatusType}" onclick="openAnalysisModal('${m.event_key}', '${m.event_home_team.replace(/'/g, "\\'")}', '${m.event_away_team.replace(/'/g, "\\'")}', this)">
                    
                    <!-- Time / Status -->
                    <div class="w-12 flex-shrink-0 text-center border-r border-white/10 pr-3">
                        ${statusBadge}
                    </div>

                    <!-- Teams Container (Stacked) -->
                    <div class="flex-1 flex flex-col gap-1.5 pl-1">
                        <!-- Home Team Row -->
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <img src="${m.home_team_logo}" class="w-5 h-5 object-contain" onerror="this.src='https://via.placeholder.com/20'">
                                <span class="text-[13px] font-medium text-sofa_text">${m.event_home_team}</span>
                            </div>
                            <span class="text-[13px] font-bold ${hasStarted ? 'text-sofa_text' : 'text-sofa_text_muted'}">${hasStarted ? m.event_final_result.split('-')[0].trim() : '-'}</span>
                        </div>
                        <!-- Away Team Row -->
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <img src="${m.away_team_logo}" class="w-5 h-5 object-contain" onerror="this.src='https://via.placeholder.com/20'">
                                <span class="text-[13px] font-medium text-sofa_text">${m.event_away_team}</span>
                            </div>
                            <span class="text-[13px] font-bold ${hasStarted ? 'text-sofa_text' : 'text-sofa_text_muted'}">${hasStarted ? m.event_final_result.split('-')[1].trim() : '-'}</span>
                        </div>
                        ${m.event_ht_result ? `
                        <div class="flex items-center justify-end mt-0.5 gap-2">
                            <span class="text-[10px] text-sofa_text_muted font-medium">1ère MT: ${m.event_ht_result}</span>
                            ${m.event_2nd_result ? `<span class="text-[10px] text-sofa_text_muted font-medium border-l border-sofa_border pl-2 border-slate-600">2ème MT: ${m.event_2nd_result}</span>` : ''}
                        </div>` : ''}
                    </div>

                    <!-- Analyze Indicator -->
                    <div class="w-8 flex-shrink-0 flex justify-end">
                        <i data-lucide="cpu" class="w-5 h-5 text-sofa_blue hidden group-hover:block transition-all"></i>
                        <i data-lucide="chevron-right" class="w-5 h-5 text-sofa_text_muted group-hover:hidden transition-all"></i>
                    </div>

                </div>
            `;
        });

        matchesHTML += `</div></div>`;

        leagueSection.innerHTML = headerHTML + matchesHTML;
        container.appendChild(leagueSection);
    }

    lucide.createIcons();
}

function buildSidebarNavigation(leaguesMap) {
    const countryTranslations = {
        "England": "Angleterre", "Spain": "Espagne", "Italy": "Italie", "Germany": "Allemagne",
        "Netherlands": "Pays-Bas", "Belgium": "Belgique", "Portugal": "Portugal", "Brazil": "Brésil",
        "Argentina": "Argentine", "France": "France", "Switzerland": "Suisse", "Austria": "Autriche",
        "Scotland": "Écosse", "Turkey": "Turquie", "Greece": "Grèce", "Poland": "Pologne",
        "Croatia": "Croatie", "Sweden": "Suède", "Norway": "Norvège", "Denmark": "Danemark",
        "Russia": "Russie", "Ukraine": "Ukraine", "Czech Republic": "Rép. Tchèque", "Romania": "Roumanie",
        "Serbia": "Serbie", "Bulgaria": "Bulgarie", "Hungary": "Hongrie", "Slovakia": "Slovaquie",
        "Slovenia": "Slovénie", "Finland": "Finlande", "Ireland": "Irlande", "Wales": "Pays de Galles",
        "Northern Ireland": "Irlande du Nord", "USA": "États-Unis", "Mexico": "Mexique", "Colombia": "Colombie",
        "Chile": "Chili", "Uruguay": "Uruguay", "Peru": "Pérou", "Japan": "Japon", "South Korea": "Corée du Sud",
        "China": "Chine", "Australia": "Australie", "Egypt": "Égypte", "Morocco": "Maroc", "Algeria": "Algérie",
        "Tunisia": "Tunisie", "South Africa": "Afrique du Sud", "Saudi Arabia": "Arabie Saoudite", "Qatar": "Qatar",
        "UAE": "Émirats Arabes Unis", "Iran": "Iran", "Bolivia": "Bolivie", "Bosnia & Herzegovina": "Bosnie-Herzégovine",
        "World": "Monde", "Europe": "Europe", "South America": "Amérique du Sud",
        "North & Central America": "Amérique du Nord", "Asia": "Asie", "Africa": "Afrique",
        "Ecuador": "Équateur", "Paraguay": "Paraguay", "Venezuela": "Venezuela", "Israel": "Israël", "Cyprus": "Chypre"
    };

    const topMatches = [
        { contains: "champions league", checkC: ["europe", "world", "international", "monde"] },
        { contains: "europa league", checkC: ["europe", "world", "international", "monde"] },
        { contains: "conference league", checkC: ["europe", "world", "international", "monde"] },
        { contains: "premier league", checkC: ["england", "angleterre"] },
        { contains: "laliga", checkC: ["spain", "espagne"] },
        { contains: "ligue 1", checkC: ["france"] },
        { contains: "serie a", checkC: ["italy", "italie", "brazil", "brésil"] },
        { contains: "bundesliga", checkC: ["germany", "allemagne"] },
        { contains: "euro", checkC: ["europe", "international", "world", "monde"] },
        { contains: "world cup", checkC: ["world", "international", "monde"] },
        { contains: "copa america", checkC: ["south america", "amérique du sud", "world", "international"] }
    ];

    const topLeaguesHtml = [];
    const countriesMap = {};

    // Generate elements dynamically
    for (const [leagueName, leagueData] of Object.entries(leaguesMap)) {
        const rawC = leagueData.country;
        const c = countryTranslations[rawC] || rawC;

        if (!countriesMap[c]) countriesMap[c] = [];
        countriesMap[c].push({ name: leagueName, logo: leagueData.logo });

        let isTopLeague = false;
        const lowerLeague = leagueName.toLowerCase();
        for (const match of topMatches) {
            if (lowerLeague.includes(match.contains) && match.checkC.includes(c.toLowerCase())) {
                isTopLeague = true;
                break;
            }
        }

        if (isTopLeague) {
            topLeaguesHtml.push(`
                <li class="rounded-md overflow-hidden">
                    <button class="w-full flex items-center gap-3 px-3 py-2 text-left text-[13px] font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors sidebar-league-btn" data-league-target="${leagueName}">
                        <img src="${leagueData.logo}" class="w-4 h-4 object-contain">
                        <span class="truncate">${leagueName}</span>
                    </button>
                </li>
            `);
        }
    }

    const topListEl = document.getElementById('topCompetitionsList');
    if (topListEl) {
        topListEl.innerHTML = topLeaguesHtml.length > 0 ? topLeaguesHtml.join('') : '<li class="py-2 text-center text-xs text-slate-500">Aucune</li>';
    }

    const countriesHtml = [];
    Object.keys(countriesMap).sort().forEach(country => {
        const cLeagues = countriesMap[country];
        const countryId = 'country-' + country.replace(/\s+/g, '-').toLowerCase();

        let leaguesHtml = '';
        cLeagues.forEach(l => {
            leaguesHtml += `
                <button class="w-full flex items-center gap-2 pl-9 pr-3 py-1.5 text-left text-[11.5px] font-medium text-slate-400 hover:text-white transition-colors sidebar-league-btn" data-league-target="${l.name}">
                    <span class="truncate">${l.name}</span>
                </button>
            `;
        });

        countriesHtml.push(`
            <div class="mb-1">
                <button class="w-full flex justify-between items-center px-3 py-2 text-left text-[13px] font-medium text-slate-300 hover:bg-slate-800 hover:text-white rounded-md transition-colors" onclick="toggleAccordion('${countryId}', true)">
                    <span class="truncate">${country}</span>
                    <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-500 transition-transform duration-300 transform rotate-180" id="icon-${countryId}"></i>
                </button>
                <div id="${countryId}" class="flex-col gap-0.5 mt-0.5 origin-top transition-all collapsed" style="display: none;">
                    ${leaguesHtml}
                </div>
            </div>
        `);
    });

    const countriesEl = document.getElementById('countriesAccordion');
    if (countriesEl) {
        countriesEl.innerHTML = countriesHtml.length > 0 ? countriesHtml.join('') : '<div class="py-2 text-center text-xs text-slate-500">Aucun</div>';
    }

    // Attach click events for scrolling
    setTimeout(() => {
        document.querySelectorAll('.sidebar-league-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetLeague = e.currentTarget.getAttribute('data-league-target');
                const targetId = 'league-section-' + targetLeague.replace(/\s+/g, '');
                const targetEl = document.getElementById(targetId);

                // Force All Filter implicitly so it's not hidden
                const allBtn = document.querySelector('.status-btn[data-status="all"]');
                if (allBtn) allBtn.click();

                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    // Highlight flash effect
                    targetEl.classList.add('ring-2', 'ring-sofa_blue_light');
                    setTimeout(() => targetEl.classList.remove('ring-2', 'ring-sofa_blue_light'), 1500);

                    // Auto-close sidebar on mobile
                    if (window.innerWidth < 768) {
                        const closeBtn = document.getElementById('closeSidebarBtn');
                        if (closeBtn) closeBtn.click();
                    }
                }
            });
        });
        lucide.createIcons();
    }, 50);
}

function toggleAccordion(id, isDisplayNone = false) {
    const el = document.getElementById(id);
    const icon = document.getElementById('icon-' + id);
    if (!el || !icon) return;

    el.classList.toggle('collapsed');
    if (el.classList.contains('collapsed')) {
        if (isDisplayNone) {
            icon.style.transform = 'rotate(180deg)';
            el.style.display = 'none';
        } else {
            icon.style.transform = 'rotate(-90deg)';
        }
    } else {
        icon.style.transform = 'rotate(0deg)';
        if (isDisplayNone) {
            el.style.display = 'flex';
        }
    }
}

// Modal Logic
function openAnalysisModal(fixtureId, homeName, awayName, element) {
    const modal = document.getElementById('analysisModal');
    const backdrop = document.getElementById('modalBackdrop');
    const panel = document.getElementById('modalPanel');

    // UI Resets
    modal.classList.remove('hidden');
    // Mini delay for CSS transition
    setTimeout(() => {
        backdrop.classList.add('show');
        panel.classList.add('show');
    }, 10);

    document.getElementById('modalTitle').textContent = `Analyse : ${homeName} vs ${awayName}`;
    document.getElementById('modalSkeleton').classList.remove('hidden');
    document.getElementById('modalContent').classList.add('hidden');

    fetchAnalysisData(fixtureId, element);
}

function openDuelModal(homeTeam, awayTeam, duelDate) {
    const modal = document.getElementById('analysisModal');
    const backdrop = document.getElementById('modalBackdrop');
    const panel = document.getElementById('modalPanel');

    // UI Resets
    modal.classList.remove('hidden');
    setTimeout(() => {
        backdrop.classList.add('show');
        panel.classList.add('show');
    }, 10);

    document.getElementById('modalTitle').textContent = `Face-à-face : ${homeTeam.name} vs ${awayTeam.name}`;
    document.getElementById('modalSkeleton').classList.remove('hidden');
    document.getElementById('modalContent').classList.add('hidden');

    fetchDuelAnalysisData(homeTeam, awayTeam, duelDate);
}

async function fetchDuelAnalysisData(homeTeam, awayTeam, duelDate) {
    try {
        const dateParam = duelDate ? `&date=${encodeURIComponent(duelDate)}` : '';
        const url = `/api/analysis/duel?homeTeamId=${homeTeam.id}&awayTeamId=${awayTeam.id}&homeName=${encodeURIComponent(homeTeam.name)}&awayName=${encodeURIComponent(awayTeam.name)}&homeLogo=${encodeURIComponent(homeTeam.logo || '')}&awayLogo=${encodeURIComponent(awayTeam.logo || '')}${dateParam}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Erreur serveur");
        }

        const analysis = data.data || data;

        populateModalData(analysis);

        document.getElementById('modalSkeleton').classList.add('hidden');
        document.getElementById('modalContent').classList.remove('hidden');
    } catch (error) {
        document.getElementById('modalSkeleton').innerHTML = `<p class="text-red-400 text-center py-10">Erreur lors de l'analyse du duel: ${error.message}</p>`;
    }
}

function closeModal() {
    const backdrop = document.getElementById('modalBackdrop');
    const panel = document.getElementById('modalPanel');

    backdrop.classList.remove('show');
    panel.classList.remove('show');

    setTimeout(() => {
        document.getElementById('analysisModal').classList.add('hidden');

        // --- UX SYNC HARMONY ---
        // Silently update the right history panel when the user finishes viewing
        // an analysis. This instantly ports "À Venir" matches to "En Cours" if they started while reading.
        if (typeof fetchHistoryData === 'function') {
            fetchHistoryData();
        }
    }, 300);
}

async function fetchAnalysisData(fixtureId, element) {
    try {
        const response = await fetch(`http://localhost:10000/api/analysis/${fixtureId}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Erreur serveur");
        }

        // Le Backend renvoie généralement un { message, data } s'il vient de la BD
        const analysis = data.data || data;

        if (element) {
            const timeSpan = element.querySelector('.live-minute-pulse');
            if (timeSpan && analysis.isLive) {
                const ts = timeSpan.getAttribute('data-live-ts');
                if (ts) {
                    analysis.match_info.live_timestamp = ts;
                    analysis.match_info.live_initial = timeSpan.getAttribute('data-live-init') || 0;
                    analysis.match_info.live_minute = timeSpan.innerText.replace('🔴', '').trim();
                } else if (!timeSpan.innerText.includes('MT') && !timeSpan.innerText.toLowerCase().includes('fin')) {
                    analysis.match_info.live_minute = timeSpan.innerText.replace('🔴', '').trim();
                } else if (timeSpan.innerText.includes('MT')) {
                    analysis.match_info.live_minute = 'MT';
                }
            } else if (element.getAttribute('data-match-status') === 'finished') {
                analysis.isLive = false;
                analysis.match_info.live_minute = "FIN";
            }
        }

        populateModalData(analysis);

        document.getElementById('modalSkeleton').classList.add('hidden');
        document.getElementById('modalContent').classList.remove('hidden');
    } catch (error) {
        document.getElementById('modalSkeleton').innerHTML = `<p class="text-red-400 text-center py-10">Erreur lors du scan: ${error.message}</p>`;
    }
}

function populateModalData(data) {
    const info = data.match_info;
    const preds = data.predictions;
    const ctx = data.standings_context;

    // Header Match
    const liveBanner = document.getElementById('liveAlertBanner');
    if (liveBanner) {
        if (data.isLive) {
            liveBanner.classList.remove('hidden');
            const minuteText = info.live_minute ? info.live_minute : 'en cours';
            document.getElementById('liveAlertMinuteText').textContent = `Le système a pris en compte la minute (${minuteText}), le score et la dynamique actuelle du match.`;
        } else {
            liveBanner.classList.add('hidden');
        }
    }

    document.getElementById('mLeague').textContent = info.league;
    // Format the date to beautiful French or show Live Time
    try {
        if (data.isLive) {
            let minDisp = info.live_minute ? info.live_minute : '';
            const dataTs = info.live_timestamp ? `data-live-ts="${info.live_timestamp}" data-live-init="${info.live_initial || 0}"` : '';
            document.getElementById('mDate').innerHTML = `<span class="text-red-500 font-bold"><span class="live-minute-pulse animate-pulse" ${dataTs}>🔴 EN DIRECT ${minDisp}</span></span>`;
        } else {
            const d = new Date(info.date.replace(' ', 'T'));
            const fDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(d);
            document.getElementById('mDate').textContent = fDate.replace(':', 'h');
        }
    } catch (e) {
        document.getElementById('mDate').textContent = info.date;
    }
    document.getElementById('mHomeName').textContent = info.home.name;
    document.getElementById('mAwayName').textContent = info.away.name;
    document.getElementById('mHomeLogo').src = info.home.logo;
    document.getElementById('mAwayLogo').src = info.away.logo;

    // Tab 1: Predictions
    const predContainer = document.getElementById('predictionsContainer');
    predContainer.innerHTML = '';

    // IA Speech Rendering
    const speechElement = document.getElementById('aiSpeechText');
    const speechContainer = document.getElementById('aiSpeechContainer');
    if (ctx.speech) {
        speechElement.textContent = ctx.speech;
        speechContainer.classList.remove('hidden');
    } else {
        speechContainer.classList.add('hidden');
    }

    // Group predictions by category
    const groupedPreds = {};
    preds.forEach(p => {
        const cat = p.category || p.tag || 'Général'; // Fallback
        if (!groupedPreds[cat]) groupedPreds[cat] = [];
        groupedPreds[cat].push(p);
    });

    // Generate Sub-Tabs Header (Premium UI)
    // Using flex-wrap so all options are instantly visible on mobile instead of requiring a horizontal swipe
    let subTabsHTML = `<div class="flex flex-wrap items-center gap-2 mb-6 pb-4 border-b border-white/5">`;
    let isFirst = true;
    for (const cat in groupedPreds) {
        // Skip categories completely if empty
        if (!groupedPreds[cat] || groupedPreds[cat].length === 0) continue;

        let isLiveCat = cat === '🔥 Alerte en Direct';
        let btnClasses = isFirst
            ? 'bg-sofa_blue/20 text-sofa_blue_light border-sofa_blue_light shadow-[0_0_15px_rgba(59,130,246,0.2)]'
            : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-white opacity-70 hover:opacity-100';

        if (isLiveCat && isFirst) {
            btnClasses = 'bg-red-900/40 text-red-400 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse';
        } else if (isLiveCat) {
            btnClasses = 'bg-red-900/10 text-red-500 border-red-900/30 hover:bg-red-900/30 hover:border-red-500 transition-all opacity-70 hover:opacity-100';
        }

        subTabsHTML += `
            <button class="sub-tab-btn px-5 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap transition-all duration-300 border backdrop-blur-sm snap-start shrink-0 flex items-center gap-2 ${btnClasses}" onclick="switchSubTab('${cat.replace(/[^a-zA-Z0-9]/g, '_')}', this)" data-cat="${cat}">
                ${cat === 'Général' ? '<i data-lucide="layers" class="w-4 h-4"></i>' : ''}
                ${cat}
            </button>
        `;

        // Only toggle isFirst AFTER successfully putting a button in the UI
        isFirst = false;
    }
    subTabsHTML += `</div>`;

    // Generate Sub-Tabs Content
    let subContentsHTML = `<div class="relative">`;
    isFirst = true;
    for (const [cat, items] of Object.entries(groupedPreds)) {
        if (!items || items.length === 0) continue; // Skip generating content for empty categories

        // Enforce strong gaps and strict 1-column mobile to prevent text clipping on tiny screens
        subContentsHTML += `<div id="subtab-${cat.replace(/[^a-zA-Z0-9]/g, '_')}" class="sub-tab-content grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 ${isFirst ? 'block animate-fade-in' : 'hidden'}">`;

        items.forEach(p => {
            // Gradient/Color logic based on confidence (No Tiers)
            let colors = '';
            let icon = '';
            let confText = p.confidence ? `${p.confidence}%` : 'N/A';

            if (p.is_live) { colors = 'bg-red-900/20 border-red-600 text-red-400 shadow-[0_0_15px_rgba(220,38,38,0.2)]'; icon = 'radio'; }
            else if (p.confidence >= 70) { colors = 'bg-green-900/10 border-green-500/50 text-green-400'; icon = 'shield-check'; }
            else if (p.confidence >= 50) { colors = 'bg-yellow-900/10 border-yellow-500/50 text-yellow-400'; icon = 'target'; }
            else { colors = 'bg-red-900/10 border-red-500/50 text-red-400'; icon = 'dice-5'; }

            // Override Icon based on exact Category
            if (cat === 'Pénalty') icon = 'circle-dot';
            if (cat === 'Buts') icon = 'flame';
            if (cat === 'Mi-Temps / Périodes') icon = 'clock';
            if (cat === 'Score') icon = 'crosshair';
            if (cat === 'Buteurs & Joueurs') icon = 'user';
            if (cat === 'Cartons & Discipline') icon = 'square';
            if (cat === 'Corners') icon = 'flag-triangle-right';
            if (cat === 'Statistiques et timing') icon = 'bar-chart-2';

            subContentsHTML += `
                <div class="border ${colors} rounded-xl p-4 relative overflow-hidden shadow-sm hover:border-sofa_blue transition-colors">
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-[#121212]/80 uppercase tracking-widest ${p.is_live ? 'text-red-400 border border-red-900' : 'text-[#a8a8a8] border border-[#333333]'}">${p.is_live ? 'EN DIRECT' : 'PRONOSTIC'}</span>
                        <span class="text-xs font-mono font-bold bg-[#121212] px-2 py-1 rounded text-white shadow-inner border ${p.is_live ? 'border-red-900' : 'border-[#333333]'}">Confiance : ${confText}</span>
                    </div>
                    
                    <h4 class="text-white text-[15px] md:text-[16px] font-bold mt-3 mb-1 flex items-start gap-2 leading-tight break-words">
                        <i data-lucide="${icon}" class="w-4 h-4 mt-0.5 shrink-0 ${p.is_live ? 'animate-pulse' : ''}"></i>
                        <span class="flex-1">${p.selection}</span>
                    </h4>
                    <p class="text-[13px] text-[#a8a8a8] mb-4 block font-medium break-words">${p.market}</p>
                    
                    <div class="text-[12px] text-slate-500 space-y-1.5 mt-3 pt-3 border-t border-[#333333] leading-snug">
                        <p><i data-lucide="brain" class="w-3 h-3 inline text-slate-400"></i> ${p.justification?.mirror_scan || p.justification || 'N/A'}</p>
                    </div>
                 </div>
            `;
        });
        subContentsHTML += `</div>`;

        // Only toggle isFirst AFTER successfully putting content in the UI
        isFirst = false;
    }
    subContentsHTML += `</div>`;

    predContainer.innerHTML = subTabsHTML + subContentsHTML;

    // Attach switch function globally if not exists
    if (!window.switchSubTab) {
        window.switchSubTab = function (targetId, btnEl) {
            // Hide all contents
            document.querySelectorAll('.sub-tab-content').forEach(el => {
                el.classList.add('hidden');
                el.classList.remove('animate-fade-in');
            });

            // Remove active classes to Glassmorphism base
            document.querySelectorAll('.sub-tab-btn').forEach(btn => {
                const cat = btn.getAttribute('data-cat') || btn.textContent;
                if (cat.includes('🔥')) {
                    btn.className = "sub-tab-btn px-5 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap transition-all duration-300 border backdrop-blur-sm snap-start shrink-0 flex items-center gap-2 bg-red-900/10 text-red-500 border-red-900/30 hover:bg-red-900/30 hover:border-red-500 opacity-70 hover:opacity-100";
                } else {
                    btn.className = "sub-tab-btn px-5 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap transition-all duration-300 border backdrop-blur-sm snap-start shrink-0 flex items-center gap-2 bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-white opacity-70 hover:opacity-100";
                }
            });

            // Show target with bounce effect
            const targetContent = document.getElementById('subtab-' + targetId);
            if (targetContent) {
                targetContent.classList.remove('hidden');
                targetContent.classList.add('animate-fade-in');
            }

            // Set active class to glowing state
            if (btnEl) {
                const cat = btnEl.getAttribute('data-cat') || btnEl.textContent;
                if (cat.includes('🔥')) {
                    btnEl.className = "sub-tab-btn px-5 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap transition-all duration-300 border backdrop-blur-sm snap-start shrink-0 flex items-center gap-2 bg-red-900/40 text-red-400 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse opacity-100";
                } else {
                    btnEl.className = "sub-tab-btn px-5 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap transition-all duration-300 border backdrop-blur-sm snap-start shrink-0 flex items-center gap-2 bg-sofa_blue/20 text-sofa_blue_light border-sofa_blue_light shadow-[0_0_15px_rgba(59,130,246,0.2)] opacity-100";
                }
            }
        };
    }

    // Tab 2: Context
    document.getElementById('ctxNarrative').textContent = ctx.narrative || 'Aucun narratif disponible.';
    document.getElementById('ctxMirror').textContent = data.mirror_scan_report || 'Analyse miroir non disponible.';

    document.getElementById('ctxHomeName').textContent = info.home.name;
    document.getElementById('ctxAwayName').textContent = info.away.name;

    const hScore = ctx.home_enjeu_score || 5;
    const aScore = ctx.away_enjeu_score || 5;

    document.getElementById('ctxHomeScore').textContent = `${hScore}/10`;
    document.getElementById('ctxAwayScore').textContent = `${aScore}/10`;

    // Animation barres Timeout
    setTimeout(() => {
        document.getElementById('ctxHomeBar').style.width = `${(hScore / 10) * 100}%`;
        document.getElementById('ctxAwayBar').style.width = `${(aScore / 10) * 100}%`;
    }, 100);

    lucide.createIcons();
}

// ----------------------------------------------------
// PHASE 3: HISTORY & TRACK RECORD
// ----------------------------------------------------

let globalHistoryData = [];
let currentHistoryTab = 'completed'; // default tab

async function fetchHistoryData() {
    const listContainer = document.getElementById('historyListContainer');
    document.getElementById('historyTotalCount').textContent = '...';

    listContainer.innerHTML = `
        <div class="flex w-full justify-center py-10 col-span-full">
            <i data-lucide="loader-2" class="w-8 h-8 animate-spin text-slate-500"></i>
        </div>
    `;
    lucide.createIcons();

    try {
        const response = await fetch('http://localhost:10000/api/analysis/history?cb=' + Date.now());
        if (!response.ok) throw new Error("Erreur réseau");

        const historyResponse = await response.json();
        globalHistoryData = historyResponse.data || [];
        renderHistory(historyResponse);
    } catch (error) {
        listContainer.innerHTML = `
            <div class="col-span-full bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-lg text-center">
                Impossible de charger l'historique : ${error.message}
            </div>
        `;
    }
}

function renderHistory(historyData) {
    const listContainer = document.getElementById('historyListContainer');
    listContainer.innerHTML = '';

    const allRecords = historyData.data || historyData || [];
    const completedRecords = [];
    const pendingRecords = [];
    const notstartedRecords = [];

    // Triage Terminés vs En Cours vs À Venir
    allRecords.forEach(r => {
        const s = r.actual_result ? r.actual_result.status : 'PENDING';

        // Les Duels Personnalisés tombent naturellement ici (PENDING => notstartedRecords / À Venir)
        // jusqu'à ce qu'ils aient un éventuel status COMPLETED.
        if (s === 'COMPLETED') completedRecords.push(r);
        else if (s === 'INPROGRESS' || s === 'LIVE') pendingRecords.push(r);
        else notstartedRecords.push(r);
    });

    // Notification Pastille Rouge
    const badge = document.getElementById('historyPendingBadge');
    if (badge) {
        if (pendingRecords.length > 0) badge.classList.remove('hidden');
        else badge.classList.add('hidden');
    }

    let records = [];
    if (currentHistoryTab === 'completed') records = completedRecords;
    else if (currentHistoryTab === 'pending') records = pendingRecords;
    else records = notstartedRecords;

    document.getElementById('historyTotalCount').textContent = records.length;

    if (records.length === 0) {
        let msg = 'Aucun match terminé récent.';
        if (currentHistoryTab === 'pending') msg = 'Aucun match en cours.';
        if (currentHistoryTab === 'notstarted') msg = 'Aucun match à venir.';
        listContainer.innerHTML = `
            <div class="col-span-full text-center py-10 text-slate-400 bg-slate-800/50 rounded-xl border border-dashed border-slate-700">
                ${msg}
            </div>
        `;
    }

    // Global Stats MUST be calculated on completed records to be accurate
    let totalEvaluated = 0;
    let totalWon = 0;

    completedRecords.forEach(record => {
        if (record.ai_predictions && record.ai_predictions.length > 0) {
            record.ai_predictions.forEach(p => {
                const isWon = p.is_won;
                if (isWon === true) { totalEvaluated++; totalWon++; }
                else if (isWon === false) { totalEvaluated++; }
            });
        } else if (record.predictions_evaluation && record.predictions_evaluation.top_pred_won !== undefined) {
            const isWon = record.predictions_evaluation.top_pred_won;
            if (isWon === true) { totalEvaluated++; totalWon++; }
            else if (isWon === false) { totalEvaluated++; }
        }
    });

    records.forEach(record => {
        const info = record.match_info || {};
        const isDuel = info.league === 'Duel Personnalisé';

        // Determiner si on a le vrai score (Phase 4 future) ou Live
        const status = record.actual_result ? record.actual_result.status : 'PENDING';
        const hasResult = status === 'COMPLETED' || status === 'INPROGRESS';

        let resultBadge = `<span class="text-xs bg-yellow-900/30 text-yellow-500 font-mono px-2 py-1 rounded border border-yellow-800/50">En Attente</span>`;

        let htBadge = '';
        let historyStatusData = 'notstarted';

        if (status === 'COMPLETED') {
            historyStatusData = 'finished';
        } else if (status === 'INPROGRESS') {
            historyStatusData = 'inprogress';
        }

        if (record.actual_result && record.actual_result.home_goals_ht !== undefined && record.actual_result.home_goals_ht !== null) {
            const h1 = record.actual_result.home_goals_ht;
            const a1 = record.actual_result.away_goals_ht;
            htBadge = `<div class="text-[10px] text-slate-400 font-medium mt-1 text-right flex gap-2 justify-end"><span>1ère MT: ${h1} - ${a1}</span>`;

            if (status === 'COMPLETED' || status === 'INPROGRESS') {
                const liveMin = record.actual_result.live_minute || '';
                // N'afficher la 2eme MT que si elle a commencé
                if (status === 'COMPLETED' || liveMin.includes('2ème') || parseInt(liveMin) > 45) {
                    const h2 = Math.max(0, record.actual_result.home_goals - h1);
                    const a2 = Math.max(0, record.actual_result.away_goals - a1);
                    htBadge += `<span class="border-l border-slate-600 pl-2">2ème MT: ${h2} - ${a2}</span>`;
                }
            }
            htBadge += `</div>`;
        }

        if (status === 'COMPLETED') {
            resultBadge = `<div class="flex flex-col items-end"><span class="text-xs bg-black/40 text-slate-300 font-mono px-2 py-1 rounded border border-white/10 backdrop-blur-sm">Score: ${record.actual_result.home_goals} - ${record.actual_result.away_goals}</span>${htBadge}</div>`;
        } else if (status === 'INPROGRESS') {
            const liveMin = record.actual_result.live_minute || 'En Cours';
            const dataTs = record.actual_result.live_timestamp ? `data-live-ts="${record.actual_result.live_timestamp}" data-live-init="${record.actual_result.live_initial || 0}"` : '';
            resultBadge = `<div class="flex items-center gap-2"><span class="live-minute-pulse text-xs font-bold text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.8)] animate-pulse" ${dataTs}>🔴 ${liveMin}</span><div class="flex flex-col items-end"><span class="text-xs bg-red-500/20 text-red-200 font-mono px-2 py-1 rounded border border-red-500/30 backdrop-blur-sm">${record.actual_result.home_goals} - ${record.actual_result.away_goals}</span>${htBadge}</div></div>`;
        }

        // Fin In-loop Evaluation logic removed

        let predictionsHTML = '';
        if (record.ai_predictions && record.ai_predictions.length > 0) {
            record.ai_predictions.forEach(pred => {
                let pBgColor = 'bg-slate-900/50';
                let pTextColor = 'text-accent_gold';
                let pIcon = '<i data-lucide="shield-check" class="w-4 h-4"></i>';

                if (hasResult) {
                    let isWon = pred.is_won;
                    if (isWon === undefined && record.predictions_evaluation && record.predictions_evaluation.top_pred_won !== undefined) {
                        isWon = record.predictions_evaluation.top_pred_won; // Fallback legacy
                    }
                    if (isWon === true) {
                        pBgColor = 'bg-green-900/30';
                        pTextColor = 'text-green-400';
                        pIcon = '<i data-lucide="check-circle-2" class="w-4 h-4"></i>';
                    } else if (isWon === false) {
                        pBgColor = 'bg-red-900/30';
                        pTextColor = 'text-red-400 line-through opacity-70';
                        pIcon = '<i data-lucide="x-circle" class="w-4 h-4"></i>';
                    } else {
                        if (status === 'INPROGRESS') {
                            pIcon = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin text-accent_gold"></i>';
                        } else if (status === 'COMPLETED') {
                            pBgColor = 'bg-slate-700/30';
                            pTextColor = 'text-slate-400';
                            pIcon = '<i data-lucide="help-circle" class="w-4 h-4"></i>';
                        }
                    }
                }

                predictionsHTML += `
                    <div class="${pBgColor} p-2 rounded ${pTextColor} text-[11px] font-semibold flex items-center justify-between gap-1 transition-colors mb-0.5">
                        <span class="truncate pr-1">${pred.category || pred.market} : ${pred.selection}</span>
                        <div class="flex items-center gap-1 shrink-0">
                            <span>${pred.confidence}%</span>
                            ${pIcon}
                        </div>
                    </div>
                `;
            });
        } else {
            predictionsHTML = `<div class="bg-slate-900/50 p-2 rounded text-slate-400 text-xs text-center">Aucune prédiction disponible</div>`;
        }

        // Créer la carte
        const cardContainer = document.createElement('div');
        cardContainer.className = 'history-item bg-[#18181b]/60 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden hover:border-white/20 hover:shadow-[0_0_15px_rgba(99,102,241,0.2)] transition-all duration-300 flex flex-col';
        cardContainer.setAttribute('data-match-status', historyStatusData);

        // Header Carte
        cardContainer.innerHTML = `
            <div class="bg-black/20 px-4 py-3 flex justify-between items-center border-b border-white/5">
                <div class="flex items-center gap-2">
                    <i data-lucide="${isDuel ? 'swords' : 'calendar-days'}" class="w-4 h-4 text-slate-400"></i>
                    <span class="text-xs text-slate-400 uppercase tracking-wide truncate w-32">${info.league || 'inconnu'}</span>
                </div>
                ${resultBadge}
            </div>
            
            <div class="p-4 flex-1 flex flex-col justify-center">
                <div class="flex justify-between items-center font-bold text-white mb-2">
                    <span class="truncate w-1/3 text-right">${info.home_name || 'Dom'}</span>
                    <span class="text-slate-500 text-sm font-mono px-2">VS</span>
                    <span class="truncate w-1/3">${info.away_name || 'Ext'}</span>
                </div>
                
                <div class="mt-4 pt-4 border-t border-slate-700/50">
                    <p class="text-[10px] text-slate-400 mb-1.5 uppercase tracking-wide font-semibold">Toutes les options :</p>
                    <div class="flex flex-col gap-0.5">
                        ${predictionsHTML}
                    </div>
                </div>
            </div>
            
            <div class="flex gap-2 w-full mt-2">
                <button onclick="openTrackRecordModal('${record._id}', this.closest('.history-item'))" class="flex-1 bg-white/5 hover:bg-sofa_blue/20 text-sofa_blue_light rounded font-bold text-xs py-2.5 transition-all flex justify-center items-center gap-2 border border-white/5">
                    Voir complet <i data-lucide="arrow-right" class="w-3 h-3"></i>
                </button>
                <button onclick="deleteHistoryRecord('${record._id}', this.closest('.history-item'))" class="w-10 shrink-0 bg-red-900/10 hover:bg-red-900/50 text-red-500 rounded flex justify-center items-center transition-all border border-red-900/30">
                    <i data-lucide="trash-2" class="w-4 h-4 text-red-500"></i>
                </button>
            </div>
        `;

        listContainer.appendChild(cardContainer);
    });

    // --- Calcul du Taux de Réussite (Winrate) ---
    const winrateUI = document.getElementById('globalWinrateUI');
    const lossrateUI = document.getElementById('globalLossrateUI');

    if (totalEvaluated > 0) {
        const winratePercentage = Math.round((totalWon / totalEvaluated) * 100);
        const lossratePercentage = 100 - winratePercentage;

        // Winrate Colors
        let winrateColor = 'text-yellow-500';
        if (winratePercentage >= 70) winrateColor = 'text-green-400';
        if (winratePercentage < 50) winrateColor = 'text-red-400';

        // Lossrate Colors
        let lossrateColor = 'text-yellow-500';
        if (lossratePercentage >= 50) lossrateColor = 'text-red-400';
        if (lossratePercentage < 30) lossrateColor = 'text-green-400';

        winrateUI.innerHTML = `<span class="${winrateColor}">${winratePercentage}%</span>`;
        if (lossrateUI) lossrateUI.innerHTML = `<span class="${lossrateColor}">${lossratePercentage}%</span>`;
    } else {
        winrateUI.innerHTML = `<span class="text-slate-500">--%</span>`;
        if (lossrateUI) lossrateUI.innerHTML = `<span class="text-slate-500">--%</span>`;
    }

    lucide.createIcons();

    // Appliquer le filtre actif actuel aux nouvelles cartes d'historique
    const activeFilterBtn = document.querySelector('.status-btn.active');
    if (activeFilterBtn) {
        // filterMatches n'est pas exposée globalement dans ce snippet, mais comme on est au même niveau, ça marchera
        // Wait, filterMatches est défini dans le DOMContentLoaded.
        // On va dispatcher un click sur le bouton actif pour forcer le refiltre de tout le DOM.
        activeFilterBtn.click();
    }
}

// Fonction pour ouvrir les détails de l'archive (Relie l'Historique à la Modal Principale)
window.openTrackRecordModal = function (dbId, element) {
    const record = globalHistoryData.find(r => r._id === dbId);
    if (!record || !record.raw_response) {
        alert("Archive introuvable ou trop ancienne pour cette version de l'interface.");
        return;
    }

    const rawData = JSON.parse(JSON.stringify(record.raw_response));
    if (record.actual_result) {
        if (record.actual_result.status === 'COMPLETED') {
            rawData.isLive = false;
            rawData.match_info.live_minute = "Terminé";
        } else if (record.actual_result.status === 'INPROGRESS') {
            rawData.match_info.live_timestamp = record.actual_result.live_timestamp;
            rawData.match_info.live_initial = record.actual_result.live_initial;
            if (element) {
                const timeSpan = element.querySelector('.live-minute-pulse');
                if (timeSpan) {
                    rawData.match_info.live_minute = timeSpan.innerText.replace('🔴', '').trim();
                }
            } else {
                rawData.match_info.live_minute = record.actual_result.live_minute || "En Cours";
            }
        }
    }

    const modal = document.getElementById('analysisModal');
    const backdrop = document.getElementById('modalBackdrop');
    const panel = document.getElementById('modalPanel');

    // UI Resets
    modal.classList.remove('hidden');
    setTimeout(() => {
        backdrop.classList.add('show');
        panel.classList.add('show');
    }, 10);

    const info = record.raw_response.match_info;
    document.getElementById('modalTitle').textContent = `Archive : ${info.home.name} vs ${info.away.name}`;

    // Hide skeleton and show content directly since we already have the data locally
    document.getElementById('modalSkeleton').classList.add('hidden');
    document.getElementById('modalContent').classList.remove('hidden');

    populateModalData(rawData);
}

// --- GLOBAL LIVE TIMER TICKER ---
// Chronomètre exact synchronisé à la seconde sur le timestamp réseau UNIX natif (Sofascore)
setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    document.querySelectorAll('.live-minute-pulse').forEach(el => {
        const ts = el.getAttribute('data-live-ts');
        const currentText = el.innerText;

        // Safety lock, if text is MT somehow, don't execute timer
        if (currentText === 'MT' || currentText === 'MT PROL.' || currentText.includes('FIN') || currentText.includes('T.A.B.')) return;

        if (ts) {
            const initial = parseInt(el.getAttribute('data-live-init') || '0', 10);
            const desc = el.getAttribute('data-live-desc') || '';
            let elapsed = now - parseInt(ts, 10);
            if (elapsed < 0) elapsed = 0;
            const totalSeconds = elapsed + initial;
            let m = Math.floor(totalSeconds / 60);
            const s = totalSeconds % 60;

            // Handle Temps Additionnel (Stoppage Time) - STRICT SYNC WITH SOFASCORE PERIODS
            let formatted;
            if (desc === '1st half' && m >= 45) {
                formatted = `45+${m - 45}:${s.toString().padStart(2, '0')}`;
            } else if (desc === '2nd half' && m >= 90) {
                formatted = `90+${m - 90}:${s.toString().padStart(2, '0')}`;
            } else if (desc === '1st extra' && m >= 105) {
                formatted = `105+${m - 105}:${s.toString().padStart(2, '0')}`;
            } else if (desc === '2nd extra' && m >= 120) {
                formatted = `120+${m - 120}:${s.toString().padStart(2, '0')}`;
            } else {
                formatted = `${m}:${s.toString().padStart(2, '0')}`;
            }

            const prefix = currentText.includes('🔴') ? '🔴 ' : '';
            el.innerText = prefix + formatted;
        }
    });
}, 1000);

// --- AUTO-ROUTING HISTORY ENGINE (A Venir -> En Cours) ---
// Scans the globalHistoryData every 30 seconds.
// If a match is scheduled in the past according to local time, 
// artificially shift its status to INPROGRESS to move it to the LIVE tab.
setInterval(() => {
    if (!globalHistoryData || globalHistoryData.length === 0) return;

    let needsRerender = false;
    const now = new Date().getTime();

    globalHistoryData.forEach(record => {
        const info = record.match_info || {};
        const statusObj = record.actual_result || {};
        const s = statusObj.status || 'PENDING';
        const isDuel = info.league === 'Duel Personnalisé';

        // Is it mathematically NOTSTARTED?
        if (!isDuel && s !== 'COMPLETED' && s !== 'INPROGRESS' && s !== 'LIVE') {
            if (info.date) {
                // Example info.date format: "2024-05-18T19:00:00.000Z"
                const kickoffTime = new Date(info.date.replace(' ', 'T')).getTime();

                // If we've passed the kickoff time by at least 1 minute (60000ms)
                if (now > (kickoffTime + 60000)) {
                    if (!record.actual_result) record.actual_result = {};
                    record.actual_result.status = 'INPROGRESS';
                    record.actual_result.live_minute = "Coup d'envoi éminent"; // Beautiful proxy status
                    needsRerender = true;
                }
            }
        }
    });

    if (needsRerender) {
        renderHistory({ data: globalHistoryData });
    }
}, 30000); // 30 seconds

// --- CUSTOM UI DELETE HOOK ---
let pendingDeleteId = null;
let pendingDeleteElement = null;

window.deleteHistoryRecord = function (dbId, element) {
    pendingDeleteId = dbId;
    pendingDeleteElement = element;

    const popup = document.getElementById('deleteConfirmModal');
    const backdrop = document.getElementById('deleteConfirmBackdrop');
    const panel = document.getElementById('deleteConfirmPanel');
    if (!popup) return;

    popup.classList.remove('hidden');
    popup.classList.add('flex');
    setTimeout(() => {
        backdrop.classList.replace('opacity-0', 'opacity-100');
        panel.classList.replace('scale-95', 'scale-100');
        panel.classList.replace('opacity-0', 'opacity-100');
    }, 10);
};

window.closeDeleteModal = function () {
    const popup = document.getElementById('deleteConfirmModal');
    const backdrop = document.getElementById('deleteConfirmBackdrop');
    const panel = document.getElementById('deleteConfirmPanel');
    if (!popup) return;

    backdrop.classList.replace('opacity-100', 'opacity-0');
    panel.classList.replace('scale-100', 'scale-95');
    panel.classList.replace('opacity-100', 'opacity-0');

    setTimeout(() => {
        popup.classList.add('hidden');
        popup.classList.remove('flex');
        pendingDeleteId = null;
        pendingDeleteElement = null;
    }, 300);
};

// Bind logic once DOM is parsed
setTimeout(() => {
    const cancelBtn = document.getElementById('cancelDeleteBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', window.closeDeleteModal);

    const confirmBtn = document.getElementById('confirmDeleteBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            if (!pendingDeleteId || !pendingDeleteElement) return;
            const dbId = pendingDeleteId;
            const element = pendingDeleteElement;

            // Visual loading
            confirmBtn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin mx-auto"></i>';
            confirmBtn.disabled = true;

            try {
                const response = await fetch('http://localhost:10000/api/analysis/history/' + dbId, { method: 'DELETE' });
                if (!response.ok) throw new Error("Erreur serveur");

                globalHistoryData = globalHistoryData.filter(r => r._id !== dbId);

                element.style.transform = 'scale(0.9)';
                element.style.opacity = '0';
                setTimeout(() => {
                    element.remove();
                    renderHistory({ data: globalHistoryData });
                }, 300);

                window.closeDeleteModal();

            } catch (error) {
                confirmBtn.innerHTML = 'Erreur réseau';
                confirmBtn.classList.replace('bg-red-600', 'bg-slate-600');
                setTimeout(() => {
                    window.closeDeleteModal();
                }, 1500);
            } finally {
                setTimeout(() => {
                    confirmBtn.innerHTML = 'Supprimer';
                    confirmBtn.disabled = false;
                    confirmBtn.classList.replace('bg-slate-600', 'bg-red-600');
                    if (window.lucide) lucide.createIcons();
                }, 1800);
            }
        });
    }
}, 500);

