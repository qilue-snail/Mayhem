(() => {
    'use strict';
    const STORE = 'mayhem-library-v1';
    const DATA_URL = 'https://arammayhem.com/data/v1/latest/augments.json';
    // ARAMMayhem published these Patch 26.23 augments on its augment pages before
    // publishing 26.23 match statistics. Never fabricate pick rates or tier ranks.
    // The public latest/augments.json remains authoritative when it catches up.
    const RELEASED_AUGMENTS = [
        {
            id: 'fortified', name: 'Fortified', rarity: 'silver', introducedPatch: '26.23',
            description: 'Gain 20 Armor, then increase your bonus Armor by 25%.',
            url: 'https://arammayhem.com/augments/fortified/'
        },
        {
            id: 'mystic_guard', name: 'Mystic Guard', rarity: 'silver', introducedPatch: '26.23',
            description: 'Gain 20 Magic Resist, then increase your bonus Magic Resist by 25%.',
            url: 'https://arammayhem.com/augments/mystic-guard/'
        },
        {
            id: 'slime_time', name: 'Slime Time', rarity: 'silver', introducedPatch: '26.23',
            description: 'Every few seconds, Autocast a burst of slime from your body, dealing magic damage to nearby enemies. If you hit a champion, secrete a blob that heals you when walked over.',
            url: 'https://arammayhem.com/augments/slime-time/'
        },
        {
            id: 'steadfaster_presence', name: 'Steadfaster Presence', rarity: 'gold', introducedPatch: '26.23',
            description: "Gain bonus Armor, Magic Resist, and Tenacity. This bonus increases when you're below 40% maximum Health.",
            url: 'https://arammayhem.com/augments/steadfaster-presence/'
        }
    ];
    function patchValue(patch) {
        const [major = 0, minor = 0] = String(patch || '').split('.').map(Number);
        return (Number(major) || 0) * 1000 + (Number(minor) || 0);
    }
    function currentGamePatch() {
        return patchValue(state.patch) >= patchValue('26.23') ? state.patch : '26.23';
    }
    function augmentReleasePending(augment) {
        return augment && augment.introducedPatch === '26.23' && augment.pickRate == null && !augment.retiredPatch;
    }
    function mergeNewReleaseAugments(rows) {
        // Deduplicate by *name* because official augmentId identifiers may differ
        // from these provisional stable IDs. Favor the live public feed entry.
        const merged = [...rows];
        const existingNames = new Set(merged.map(a => slug(a.name)));
        for (const a of RELEASED_AUGMENTS) {
            if (existingNames.has(slug(a.name))) continue;
            merged.push({
                id: a.id, legacyId: a.id, name: a.name, rarity: a.rarity,
                introducedPatch: a.introducedPatch, retiredPatch: null,
                description: '', pickRate: null, pickRateRank: null,
                source: 'new-release', url: a.url
            });
            existingNames.add(slug(a.name));
        }
        return merged;
    }

    const DD = 'https://ddragon.leagueoflegends.com/cdn/';
    const CDRAGON = 'https://raw.communitydragon.org/latest/';
    const CDRAGON_ARENA = CDRAGON + 'cdragon/arena/en_us.json';
    const MAYHEM_ITEMS_URL = 'https://arammayhem.com/data/v1/latest/items.json';
    const ITEM_CACHE = 'mayhem-library-items-v3';
    const HEARTSTEEL_BONUSES = [
        { member: 'Aphelios', effect: '2 Stat Anvils', detail: 'Gain 2 Stat Anvils when you select the stickered augment.' },
        { member: 'Ezreal', effect: '+4 AD and +4 AP per level', detail: 'Gain 4 Attack Damage and 4 Ability Power per champion level.' },
        { member: 'Kayn', effect: '+5% Omnivamp', detail: 'Gain 5% Omnivamp.' },
        { member: "K'Sante", effect: '+1 level and +1 maximum level', detail: 'Immediately gain 1 level and increase your level cap by 1.' },
        { member: 'Sett', effect: '+30 Health per level', detail: 'Gain 30 Health per champion level.' },
        { member: 'Yone', effect: '+40% Attack Speed and +20 Ability Haste', detail: 'Gain 40% Attack Speed and 20 Ability Haste.' }
    ];
    const FALLBACK_ITEMS = [
        ['1001', 'Boots', 'boots_tier1', 300], ['3006', "Berserker's Greaves", 'boots_tier2', 1100], ['3047', 'Plated Steelcaps', 'boots_tier2', 1200], ['3111', "Mercury's Treads", 'boots_tier2', 1200], ['3020', "Sorcerer's Shoes", 'boots_tier2', 1100], ['3084', 'Heartsteel', 'legendary', 3000], ['2510', 'Dusk and Dawn', 'legendary', 3100], ['2522', 'Actualizer', 'legendary', 3100], ['2512', 'Fiendhunter Bolts', 'legendary', 2650], ['124011', 'Sword of Blossoming Dawn', 'legendary', 2350], ['2501', "Overlord's Bloodmail", 'legendary', 3300], ['3146', 'Hextech Gunblade', 'legendary', 3000], ['3078', 'Trinity Force', 'legendary', 3333], ['3153', 'Blade of the Ruined King', 'legendary', 3200], ['3031', 'Infinity Edge', 'legendary', 3600], ['3089', "Rabadon's Deathcap", 'legendary', 3600], ['3135', 'Void Staff', 'legendary', 3000], ['3157', "Zhonya's Hourglass", 'legendary', 3250], ['3072', 'Bloodthirster', 'legendary', 3400], ['4645', 'Shadowflame', 'legendary', 3200], ['6676', 'The Collector', 'legendary', 3000], ['3068', 'Sunfire Aegis', 'legendary', 2700], ['3070', 'Tear of the Goddess', 'starter', 400]
    ];
    const HEADLINERS = [['K/DA', 'Collect four K/DA cards to gain an extra augment.'], ['HEARTSTEEL', 'Augments can roll with powerful unique modifiers.'], ['True Damage', 'Takedowns and destroyed towers can drop anvils.'], ['Pentakill', 'One ability gains power at the start and again at level 18.'], ['Disco', 'Dance beneath the disco ball to earn gold for the team.'], ['Cafe Cuties', 'Health relics have enhanced effects.'], ['Bees', 'Gather honey pots and avoid the roaming bees.'], ['Command Line', 'Reroll an augment for a higher-tier choice at each selection.']];
    const FALLBACK = `silver|Blunt Force;silver|Deft;silver|Heavy Hitter;silver|Escape Plan;silver|Goredrink;silver|First-Aid Kit;silver|Tank It Or Leave It;silver|Blue Barrier;silver|Flow of Spirit;silver|Fruitify;silver|Gift of the Drowned;silver|Hands Off The Talent;silver|Lich Brain;silver|Lonely Warrior;silver|No Mana, No Problem;silver|Sound Barrier;silver|Ultimate Recursion;silver|Purist - Caster;silver|ADAPt;silver|Erosion;silver|Twin Fire;silver|Upgrade Death's Dance;silver|Siphon;silver|Stackosaurus Rex;silver|Leg Day;silver|Witchful Thinking;silver|Ocean Soul;silver|Homeguard;silver|Scoped Weapons;silver|Typhoon;silver|Shadow Runner;silver|Stats!;silver|Ice Cold;silver|Trusty Weapon;silver|Swift and Safe;silver|Spin To Win;silver|Zealot;silver|Flashbang;silver|Dive Bomber;gold|Weapon Of Destiny;gold|BEES!!!;gold|The Boom and the Bass;gold|Transmute: Prismatic;gold|Recursion;gold|Shrink Engine;gold|Take’em Down Down Down;gold|Tank Engine;gold|Ethereal Weapon;gold|Armored Impact;gold|Warlock Juicebox;gold|Still Here;gold|Quest: Steel Your Heart;gold|Soul Eater;gold|Nature is Healing;gold|Phenomenal Evil;gold|Jeweled Bracelet;gold|Get Jinxed;gold|Double Time;gold|Enchanting Butterflies;gold|Heavy Is The Crown;gold|Recoil;gold|Salvation;gold|Sap Magic;gold|Tickle Monster;gold|Upgrade: Stormsurge;gold|Arcane Axiom;gold|CRIMSON COBALT;gold|Brass Blast;gold|Vulnerability;gold|Magic Missile;gold|Critical Healing;gold|Sonata;gold|Upgrade Sundered Sky;gold|Upgrade Ravenous Hydra;gold|Upgrade Infinity Edge;gold|Growth Spurt;gold|Nightstalking;gold|All For You;gold|Firebrand;gold|Big Brain;gold|Marksmage;gold|With Haste;gold|Scopier Weapons;gold|It's Killing Time;gold|Quest: Urf's Champion;prismatic|Jeweled Gauntlet;prismatic|Infinite Recursion;prismatic|Eureka;prismatic|Goliath;prismatic|Mad Scientist;prismatic|Draw Your Sword;prismatic|Windspeaker's Blessing;prismatic|Mystic Punch;prismatic|Bouncing Bees;prismatic|Group Hug;prismatic|Mosh Monster;prismatic|Third Times The Harm;prismatic|Totentanz;prismatic|Big Shot;prismatic|Double Tap;prismatic|Ultra Hydra;prismatic|Titan's Resolve;prismatic|Final Form;prismatic|Archmage;prismatic|Giant Slayer;prismatic|Quest: Wooglet's Witchcap;prismatic|Blade Waltz;prismatic|Dashing;prismatic|Cruelty;prismatic|Empyrean Promise;prismatic|Scopiest Weapons;prismatic|Back To Basics;prismatic|Master of Duality;prismatic|Ominous Pact;prismatic|Ultimate Awakening;prismatic|Ultimate Revolution`;
    function slug(s) {
        return String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
    function escapeHtml(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function toast(s) {
        const t = document.getElementById('toast');
        t.textContent = s;
        t.style.display = 'block';
        clearTimeout(toast.timer);
        toast.timer = setTimeout(() => t.style.display = 'none', 3000);
    }
    function newid() {
        return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }
    function fallbackData() {
        return [...new Map(FALLBACK.split(';').map(e => {
                const [rarity, name] = e.split('|');
                const id = slug(name);
                return [id, { id, name, rarity, description: '', introducedPatch: '', retiredPatch: null, pickRate: null, source: 'starter' }];
            })).values()];
    }
    const OFFLINE_CHAMPIONS = `Aatrox|Ahri|Akali|Akshan|Alistar|Ambessa|Amumu|Anivia|Annie|Aphelios|Ashe|Aurelion Sol|Aurora|Azir|Bard|Bel'Veth|Blitzcrank|Brand|Braum|Briar|Caitlyn|Camille|Cassiopeia|Cho'Gath|Corki|Darius|Diana|Dr. Mundo|Draven|Ekko|Elise|Evelynn|Ezreal|Fiddlesticks|Fiora|Fizz|Galio|Gangplank|Garen|Gnar|Gragas|Graves|Gwen|Hecarim|Heimerdinger|Hwei|Illaoi|Irelia|Ivern|Janna|Jarvan IV|Jax|Jayce|Jhin|Jinx|K'Sante|Kai'Sa|Kalista|Karma|Karthus|Kassadin|Katarina|Kayle|Kayn|Kennen|Kha'Zix|Kindred|Kled|Kog'Maw|LeBlanc|Lee Sin|Leona|Lillia|Lissandra|Locke|Lucian|Lulu|Lux|Malphite|Malzahar|Maokai|Master Yi|Mel|Milio|Miss Fortune|Mordekaiser|Morgana|Naafiri|Nami|Nasus|Nautilus|Neeko|Nidalee|Nilah|Nocturne|Nunu & Willump|Olaf|Orianna|Ornn|Pantheon|Poppy|Pyke|Qiyana|Quinn|Rakan|Rammus|Rek'Sai|Rell|Renata Glasc|Renekton|Rengar|Riven|Rumble|Ryze|Samira|Sejuani|Senna|Seraphine|Sett|Shaco|Shen|Shyvana|Singed|Sion|Sivir|Skarner|Smolder|Sona|Soraka|Swain|Sylas|Syndra|Tahm Kench|Taliyah|Talon|Taric|Teemo|Thresh|Tristana|Trundle|Tryndamere|Twisted Fate|Twitch|Udyr|Urgot|Varus|Vayne|Veigar|Vel'Koz|Vex|Vi|Viego|Viktor|Vladimir|Volibear|Warwick|Wukong|Xayah|Xerath|Xin Zhao|Yasuo|Yone|Yorick|Yuumi|Zac|Zaahen|Zed|Zeri|Ziggs|Zilean|Zoe|Zyra|Yunara`;
    const CHAMP_ID_MAP = {
        "Aurelion Sol": "AurelionSol", "Bel'Veth": "Belveth", "Cho'Gath": "Chogath", "Dr. Mundo": "DrMundo", Fiddlesticks: "FiddleSticks", "Jarvan IV": "JarvanIV", "K'Sante": "KSante", "Kai'Sa": "Kaisa", "Kha'Zix": "Khazix", "Kog'Maw": "KogMaw", LeBlanc: 'Leblanc', 'Lee Sin': 'LeeSin', 'Master Yi': 'MasterYi', 'Miss Fortune': 'MissFortune', 'Nunu & Willump': 'Nunu', "Rek'Sai": "RekSai", 'Renata Glasc': 'Renata', 'Tahm Kench': 'TahmKench', 'Twisted Fate': 'TwistedFate', "Vel'Koz": 'Velkoz', Wukong: 'MonkeyKing', 'Xin Zhao': 'XinZhao'
    };
    function fallbackChampions() {
        return OFFLINE_CHAMPIONS.split('|').map(name => ({ id: CHAMP_ID_MAP[name] || name.replace(/[^A-Za-z]/g, ''), name, tags: [] })).sort((a, b) => a.name.localeCompare(b.name));
    }
    function keyName(s) {
        return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    }
    const FALLBACK_ROLES = {
        Mage: 'Ahri Anivia Annie AurelionSol Aurora Azir Brand Cassiopeia Fiddlesticks Hwei Karthus LeBlanc Lissandra Lux Malzahar Mel Morgana Neeko Orianna Ryze Seraphine Swain Syndra Taliyah Veigar Velkoz Vex Viktor Vladimir Xerath Ziggs Zilean Zoe Zyra', Marksman: 'Akshan Aphelios Ashe Caitlyn Corki Draven Ezreal Jhin Jinx Kaisa Kalista Kindred KogMaw Lucian MissFortune Nilah Quinn Samira Senna Sivir Smolder Tristana Twitch Varus Vayne Xayah Zeri Yunara', Tank: 'Alistar Amumu Blitzcrank Braum Chogath Galio Leona Malphite Maokai Nautilus Nunu Ornn Rammus Rell Sejuani Shen Sion Skarner TahmKench Taric Zac', Support: 'Bard Ivern Janna Karma Lulu Milio Nami Rakan Renata Seraphine Sona Soraka Yuumi', Assassin: 'Akali Evelynn Fizz Katarina Khazix Naafiri Nocturne Pyke Qiyana Rengar Shaco Talon Zed'
    };
    function roleOf(c) {
        if (!c)
            return 'Champion';
        if (Array.isArray(c.tags) && c.tags.length) {
            const t = c.tags[0];
            return t === 'Fighter' ? 'Fighter' : t === 'Marksman' ? 'Marksman' : t === 'Mage' ? 'Mage' : t === 'Tank' ? 'Tank' : t === 'Support' ? 'Support' : t === 'Assassin' ? 'Assassin' : t;
        }
        const id = keyName(c.id);
        for (const [role, names] of Object.entries(FALLBACK_ROLES))
            if (names.split(' ').some(n => keyName(n) === id))
                return role;
        return 'Fighter';
    }
    function resolvedChampion(idOrName) {
        return state.champions.find(c => keyName(c.id) === keyName(idOrName) || keyName(c.name) === keyName(idOrName)) || null;
    }
    const state = {
        itemNotes: {}, view: 'home', selected: null, builds: [], overrides: {}, augments: mergeNewReleaseAugments(fallbackData()), patch: '26.22', champions: fallbackChampions(), items: FALLBACK_ITEMS.map(([id, name, category, cost]) => ({ id, name, category, cost, gold: { total: cost }, source: 'starter' })), riotItems: new Map(), itemSource: 'Offline starter items · refresh for the current Mayhem catalog', itemCategory: 'all', ddver: '16.22.1', augSearch: '', augRarity: 'all', itemSearch: '',         status: 'Offline starter list + 4 new augments from Patch 26.23 (stats pending)', newOnly: false, homeSearch: '', homeFilter: 'all', homeRole: 'all', homeSort: 'az', championFocus: '', manualItems: {}, mayhemItems: [], hasMayhemItems: false, arenaInfo: new Map(),
    };
    try {
        const s = JSON.parse(localStorage.getItem(STORE) || '{}');
        state.builds = Array.isArray(s.builds) ? s.builds : [];
        state.overrides = s.overrides && typeof s.overrides === 'object' ? s.overrides : {};
        state.itemNotes = s.itemNotes && typeof s.itemNotes === 'object' ? s.itemNotes : {};
        state.manualItems = s.manualItems && typeof s.manualItems === 'object' ? s.manualItems : {};
        state.selected = s.selected || state.builds[0]?.id || null;
    }
    catch (e) {
        console.warn(e);
    }
    try {
        const cached = JSON.parse(localStorage.getItem(ITEM_CACHE) || 'null');
        if (cached && Array.isArray(cached.items) && cached.items.length > 30) {
            state.mayhemItems = cached.items.map(x => ({ ...x, source: 'mayhem' }));
            state.hasMayhemItems = true;
            state.items = dedupeItems([...state.mayhemItems, ...Object.values(state.manualItems)]);
            state.itemSource = `Cached Mayhem items (${cached.items.length}) · ${cached.patch || 'patch unknown'}`;
        }
    }
    catch (e) {
        console.warn('Item cache unavailable', e);
    }
    // A new build is an in-memory draft until a real champion is chosen.
    // Drafts never appear in My Builds, exports, or persistent browser storage.
    let draftBuild = null;
    function abandonDraft() {
        if (!draftBuild)
            return;
        if (state.selected === draftBuild.id)
            state.selected = state.builds[0]?.id || null;
        draftBuild = null;
    }
    function persist() {
        try {
            const savedSelection = state.builds.some(b => b.id === state.selected) ? state.selected : (state.builds[0]?.id || null);
            localStorage.setItem(STORE, JSON.stringify({ builds: state.builds, overrides: state.overrides, itemNotes: state.itemNotes, manualItems: state.manualItems, selected: savedSelection }));
            return true;
        }
        catch (e) {
            toast('Storage full: export your data now.');
            return false;
        }
    }
    function build() {
        return state.builds.find(b => b.id === state.selected) || (draftBuild?.id === state.selected ? draftBuild : null);
    }
    function allAugments() {
        const m = new Map(state.augments.map(x => [x.id, { ...x }]));
        Object.entries(state.overrides).forEach(([id, o]) => {
            if (o.deleted) {
                m.delete(id);
                return;
            }
            m.set(id, { ...(m.get(id) || { id }), ...o });
        });
        return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
    }
    function getAug(id) {
        return allAugments().find(a => a.id === id) || { id, name: id, rarity: 'silver', retiredPatch: '?', description: 'Not in current database' };
    }
    function champImg(id) {
        return id ? DD + state.ddver + '/img/champion/' + encodeURIComponent(id) + '.png' : '';
    }
    function itemImg(id) {
        const item = state.items.find(x => x.id === String(id));
        const n = String(item?.imageId || id);
        if (item?.imageUrl && /^https:\/\//.test(item.imageUrl))
            return item.imageUrl;
        return /^\d+$/.test(n) ? DD + state.ddver + '/img/item/' + n + '.png' : '';
    }
    function itemName(id) {
        return state.items.find(i => i.id === id)?.name || id;
    }
    function renderSidebar() {
        const q = document.getElementById('sideSearch').value.toLowerCase();
        document.getElementById('sidebarList').innerHTML = state.builds.filter(b => (b.title + ' ' + b.championName + ' ' + b.style).toLowerCase().includes(q)).map(b => `<button class="buildrow ${b.id === state.selected ? 'active' : ''}" data-bid="${escapeHtml(b.id)}"><img class="avatar" src="${champImg(b.champion)}" onerror="this.style.visibility='hidden'" alt=""><span><span class="name">${escapeHtml(b.championName || 'Champion')}</span><br><span class="sub">${escapeHtml(b.title || 'New build')} · ${escapeHtml(b.style || roleOf(resolvedChampion(b.champion)) || 'Build')}</span></span></button>`).join('') || '<p class="hint" style="padding:12px">No builds found.</p>';
    }
    function safeAsset(path) {
        if (!path || typeof path !== 'string')
            return '';
        if (/^https:\/\//i.test(path))
            return /^https:\/\/(raw\.communitydragon\.org|cdn\.communitydragon\.org|arammayhem\.com|ddragon\.leagueoflegends\.com)\//i.test(path) ? path : '';
        const clean = path.replace(/^\/+/, '').toLowerCase();
        if (!/^assets\/[a-z0-9_./-]+\.(png|webp)$/.test(clean) || clean.includes('..'))
            return '';
        return CDRAGON + 'game/' + clean;
    }
    function plainDesc(s) {
        return String(s || '').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, '').replace(/@([A-Za-z0-9_*.+-]+)@/g, '[scaling value]').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    }
    function extraInfo(a) {
        return state.arenaInfo.get(slug(a.name)) || state.arenaInfo.get(keyName(a.name)) || state.arenaInfo.get(keyName(a.id)) || {};
    }
    // Public stats JSON does not contain effect text. These are individually verified
    // ARAMMayhem 26.22 effects; older patch values are not silently presented as current.
    // Optional site-page augment manifest generated by refresh_augments.py.
    // Local details are matched by stable public ID and URL slug; personal edits always win.
    const MAYHEM_DETAIL_PACK = (() => {
        try {
            const node = document.getElementById('mayhemDetailPack');
            const raw = JSON.parse(node?.textContent || '{"augments":{}}');
            return raw.augments && typeof raw.augments === 'object' ? raw.augments : {};
        }
        catch (e) {
            console.warn('Unable to read augment detail pack', e);
            return {};
        }
    })();
    function detailForAug(a) {
        if (!a)
            return null;
        const siteSlug = String(a.url || '').match(/\/augments\/([^/?#]+)/)?.[1] || '';
        const keys = [String(a.id || ''), siteSlug, slug(a.name)];
        for (const key of keys) {
            if (MAYHEM_DETAIL_PACK[key])
                return MAYHEM_DETAIL_PACK[key];
        }
        const released = RELEASED_AUGMENTS.find(x => slug(x.name) === slug(a.name));
        return released ? { description: released.description, captured: 'Nov 19, 2026' } : null;
    }
    const VERIFIED_MAYHEM_EFFECTS = {
        'windspeakers-blessing': { patch: '26.22', tier: 'S', description: "Healing or shielding an ally (or receiving healing and shields) grants 30–60 bonus Armor and Magic Resistance for 3 seconds." },
        'big-brain': { patch: '26.22', tier: 'A-', description: 'Gain a shield equal to 300% of your Ability Power. It lasts until destroyed and refreshes when you respawn or every 70 seconds.' },
        'bees': { patch: '26.22', tier: 'S+', description: 'Your abilities can launch an exploding beehive at enemies, dealing damage, slowing them, and applying on-hit effects.' },
        'goliath': { patch: '26.22', tier: 'S', description: 'Gain 35% bonus Health, 15% adaptive force, and 50% increased size.' },
        'ethereal-weapon': { patch: '26.22', tier: 'S', description: 'Your abilities apply on-hit effects, with a 1-second cooldown per target.' },
        'its-killing-time': { patch: '26.22', tier: 'B', description: 'Casting your ultimate marks enemy champions. The mark stores 40% of your post-mitigation damage and detonates after 5 seconds as true damage. The effect has an 8-second cooldown.' }
    };
    function verifiedAug(a) {
        return VERIFIED_MAYHEM_EFFECTS[slug(a.name)] || VERIFIED_MAYHEM_EFFECTS[String(a.url || '').match(/\/augments\/([^/]+)/)?.[1]] || null;
    }
    function communityDesc(a) {
        const info = extraInfo(a);
        let original = String(info.desc || info.tooltip || '');
        if (!original)
            return '';
        const values = info.dataValues || {};
        original = original.replace(/@([A-Za-z][A-Za-z0-9_]*)(?:\s*([*\/+-])\s*([\d.]+))?@/g, (_token, key, op, value) => {
            let d = values[key];
            if (!Array.isArray(d) || !d.length)
                return '[value varies]';
            const nums = d.filter(x => typeof x === 'number' && Number.isFinite(x));
            if (!nums.length)
                return '[value varies]';
            const transform = x => !op ? x : op === '*' ? x * Number(value) : op === '/' ? x / Number(value) : op === '+' ? x + Number(value) : x - Number(value);
            const fmt = n => Number(transform(n).toFixed(2)).toString();
            const first = Math.min(...nums), last = Math.max(...nums);
            return Math.abs(last - first) < .001 ? fmt(first) : fmt(first) + '–' + fmt(last);
        });
        // Game-icon tokens are markup rather than effect values; do not display them raw.
        original = original.replace(/%i:[a-z0-9_]+%/gi, '').replace(/\[scaling value\]/gi, '[value varies]');
        return plainDesc(original).replace(/@[^@\n]+@/g, '[value varies]').replace(/\s{2,}/g, ' ');
    }
    function augEffect(a) {
        if (a.description && String(a.description).trim())
            return { text: plainDesc(a.description), source: 'Personal description', warning: '' };
        const official = detailForAug(a);
        if (official?.description)
            return { text: plainDesc(official.description), source: 'ARAMMayhem augment page · ' + (official.captured || 'saved public data'), warning: '' };
        const verified = verifiedAug(a);
        if (verified && state.patch === verified.patch)
            return { text: verified.description, source: 'Verified ARAM Mayhem effect · patch ' + verified.patch, warning: '' };
        const c = communityDesc(a);
        if (c) {
            const unknown = /\[value varies\]/.test(c);
            return { text: c, source: 'CommunityDragon Arena description', warning: unknown ? 'Some scaling values could not be resolved. This is general Arena data, not a verified Mayhem-specific effect.' : 'General Arena data may differ from current ARAM Mayhem. Follow the source link to confirm.' };
        }
        if (verified)
            return { text: verified.description, source: 'Archived Mayhem effect · patch ' + verified.patch, warning: 'Current patch effects may have changed; verify against the live source.' };
        return { text: 'A verified effect description is not included in the public stats feed.', source: 'No verified effect available', warning: 'Open the current ARAMMayhem page for the full current effect, or add your own description.' };
    }
    function augStats(a) {
        const cells = [];
        const verified = verifiedAug(a);
        if (verified && verified.patch === state.patch)
            cells.push(['Tier', verified.tier, 'Confirmed for ' + verified.patch]);
        if (a.pickRate != null) {
            const change = Number(a.pickRateChange);
            cells.push(['Pick rate', Number(a.pickRate).toFixed(2) + '%', Number.isFinite(change) ? (change >= 0 ? '+' : '') + change.toFixed(2) + ' pp vs prior patch' : 'Public sample']);
        }
        if (Number.isFinite(Number(a.pickRateRank)) && a.pickRateRank != null)
            cells.push(['Rank', '#' + a.pickRateRank, a.previousPickRateRank != null ? 'Previously #' + a.previousPickRateRank : 'Current data']);
        if (!cells.length)
            cells.push(augmentReleasePending(a) ? ['Pick rate', 'Pending', 'New in Patch 26.23 · 26.22 stats still published'] : ['Rarity', (a.rarity || 'Unknown').toUpperCase(), 'Custom or offline augment']);
        return '<div class="aug-meta-grid">' + cells.map(([label, value, small]) => `<div class="aug-meta-cell"><span class="meta-label">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(small)}</small></div>`).join('') + '</div>';
    }
    function augDescription(a) {
        return augEffect(a).text;
    }
    // Do not invent substitute game art. Report missing icons plainly.
    const FALLBACK_ART = `<span class="no-icon-text" aria-label="Official icon unavailable">NO<br>ICON</span>`;
    function publicMayhemIcon(a) {
        // ARAMMayhem keeps apostrophes inside filenames: Windspeaker's_Blessing_mayhem_augment.webp.
        const raw = String(a.name || '').normalize('NFKC').replace(/[’‘]/g, "'").replace(/[^A-Za-z0-9']+/g, '_').replace(/^_+|_+$/g, '');
        return raw ? 'https://arammayhem.com/augments/' + encodeURIComponent(raw + '_mayhem_augment.webp') : '';
    }
    function augImages(a) {
        const info = extraInfo(a), known = detailForAug(a), slugged = slug(a.name);
        const sanitized = String(a.name || '').normalize('NFKC').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        const list = [
            /^https:\/\//i.test(a.imageUrl || '') ? a.imageUrl : '',
            known?.localImage || '', known?.image || '',
            publicMayhemIcon(a),
            // Older filenames strip apostrophes; check them only after the canonical form.
            sanitized ? 'https://arammayhem.com/augments/' + encodeURIComponent(sanitized + '_mayhem_augment.webp') : '',
            safeAsset(info.iconLarge), safeAsset(info.iconSmall),
            slugged ? 'https://arammayhem.com/augments/' + slugged + '.webp' : ''
        ];
        return [...new Set(list.filter(Boolean))];
    }
    function advanceArtwork(img) {
        const list = (img.dataset.imgs || '').split('|').filter(Boolean);
        const index = Number(img.dataset.pos || 0) + 1;
        if (index < list.length) {
            img.dataset.pos = index;
            img.src = list[index];
        }
        else {
            img.style.display = 'none';
            img.parentElement.classList.add('no-art');
        }
    }
    function artLoaded(img) {
        if (!img.naturalWidth || !img.naturalHeight) {
            advanceArtwork(img);
            return;
        }
        img.parentElement.classList.remove('no-art');
        img.style.display = 'block';
    }
    function itemArtLoaded(img) {
        if (img.naturalWidth < 20 || img.naturalHeight < 20)
            advanceArtwork(img);
    }
    function augVisual(a) {
        const urls = augImages(a);
        return `<div class="augsymbol ${escapeHtml(a.rarity || 'silver')} ${urls.length ? '' : 'no-art'}" title="${escapeHtml(a.name)} — source game icon or clearly labeled unavailable">${urls.length ? `<img src="${escapeHtml(urls[0])}" data-imgs="${escapeHtml(urls.join('|'))}" data-pos="0" loading="lazy" alt="" class="aug-art-image" referrerpolicy="no-referrer">` : ''}<span class="fallback">${FALLBACK_ART}</span></div>`;
    }
    function rarityLabel(a) {
        return `<span class="rarity ${escapeHtml(a.rarity)}">${escapeHtml(a.rarity || 'Silver')}${a.retiredPatch ? ' · retired' : augmentReleasePending(a) ? ' · new 26.23' : ''}</span>`;
    }
    function roleBadge(c) {
        const role = roleOf(c);
        return `<span class="champ-role">${escapeHtml(role)}</span>`;
    }
    function buildsForChampion(c) {
        return state.builds.filter(b => keyName(b.champion) === keyName(c.id) || keyName(b.championName) === keyName(c.name));
    }
    function championTile(c) {
        const mine = buildsForChampion(c), count = mine.length;
        return `<button class="champion-tile ${count ? 'has-build' : ''}" data-open-champion="${escapeHtml(c.id)}" title="${escapeHtml(c.name)} — ${count ? count + ' saved build' + (count === 1 ? '' : 's') : 'Create a build'}"><span class="champion-thumb"><img src="${champImg(c.id)}" loading="lazy" alt="${escapeHtml(c.name)}" onerror="this.style.opacity='.28'"></span><span class="champion-name">${escapeHtml(c.name)}</span>${roleBadge(c)}${count ? `<span class="saved-count">${count} ${count === 1 ? 'BUILD' : 'BUILDS'}</span>` : ''}</button>`;
    }
    function renderChampionGrid() {
        let arr = [...state.champions], q = keyName(state.homeSearch);
        if (q)
            arr = arr.filter(c => keyName(c.name).includes(q));
        if (state.homeFilter === 'saved')
            arr = arr.filter(c => buildsForChampion(c).length);
        if (state.homeFilter === 'empty')
            arr = arr.filter(c => !buildsForChampion(c).length);
        if (state.homeRole !== 'all')
            arr = arr.filter(c => roleOf(c) === state.homeRole);
        arr.sort((a, b) => state.homeSort === 'saved' ? buildsForChampion(b).length - buildsForChampion(a).length || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));
        return arr.map(championTile).join('') || '<div class="empty" style="grid-column:1/-1">No champions match these filters.</div>';
    }
    function renderHomeView() {
        const savedChamps = state.champions.filter(c => buildsForChampion(c).length).length;
        return `<section class="home-banner"><span class="overline">YOUR PERSONAL ARAM MAYHEM DATABASE</span><h1>Champions, augments,<br><em>your builds.</em></h1><p>Browse every champion, open your saved builds, and keep your augment priorities and HEARTSTEEL combos in one place.</p><div class="banner-actions"><button class="btn primary" data-go-view="library">Browse saved builds</button><button class="btn" data-new-build>+ New build</button><button class="btn" data-import-share title="Import one build from a share link or JSON file">Import Build</button><button class="btn" data-import-all title="Import builds, item notes and custom data from a JSON backup">Import All</button><button class="btn" data-export-all title="Download all saved builds and personal data as JSON">Export All</button></div><div class="home-summary"><span><strong>${state.champions.length}</strong> champions</span><span><strong>${state.builds.length}</strong> saved builds</span><span><strong>${savedChamps}</strong> champions with builds</span><span><strong>${allAugments().length}</strong> augments</span></div></section>
<section class="hub-section"><div class="hub-title"><div><span class="overline">CHAMPION DIRECTORY</span><h2>All Champions</h2></div><span class="small">Select a champion portrait to view its saved build(s)</span></div><div class="champion-toolbar"><input id="homeSearch" placeholder="Search champions…" value="${escapeHtml(state.homeSearch)}" aria-label="Search champions"><select id="homeFilter" aria-label="Saved builds filter"><option value="all" ${state.homeFilter === 'all' ? 'selected' : ''}>All champions</option><option value="saved" ${state.homeFilter === 'saved' ? 'selected' : ''}>With my builds</option><option value="empty" ${state.homeFilter === 'empty' ? 'selected' : ''}>Without builds</option></select><select id="homeRole" aria-label="Champion role"><option value="all">All roles</option>${['Fighter', 'Mage', 'Marksman', 'Tank', 'Support', 'Assassin'].map(role => `<option value="${role}" ${state.homeRole === role ? 'selected' : ''}>${role}</option>`).join('')}</select><select id="homeSort"><option value="az" ${state.homeSort === 'az' ? 'selected' : ''}>A–Z</option><option value="saved" ${state.homeSort === 'saved' ? 'selected' : ''}>Most saved builds</option></select></div><div id="champGrid" class="champion-grid">${renderChampionGrid()}</div></section>`;
    }
    // V7 preserves V1–V6 exports, converting old ranked augments into an editable combo.
    // Multiple Headliners may be attached to one build combo. The first selection is also
    // stored in legacy `headliner` so older clients can still display one Headliner.
    function comboHeadlinerNames(c) {
        const names = Array.isArray(c?.headliners) ? c.headliners.filter(n => typeof n === 'string' && n.trim()) : [];
        const legacy = typeof c?.headliner === 'string' && c.headliner ? c.headliner : '';
        return [...new Set(names.length ? names : (legacy ? [legacy] : []))];
    }
    function hasComboHeadliner(c, name) {
        return comboHeadlinerNames(c).includes(name);
    }
    function setComboHeadliner(c, name, checked) {
        if (!HEADLINERS.some(([known]) => known === name))
            return;
        const next = comboHeadlinerNames(c).filter(x => x !== name);
        if (checked)
            next.push(name);
        c.headliners = next;
        c.headliner = next[0] || '';
    }
    const ITEM_SLOTS = ['pool', 'start', 'boots', 'core', 'options'];
    const ITEM_LABELS = { pool: 'Unsorted', start: 'Starting', boots: 'Boots', core: 'Core', options: 'Situational' };
    function ensureBuildV7(b) {
        if (!b || typeof b !== 'object')
            return b;
        const old = b.items || {};
        b.items = Object.fromEntries(ITEM_SLOTS.map(s => [s, Array.isArray(old[s]) ? old[s] : []]));
        b.augments = b.augments || { top: [], great: [], good: [] };
        if (!Array.isArray(b.augmentCombos)) {
            const previous = [...new Set([...['top', 'great', 'good'].flatMap(k => b.augments[k] || []), ...Object.keys(b.heartsteelStickers || {})])];
            b.augmentCombos = [{ id: 'combo-main', name: 'Combo 1', augments: previous }];
        }
        const bands = Array.isArray(b.bands) ? b.bands : [];
        b.heartsteelStickers = b.heartsteelStickers || {};
        b.pentakill = b.pentakill || { first: '', second: '' };
        b.augmentCombos = b.augmentCombos.filter(x => x && typeof x === 'object').map((x, i) => {
            // Infer historical whole-build Headliners once. Existing combo settings are never overwritten.
            const inferred = bands[i] || (!i ? bands[0] : '') || '';
            return {
                id: String(x.id || ('combo-' + i)), name: String(x.name || ('Combo ' + (i + 1))),
                augments: Array.isArray(x.augments) ? x.augments.map(String) : [],
                coreItems: Array.isArray(x.coreItems) ? x.coreItems.map(String) : [],
                headliner: comboHeadlinerNames(x).length ? comboHeadlinerNames(x)[0] : inferred,
                headliners: comboHeadlinerNames(x).length ? comboHeadlinerNames(x) : (inferred ? [inferred] : []),
                stickers: x.stickers && typeof x.stickers === 'object' ? x.stickers : { ...Object.fromEntries((x.augments || []).filter(id => b.heartsteelStickers[id]).map(id => [id, b.heartsteelStickers[id]])) },
                pentakill: x.pentakill && typeof x.pentakill === 'object' ? x.pentakill : { first: inferred === 'Pentakill' ? b.pentakill.first || '' : '', second: inferred === 'Pentakill' ? b.pentakill.second || '' : '' }
            };
        });
        if (!b.augmentCombos.length)
            b.augmentCombos = [{ id: 'combo-main', name: 'Combo 1', augments: [], headliner: '', headliners: [], stickers: {}, pentakill: { first: '', second: '' } }];
        if (!b.activeComboId || !b.augmentCombos.some(c => c.id === b.activeComboId))
            b.activeComboId = b.augmentCombos[0].id;
        b.bands = bands;
        return b;
    }
    state.builds.forEach(ensureBuildV7);
    state.itemPickerOpen = false;
    state.augPickerOpen = false;
    state.augSort = 'rank';
    function chosenAugmentIds(b) {
        return [...new Set((b.augmentCombos || []).flatMap(c => c.augments || []))];
    }
    function comboById(b, id) {
        return (b.augmentCombos || []).find(c => c.id === id);
    }
    function addToCombo(augId, comboId) {
        const b = ensureBuildV7(build());
        if (!b)
            return;
        const c = comboById(b, comboId) || b.augmentCombos[0];
        if (!c.augments.includes(augId))
            c.augments.push(augId);
        b.activeComboId = c.id;
        touch();
        render();
        toast('Added ' + getAug(augId).name + ' to ' + c.name);
    }
    function removeFromCombo(comboId, augId) {
        const b = ensureBuildV7(build());
        const c = comboById(b, comboId);
        if (!c)
            return;
        c.augments = c.augments.filter(id => id !== augId);
        delete c.stickers[augId];
        if (!chosenAugmentIds(b).includes(augId))
            delete b.heartsteelStickers[augId];
        touch();
        render();
    }
    function moveItem(fromSlot, index, toSlot, beforeIndex) {
        const b = ensureBuildV7(build());
        if (!b || !ITEM_SLOTS.includes(toSlot))
            return;
        const source = b.items[fromSlot];
        if (!source || index < 0 || index >= source.length)
            return;
        const [id] = source.splice(index, 1);
        const target = b.items[toSlot];
        let position = Number.isInteger(beforeIndex) ? beforeIndex : target.length;
        if (fromSlot === toSlot && index < position)
            position--;
        target.splice(Math.max(0, Math.min(position, target.length)), 0, id);
        touch();
        render();
    }
    function addItemToSlot(id, slot = 'pool', beforeIndex) {
        const b = ensureBuildV7(build());
        if (!b || !ITEM_SLOTS.includes(slot))
            return;
        const target = b.items[slot], at = Number.isInteger(beforeIndex) ? Math.max(0, Math.min(beforeIndex, target.length)) : target.length;
        target.splice(at, 0, id);
        touch();
        render();
        toast('Added ' + itemName(id) + ' to ' + ITEM_LABELS[slot]);
    }
    function moveAugmentInBuild(b, fromCombo, augId, toCombo, beforeId) {
        if (!b)
            return false;
        ensureBuildV7(b);
        const src = comboById(b, fromCombo), target = comboById(b, toCombo);
        if (!src || !target || !src.augments.includes(augId))
            return false;
        const member = src.stickers?.[augId];
        src.augments = src.augments.filter(x => x !== augId);
        target.augments = target.augments.filter(x => x !== augId);
        let pos = beforeId ? target.augments.indexOf(beforeId) : -1;
        if (pos < 0)
            pos = target.augments.length;
        target.augments.splice(pos, 0, augId);
        if (src !== target) {
            delete src.stickers[augId];
            if (hasComboHeadliner(target, 'HEARTSTEEL') && member)
                target.stickers[augId] = member;
        }
        b.activeComboId = target.id;
        return true;
    }
    function moveAugment(fromCombo, augId, toCombo, beforeId) {
        if (moveAugmentInBuild(build(), fromCombo, augId, toCombo, beforeId)) {
            touch();
            render();
        }
    }
    let preferredItemSlot = 'pool';
    function itemBucket(b, slot) {
        const ids = b.items[slot] || [];
        return `<div class="item-bucket ${slot === 'pool' ? 'unsorted' : ''}" data-drop-item-slot="${slot}"><div class="bucket-head"><strong>${ITEM_LABELS[slot]}</strong><span class="row"><span class="small">${ids.length}</span>${slot === 'pool' ? `<button type="button" class="btn smallbtn item-add-to-slot" data-open-item-slot="${slot}" title="Browse and add to Unsorted">+ Items</button>` : ''}</span></div><div class="item-bucket-chips">${ids.map((id, i) => `<div class="chosen-item" draggable="true" data-drag-selected-item="${slot}:${i}" data-item-target-index="${i}" title="Drag to reorder or move between item groups"><span class="drag-grip" draggable="true" data-drag-selected-item="${slot}:${i}" title="Drag to move item" aria-label="Drag ${escapeHtml(itemName(id))}">⠿</span><img src="${itemImg(id)}" alt="" onerror="this.style.opacity='.25'"><div class="item-chip-info"><strong title="${escapeHtml(itemName(id))}">${escapeHtml(itemName(id))}</strong><small>${escapeHtml(ITEM_LABELS[slot])}</small></div><button class="item-chip-detail" data-item-info="${escapeHtml(id)}" title="Item details" aria-label="Details for ${escapeHtml(itemName(id))}">ⓘ</button><button class="item-chip-remove" data-remove-item="${slot}:${i}" title="Remove item" aria-label="Remove ${escapeHtml(itemName(id))}">×</button></div>`).join('') || '<span class="drop-hint">Browse items or drop them here</span>'}</div></div>`;
    }
    // Combo selection is view-only. Unassigned combos ALWAYS show the default core
    // items configured at the top of the full build editor (never another combo's).
    const libraryActiveComboIds = new Map();
    const comboCorePanelsOpen = new Set();
    function activeLibraryCombo(b) {
        ensureBuildV7(b);
        const id = libraryActiveComboIds.get(b.id);
        return comboById(b, id) || b.augmentCombos[0];
    }
    function effectiveLibraryCore(b) {
        const combo = activeLibraryCombo(b);
        if (combo?.coreItems?.length)
            return { items: combo.coreItems, source: 'combo', combo };
        return { items: b.items?.core || [], source: 'default', combo };
    }
    function activateLibraryCombo(b, id) {
        const next = comboById(b, id);
        if (!next)
            return;
        libraryActiveComboIds.set(b.id, next.id);
        render(); // view-only: no changes to saved build or item assignments
    }
    const comboCorePickerOpen = new Set();
    const comboCoreSearch = new Map();
    function renderCoreItemOptions(combo, query = '') {
        const search = keyName(query);
        return state.items.filter(item => !search || keyName(item.name).includes(search)).map(item => {
            const selected = combo.coreItems.includes(item.id);
            return `<button type="button" class="itemoption core-item-choice ${selected ? 'selected' : ''}" data-core-select="${escapeHtml(combo.id)}|${escapeHtml(item.id)}" title="${selected ? 'Remove' : 'Add'} ${escapeHtml(item.name)} ${selected ? 'from' : 'to'} ${escapeHtml(combo.name)}" aria-pressed="${selected}">${itemVisual(item)}<span class="item-option-text"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml((item.category || 'item').replace(/_/g, ' '))}</small></span><span class="core-item-check" aria-hidden="true">${selected ? '✓' : '+'}</span></button>`;
        }).join('') || '<p class="hint">No items found.</p>';
    }
    function renderComboCoreEditor(b, combo) {
        const ids = combo.coreItems || [];
        return `<div class="combo-core-editor"><div class="combo-core-editor-header"><strong>${escapeHtml(combo.name)} — Core items</strong><span class="hint">${ids.length ? ids.length + ' items' : 'Uses default core items'}</span></div><div class="combo-core-chips">${ids.map((id, i) => `<span class="combo-core-chip" title="${escapeHtml(itemName(id))}"><img loading="lazy" alt="" src="${itemImg(id)}" onerror="this.style.opacity='.3'"><span>${escapeHtml(itemName(id))}</span><button type="button" data-core-remove="${escapeHtml(combo.id)}|${i}" title="Remove item">×</button></span>`).join('') || '<span class="hint">No combo-specific items — using the default core items from the Items section.</span>'}</div><details class="combo-core-picker" data-core-picker="${escapeHtml(combo.id)}" ${comboCorePickerOpen.has(combo.id) ? 'open' : ''}><summary>+ Browse and select items</summary><input type="search" data-core-search="${escapeHtml(combo.id)}" value="${escapeHtml(comboCoreSearch.get(combo.id) || '')}" placeholder="Search the item catalog…" aria-label="Search items for ${escapeHtml(combo.name)}"><div class="itemcatalog combo-core-catalog" data-core-results="${escapeHtml(combo.id)}">${renderCoreItemOptions(combo, comboCoreSearch.get(combo.id) || '')}</div></details><div class="combo-core-actions"><button type="button" class="btn ghost" data-core-copy="${escapeHtml(combo.id)}">Copy default core</button><button type="button" class="btn ghost" data-core-clear="${escapeHtml(combo.id)}">Use default</button></div></div>`;
    }
    function bindComboCoreControls(root, b) {
        if (!root || !b)
            return;
        const commit = () => {
            b.updated = new Date().toLocaleDateString();
            persist();
            render();
        };
        root.querySelectorAll('[data-core-picker]').forEach(el => el.addEventListener('toggle', () => {
            if (el.open)
                comboCorePickerOpen.add(el.dataset.corePicker);
            else
                comboCorePickerOpen.delete(el.dataset.corePicker);
        }));
        root.querySelectorAll('[data-core-search]').forEach(el => el.addEventListener('input', () => {
            const id = el.dataset.coreSearch, c = comboById(b, id), list = root.querySelector(`[data-core-results="${CSS.escape(id)}"]`);
            if (!c || !list)
                return;
            comboCoreSearch.set(id, el.value);
            list.innerHTML = renderCoreItemOptions(c, el.value);
        }));
        // Delegation also covers results replaced during searches.
        root.querySelectorAll('[data-core-results]').forEach(list => list.addEventListener('click', e => {
            const button = e.target.closest('[data-core-select]');
            if (!button)
                return;
            e.preventDefault();
            e.stopPropagation();
            const [id, itemId] = button.dataset.coreSelect.split('|');
            const c = comboById(b, id);
            if (!c)
                return;
            if (c.coreItems.includes(itemId))
                c.coreItems = c.coreItems.filter(x => x !== itemId);
            else
                c.coreItems.push(itemId);
            commit();
        }));
        root.querySelectorAll('[data-core-remove]').forEach(el => el.addEventListener('click', () => {
            const [id, index] = el.dataset.coreRemove.split('|'), c = comboById(b, id);
            if (!c)
                return;
            c.coreItems.splice(Number(index), 1);
            commit();
        }));
        root.querySelectorAll('[data-core-copy]').forEach(el => el.addEventListener('click', () => {
            const c = comboById(b, el.dataset.coreCopy);
            if (!c)
                return;
            if (!(b.items.core || []).length)
                return toast('Set default core items in the Items section first');
            c.coreItems = [...b.items.core];
            commit();
        }));
        root.querySelectorAll('[data-core-clear]').forEach(el => el.addEventListener('click', () => {
            const c = comboById(b, el.dataset.coreClear);
            if (!c)
                return;
            c.coreItems = [];
            commit();
        }));
    }
    const headlinerPickerOpen = new Set();
    // Like the HEARTSTEEL popover, Headliners dismiss on outside click or Escape.
    // The checkbox selections remain intact when a menu closes.
    function closeHeadlinerPickers(except = null) {
        document.querySelectorAll('[data-headliner-picker][open]').forEach(picker => {
            if (picker === except)
                return;
            headlinerPickerOpen.delete(picker.dataset.headlinerPicker);
            picker.open = false;
        });
        if (!except)
            headlinerPickerOpen.clear();
    }
    document.addEventListener('pointerdown', event => {
        const inside = event.target.closest?.('[data-headliner-picker]') || null;
        if (inside) {
            // Only one headliner menu should be open at a time.
            closeHeadlinerPickers(inside);
        }
        else if (headlinerPickerOpen.size || document.querySelector('[data-headliner-picker][open]')) {
            closeHeadlinerPickers();
        }
    }, true);
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape')
            return;
        const opened = document.querySelector('[data-headliner-picker][open]');
        if (!opened)
            return;
        event.preventDefault();
        event.stopImmediatePropagation();
        closeHeadlinerPickers();
        opened.querySelector('summary')?.focus();
    }, true);
    function comboHeadlinerSelect(combo, selector = 'data-combo-headliner-choice') {
        const selected = comboHeadlinerNames(combo);
        const id = escapeHtml(combo.id), summary = selected.length ? selected.length === 1 ? selected[0] : selected.length + ' selected' : 'Choose Headliners';
        const open = headlinerPickerOpen.has(combo.id) ? 'open' : '';
        return `<details class="combo-headliner-picker" data-headliner-picker="${id}" ${open}><summary aria-label="Headliners for ${escapeHtml(combo.name)}">✦ ${escapeHtml(summary)}</summary><div class="headliner-picker-choices"><div class="headliner-picker-title">Select any Headliners</div>${HEADLINERS.map(([name]) => `<label class="headliner-picker-option"><input type="checkbox" ${selector}="${id}" value="${escapeHtml(name)}" ${selected.includes(name) ? 'checked' : ''}><span>${escapeHtml(name)}</span></label>`).join('')}</div></details>`;
    }
    function comboHeading(combo, index) {
        return `${escapeHtml(combo.name || 'Combo ' + (index + 1))}${comboHeadlinerNames(combo).map(name => `<span class="combo-headliner-mini">${escapeHtml(name)}</span>`).join('')}`;
    }
    function bindHeadlinerPickers(root, selector, commit, sourceBuild = null) {
        root.querySelectorAll('[data-headliner-picker]').forEach(picker => {
            picker.addEventListener('toggle', () => {
                // Ignore delayed toggle events from a previous render; they should not
                // overwrite the state of a freshly rendered picker.
                if (!picker.isConnected)
                    return;
                if (picker.open)
                    headlinerPickerOpen.add(picker.dataset.headlinerPicker);
                else
                    headlinerPickerOpen.delete(picker.dataset.headlinerPicker);
            });
        });
        root.querySelectorAll('[' + selector + ']').forEach(input => input.addEventListener('change', e => {
            e.stopPropagation();
            const b = sourceBuild || build();
            if (!b)
                return;
            const c = comboById(b, input.dataset[selector.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase())]);
            if (!c)
                return;
            headlinerPickerOpen.add(c.id);
            setComboHeadliner(c, input.value, input.checked);
            commit();
        }));
    }
    // Inline HEARTSTEEL assignment; keep combo.stickers unchanged for old builds and shared links.
    // A custom floating picker shows EVERY effect and can close on outside click or Escape.
    function inlineHeartsteelSticker(combo, augId, member, { editable = true, focused = false } = {}) {
        const bonus = stickerInfo(member), name = escapeHtml(member || ''), effect = bonus ? escapeHtml(bonus.effect) : '';
        if (!editable) {
            return member ? `<div class="inline-heartsteel is-readonly" title="${name}: ${effect}"><strong>♥ ${name}</strong><small>${effect}</small></div>` : '';
        }
        const key = escapeHtml(combo.id) + '|' + escapeHtml(augId);
        return `<div class="inline-heartsteel" draggable="false">
  <button type="button" class="sticker-picker-trigger" data-sticker-picker="${key}" data-sticker-member="${name}" data-sticker-focus="${focused ? '1' : '0'}" aria-haspopup="listbox" aria-expanded="false" aria-label="HEARTSTEEL sticker for ${escapeHtml(getAug(augId).name)}: ${name || 'No sticker'}" draggable="false" title="Choose a HEARTSTEEL member and bonus">
   <span class="sticker-current-text"><strong>${member ? name : '♥ Choose sticker'}</strong>${member ? `<small>${effect}</small>` : ''}</span><span class="sticker-chevron" aria-hidden="true">▾</span>
  </button>
 </div>`;
    }
    // Portal the menu directly to document.body so combo-card overflow cannot clip it.
    let activeStickerPopup = null;
    function closeStickerPopup(restoreFocus = false) {
        if (!activeStickerPopup)
            return;
        const { button, popup } = activeStickerPopup;
        activeStickerPopup = null;
        popup.remove();
        if (button?.isConnected) {
            button.setAttribute('aria-expanded', 'false');
            if (restoreFocus)
                button.focus();
        }
    }
    function positionStickerPopup() {
        if (!activeStickerPopup)
            return;
        const { button, popup } = activeStickerPopup;
        if (!button.isConnected) {
            closeStickerPopup();
            return;
        }
        const r = button.getBoundingClientRect(), pad = 8;
        const width = Math.min(326, window.innerWidth - pad * 2), left = Math.max(pad, Math.min(r.right - width, window.innerWidth - pad - width));
        popup.style.width = width + 'px';
        popup.style.left = left + 'px';
        const popupHeight = popup.scrollHeight, below = window.innerHeight - r.bottom - pad, above = r.top - pad;
        const openAbove = below < Math.min(popupHeight, 260) && above > below;
        const available = Math.max(100, openAbove ? above - 5 : below - 5);
        popup.style.maxHeight = Math.min(360, available) + 'px';
        const height = Math.min(popup.scrollHeight, 360, available);
        popup.style.top = (openAbove ? Math.max(pad, r.top - 5 - height) : Math.min(window.innerHeight - pad - height, r.bottom + 5)) + 'px';
        popup.dataset.side = openAbove ? 'above' : 'below';
    }
    function openStickerPopup(button) {
        if (activeStickerPopup?.button === button) {
            closeStickerPopup();
            return;
        }
        closeStickerPopup();
        const [comboId, augId] = button.dataset.stickerPicker.split('|'), focused = button.dataset.stickerFocus === '1';
        const current = button.dataset.stickerMember || '';
        const popup = document.createElement('div');
        popup.className = 'sticker-picker-popup';
        popup.setAttribute('role', 'listbox');
        popup.setAttribute('aria-label', 'Choose HEARTSTEEL member and bonus');
        popup.tabIndex = -1;
        const options = [{ member: '', effect: 'No bonus assigned' }, ...HEARTSTEEL_BONUSES];
        popup.innerHTML = options.map(({ member, effect }) => `<button type="button" class="sticker-picker-option ${member === current ? 'is-selected' : ''}" role="option" aria-selected="${member === current}" data-sticker-choice="${escapeHtml(member)}"><span class="sticker-option-lines"><strong>${escapeHtml(member || 'No sticker')}</strong><small>${escapeHtml(effect)}</small></span>${member === current ? '<span class="sticker-option-check" aria-hidden="true">✓</span>' : ''}</button>`).join('');
        document.body.appendChild(popup);
        button.setAttribute('aria-expanded', 'true');
        activeStickerPopup = { button, popup };
        positionStickerPopup();
        popup.addEventListener('click', e => {
            const choice = e.target.closest('[data-sticker-choice]');
            if (!choice)
                return;
            e.preventDefault();
            e.stopPropagation();
            const value = choice.dataset.stickerChoice;
            closeStickerPopup();
            if (focused) {
                const b = state.builds.find(x => x.id === libraryFocusedId), combo = comboById(b, comboId);
                if (!combo || !hasComboHeadliner(combo, 'HEARTSTEEL') || !combo.augments.includes(augId))
                    return;
                if (value)
                    combo.stickers[augId] = value;
                else
                    delete combo.stickers[augId];
                b.updated = new Date().toLocaleDateString();
                persist();
                render();
            }
            else
                setSticker(augId, value, comboId);
        });
        popup.addEventListener('keydown', e => {
            const choices = [...popup.querySelectorAll('[data-sticker-choice]')], index = choices.indexOf(document.activeElement);
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
                e.preventDefault();
                let n = e.key === 'Home' ? 0 : e.key === 'End' ? choices.length - 1 : index + (e.key === 'ArrowUp' ? -1 : 1);
                n = (n + choices.length) % choices.length;
                choices[n].focus();
            }
        });
        const selected = popup.querySelector('.is-selected');
        (selected || popup.querySelector('[data-sticker-choice]'))?.focus({ preventScroll: true });
        if (selected) {
            const midpoint = selected.offsetTop + selected.offsetHeight / 2;
            popup.scrollTop = Math.max(0, midpoint - popup.clientHeight / 2);
        }
    }
    function bindStickerPickerButtons(root) {
        root.querySelectorAll('[data-sticker-picker]').forEach(button => {
            button.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                openStickerPopup(button);
            });
            button.addEventListener('pointerdown', e => e.stopPropagation());
            button.addEventListener('dragstart', e => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
    }
    // Install document listeners only once; they work for editors and focused Quick Edit.
    document.addEventListener('pointerdown', e => {
        if (activeStickerPopup && !activeStickerPopup.popup.contains(e.target) && !activeStickerPopup.button.contains(e.target))
            closeStickerPopup();
    }, true);
    document.addEventListener('keydown', e => {
        if (activeStickerPopup && e.key === 'Escape') {
            e.preventDefault();
            e.stopImmediatePropagation();
            closeStickerPopup(true);
        }
    }, true);
    window.addEventListener('resize', () => {
        if (activeStickerPopup)
            positionStickerPopup();
    });
    window.addEventListener('scroll', e => {
        if (activeStickerPopup && !activeStickerPopup.popup.contains(e.target))
            positionStickerPopup();
    }, true);
    function renderComboRows(b) {
        return `<div class="combo-stack">${b.augmentCombos.map((c, i) => {
            const hasHeartsteel = hasComboHeadliner(c, 'HEARTSTEEL');
            const removable = b.augmentCombos.length > 1;
            const header = `<div class="combo-titlebar ${removable ? 'has-delete' : ''}">
   <span class="combo-number">${i + 1}</span>
   <input class="combo-name" data-combo-rename="${escapeHtml(c.id)}" aria-label="Combo name" value="${escapeHtml(c.name)}">
   ${comboHeadlinerSelect(c)}
   <button class="btn smallbtn" data-combo-target="${escapeHtml(c.id)}">+ Augments</button>
   ${removable ? `<button class="btn smallbtn danger" data-remove-combo="${escapeHtml(c.id)}" title="Delete combo" aria-label="Delete ${escapeHtml(c.name)}">×</button>` : ''}
  </div>`;
            const augments = c.augments.map(id => {
                const a = getAug(id), sticker = hasHeartsteel ? c.stickers?.[id] : null;
                return `<div class="combo-aug ${hasHeartsteel ? 'has-heartsteel' : ''}" draggable="true" data-drag-combo="${escapeHtml(c.id)}" data-drag-aug="${escapeHtml(id)}" data-combo-target-aug="${escapeHtml(id)}" title="Drag to reorder or move to another combo">
    <span class="drag-grip" draggable="true" data-drag-combo="${escapeHtml(c.id)}" data-drag-aug="${escapeHtml(id)}" aria-label="Drag ${escapeHtml(a.name)}">⠿</span>
    ${augVisual(a)}
    <div class="combo-aug-text"><strong title="${escapeHtml(a.name)}">${escapeHtml(a.name)}</strong>${rarityLabel(a)}</div>
    ${hasHeartsteel ? inlineHeartsteelSticker(c, id, sticker) : ''}
    <button data-aug-info="${escapeHtml(id)}" title="Augment details">ⓘ</button>
    <button data-remove-combo-aug="${escapeHtml(c.id)}|${escapeHtml(id)}" title="Remove from combo">×</button>
   </div>`;
            }).join('') || '<span class="drop-hint">Click + Augments to add here</span>';
            return `<section class="combo-row ${b.activeComboId === c.id ? 'active' : ''}" data-combo-drop="${escapeHtml(c.id)}">
   ${header}
   <div class="combo-content ${comboHeadlinerNames(c).length ? 'has-addon' : ''}">
    <div class="combo-picks">${augments}</div>
    ${renderPentakill(b, c)}
    <details class="combo-core-details" data-core-details="${escapeHtml(c.id)}" ${comboCorePanelsOpen.has(c.id) ? 'open' : ''}>
     <summary>Core item plan (${c.coreItems.length ? c.coreItems.length + ' items' : 'uses default'})</summary>${renderComboCoreEditor(b, c)}
    </details>
   </div>
  </section>`;
        }).join('')}</div>`;
    }
    const PENTAKILL_ABILITIES = { Q: 'HEAVY', W: 'POWER', E: 'THRASH', R: 'DOOM' };
    function renderPentakill(b, c) {
        if (!hasComboHeadliner(c, 'Pentakill'))
            return '';
        return `<div class="combo-pentakill"><strong class="combo-addon-title">🎸 Pentakill ability empowerment</strong><div class="pentakill-grid"><div class="field"><label>Game start</label><select data-combo-penta-first="${escapeHtml(c.id)}"><option value="">Choose Q / W / E</option>${['Q', 'W', 'E'].map(k => `<option value="${k}" ${c.pentakill.first === k ? 'selected' : ''}>${k} — ${PENTAKILL_ABILITIES[k]}</option>`).join('')}</select></div><div class="field"><label>Level 18</label><select data-combo-penta-second="${escapeHtml(c.id)}"><option value="">Choose Q / W / E / R</option>${['Q', 'W', 'E', 'R'].map(k => `<option value="${k}" ${c.pentakill.second === k ? 'selected' : ''}>${k} — ${PENTAKILL_ABILITIES[k]}</option>`).join('')}</select></div></div><p class="hint">Each empowered ability: +20 Ability Haste, +10% damage, +10% healing/shielding.</p></div>`;
    }
    let libraryFocusedId = null; // Transient focus, never saved as a build.
    let libraryQuickEdit = false; // Off by default; never stored in exported or saved builds.
    // V21 visual-only focus layout. Layout is global and intentionally lives outside build data.
    const FOCUS_LAYOUT_KEY = 'mayhem-library-focus-layout-v1';
    const FOCUS_SECTIONS = ['items', 'combos', 'skills', 'notes'];
    const FOCUS_TITLES = { items: 'Items', combos: 'Augment combinations', skills: 'Skills & spells', notes: 'Strategy & notes' };
    const FOCUS_WIDTHS = ['half', 'wide', 'full'];
    const COMBO_WIDTHS = ['auto', 'third', 'half', 'wide', 'full'];
    const PAGE_PANELS = ['guide', 'focus', 'others'];
    const PAGE_TITLES = { guide: 'Weapon of Destiny', focus: 'Focused build', others: 'Other champions' };
    const PAGE_MIN = { guide: 14, focus: 34, others: 17 };
    const DEFAULT_PAGE_WIDTHS = { guide: 19, focus: 60, others: 21 };
    const clampPercent = (value, min = 24) => Math.max(min, Math.min(100, Math.round(Number(value) || 100)));
    const PAGE_PATTERNS = ['split-right', 'split-left', 'focus-top', 'focus-bottom', 'columns', 'stacked'];
    const SITE_VIEWS = ['home', 'champion', 'builds', 'augments', 'items', 'headliners'];
    const defaultSpace = () => ({ left: 0, right: 0, top: 0, bottom: 0 });
    function normalizeSpace(raw) {
        const s = defaultSpace();
        if (!raw || typeof raw !== 'object')
            return s;
        const cap = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
        s.left = cap(raw.left, 35);
        s.right = cap(raw.right, 35);
        if (s.left + s.right > 65)
            s.right = 65 - s.left;
        s.top = cap(raw.top, 320);
        s.bottom = cap(raw.bottom, 320);
        return s;
    }
    function defaultPageLayout() {
        return {
            order: [...PAGE_PANELS], slots: ['focus', 'others', 'guide'], widths: { ...DEFAULT_PAGE_WIDTHS }, mode: 'columns', pattern: 'split-right',
            guideVisible: true, heights: { guide: 0, focus: 0, others: 0 }, innerWidths: { guide: 100, focus: 100, others: 100 },
            guidePosition: 'inline', guideAlign: 'left', spaceLeft: 0, spaceRight: 0, spaceTop: 0, spaceBottom: 0, panelGap: 12, stackGap: 0, overviewPositions: {}, overviewLayoutWidth: 0, focusReferenceWidth: 0
        };
    }
    function normalizePageLayout(raw) {
        const page = defaultPageLayout();
        if (!raw || typeof raw !== 'object')
            return page;
        const order = Array.isArray(raw.order) ? raw.order.filter(x => PAGE_PANELS.includes(x)) : [];
        page.order = [...new Set([...order, ...PAGE_PANELS])];
        const slots = Array.isArray(raw.slots) ? raw.slots.filter(x => PAGE_PANELS.includes(x)) : [];
        page.slots = [...new Set([...(slots.length ? slots : ['focus', ...page.order.filter(k => k !== 'focus')]), ...PAGE_PANELS])];
        // Old V23 top/bottom placements are retained as a top/bottom two-dimensional layout.
        page.pattern = PAGE_PATTERNS.includes(raw.pattern) ? raw.pattern :
            raw.guidePosition === 'top' ? 'focus-bottom' : raw.guidePosition === 'bottom' ? 'focus-top' :
                raw.mode === 'stacked' ? 'stacked' : 'columns';
        page.mode = page.pattern === 'stacked' ? 'stacked' : 'columns';
        page.guideVisible = raw.guideVisible !== false;
        page.guidePosition = ['inline', 'top', 'bottom'].includes(raw.guidePosition) ? raw.guidePosition : 'inline';
        page.guideAlign = ['left', 'center', 'right'].includes(raw.guideAlign) ? raw.guideAlign : 'left';
        for (const key of PAGE_PANELS) {
            const val = Number(raw.widths?.[key]);
            if (Number.isFinite(val) && val >= PAGE_MIN[key])
                page.widths[key] = Math.max(PAGE_MIN[key], Math.min(100, Math.round(val)));
            const ht = Number(raw.heights?.[key]);
            page.heights[key] = Number.isFinite(ht) ? Math.max(0, Math.min(1600, Math.round(ht))) : 0;
            const inner = Number(raw.innerWidths?.[key]);
            page.innerWidths[key] = Number.isFinite(inner) && inner >= 35 ? Math.max(35, Math.min(100, Math.round(inner))) : 100;
        }
        const cap = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
        page.spaceLeft = cap(raw.spaceLeft, 35);
        page.spaceRight = cap(raw.spaceRight, 35);
        if (page.spaceLeft + page.spaceRight > 65)
            page.spaceRight = 65 - page.spaceLeft;
        page.spaceTop = cap(raw.spaceTop, 320);
        page.spaceBottom = cap(raw.spaceBottom, 320);
        page.panelGap = raw.panelGap === undefined ? 12 : cap(raw.panelGap, 32);
        page.stackGap = raw.stackGap === undefined ? 0 : cap(raw.stackGap, 32);
        // Each champion tile can be placed independently in the un-focused overview.
        // These coordinates belong to layout preferences, never to saved build data.
        page.overviewLayoutWidth = Math.max(0, Math.min(10000, Number(raw.overviewLayoutWidth) || 0));
        // The desktop width at which focused-panel percentages were chosen.
        // Holding this reference prevents cards from shrinking while unused
        // horizontal space is still available as the window gets narrower.
        page.focusReferenceWidth = Math.max(0, Math.min(10000, Number(raw.focusReferenceWidth) || 0));
        if (raw.overviewPositions && typeof raw.overviewPositions === 'object' && !Array.isArray(raw.overviewPositions)) {
            for (const [key, pos] of Object.entries(raw.overviewPositions)) {
                if ((key === 'guide' || key.startsWith('champ:')) && key.length < 140 && pos && typeof pos === 'object') {
                    const x = Number(pos.x), y = Number(pos.y), w = Number(pos.w);
                    if ([x, y, w].every(Number.isFinite)) {
                        page.overviewPositions[key] = {
                            x: Math.max(0, Math.min(100, x)),
                            y: Math.max(0, Math.min(6000, Math.round(y))),
                            w: Math.max(key === 'guide' ? 260 : 198, Math.min(700, Math.round(w)))
                        };
                    }
                }
            }
        }
        // V24 stored secondary widths as fractions of their grid track, while its UI
        // displayed whole-page percentages. Normalize old settings once to a single unit.
        if (raw.pageWidthVersion !== 2 && ['split-right', 'split-left', 'focus-top', 'focus-bottom'].includes(page.pattern)) {
            const main = page.slots[0], primary = Math.max(PAGE_MIN[main], Math.min(85, page.widths[main]));
            const track = page.pattern.startsWith('split-') ? 100 - primary : 50;
            for (const key of page.slots.slice(1)) {
                const oldInner = Number(raw.innerWidths?.[key]);
                if (Number.isFinite(oldInner) && oldInner >= 35 && oldInner < 100) {
                    page.widths[key] = Math.max(PAGE_MIN[key], Math.min(track, Math.round(track * oldInner / 100)));
                }
            }
        }
        page.pageWidthVersion = 2;
        return page;
    }
    function defaultFocusLayout() {
        return {
            order: [...FOCUS_SECTIONS], sections: { items: { width: 'full', visible: true }, combos: { width: 'full', visible: true }, skills: { width: 'half', visible: false }, notes: { width: 'half', visible: false } }, comboOrder: [], comboWidths: {}, comboPercents: {}, sectionHeights: {}, comboHeights: {}, spaces: Object.fromEntries(SITE_VIEWS.map(k => [k, defaultSpace()])), page: defaultPageLayout()
        };
    }
    function normalizeFocusLayout(raw) {
        const base = defaultFocusLayout();
        if (!raw || typeof raw !== 'object')
            return base;
        const order = Array.isArray(raw.order) ? raw.order.filter(x => FOCUS_SECTIONS.includes(x)) : [];
        base.order = [...new Set([...order, ...FOCUS_SECTIONS])];
        for (const key of FOCUS_SECTIONS) {
            const val = raw.sections?.[key];
            if (!val || typeof val !== 'object')
                continue;
            base.sections[key] = { width: FOCUS_WIDTHS.includes(val.width) ? val.width : base.sections[key].width, visible: typeof val.visible === 'boolean' ? val.visible : base.sections[key].visible };
            if (Number.isFinite(Number(val.percent)))
                base.sections[key].percent = clampPercent(val.percent);
        }
        if (Array.isArray(raw.comboOrder))
            base.comboOrder = [...new Set(raw.comboOrder.filter(x => Number.isInteger(x) && x >= 0 && x < 100))];
        if (raw.comboWidths && typeof raw.comboWidths === 'object')
            for (const [key, value] of Object.entries(raw.comboWidths)) {
                if (/^\d{1,2}$/.test(key) && COMBO_WIDTHS.includes(value))
                    base.comboWidths[key] = value;
            }
        if (raw.comboPercents && typeof raw.comboPercents === 'object')
            for (const [key, value] of Object.entries(raw.comboPercents)) {
                if (/^\d{1,2}$/.test(key) && Number.isFinite(Number(value)))
                    base.comboPercents[key] = clampPercent(value);
            }
        if (raw.sectionHeights && typeof raw.sectionHeights === 'object')
            for (const [key, value] of Object.entries(raw.sectionHeights))
                if (FOCUS_SECTIONS.includes(key) && Number.isFinite(Number(value)))
                    base.sectionHeights[key] = Math.max(0, Math.min(1200, Number(value)));
        if (raw.comboHeights && typeof raw.comboHeights === 'object')
            for (const [key, value] of Object.entries(raw.comboHeights))
                if (/^\d{1,2}$/.test(key) && Number.isFinite(Number(value)))
                    base.comboHeights[key] = Math.max(0, Math.min(1200, Number(value)));
        if (raw.spaces && typeof raw.spaces === 'object')
            for (const key of SITE_VIEWS)
                base.spaces[key] = normalizeSpace(raw.spaces[key]);
        base.page = normalizePageLayout(raw.page);
        return base;
    }
    let focusLayout = (() => {
        try {
            return normalizeFocusLayout(JSON.parse(localStorage.getItem(FOCUS_LAYOUT_KEY) || 'null'));
        }
        catch {
            return defaultFocusLayout();
        }
    })();
    let focusLayoutEditing = false;
    function saveFocusLayout() {
        try {
            localStorage.setItem(FOCUS_LAYOUT_KEY, JSON.stringify(focusLayout));
        }
        catch {
            toast('Could not save layout preferences.');
        }
    }
    function changeFocusLayout(mutator) {
        mutator(focusLayout);
        focusLayout = normalizeFocusLayout(focusLayout);
        saveFocusLayout();
        render();
    }
    function focusComboOrder(b) {
        const order = focusLayout.comboOrder.filter(i => i < b.augmentCombos.length);
        return [...order, ...b.augmentCombos.map((_, i) => i).filter(i => !order.includes(i))];
    }
    function comboColumnWidth(index, count) {
        const free = focusLayout.comboPercents[String(index)];
        if (free)
            return free;
        const mode = focusLayout.comboWidths[String(index)] || 'auto';
        return mode === 'third' ? 33 : mode === 'half' ? 50 : mode === 'wide' ? 67 : mode === 'full' ? 100 : (count === 1 ? 100 : count === 2 ? 50 : 33);
    }
    function sectionColumnWidth(key) {
        const setting = focusLayout.sections[key];
        return setting.percent || (setting.width === 'half' ? 50 : setting.width === 'wide' ? 67 : 100);
    }
    function reorderFocusSlots(arr, source, target, after) {
        const next = [...arr];
        const from = next.indexOf(source), to = next.indexOf(target);
        if (from < 0 || to < 0 || from === to)
            return next;
        next.splice(from, 1);
        const position = next.indexOf(target) + (after ? 1 : 0);
        next.splice(position, 0, source);
        return next;
    }
    function buildCard(b) {
        ensureBuildV7(b);
        const c = resolvedChampion(b.champion || b.championName);
        const core = (b.items?.core || []).slice(0, 5).map(id => `<img class="card-item" title="${escapeHtml(itemName(id))}" src="${itemImg(id)}" loading="lazy" onerror="this.style.display='none'">`).join('');
        const displayed = b.augmentCombos.map((combo, index) => `<div class="saved-combo"><span class="saved-combo-name">${comboHeading(combo, index)}</span><div class="saved-combo-picks">${combo.augments.map(id => {
            const a = getAug(id);
            return `<span class="saved-augment" title="${escapeHtml(a.name)}">${augVisual(a)}<span>${escapeHtml(a.name)}</span></span>`;
        }).join('') || '<span class="small">No augments selected</span>'}</div></div>`).join('');
        const bandLabels = b.augmentCombos.flatMap(c => comboHeadlinerNames(c).map(name => `<span class="saved-band-tag">${escapeHtml(name)}${name === 'Pentakill' && c.pentakill?.first ? ' ' + escapeHtml(c.pentakill.first) + (c.pentakill.second ? ' + ' + escapeHtml(c.pentakill.second) : '') : ''}</span>`)).join('');
        return `<button class="saved-build-card" data-open-build="${escapeHtml(b.id)}" title="Open this build in the editor"><div class="saved-build-header"><img class="saved-build-portrait" src="${champImg(b.champion || c?.id)}" alt="${escapeHtml(b.championName || 'Champion')}" onerror="this.style.opacity='.25'"><div><div class="saved-champ">${escapeHtml(b.championName || 'Select champion')}</div><div class="saved-title">${escapeHtml(b.title || 'New build')}</div><div class="role-line">${escapeHtml(b.style || roleOf(c))} <span>·</span> ${escapeHtml(b.skill || 'Custom')}</div></div><span class="card-arrow">↗</span></div><div class="saved-build-items">${core || '<span class="small">No core items yet</span>'}</div><div class="saved-build-combos">${displayed}</div><div class="saved-build-footer"><span>${bandLabels || '<span class="small">No Headliner preference</span>'}</span><span class="small">${escapeHtml(b.updated || '')}</span></div></button>`;
    }
    function focusedItemGroups(b) {
        const active = effectiveLibraryCore(b), combo = active.combo;
        const groups = [['start', 'Starting'], ['boots', 'Boots'], ['core', 'Core'], ['options', 'Situational'], ['pool', 'Unsorted']];
        const display = groups.map(([key, title]) => [key, key === 'core' ? active.items : b.items?.[key] || [], title]).filter(([key, ids]) => ids.length).map(([key, ids, title]) => `<div class="focus-item-group"><span class="focus-group-title">${title}${key === 'core' ? ` · ${active.source === 'combo' ? escapeHtml(combo?.name || 'Combo') : 'Default'}` : ''}</span><div class="focus-item-images">${ids.map(id => `<img src="${itemImg(id)}" class="focus-item-image" loading="lazy" alt="${escapeHtml(itemName(id))}" title="${escapeHtml(itemName(id))}" onerror="this.style.opacity='.25'">`).join('')}</div></div>`).join('') || '<span class="small">No items selected yet.</span>';
        return display;
    }
    function pentakillSummary(combo, quickEdit = false) {
        if (!hasComboHeadliner(combo, 'Pentakill'))
            return '';
        const p = combo.pentakill || {};
        const ability = (key, k, opts) => {
            if (quickEdit)
                return `<label>${key}<select data-focus-penta-${k}="${escapeHtml(combo.id)}"><option value="">Choose ability</option>${opts.map(a => `<option value="${a}" ${p[k] === a ? 'selected' : ''}>${a} — ${PENTAKILL_ABILITIES[a]}</option>`).join('')}</select></label>`;
            const letter = p[k], name = PENTAKILL_ABILITIES[letter];
            return letter && name
                ? `<span class="focus-penta-ability" aria-label="${key}: ${escapeHtml(letter)} — ${escapeHtml(name)}" title="${key}"><strong>${escapeHtml(letter)}</strong><span>— ${escapeHtml(name)}</span></span>`
                : `<span class="focus-penta-ability is-empty" aria-label="${key}: not selected">Not selected</span>`;
        };
        return `<div class="combo-penta-pill"><div class="combo-addon-title">🎸 PENTAKILL</div><div class="combo-penta-picks">${ability('Game start', 'first', ['Q', 'W', 'E'])}<span class="combo-penta-plus">+</span>${ability('Level 18', 'second', ['Q', 'W', 'E', 'R'])}</div><small>+20 Ability Haste · +10% damage · +10% healing/shielding per ability</small></div>`;
    }
    function focusComboCard(b, combo, index, editable, activeCombo) {
        const layoutMode = focusLayoutEditing;
        const selected = activeCombo?.id === combo.id;
        const cols = comboColumnWidth(index, b.augmentCombos.length);
        return `<section class="focus-combo-col ${selected ? 'is-active-combo' : ''} ${layoutMode ? 'layout-configurable' : ''}" style="--focus-span:${cols};--custom-min-height:${focusLayout.comboHeights[index] || 0}px" data-layout-combo-index="${index}" data-focus-combo-drop="${escapeHtml(combo.id)}" data-activate-combo="${escapeHtml(combo.id)}" aria-label="${escapeHtml(combo.name)}">${layoutMode ? `<div class="focus-combo-layout-controls" data-layout-ui><span class="focus-layout-grip" draggable="true" data-layout-drag-combo="${index}" title="Drag to reposition combo" aria-label="Drag combo">⠿</span><label>Width <select data-layout-combo-width="${index}" aria-label="Width of combo position ${index + 1}">${focusLayout.comboPercents[index] ? `<option value="custom" selected>${focusLayout.comboPercents[index]}% (dragged)</option>` : ''}${[['auto', 'Auto'], ['third', '⅓'], ['half', '½'], ['wide', '⅔'], ['full', 'Full']].map(([w, title]) => `<option value="${w}" ${!focusLayout.comboPercents[index] && (focusLayout.comboWidths[index] === w || !focusLayout.comboWidths[index] && w === 'auto') ? 'selected' : ''}>${title}</option>`).join('')}</select></label></div><span class="focus-free-resizer" data-resize-combo="${index}" role="separator" aria-label="Drag to resize combo ${index + 1} width"></span><span class="focus-bottom-resizer" data-resize-combo-y="${index}" role="separator" aria-label="Drag bottom edge to resize combo ${index + 1} height" title="Drag to resize height; double-click for automatic height"></span>` : ''}<div class="focus-combo-header"><h3>${comboHeading(combo, index)}</h3>${editable ? comboHeadlinerSelect(combo, 'data-focus-headliner-choice') : ''}</div><button type="button" class="focus-combo-activate" data-select-combo="${escapeHtml(combo.id)}" aria-pressed="${selected}">${selected ? '✓ Active · showing its items' : 'Select · show items'}</button><div class="focus-aug-list">${combo.augments.map(id => {
            const a = getAug(id), sticker = hasComboHeadliner(combo, 'HEARTSTEEL') ? combo.stickers?.[id] : null;
            return `<div class="focus-aug-row" ${editable ? `draggable="true" data-focus-drag-combo="${escapeHtml(combo.id)}" data-focus-drag-aug="${escapeHtml(id)}"` : ''} data-focus-target-aug="${escapeHtml(id)}">${editable ? `<span class="drag-grip" draggable="true" data-focus-drag-combo="${escapeHtml(combo.id)}" data-focus-drag-aug="${escapeHtml(id)}" title="Drag to reorder or move augment">⠿</span>` : ''}${augVisual(a)}<div class="focus-aug-text"><strong>${escapeHtml(a.name)}</strong><span class="rarity ${escapeHtml(a.rarity || 'silver')}">${escapeHtml(a.rarity || 'silver')}</span></div>${hasComboHeadliner(combo, 'HEARTSTEEL') ? inlineHeartsteelSticker(combo, id, sticker, { editable, focused: true }) : ''}</div>`;
        }).join('') || `<span class="small">${editable ? 'Drop augments here' : 'No augments selected'}</span>`}</div>${pentakillSummary(combo, editable)}</section>`;
    }
    function focusLayoutSection(key, content, comboCount) {
        const setting = focusLayout.sections[key], mode = focusLayoutEditing;
        if (!setting.visible && !mode)
            return '';
        const span = sectionColumnWidth(key);
        const controls = mode ? `<div class="focus-layout-controls" data-layout-ui><span class="focus-layout-grip" draggable="true" data-layout-drag-section="${key}" title="Drag to move section" aria-label="Drag ${FOCUS_TITLES[key]}">⠿</span><label>Width <select data-layout-section-width="${key}" aria-label="Width of ${FOCUS_TITLES[key]}">${setting.percent ? `<option value="custom" selected>${setting.percent}% (dragged)</option>` : ''}${[['half', '½'], ['wide', '⅔'], ['full', 'Full']].map(([w, title]) => `<option value="${w}" ${!setting.percent && setting.width === w ? 'selected' : ''}>${title}</option>`).join('')}</select></label><label class="focus-layout-visible"><input type="checkbox" data-layout-visible="${key}" ${setting.visible ? 'checked' : ''}> Show</label></div><span class="focus-free-resizer" data-resize-section="${key}" role="separator" aria-label="Drag to resize ${FOCUS_TITLES[key]} width"></span><span class="focus-bottom-resizer" data-resize-section-y="${key}" role="separator" aria-label="Drag bottom edge to resize ${FOCUS_TITLES[key]} height" title="Drag to resize height; double-click for automatic height"></span>` : '';
        return `<section class="focus-layout-section ${mode ? 'is-customizing' : ''} ${!setting.visible ? 'is-hidden-section' : ''}" data-layout-section="${key}" style="--focus-span:${span};--custom-min-height:${focusLayout.sectionHeights[key] || 0}px"><div class="focus-layout-heading"><div class="focus-section-label">${FOCUS_TITLES[key] === 'Augment combinations' ? 'AUGMENT COMBINATIONS' : escapeHtml(FOCUS_TITLES[key]).toUpperCase()}${key === 'combos' ? ` <span class="small">(${comboCount})</span>` : ''}</div>${controls}</div>${setting.visible ? content : '<p class="hint focus-hidden-text">Hidden in normal view. Tick Show to display this section.</p>'}</section>`;
    }
    function buildAttribution(b) {
        const who = String(b.createdBy || b.sharedBy || '').trim();
        return who ? `<div class="share-byline">Created by ${escapeHtml(who)}${b.importedFrom && b.importedFrom !== who ? ` · Shared by ${escapeHtml(b.importedFrom)}` : ''}</div>` : '';
    }
    function focusedLibraryCard(b, group) {
        ensureBuildV7(b);
        const champ = resolvedChampion(b.champion || b.championName);
        const editable = libraryQuickEdit && !focusLayoutEditing;
        const variants = group.builds.length > 1 ? `<div class="library-variant-selector"><div class="library-variant-title">${escapeHtml(group.name)} builds <span>${group.builds.length}</span></div><div class="library-variant-tabs" role="group" aria-label="Choose a saved build for ${escapeHtml(group.name)}">${group.builds.map((variant, i) => `<button type="button" class="library-variant-tab ${variant.id === b.id ? 'active' : ''}" data-switch-library-build="${escapeHtml(variant.id)}" aria-pressed="${variant.id === b.id}" title="${escapeHtml(variant.title || 'New build')}"><small>${i + 1}</small>${escapeHtml(variant.title || 'New build')}</button>`).join('')}</div></div>` : '';
        const activeCombo = activeLibraryCombo(b);
        const combos = `<div class="focus-layout-combo-grid">${focusComboOrder(b).map(i => focusComboCard(b, b.augmentCombos[i], i, editable, activeCombo)).join('')}</div>`;
        const contents = {
            items: `<div class="focus-items">${focusedItemGroups(b)}</div>${editable ? `<div class="focus-core-override">${renderComboCoreEditor(b, activeCombo)}</div>` : ''}`,
            combos,
            skills: `<div class="focus-optional-content"><div><strong>Skill priority</strong><span>${escapeHtml(b.skill || 'Not set')}</span></div><div><strong>Summoner spells</strong><span>${escapeHtml(b.spells || 'Not set')}</span></div></div>`,
            notes: `<div class="focus-optional-notes">${b.notes?.trim() ? escapeHtml(b.notes) : '<span class="hint">No notes added to this build.</span>'}</div>${b.intro?.trim() ? `<div class="focus-optional-intro"><strong>Introduction</strong><p>${escapeHtml(b.intro)}</p></div>` : ''}`
        };
        const sections = focusLayout.order.map(key => focusLayoutSection(key, contents[key], b.augmentCombos.length)).join('');
        return `<article class="library-focused-card ${editable ? 'quick-edit-on' : 'quick-edit-off'} ${focusLayoutEditing ? 'focus-customize-mode' : ''}" role="region" data-unfocus-build aria-label="Focused ${escapeHtml(b.championName || 'champion')} build"><div class="focus-build-header" data-unfocus-header role="button" tabindex="0" aria-label="Unfocus this build and show all champions" title="Click this header to show all champions"><img class="saved-build-portrait" src="${champImg(b.champion || champ?.id)}" alt="${escapeHtml(b.championName || 'Champion')}" onerror="this.style.opacity='.25'"><div class="focus-build-heading"><div class="overline">FOCUSED BUILD</div><h2>${escapeHtml(b.championName || 'Select champion')}</h2><div class="saved-title">${escapeHtml(b.title || 'New build')}</div><div class="role-line">${escapeHtml(b.style || roleOf(champ))} · ${escapeHtml(b.skill || 'Custom')}</div>${buildAttribution(b)}</div><div class="focus-header-actions"><button type="button" class="focus-share-mini share-build-btn" data-share-build="${escapeHtml(b.id)}" title="Share this build">↗ Share</button><button type="button" class="focus-edit-arrow" data-edit-focused-build="${escapeHtml(b.id)}" title="Open full editor">↗<span>Edit</span></button></div></div>${variants}<div class="focus-section-layout">${sections}</div><div class="focus-build-footer"><label class="focus-quick-edit-toggle" for="focusQuickEdit"><input type="checkbox" id="focusQuickEdit" ${editable ? 'checked' : ''} ${focusLayoutEditing ? 'disabled' : ''}><span><strong>Quick edit</strong><small>${focusLayoutEditing ? 'Finish customizing to edit augments' : 'Changes save automatically to this browser'}</small></span></label><span class="small">Updated ${escapeHtml(b.updated || '')}</span></div></article>`;
    }
    // The library groups builds by champion, but never merges or alters their saved data.
    function championBuildGroups() {
        const groups = new Map();
        for (const b of state.builds) {
            ensureBuildV7(b);
            const champion = resolvedChampion(b.champion || b.championName);
            const key = keyName(champion?.id || b.champion || b.championName) || 'unassigned';
            if (!groups.has(key))
                groups.set(key, { key, name: champion?.name || b.championName || 'Select champion', champion, builds: [] });
            groups.get(key).builds.push(b);
        }
        return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
    }
    const libraryLastVariant = new Map(); // Transient UI selection; builds remain independently saved.
    function libraryGroupCard(group, compact = false) {
        const { builds, champion, name, key } = group;
        const first = builds[0];
        const count = builds.length;
        const totalCombos = builds.reduce((sum, b) => sum + b.augmentCombos.length, 0);
        const headliners = [...new Set(builds.flatMap(b => b.augmentCombos.flatMap(comboHeadlinerNames)))];
        const image = champImg(champion?.id || first.champion);
        if (compact)
            return `<button class="library-compact-card" data-focus-champion="${escapeHtml(key)}" aria-label="Focus ${escapeHtml(name)} — ${count} saved ${count === 1 ? 'build' : 'builds'}"><img class="compact-portrait" src="${image}" alt="" loading="lazy" onerror="this.style.opacity='.2'"><div class="compact-details"><strong>${escapeHtml(name)}</strong><span class="compact-subtitle">${count === 1 ? escapeHtml(first.title || 'New build') : `${count} saved builds`}</span><span class="role-line">${escapeHtml(first.style || roleOf(champion))} · ${totalCombos} ${totalCombos === 1 ? 'combo' : 'combos'}</span></div><span class="compact-switch" aria-hidden="true">⤢</span></button>`;
        return `<button class="library-summary-card" data-focus-champion="${escapeHtml(key)}" aria-label="Focus ${escapeHtml(name)} — ${count} saved ${count === 1 ? 'build' : 'builds'}"><img class="library-summary-portrait" src="${image}" loading="lazy" alt="" onerror="this.style.opacity='.24'"><span class="library-summary-content"><strong class="library-summary-name">${escapeHtml(name)}</strong><span class="library-summary-title" title="${count === 1 ? escapeHtml(first.title || 'New build') : count + ' saved builds'}">${count === 1 ? escapeHtml(first.title || 'New build') : `${count} saved builds`}</span><span class="library-summary-meta">${escapeHtml(first.style || roleOf(champion))} · ${totalCombos} ${totalCombos === 1 ? 'combo' : 'combos'}</span>${headliners.length ? `<span class="library-summary-headliners" title="${escapeHtml(headliners.join(', '))}">${escapeHtml(headliners.join(' · '))}</span>` : ''}</span><span class="library-summary-arrow" aria-hidden="true">⤢</span></button>`;
    }
    // The overview is an independent full-width canvas, not a subset of the
    // focused-build panel. Each champion and the guide has its own position.
    // Tiles adapt to the *actual board width*: reduce their width down to the
    // minimum before wrapping, and reserve the guide at the right only when two
    // champion tiles still fit beside it. Moving a tile records its desktop
    // position; smaller windows pack those tiles fluidly without overwriting it.
    function overviewTilePositions(groups, page, boardWidth) {
        const content = document.getElementById('content');
        const canvasWidth = Math.max(1, boardWidth || (content?.clientWidth || window.innerWidth - 36) *
            (100 - page.spaceLeft - page.spaceRight) / 100);
        const saved = page.overviewPositions || {};
        const positions = {};
        const taken = [];
        const ids = groups.map(g => 'champ:' + g.key);
        const gap = 9, minCard = 198, maxCard = 320;
        const guideW = Math.min(canvasWidth, saved.guide?.w || 302);
        const guideOnRight = page.guideVisible && canvasWidth >= guideW + 2 * minCard + 2 * gap;
        const cardArea = guideOnRight ? canvasWidth - guideW - gap : canvasWidth;
        const cols = Math.max(1, Math.floor((cardArea + gap) / (minCard + gap)));
        const cardW = Math.max(Math.min(canvasWidth, minCard),
            Math.min(maxCard, Math.floor((cardArea - (cols - 1) * gap) / cols)));
        const tileHeight = 102, rowStep = 112;
        const collision = (a, b) => a.x < b.x + b.w + gap && a.x + a.w + gap > b.x &&
            a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;
        const reserve = (id, p, h) => {
            positions[id] = { x: p.x, y: p.y, w: p.w };
            taken.push({ x: p.x, y: p.y, w: p.w, h });
        };
        const fitPosition = (id, requested, height) => {
            const x = Math.max(0, Math.min(canvasWidth - requested.w, requested.x));
            const y = Math.max(0, requested.y);
            const first = { x, y, w: requested.w, h: height };
            if (!taken.some(p => collision(first, p))) return { x, y, w: requested.w };
            // Dragging a tile onto another tile moves it to the nearest free row.
            for (let dy = 0; dy < 5000; dy += rowStep) {
                for (const sx of [x, ...Array.from({ length: cols + 2 }, (_, c) => c * (cardW + gap))]) {
                    if (sx + requested.w > canvasWidth + .5) continue;
                    const p = { x: sx, y: y + dy, w: requested.w, h: height };
                    if (!taken.some(other => collision(p, other))) return p;
                }
            }
            return { x: 0, y: y + 5000, w: requested.w };
        };
        // The guide normally sits at the right edge, independently of cards.
        // At narrow widths, the guide flows after the cards instead of wasting
        // most of the row that could have held champion cards.
        if (guideOnRight) {
            const old = saved.guide;
            const canUseSaved = old && (!page.overviewLayoutWidth ||
                canvasWidth >= page.overviewLayoutWidth - 8);
            const desired = canUseSaved
                ? { x: (old.x || 0) * canvasWidth / 100, y: old.y || 0, w: Math.min(canvasWidth, old.w || guideW) }
                : { x: canvasWidth - guideW, y: 0, w: guideW };
            reserve('guide', desired, 254);
        }
        const adaptive = page.overviewLayoutWidth && canvasWidth < page.overviewLayoutWidth - 8;
        const ordered = adaptive ? ids.slice().sort((a, b) => {
            const ap = saved[a], bp = saved[b];
            if (!ap || !bp) return ap ? -1 : bp ? 1 : ids.indexOf(a) - ids.indexOf(b);
            return ap.y - bp.y || ap.x - bp.x;
        }) : ids;
        // When the viewport matches the customized width, honor saved positions.
        // At narrower widths, keep the card order but refill available columns.
        if (!adaptive) for (const id of ordered) {
            const s = saved[id];
            if (!s) continue;
            const w = Math.min(canvasWidth, s.w);
            const desired = { x: Math.max(0, (s.x || 0) * canvasWidth / 100), y: s.y || 0, w };
            const pos = fitPosition(id, desired, tileHeight);
            reserve(id, pos, tileHeight);
        }
        for (const id of ordered) {
            if (positions[id]) continue;
            let location = null;
            const slots = Math.max(1, Math.floor((cardArea - cardW + gap) / (cardW + gap)) + 1);
            for (let row = 0; row < 100 && !location; row++) {
                for (let col = 0; col < slots; col++) {
                    const x = col * (cardW + gap);
                    if (x + cardW > cardArea + .5) continue;
                    const p = { x, y: row * rowStep, w: cardW, h: tileHeight };
                    if (!taken.some(other => collision(p, other))) { location = p; break; }
                }
            }
            reserve(id, location || { x: 0, y: taken.length * rowStep, w: cardW }, tileHeight);
        }
        if (page.guideVisible && !guideOnRight) {
            const maxBottom = Math.max(0, ...ids.map(id => positions[id].y + tileHeight));
            reserve('guide', { x: 0, y: maxBottom + gap, w: guideW }, 254);
        }
        return { positions, canvasWidth };
    }
    function renderOverviewBoard(groups, page, guideHtml) {
        const { positions, canvasWidth } = overviewTilePositions(groups, page);
        const tile = (id, child, title, isGuide = false) => {
            const pos = positions[id];
            if (!pos) return '';
            const x = Math.round(pos.x / canvasWidth * 100000) / 1000;
            const drag = focusLayoutEditing ? `<span class="overview-tile-grip" data-overview-grip title="Drag ${escapeHtml(title)} anywhere on the page" role="button" tabindex="0" aria-label="Drag ${escapeHtml(title)}">⠿</span><span class="overview-tile-resizer" data-overview-resize title="Drag to change width" role="separator" aria-label="Resize ${escapeHtml(title)}"></span>` : '';
            return `<div class="overview-free-tile${isGuide ? ' overview-guide-tile' : ''}${focusLayoutEditing ? ' is-customizing' : ''}" data-overview-tile="${escapeHtml(id)}" style="--overview-x:${x}%;--overview-y:${pos.y}px;--overview-w:${pos.w}px">${child}${drag}</div>`;
        };
        const cards = groups.map(g => tile('champ:' + g.key, libraryGroupCard(g), g.name)).join('');
        const guide = page.guideVisible ? tile('guide', `<section class="library-page-panel page-panel-guide">${guideHtml}</section>`, 'Weapon of Destiny', true) : '';
        const maxBottom = Math.max(300, ...Object.entries(positions).map(([key, pos]) => pos.y + (key === 'guide' ? 255 : 110) + 12));
        return `<div class="overview-free-board${focusLayoutEditing ? ' overview-customizing' : ''}" data-overview-board style="min-height:${maxBottom}px">${cards}${guide}</div>`;
    }
    function bindOverviewBoard(root) {
        const board = root.querySelector('[data-overview-board]');
        if (!board) return;
        const updateHeight = () => {
            let bottom = 290;
            for (const el of board.querySelectorAll('[data-overview-tile]')) {
                bottom = Math.max(bottom, el.offsetTop + el.offsetHeight + 10);
            }
            board.style.minHeight = Math.ceil(bottom) + 'px';
        };
        updateHeight();
        let moving = false, lastWidth = 0;
        const recalculate = () => {
            if (!board.isConnected || moving) return;
            const width = board.clientWidth;
            if (!width || Math.abs(width - lastWidth) < 1) return;
            lastWidth = width;
            const ids = [...board.querySelectorAll('[data-overview-tile^="champ:"]')]
                .map(x => ({ key: x.dataset.overviewTile.slice(6) }));
            const { positions } = overviewTilePositions(ids, focusLayout.page, width);
            for (const item of board.querySelectorAll('[data-overview-tile]')) {
                const pos = positions[item.dataset.overviewTile];
                if (!pos) continue;
                item.style.removeProperty('left');
                item.style.removeProperty('top');
                item.style.removeProperty('width');
                item.style.setProperty('--overview-x', (pos.x / width * 100) + '%');
                item.style.setProperty('--overview-y', pos.y + 'px');
                item.style.setProperty('--overview-w', pos.w + 'px');
            }
            updateHeight();
        };
        if (typeof ResizeObserver !== 'undefined') {
            const resizeObserver = new ResizeObserver(() => {
                if (!board.isConnected) { resizeObserver.disconnect(); return; }
                recalculate();
            });
            resizeObserver.observe(board);
        }
        recalculate();
        if (!focusLayoutEditing) return;
        board.querySelectorAll('[data-overview-grip],[data-overview-resize]').forEach(handle => {
            handle.addEventListener('pointerdown', event => {
                if (event.button !== 0 || window.innerWidth <= 680) return;
                event.preventDefault();
                event.stopPropagation();
                const item = handle.closest('[data-overview-tile]');
                if (!item) return;
                const resizing = handle.hasAttribute('data-overview-resize');
                const area = board.getBoundingClientRect();
                const rect = item.getBoundingClientRect();
                const oldX = rect.left - area.left;
                const oldY = rect.top - area.top;
                const oldW = rect.width;
                let nextX = oldX, nextY = oldY, nextW = oldW;
                moving = true;
                item.classList.add('overview-moving');
                const move = e => {
                    const dx = e.clientX - event.clientX;
                    const dy = e.clientY - event.clientY;
                    if (resizing) {
                        const minimum = item.dataset.overviewTile === 'guide' ? 260 : 198;
                        nextW = Math.max(minimum, Math.min(600, Math.min(area.width - oldX, oldW + dx)));
                        item.style.width = nextW + 'px';
                    } else {
                        nextX = Math.max(0, Math.min(area.width - oldW, oldX + dx));
                        nextY = Math.max(0, Math.min(6000, oldY + dy));
                        item.style.left = nextX + 'px';
                        item.style.top = nextY + 'px';
                    }
                    updateHeight();
                };
                const finish = () => {
                    handle.removeEventListener('pointermove', move);
                    handle.removeEventListener('pointerup', finish);
                    handle.removeEventListener('pointercancel', finish);
                    moving = false;
                    item.classList.remove('overview-moving');
                    const id = item.dataset.overviewTile;
                    changeFocusLayout(layout => {
                        layout.page.overviewPositions ||= {};
                        layout.page.overviewLayoutWidth = Math.round(area.width);
                        layout.page.overviewPositions[id] = {
                            x: Math.round(nextX / Math.max(1, area.width) * 100000) / 1000,
                            y: Math.round(nextY),
                            w: Math.round(nextW)
                        };
                    });
                };
                handle.setPointerCapture(event.pointerId);
                handle.addEventListener('pointermove', move);
                handle.addEventListener('pointerup', finish);
                handle.addEventListener('pointercancel', finish);
            });
        });
    }
    function renderLibraryView() {
        const groups = championBuildGroups();
        const focusedGroup = groups.find(g => g.builds.some(b => b.id === libraryFocusedId));
        const focused = focusedGroup?.builds.find(b => b.id === libraryFocusedId);
        const page = focusLayout.page;
        const otherCount = groups.length - (focusedGroup ? 1 : 0);
        const otherCards = `<div class="library-other-builds"><h2>Other champions <span class="small">(${otherCount})</span></h2>${groups.filter(g => g.key !== focusedGroup?.key).map(g => libraryGroupCard(g, true)).join('') || '<p class="hint">No other champions saved.</p>'}</div>`;
        const placeholder = `<div class="library-empty-focus"><h2>Focused build</h2><p>Select a champion to preview a saved build. You can arrange the page before choosing one.</p><button class="btn primary smallbtn" data-go-view="home">Browse champions</button></div>`;
        const overview = `<div class="library-summary-grid" aria-label="Saved champions">${groups.map(g => libraryGroupCard(g)).join('') || '<div class="empty">No builds yet. Create one from the Champions page.</div>'}</div>`;
        const panels = {
            guide: document.getElementById('legendaryGuide')?.innerHTML || '',
            focus: focused ? `<div class="row between library-focus-toolbar"><span class="hint">${escapeHtml(focusedGroup.name)} · ${focusedGroup.builds.length} ${focusedGroup.builds.length === 1 ? 'build' : 'builds'}</span><button class="btn smallbtn ghost" data-collapse-library>← Show all champions</button></div>${focusedLibraryCard(focused, focusedGroup)}` : (focusLayoutEditing ? placeholder : overview),
            others: otherCards
        };
        const overviewMode = !focused;
        const keys = page.slots.filter(k => (k !== 'guide' || page.guideVisible) && (!overviewMode || k !== 'others'));
        const mainKey = page.slots[0];
        const pattern = page.pattern;
        if (focused && pattern.startsWith('split-') && !page.focusReferenceWidth && window.innerWidth > 800) {
            const canvasWidth = (document.getElementById('content')?.clientWidth || window.innerWidth - 36) *
                (100 - page.spaceLeft - page.spaceRight) / 100;
            page.focusReferenceWidth = Math.round(Math.max(1440, canvasWidth));
            // Layout settings are independent from builds; no build is modified.
            saveFocusLayout();
        }
        const renderPanel = (key, slot, sideTrack = 100) => {
            const width = page.widths[key], height = page.heights[key] || 0;
            const inner = (slot === 'upper' || slot === 'lower') && pattern.startsWith('split-') ? Math.min(100, Math.round(width / Math.max(1, sideTrack) * 100)) : 100;
            return `<section class="library-page-panel page-panel-${key} ${focusLayoutEditing ? 'is-page-editing' : ''} ${height ? 'has-custom-height' : ''}" data-page-panel="${key}" data-slot="${slot}" style="--page-span:${width};--panel-inner-width:${inner};--page-height:${height}px">${focusLayoutEditing ? `<div class="page-panel-controls" data-layout-ui><span class="focus-layout-grip" draggable="true" data-drag-page-panel="${key}" title="Drag to another panel edge to snap it above, below, left or right">⠿</span><strong>${PAGE_TITLES[key]}</strong><span class="page-width-readout">${width}%${height ? ' · ' + height + 'px' : ''}</span></div>` : ''}<div class="page-panel-body">${panels[key]}</div>${focusLayoutEditing ? `<span class="page-panel-resizer" data-resize-page-panel="${key}" role="separator" aria-label="Resize ${PAGE_TITLES[key]} width" title="Drag horizontally to resize"></span><span class="page-panel-resizer-y" data-resize-page-panel-y="${key}" role="separator" aria-label="Resize ${PAGE_TITLES[key]} height" title="Drag vertically; double-click to reset height"></span>` : ''}</section>`;
        };
        const slots = page.slots.filter(k => keys.includes(k));
        const mainWidth = Math.max(PAGE_MIN[mainKey], Math.min(85, page.widths[mainKey] || 60));
        const sideKeys = slots.filter(k => k !== mainKey);
        const sideWidth = Math.max(0, ...sideKeys.map(k => page.widths[k]));
        const referenceWidth = page.focusReferenceWidth || Math.max(1440, window.innerWidth - 36);
        const primaryPreferred = Math.round(referenceWidth * mainWidth / 100);
        const sidePreferred = Math.round(referenceWidth * sideWidth / 100);
        const layoutPanels = () => {
            if (pattern.startsWith('split-')) {
                const primary = `<div class="page-main-track" style="--primary-width:${mainWidth}%">${keys.includes(mainKey) ? renderPanel(mainKey, 'primary') : ''}</div>`;
                const secondary = `<div class="page-side-stack" style="--side-width:${sideWidth}%">${sideKeys.map(k => renderPanel(k, slots.indexOf(k) === 1 ? 'upper' : 'lower', sideWidth)).join('')}</div>`;
                return pattern === 'split-left' ? secondary + primary : primary + secondary;
            }
            if (pattern === 'focus-top' || pattern === 'focus-bottom') {
                const primary = `<div class="page-main-track">${keys.includes(mainKey) ? renderPanel(mainKey, 'primary') : ''}</div>`;
                const secondary = `<div class="page-secondary-row">${sideKeys.map(k => renderPanel(k, slots.indexOf(k) === 1 ? 'upper' : 'lower')).join('')}</div>`;
                return pattern === 'focus-top' ? primary + secondary : secondary + primary;
            }
            return slots.map(k => renderPanel(k, k === mainKey ? 'primary' : slots.indexOf(k) === 1 ? 'upper' : 'lower')).join('');
        };
        const mosaic = `<div class="page-mosaic mode-${pattern} ${overviewMode ? 'is-library-overview' : ''}" data-page-mosaic style="--primary-width:${mainWidth}%;--side-width:${sideWidth}%;--primary-preferred-px:${primaryPreferred}px;--side-preferred-px:${sidePreferred}px;--panel-gap:${page.panelGap}px;--stack-gap:${page.stackGap}px">${layoutPanels()}</div>`;
        const board = overviewMode ? renderOverviewBoard(groups, page, panels.guide) : mosaic;
        const cards = `<div class="library-page-grid" data-page-grid style="--page-space-left:${page.spaceLeft}%;--page-space-right:${page.spaceRight}%;--page-space-top:${page.spaceTop}px;--page-space-bottom:${page.spaceBottom}px">${board}</div>`;
        const toggle = `<button class="btn ${focusLayoutEditing ? 'primary' : 'ghost'}" data-toggle-focus-layout>${focusLayoutEditing ? '✓ Done customizing' : '▦ Customize page'}</button>`;
        const guideToggle = `<label class="page-guide-toggle"><input type="checkbox" data-guide-visible ${page.guideVisible ? 'checked' : ''}> Weapon of Destiny</label>`;
        const patterns = [['split-right', 'Main left · right stack'], ['split-left', 'Main right · left stack'], ['focus-top', 'Main top · two below'], ['focus-bottom', 'Main bottom · two above'], ['columns', 'Three columns'], ['stacked', 'Vertical stack']];
        const extras = focusLayoutEditing ? (overviewMode ? `<button class="btn smallbtn ghost" data-reset-overview-layout>↺ Reset card positions</button>` : `<button class="btn smallbtn ghost" data-reset-focus-layout>↺ Reset layout</button><label class="page-layout-mode-label">Arrangement <select data-page-pattern>${patterns.map(([id, label]) => `<option value="${id}" ${page.pattern === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label>`) : '';
        const spaceLabels = [['spaceLeft', 'Left', 35, '%'], ['spaceRight', 'Right', 35, '%'], ['spaceTop', 'Top', 320, 'px'], ['spaceBottom', 'Bottom', 320, 'px']];
        const spacing = focusLayoutEditing ? `<div class="page-space-toolbar" data-layout-ui><strong>Blank space</strong>${spaceLabels.map(([id, label, max, unit]) => `<label>${label} <input type="range" min="0" max="${max}" step="1" value="${page[id]}" data-page-space="${id}" aria-label="Blank space on ${label.toLowerCase()} of page"><output>${page[id]}${unit}</output></label>`).join('')}${overviewMode ? '' : `<strong>Panel gaps</strong>${[['panelGap', 'Side-by-side'], ['stackGap', 'Stack']].map(([id, label]) => `<label>${label} <input type="range" min="0" max="32" step="1" value="${page[id]}" data-panel-gap="${id}" aria-label="${label} panel gap"><output>${page[id]}px</output></label>`).join('')}`}</div>` : '';
        return `<div class="hub-title"><div><span class="overline">PERSONAL ARAM MAYHEM BUILDS</span><h1>My Saved Builds</h1></div><div class="row library-header-actions"><button class="btn primary" data-new-build>+ New build</button><button class="btn ghost" data-import-share>Import Build</button>${toggle}${guideToggle}${extras}</div></div>${spacing}<p class="muted">${focusLayoutEditing ? (overviewMode ? 'Drag any champion card or Weapon of Destiny using its dotted handle. Drag the gold edge handle to resize; positions save automatically.' : 'Drag a dotted handle to another panel edge to snap it. Resize sides or bottoms; set the Stack gap to 0px to make panels touch.') : focused ? 'Select an augment combo to show its core items. Quick edit changes save automatically.' : 'Choose a champion to expand it, then switch between its saved builds. Your layout is preserved.'}</p>${groups.length || focusLayoutEditing ? cards : `<div class="empty"><h2>No builds yet</h2><p>Choose a champion from the directory to create your first build.</p><button class="btn primary" data-go-view="home">Browse champions</button></div>`}`;
    }
    function renderChampionView() {
        const c = resolvedChampion(state.championFocus);
        if (!c)
            return renderHomeView();
        const mine = buildsForChampion(c);
        return `<button class="btn ghost back-button" data-go-view="home">← All champions</button><section class="champion-detail-hero"><img src="${champImg(c.id)}" alt="${escapeHtml(c.name)}" onerror="this.style.opacity='.25'"><div><span class="overline">PERSONAL CHAMPION BUILDS</span><h1>${escapeHtml(c.name)}</h1>${roleBadge(c)} <span class="tag">${mine.length} saved ${mine.length === 1 ? 'build' : 'builds'}</span><p class="muted">${mine.length ? 'Choose your build, or create another variation.' : 'No personal build for this champion yet.'}</p></div><button class="btn primary" data-create-champion="${escapeHtml(c.id)}">+ New ${escapeHtml(c.name)} build</button></section>${mine.length ? `<div class="saved-build-grid">${mine.map(buildCard).join('')}</div>` : `<div class="empty">You haven't made a build for ${escapeHtml(c.name)}. Click “New build” to get started.</div>`}`;
    }
    function renderItemsView() {
        return `<div class="hub-title"><div><span class="overline">UPDATING GAME CATALOG</span><h1>Item Library</h1></div><button class="btn primary" id="addCustomItem">+ Add a missing item</button></div><p class="muted">${escapeHtml(state.itemSource)}. New Mayhem items are listed alongside current Riot ARAM items; Riot-only extras are labeled because availability can differ. You can also add an item manually.</p><div class="panel standalone-items"><div class="picker"><input id="itemSearch" value="${escapeHtml(state.itemSearch)}" placeholder="Search item name…"><select id="itemCategory"><option value="all" ${state.itemCategory === 'all' ? 'selected' : ''}>All items</option><option value="complete" ${state.itemCategory === 'complete' ? 'selected' : ''}>Finished items</option><option value="boots" ${state.itemCategory === 'boots' ? 'selected' : ''}>Boots</option><option value="components" ${state.itemCategory === 'components' ? 'selected' : ''}>Components</option><option value="starter" ${state.itemCategory === 'starter' ? 'selected' : ''}>Starting & consumables</option><option value="extras" ${state.itemCategory === 'extras' ? 'selected' : ''}>Riot extra / custom</option></select></div><div class="row between" style="margin:12px 0"><span class="small">${state.items.length} deduplicated items in the current catalog</span><span class="small">Click for image, description and build placement</span></div><div class="itemcatalog" id="itemCatalog">${renderItemCatalog()}</div></div>`;
    }
    function openChampion(id) {
        const c = resolvedChampion(id);
        if (!c)
            return;
        const mine = buildsForChampion(c);
        if (mine.length === 1) {
            state.selected = mine[0].id;
            state.view = 'builds';
            persist();
            render();
        }
        else {
            state.championFocus = c.id;
            state.view = 'champion';
            render();
        }
    }
    function createBuildForChampion(id) {
        const c = resolvedChampion(id);
        if (!c)
            return;
        createBuild();
        const b = build();
        b.champion = c.id;
        b.championName = c.name;
        b.title = 'New ' + c.name + ' build';
        b.style = roleOf(c);
        commitDraft();
        touch();
        render();
    }
    function bindCards(root = document) {
        root.querySelectorAll('[data-open-champion]').forEach(x => x.onclick = () => openChampion(x.dataset.openChampion));
        root.querySelectorAll('[data-open-build]').forEach(x => x.onclick = () => {
            state.selected = x.dataset.openBuild;
            state.view = 'builds';
            persist();
            render();
        });
        root.querySelectorAll('[data-focus-champion]').forEach(x => x.onclick = () => {
            const group = championBuildGroups().find(g => g.key === x.dataset.focusChampion);
            if (!group)
                return;
            const previous = libraryLastVariant.get(group.key);
            libraryFocusedId = group.builds.find(b => b.id === previous)?.id || group.builds.find(b => b.id === state.selected)?.id || group.builds[0].id;
            libraryQuickEdit = false;
            focusLayoutEditing = false;
            render();
        });
        root.querySelectorAll('[data-switch-library-build]').forEach(x => x.onclick = e => {
            e.stopPropagation();
            const id = x.dataset.switchLibraryBuild;
            const group = championBuildGroups().find(g => g.builds.some(b => b.id === id));
            if (!group)
                return;
            libraryLastVariant.set(group.key, id);
            libraryFocusedId = id;
            libraryQuickEdit = false;
            render();
        });
        root.querySelectorAll('[data-edit-focused-build]').forEach(x => x.onclick = e => {
            e.stopPropagation();
            state.selected = x.dataset.editFocusedBuild;
            state.view = 'builds';
            persist();
            render();
        });
        root.querySelectorAll('[data-collapse-library]').forEach(x => x.onclick = () => {
            libraryFocusedId = null;
            libraryQuickEdit = false;
            focusLayoutEditing = false;
            render();
        });
        root.querySelectorAll('[data-unfocus-header]').forEach(header => {
            const unfocus = () => {
                libraryFocusedId = null;
                libraryQuickEdit = false;
                focusLayoutEditing = false;
                render();
            };
            header.addEventListener('click', e => {
                if (focusLayoutEditing || e.target.closest('button,a,input,select,textarea,label,[data-layout-ui]'))
                    return;
                unfocus();
            });
            header.addEventListener('keydown', e => {
                if (focusLayoutEditing || e.target !== header)
                    return;
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    unfocus();
                }
            });
        });
        bindStickerPickerButtons(root);
        bindFocusedQuickEdit(root);
        bindFocusCustomization(root);
        root.querySelectorAll('[data-create-champion]').forEach(x => x.onclick = () => createBuildForChampion(x.dataset.createChampion));
        root.querySelectorAll('[data-go-view]').forEach(x => x.onclick = () => {
            abandonDraft();
            if (x.dataset.goView === 'library') {
                libraryFocusedId = null;
                libraryQuickEdit = false;
            }
            state.view = x.dataset.goView;
            render();
        });
        root.querySelectorAll('[data-new-build]').forEach(x => x.onclick = () => createBuild());
        root.querySelectorAll('[data-export-all]').forEach(x => x.onclick = exportAllData);
        root.querySelectorAll('[data-import-all]').forEach(x => x.onclick = openImportAll);
        root.querySelectorAll('[data-import-share]').forEach(x => x.onclick = openShareImportDialog);
        root.querySelectorAll('[data-share-build]').forEach(x => x.onclick = e => {
            e.stopPropagation();
            openShareBuildDialog(x.dataset.shareBuild);
        });
        const hs = root.querySelector('#homeSearch');
        if (hs)
            hs.oninput = e => {
                state.homeSearch = e.target.value;
                const g = root.querySelector('#champGrid');
                if (g) {
                    g.innerHTML = renderChampionGrid();
                    bindCards(g);
                }
            };
        for (const [id, field] of [['homeFilter', 'homeFilter'], ['homeRole', 'homeRole'], ['homeSort', 'homeSort']])
            root.querySelector('#' + id)?.addEventListener('change', e => {
                state[field] = e.target.value;
                render();
            });
        root.querySelector('#addCustomItem')?.addEventListener('click', createCustomItem);
    }
    // Layout customizer is independent from Quick edit and never mutates saved build content.
    function bindFocusCustomization(root) {
        const card = root.querySelector('.library-focused-card');
        root.querySelector('[data-guide-visible]')?.addEventListener('change', e => changeFocusLayout(layout => {
            layout.page.guideVisible = e.target.checked;
        }));
        root.querySelector('[data-toggle-focus-layout]')?.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            focusLayoutEditing = !focusLayoutEditing;
            if (focusLayoutEditing)
                libraryQuickEdit = false;
            render();
        });
        root.querySelector('[data-reset-overview-layout]')?.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            changeFocusLayout(layout => {
                layout.page.overviewPositions = {};
                layout.page.overviewLayoutWidth = 0;
            });
        });
        bindOverviewBoard(root);
        root.querySelector('[data-reset-focus-layout]')?.addEventListener('click', e => {
            e.stopPropagation();
            if (!confirm('Reset the entire My Builds page layout? Your saved builds will not change.'))
                return;
            focusLayout = defaultFocusLayout();
            saveFocusLayout();
            render();
        });
        if (!focusLayoutEditing)
            return;
        root.querySelector('[data-page-pattern]')?.addEventListener('change', e => changeFocusLayout(layout => {
            layout.page.pattern = e.target.value;
        }));
        root.querySelectorAll('[data-page-space]').forEach(input => {
            input.addEventListener('input', () => {
                const grid = root.querySelector('[data-page-grid]'), id = input.dataset.pageSpace;
                if (grid)
                    grid.style.setProperty({ 'spaceLeft': '--page-space-left', 'spaceRight': '--page-space-right', 'spaceTop': '--page-space-top', 'spaceBottom': '--page-space-bottom' }[id], input.value + (id === 'spaceLeft' || id === 'spaceRight' ? '%' : 'px'));
                input.nextElementSibling.textContent = input.value + (id === 'spaceLeft' || id === 'spaceRight' ? '%' : 'px');
            });
            input.addEventListener('change', () => changeFocusLayout(layout => {
                layout.page[input.dataset.pageSpace] = Number(input.value);
            }));
        });
        root.querySelectorAll('[data-panel-gap]').forEach(input => {
            input.addEventListener('input', () => {
                const mosaic = root.querySelector('[data-page-mosaic]'), id = input.dataset.panelGap;
                if (mosaic)
                    mosaic.style.setProperty(id === 'stackGap' ? '--stack-gap' : '--panel-gap', input.value + 'px');
                input.nextElementSibling.textContent = input.value + 'px';
            });
            input.addEventListener('change', () => changeFocusLayout(layout => {
                layout.page[input.dataset.panelGap] = Number(input.value);
            }));
        });
        bindPagePanelCustomization(root);
        if (!card)
            return;
        card.querySelectorAll('[data-layout-section-width]').forEach(sel => sel.addEventListener('change', e => {
            e.stopPropagation();
            if (sel.value === 'custom')
                return;
            changeFocusLayout(layout => {
                const setting = layout.sections[sel.dataset.layoutSectionWidth];
                setting.width = sel.value;
                delete setting.percent;
            });
        }));
        card.querySelectorAll('[data-layout-visible]').forEach(inp => inp.addEventListener('change', e => {
            e.stopPropagation();
            changeFocusLayout(layout => {
                layout.sections[inp.dataset.layoutVisible].visible = inp.checked;
            });
        }));
        card.querySelectorAll('[data-layout-combo-width]').forEach(sel => sel.addEventListener('change', e => {
            e.stopPropagation();
            if (sel.value === 'custom')
                return;
            changeFocusLayout(layout => {
                layout.comboWidths[sel.dataset.layoutComboWidth] = sel.value;
                delete layout.comboPercents[sel.dataset.layoutComboWidth];
            });
        }));
        bindContinuousLayoutResize(card);
        bindVerticalInnerResize(card);
        let dragging = null, lastTarget = null;
        const clear = () => {
            card.querySelectorAll('.layout-drop-before,.layout-drop-after,.layout-dragging').forEach(el => el.classList.remove('layout-drop-before', 'layout-drop-after', 'layout-dragging'));
            lastTarget = null;
        };
        card.addEventListener('dragstart', e => {
            const section = e.target.closest('[data-layout-drag-section]'), combo = e.target.closest('[data-layout-drag-combo]');
            if (!section && !combo)
                return;
            dragging = section ? { kind: 'section', source: section.dataset.layoutDragSection } : { kind: 'combo', source: Number(combo.dataset.layoutDragCombo) };
            e.stopPropagation();
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', 'focus-layout');
            (section || combo).closest(dragging.kind === 'section' ? '[data-layout-section]' : '[data-layout-combo-index]')?.classList.add('layout-dragging');
        });
        card.addEventListener('dragover', e => {
            if (!dragging)
                return;
            const element = e.target.closest(dragging.kind === 'section' ? '[data-layout-section]' : '[data-layout-combo-index]');
            if (!element)
                return;
            const target = dragging.kind === 'section' ? element.dataset.layoutSection : Number(element.dataset.layoutComboIndex);
            if (target === dragging.source) {
                clear();
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            const r = element.getBoundingClientRect(), parent = element.parentElement.getBoundingClientRect();
            const sideways = r.width < parent.width * .65;
            const after = sideways ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
            const old = lastTarget;
            if (old?.element === element && old.after === after)
                return;
            clear();
            element.classList.add(after ? 'layout-drop-after' : 'layout-drop-before');
            lastTarget = { element, after, target };
        });
        card.addEventListener('drop', e => {
            if (!dragging || !lastTarget)
                return;
            e.preventDefault();
            e.stopPropagation();
            const { target, after } = lastTarget, dragged = dragging;
            dragging = null;
            clear();
            changeFocusLayout(layout => {
                if (dragged.kind === 'section')
                    layout.order = reorderFocusSlots(layout.order, dragged.source, target, after);
                else {
                    const b = state.builds.find(x => x.id === libraryFocusedId);
                    if (!b)
                        return;
                    const order = focusComboOrder(b);
                    layout.comboOrder = reorderFocusSlots(order, dragged.source, target, after);
                }
            });
        });
        card.addEventListener('dragend', () => {
            dragging = null;
            clear();
        });
    }
    // Resize section/augment-combo widths continuously with Pointer Events. Only visual data is saved.
    function bindContinuousLayoutResize(card) {
        card.querySelectorAll('[data-resize-section],[data-resize-combo]').forEach(grip => {
            grip.addEventListener('pointerdown', event => {
                if (event.button !== 0 && event.pointerType === 'mouse')
                    return;
                event.preventDefault();
                event.stopPropagation();
                const section = grip.dataset.resizeSection, comboIndex = grip.dataset.resizeCombo;
                const target = grip.closest(section ? '[data-layout-section]' : '[data-layout-combo-index]');
                const parent = target?.parentElement;
                if (!target || !parent)
                    return;
                const orig = Number(getComputedStyle(target).getPropertyValue('--focus-span')) || (section ? sectionColumnWidth(section) : comboColumnWidth(Number(comboIndex), 1));
                const width = parent.getBoundingClientRect().width;
                let percent = orig;
                grip.setPointerCapture(event.pointerId);
                target.classList.add('is-resizing-layout');
                const move = evt => {
                    percent = clampPercent(orig + (evt.clientX - event.clientX) / Math.max(1, width) * 100, 25);
                    target.style.setProperty('--focus-span', percent);
                    target.style.gridColumn = `span ${percent}`;
                    grip.setAttribute('aria-valuenow', String(percent));
                };
                const finish = () => {
                    grip.removeEventListener('pointermove', move);
                    grip.removeEventListener('pointerup', finish);
                    grip.removeEventListener('pointercancel', finish);
                    target.classList.remove('is-resizing-layout');
                    changeFocusLayout(layout => {
                        if (section)
                            layout.sections[section].percent = percent;
                        else
                            layout.comboPercents[comboIndex] = percent;
                    });
                };
                grip.addEventListener('pointermove', move);
                grip.addEventListener('pointerup', finish);
                grip.addEventListener('pointercancel', finish);
            });
        });
    }
    // Vertical sizing extends the section/combo without truncating its content.
    function bindVerticalInnerResize(card) {
        card.querySelectorAll('[data-resize-section-y],[data-resize-combo-y]').forEach(grip => {
            const section = grip.dataset.resizeSectionY, combo = grip.dataset.resizeComboY;
            const isSection = section !== undefined, key = isSection ? section : combo;
            const target = grip.closest(isSection ? '[data-layout-section]' : '[data-layout-combo-index]');
            if (!target)
                return;
            grip.addEventListener('dblclick', e => {
                e.preventDefault();
                e.stopPropagation();
                changeFocusLayout(l => {
                    if (isSection)
                        delete l.sectionHeights[key];
                    else
                        delete l.comboHeights[key];
                });
            });
            grip.addEventListener('pointerdown', e => {
                if (e.pointerType === 'mouse' && e.button !== 0)
                    return;
                e.preventDefault();
                e.stopPropagation();
                const orig = target.getBoundingClientRect().height;
                let height = Math.round(orig);
                const move = ev => {
                    height = Math.max(80, Math.min(1200, Math.round(orig + ev.clientY - e.clientY)));
                    target.style.setProperty('--custom-min-height', height + 'px');
                };
                const finish = () => {
                    grip.removeEventListener('pointermove', move);
                    grip.removeEventListener('pointerup', finish);
                    grip.removeEventListener('pointercancel', finish);
                    changeFocusLayout(l => {
                        if (isSection)
                            l.sectionHeights[key] = height;
                        else
                            l.comboHeights[key] = height;
                    });
                };
                grip.setPointerCapture(e.pointerId);
                grip.addEventListener('pointermove', move);
                grip.addEventListener('pointerup', finish);
                grip.addEventListener('pointercancel', finish);
            });
        });
    }
    // The top-level canvas is a separate set of movable panels; it never edits build content.
    // Two-dimensional panel snapping. Only panel layout settings are mutated.
    function bindPagePanelCustomization(root) {
        const mosaic = root.querySelector('[data-page-mosaic]');
        if (!mosaic)
            return;
        let dragged = null, hover = null, edge = null;
        const panels = () => [...mosaic.querySelectorAll('[data-page-panel]')];
        const clean = () => {
            panels().forEach(x => {
                x.classList.remove('page-drop-hover', 'page-panel-dragging');
                x.removeAttribute('data-drop-edge');
            });
            hover = null;
            edge = null;
        };
        function nearestEdge(target, e) {
            const rect = target.getBoundingClientRect(), x = (e.clientX - rect.left) / Math.max(1, rect.width), y = (e.clientY - rect.top) / Math.max(1, rect.height);
            const pattern = focusLayout.page.pattern;
            // A vertical stack is best manipulated by inserting above or below; its geometry
            // is independent of the main card's height.
            if (pattern.startsWith('split-') && target.dataset.slot !== 'primary')
                return y < 0.5 ? 'top' : 'bottom';
            if (pattern.startsWith('split-') && target.dataset.slot === 'primary') {
                if (y < 0.13)
                    return 'top';
                if (y > 0.87)
                    return 'bottom';
                return x < 0.5 ? 'left' : 'right';
            }
            const ds = { left: x, right: 1 - x, top: y, bottom: 1 - y };
            return Object.entries(ds).sort((a, b) => a[1] - b[1])[0][0];
        }
        mosaic.addEventListener('dragstart', e => {
            const grip = e.target.closest('[data-drag-page-panel]');
            if (!grip)
                return;
            dragged = grip.dataset.dragPagePanel;
            e.stopPropagation();
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', 'layout-panel');
            grip.closest('[data-page-panel]')?.classList.add('page-panel-dragging');
        });
        mosaic.addEventListener('dragover', e => {
            if (!dragged)
                return;
            const target = e.target.closest('[data-page-panel]');
            if (!target || target.dataset.pagePanel === dragged) {
                if (hover) {
                    clean();
                }
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            const nextEdge = nearestEdge(target, e);
            if (hover === target && edge === nextEdge)
                return;
            clean();
            hover = target;
            edge = nextEdge;
            target.classList.add('page-drop-hover');
            target.dataset.dropEdge = edge;
        });
        mosaic.addEventListener('drop', e => {
            if (!dragged || !hover)
                return;
            e.preventDefault();
            e.stopPropagation();
            const from = dragged, to = hover.dataset.pagePanel, direction = edge;
            dragged = null;
            clean();
            changeFocusLayout(l => {
                const slots = l.page.slots.filter(k => PAGE_PANELS.includes(k));
                const currentMain = slots[0];
                if (direction === 'top' || direction === 'bottom') {
                    if (to === currentMain) {
                        // Insert alongside the main card vertically, switching to a top/bottom layout.
                        l.page.pattern = direction === 'top' ? 'focus-bottom' : 'focus-top';
                        l.page.slots = [currentMain, from, ...slots.filter(k => k !== currentMain && k !== from)];
                    }
                    else if (l.page.pattern.startsWith('split-')) {
                        // Sort the side stack without changing the big panel or its height.
                        const newSide = slots.filter(k => k !== currentMain && k !== from);
                        const i = newSide.indexOf(to);
                        newSide.splice(i + (direction === 'bottom' ? 1 : 0), 0, from);
                        if (from === currentMain) {
                            // Moving the main panel onto a side panel promotes the other panel to main.
                            const replacement = slots.find(k => k !== from && k !== to) || to;
                            l.page.slots = [replacement, ...new Set([to, from, ...slots].filter(k => k !== replacement))];
                        }
                        else
                            l.page.slots = [currentMain, ...newSide];
                    }
                    else {
                        // In row/stack modes, put the dragged panel immediately before/after the target.
                        l.page.pattern = 'stacked';
                        l.page.slots = reorderFocusSlots(slots, from, to, direction === 'bottom');
                    }
                }
                else {
                    // A horizontal drop explicitly forms a side-by-side arrangement.
                    const main = (to === currentMain) ? to : from;
                    l.page.pattern = direction === 'left' ? 'split-left' : 'split-right';
                    l.page.slots = [main, ...new Set([from, to, ...slots].filter(k => k !== main))];
                }
            });
        });
        mosaic.addEventListener('dragend', () => {
            dragged = null;
            clean();
        });
        mosaic.querySelectorAll('[data-resize-page-panel],[data-resize-page-panel-y]').forEach(grip => {
            const vertical = grip.hasAttribute('data-resize-page-panel-y');
            const key = grip.dataset.resizePagePanelY || grip.dataset.resizePagePanel;
            grip.addEventListener('dblclick', e => {
                if (!vertical)
                    return;
                e.preventDefault();
                e.stopPropagation();
                changeFocusLayout(l => {
                    l.page.heights[key] = 0;
                });
            });
            grip.addEventListener('pointerdown', e => {
                if (e.pointerType === 'mouse' && e.button !== 0)
                    return;
                if (!vertical && window.innerWidth <= 800)
                    return;
                e.preventDefault();
                e.stopPropagation();
                const panel = grip.closest('[data-page-panel]');
                if (!panel)
                    return;
                const layout = focusLayout.page, slot = panel.dataset.slot;
                const split = layout.pattern.startsWith('split-');
                const leftEdge = split && layout.pattern === 'split-left' && slot === 'primary';
                const mosaicRect = mosaic.getBoundingClientRect();
                const mainKey = layout.slots[0], mainWidth = layout.widths[mainKey];
                const referenceWidth = layout.focusReferenceWidth || Math.max(1440, mosaicRect.width);
                const baseWidth = layout.widths[key], baseHeight = panel.getBoundingClientRect().height;
                const min = PAGE_MIN[key];
                const gapPct = layout.panelGap / Math.max(1, mosaicRect.width) * 100;
                const otherWidths = layout.slots.slice(1).filter(k => k !== key).map(k => layout.widths[k]);
                const maxWidth = split ? (slot === 'primary' ? Math.min(85, 100 - Math.max(...otherWidths, PAGE_MIN.others) - gapPct) : 100 - mainWidth - gapPct) : 100;
                let next = vertical ? Math.round(baseHeight) : baseWidth;
                const move = ev => {
                    if (vertical) {
                        next = Math.max(120, Math.min(1600, Math.round(baseHeight + ev.clientY - e.clientY)));
                        panel.style.setProperty('--page-height', next + 'px');
                        panel.classList.add('has-custom-height');
                    }
                    else {
                        const d = Math.round((ev.clientX - e.clientX) / Math.max(1, split ? referenceWidth : mosaicRect.width) * 100) * (leftEdge ? -1 : 1);
                        next = Math.round(Math.max(min, Math.min(Math.max(min, maxWidth), baseWidth + d)));
                        if (split) {
                            const sideStack = mosaic.querySelector('.page-side-stack');
                            if (slot === 'primary') {
                                mosaic.style.setProperty('--primary-width', next + '%');
                                mosaic.style.setProperty('--primary-preferred-px', (referenceWidth * next / 100) + 'px');
                                const mainTrack = mosaic.querySelector('.page-main-track');
                                if (mainTrack)
                                    mainTrack.style.setProperty('--primary-width', next + '%');
                            }
                            else {
                                const maxSide = Math.max(next, ...layout.slots.slice(1).filter(k => k !== key).map(k => layout.widths[k]));
                                if (sideStack) {
                                    sideStack.style.setProperty('--side-width', maxSide + '%');
                                    sideStack.style.setProperty('--side-preferred-px', (referenceWidth * maxSide / 100) + 'px');
                                    mosaic.style.setProperty('--side-preferred-px', (referenceWidth * maxSide / 100) + 'px');
                                }
                                if (sideStack)
                                    sideStack.querySelectorAll('[data-page-panel]').forEach(p => {
                                        const w = p === panel ? next : layout.widths[p.dataset.pagePanel];
                                        p.style.setProperty('--panel-inner-width', Math.min(100, Math.round(w / Math.max(1, maxSide) * 100)));
                                    });
                            }
                        }
                        else if (layout.pattern === 'columns' || layout.pattern === 'stacked' || layout.pattern.startsWith('focus-'))
                            panel.style.width = next + '%';
                        const readout = panel.querySelector('.page-width-readout');
                        if (readout)
                            readout.textContent = next + '%';
                    }
                    const readout = panel.querySelector('.page-width-readout');
                    if (readout && vertical)
                        readout.textContent = next + 'px';
                };
                const end = () => {
                    grip.removeEventListener('pointermove', move);
                    grip.removeEventListener('pointerup', end);
                    grip.removeEventListener('pointercancel', end);
                    changeFocusLayout(l => {
                        if (vertical)
                            l.page.heights[key] = next;
                        else {
                            l.page.widths[key] = next;
                            if (split)
                                l.page.focusReferenceWidth = referenceWidth;
                        }
                    });
                };
                grip.setPointerCapture(e.pointerId);
                grip.addEventListener('pointermove', move);
                grip.addEventListener('pointerup', end);
                grip.addEventListener('pointercancel', end);
            });
        });
    }
    function bindFocusedQuickEdit(root) {
        const card = root.querySelector('.library-focused-card');
        if (!card)
            return;
        const b = state.builds.find(x => x.id === libraryFocusedId);
        if (!b)
            return;
        const apply = () => {
            b.updated = new Date().toLocaleDateString();
            persist();
            render();
        };
        // Selecting a combo only changes what appears in the item summary, never the stored build.
        card.querySelectorAll('[data-select-combo]').forEach(el => el.addEventListener('click', e => {
            e.stopPropagation();
            activateLibraryCombo(b, el.dataset.selectCombo);
        }));
        card.querySelectorAll('[data-activate-combo]').forEach(el => el.addEventListener('click', e => {
            if (e.target.closest('button,input,select,label,a,summary,details,[draggable],.combo-core-editor'))
                return;
            e.stopPropagation();
            activateLibraryCombo(b, el.dataset.activateCombo);
        }));
        const toggle = card.querySelector('#focusQuickEdit');
        toggle?.addEventListener('change', e => {
            libraryQuickEdit = e.target.checked;
            render();
        });
        if (!libraryQuickEdit)
            return; // Read-only focus mode: combo selection still works; mutation is blocked.
        bindComboCoreControls(card, b);
        bindHeadlinerPickers(card, 'data-focus-headliner-choice', apply, b);
        for (const k of ['first', 'second'])
            card.querySelectorAll(`[data-focus-penta-${k}]`).forEach(el => el.addEventListener('change', () => {
                const c = comboById(b, el.dataset['focusPenta' + k[0].toUpperCase() + k.slice(1)]);
                if (!c)
                    return;
                const value = el.value;
                if (value && c.pentakill[k === 'first' ? 'second' : 'first'] === value)
                    return toast('Choose two different abilities');
                c.pentakill[k] = value;
                apply();
            }));
        let drag = null;
        const preview = dragPreview();
        card.addEventListener('dragstart', e => {
            const el = e.target.closest('[data-focus-drag-combo]');
            if (!el)
                return;
            drag = { combo: el.dataset.focusDragCombo, id: el.dataset.focusDragAug };
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', JSON.stringify(drag));
            el.closest('.focus-aug-row')?.classList.add('dragging');
        });
        card.addEventListener('dragover', e => {
            const zone = e.target.closest('[data-focus-combo-drop]');
            if (!drag || !zone)
                return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            preview.show(zone, e, '.focus-aug-list', '[data-focus-target-aug]');
        });
        card.addEventListener('drop', e => {
            const zone = e.target.closest('[data-focus-combo-drop]');
            if (!drag || !zone)
                return;
            e.preventDefault();
            e.stopPropagation();
            const next = preview.next(), before = next?.dataset.focusTargetAug || null;
            const from = drag;
            preview.clear();
            drag = null;
            if (moveAugmentInBuild(b, from.combo, from.id, zone.dataset.focusComboDrop, before))
                apply();
        });
        card.addEventListener('dragend', () => {
            drag = null;
            preview.clear();
            card.querySelectorAll('.dragging,.drop-ready').forEach(x => x.classList.remove('dragging', 'drop-ready'));
        });
    }
    let siteSpacingEditing = false;
    function siteSpacingToolbar(key) {
        const a = focusLayout.spaces[key] || defaultSpace();
        return `<div class="page-space-toolbar" data-layout-ui><strong>${key === 'home' ? 'Champions' : key === 'builds' ? 'Build editor' : key === 'champion' ? 'Champion builds' : key === 'augments' ? 'Augments' : key === 'items' ? 'Items' : 'Headliners'} · blank space</strong>${[['left', 'Left', 35, '%'], ['right', 'Right', 35, '%'], ['top', 'Top', 320, 'px'], ['bottom', 'Bottom', 320, 'px']].map(([id, label, max, unit]) => `<label>${label}<input type="range" min="0" max="${max}" value="${a[id]}" data-site-space="${id}" aria-label="${label} blank space for this page"><output>${a[id]}${unit}</output></label>`).join('')}<button class="btn smallbtn ghost" data-reset-site-space>Reset this page</button></div>`;
    }
    function bindSiteSpacing(root) {
        root.querySelectorAll('[data-site-space]').forEach(el => {
            const prop = { left: '--site-left', right: '--site-right', top: '--site-top', bottom: '--site-bottom' }[el.dataset.siteSpace];
            const unit = ['left', 'right'].includes(el.dataset.siteSpace) ? '%' : 'px';
            el.addEventListener('input', () => {
                root.querySelector('[data-site-canvas]')?.style.setProperty(prop, el.value + unit);
                el.nextElementSibling.textContent = el.value + unit;
            });
            el.addEventListener('change', () => changeFocusLayout(l => {
                l.spaces[state.view][el.dataset.siteSpace] = Number(el.value);
            }));
        });
        root.querySelector('[data-reset-site-space]')?.addEventListener('click', () => changeFocusLayout(l => {
            l.spaces[state.view] = defaultSpace();
        }));
    }
    function render() {
        closeStickerPopup();
        document.body.classList.toggle('index-mode', state.view !== 'builds');
        document.body.classList.toggle('editor-mode', state.view === 'builds');
        document.body.classList.toggle('library-page-mode', state.view === 'library');
        renderSidebar();
        document.getElementById('patchTag').textContent = 'Patch ' + currentGamePatch() + (patchValue(state.patch) < patchValue(currentGamePatch()) ? ' · stats ' + state.patch : '');
        document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('active', x.dataset.view === state.view || (state.view === 'champion' && x.dataset.view === 'home') || (state.view === 'builds' && x.dataset.view === 'library')));
        document.getElementById('dataStatus').textContent = state.status;
        const spacingButton = document.getElementById('siteSpacingToggle');
        spacingButton.hidden = state.view === 'library';
        spacingButton.classList.toggle('primary', siteSpacingEditing && state.view !== 'library');
        spacingButton.onclick = () => {
            siteSpacingEditing = !siteSpacingEditing;
            render();
        };
        const c = document.getElementById('content');
        const page = state.view === 'home' ? renderHomeView() : state.view === 'champion' ? renderChampionView() : state.view === 'library' ? renderLibraryView() : state.view === 'builds' ? renderBuildView() : state.view === 'augments' ? renderAugmentsView() : state.view === 'items' ? renderItemsView() : renderHeadlinersView();
        if (state.view === 'library')
            c.innerHTML = page;
        else {
            const x = focusLayout.spaces[state.view] || defaultSpace();
            c.innerHTML = (siteSpacingEditing ? siteSpacingToolbar(state.view) : '') + `<div class="site-page-canvas" data-site-canvas style="--site-left:${x.left}%;--site-right:${x.right}%;--site-top:${x.top}px;--site-bottom:${x.bottom}px">${page}</div>`;
        }
        bindView();
        bindCards(c);
        bindSiteSpacing(c);
        if (quickAugComboId) {
            if (state.view === 'builds' && document.querySelector(`[data-combo-target="${CSS.escape(quickAugComboId)}"]`))
                requestAnimationFrame(positionQuickAugPicker);
            else
                closeQuickAugPicker();
        }
    }
    function detailOpenAug(id) {
        const a = getAug(id), effect = augEffect(a), b = build() ? ensureBuildV7(build()) : null;
        const url = a.url && /^https:\/\/arammayhem\.com\//.test(a.url) ? a.url : 'https://arammayhem.com/augments/' + slug(a.name) + '/';
        const host = document.getElementById('detailHost');
        host.innerHTML = `<div class="detail-overlay" role="presentation"><div class="detail-dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(a.name)}"><div class="detail-head">${augVisual(a)}<div style="min-width:0;flex:1"><div class="detail-title">${escapeHtml(a.name)}</div>${rarityLabel(a)}</div><button class="detail-close" data-close aria-label="Close details">✕</button></div>${augStats(a)}<div class="aug-source-caption">${escapeHtml(effect.source)}</div><div class="detail-desc">${escapeHtml(effect.text)}</div>${effect.warning ? `<div class="aug-effect-note">${escapeHtml(effect.warning)}</div>` : ''}<p><a class="aug-detail-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">Read current effect and full stats on ARAMMayhem.com ↗</a></p>${b ? `<div class="detail-add-combo"><label for="detailCombo">Add to an augment combo</label><div class="row"><select id="detailCombo">${b.augmentCombos.map(c => `<option value="${escapeHtml(c.id)}" ${c.id === b.activeComboId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select><button class="btn primary" id="detailAddAug">+ Add augment</button></div><p class="hint">${b.augmentCombos.filter(c => c.augments.includes(id)).map(c => escapeHtml(c.name)).join(' · ') || 'Not yet in a combo'}</p></div>` : ''}${b && b.augmentCombos.some(c => hasComboHeadliner(c, 'HEARTSTEEL') && c.augments.includes(id)) ? `<div class="detail-stickers"><label>HEARTSTEEL sticker</label><select id="detailSticker"><option value="">Choose sticker</option>${HEARTSTEEL_BONUSES.map(x => `<option value="${escapeHtml(x.member)}" ${b.augmentCombos.find(c => hasComboHeadliner(c, 'HEARTSTEEL') && c.augments.includes(id))?.stickers?.[id] === x.member ? 'selected' : ''}>${escapeHtml(x.member)} — ${escapeHtml(x.effect)}</option>`).join('')}</select><small class="hint">Applies to a HEARTSTEEL combo containing this augment.</small></div>` : ''}<div class="detail-footer"><button class="btn smallbtn" data-edit-description="${escapeHtml(id)}">Edit personal details</button><p class="creditline">Augment stats & selected verified effects: <a href="https://arammayhem.com/data/" target="_blank" rel="noopener">ARAMMayhem.com</a> (CC BY 4.0); other tooltips: <a href="https://communitydragon.org/" target="_blank" rel="noopener">CommunityDragon</a>.</p></div></div></div>`;
        host.querySelector('[data-close]').onclick = closeDetail;
        host.querySelector('.detail-overlay').addEventListener('click', e => {
            if (e.target.classList.contains('detail-overlay'))
                closeDetail();
        });
        host.querySelector('#detailAddAug')?.addEventListener('click', () => {
            const target = host.querySelector('#detailCombo').value;
            addToCombo(id, target);
            closeDetail();
        });
        host.querySelector('#detailSticker')?.addEventListener('change', e => {
            setSticker(id, e.target.value, host.querySelector('#detailCombo')?.value);
            closeDetail();
        });
        host.querySelector('[data-edit-description]').onclick = () => {
            closeDetail();
            editAug(id);
        };
        host.querySelector('.detail-close').focus();
    }
    function detailOpenItem(id) {
        const item = state.items.find(x => x.id === id);
        if (!item)
            return;
        const host = document.getElementById('detailHost');
        host.innerHTML = `<div class="detail-overlay"><div class="detail-dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(item.name)}"><div class="detail-head"><img class="item-detail-art" src="${itemImg(id)}" alt=""><div style="flex:1"><div class="detail-title">${escapeHtml(item.name)}</div><span class="small">${escapeHtml(item.category || 'Item')} · ${item.gold?.total ?? item.cost ?? '—'} gold</span></div><button class="detail-close" data-close>✕</button></div><div class="detail-desc">${escapeHtml(plainDesc(item.description) || 'No full tooltip in the public dataset.')}</div><div class="detail-stickers"><label>Personal item note</label><div class="small">${escapeHtml(state.itemNotes[id] || 'No note yet.')}</div><button class="btn smallbtn" style="margin-top:9px" id="editItemNote">Edit note</button></div>${build() ? `<div class="detail-add-combo"><label for="detailItemSlot">Add to item group</label><div class="row"><select id="detailItemSlot">${ITEM_SLOTS.map(slot => `<option value="${slot}" ${slot === preferredItemSlot ? 'selected' : ''}>${ITEM_LABELS[slot]}</option>`).join('')}</select><button class="btn primary" id="detailAddItem">+ Add item</button></div><p class="hint">Drag items to reorder or move between groups.</p></div>` : ''}</div></div>`;
        host.querySelector('[data-close]').onclick = closeDetail;
        host.querySelector('#editItemNote').onclick = () => {
            const note = prompt('Personal Mayhem item note:', state.itemNotes[id] || '');
            if (note === null)
                return;
            if (note.trim())
                state.itemNotes[id] = note.trim();
            else
                delete state.itemNotes[id];
            persist();
            detailOpenItem(id);
        };
        host.querySelector('.detail-overlay').onclick = e => {
            if (e.target.classList.contains('detail-overlay'))
                closeDetail();
        };
        host.querySelector('#detailAddItem')?.addEventListener('click', () => {
            preferredItemSlot = host.querySelector('#detailItemSlot').value;
            addItemToSlot(id, preferredItemSlot);
            closeDetail();
        });
    }
    function closeDetail() {
        document.getElementById('detailHost').innerHTML = '';
    }
    function stickerInfo(member) {
        return HEARTSTEEL_BONUSES.find(x => x.member === member);
    }
    function setSticker(id, member, comboId) {
        const b = build();
        if (!b)
            return;
        const chosen = comboById(b, comboId);
        const c = (hasComboHeadliner(chosen, 'HEARTSTEEL') && chosen.augments.includes(id) ? chosen : null) || b.augmentCombos.find(x => hasComboHeadliner(x, 'HEARTSTEEL') && x.augments.includes(id));
        if (!c || !hasComboHeadliner(c, 'HEARTSTEEL'))
            return toast('Select a HEARTSTEEL combo first');
        if (member && !stickerInfo(member))
            return toast('Unknown HEARTSTEEL member');
        if (member)
            c.stickers[id] = member;
        else
            delete c.stickers[id];
        touch();
        render();
        toast(member ? 'Sticker saved for ' + getAug(id).name : 'Sticker removed');
    }
    // V31: one-click augment picker for one combo. Its state is transient; only adding
    // an augment changes the saved build. The full augment catalog remains available.
    let quickAugComboId = null, quickAugQuery = '', quickAugRarity = 'all';
    function quickAugChoiceData() {
        const b = build(), combo = b && comboById(ensureBuildV7(b), quickAugComboId);
        if (!combo)
            return null;
        const q = keyName(quickAugQuery), all = allAugments().filter(a => (quickAugRarity === 'all' || a.rarity === quickAugRarity) && (!q || keyName(a.name).includes(q)));
        // Selected augments stay at the end; available choices appear first.
        const sorted = [...all].sort((a, b) => Number(combo.augments.includes(a.id)) - Number(combo.augments.includes(b.id)) || a.name.localeCompare(b.name));
        return { combo, all, sorted };
    }
    function quickAugResults() {
        const x = quickAugChoiceData();
        if (!x)
            return { html: '', count: 0, available: 0 };
        const shown = x.sorted.slice(0, 90), available = x.all.filter(a => !x.combo.augments.includes(a.id)).length;
        return { count: x.all.length, available, html: shown.map(a => {
                const chosen = x.combo.augments.includes(a.id);
                return `<button type="button" class="quick-aug-choice" data-quick-aug-add="${escapeHtml(a.id)}" ${chosen ? 'disabled aria-label="Already added"' : ''} title="${escapeHtml(a.name)}${chosen ? ' — already in this combo' : ' — add to this combo'}">${augVisual(a)}<span class="quick-aug-choice-info"><strong>${escapeHtml(a.name)}</strong>${rarityLabel(a)}</span><span class="quick-aug-add-icon">${chosen ? '✓ Added' : '+'}</span></button>`;
            }).join('') || '<p class="quick-aug-empty">No augments match your search.</p>' };
    }
    function refreshQuickAugPickerResults() {
        const host = document.getElementById('quickAugHost'), results = host?.querySelector('[data-quick-aug-results]');
        if (!results)
            return;
        const r = quickAugResults();
        results.innerHTML = r.html;
        host.querySelector('[data-quick-aug-count]').textContent = r.count ? `${r.available} available · ${r.count} matching${r.count > 90 ? ' · showing first 90' : ''}` : 'No matches';
        host.querySelector('[data-quick-aug-added]').textContent = `${quickAugChoiceData()?.combo.augments.length || 0} in combo`;
        results.querySelectorAll('[data-quick-aug-add]').forEach(btn => btn.onclick = () => {
            if (btn.disabled || !quickAugComboId)
                return;
            // addToCombo persists, re-renders the build, and updates the selected combo.
            addToCombo(btn.dataset.quickAugAdd, quickAugComboId);
            refreshQuickAugPickerResults();
            // Keep palette open and search ready for the next add.
            document.getElementById('quickAugHost')?.querySelector('[data-quick-aug-search]')?.focus({ preventScroll: true });
        });
    }
    function positionQuickAugPicker() {
        if (!quickAugComboId)
            return;
        const pop = document.querySelector('#quickAugHost .quick-aug-picker'), button = [...document.querySelectorAll('[data-combo-target]')].find(x => x.dataset.comboTarget === quickAugComboId);
        if (!pop || !button)
            return;
        const anchor = button.getBoundingClientRect(), gap = 7, w = pop.offsetWidth || 425, h = pop.offsetHeight || 520;
        let left = anchor.left, top = anchor.bottom + gap;
        if (left + w > innerWidth - 8)
            left = innerWidth - w - 8;
        if (left < 8)
            left = 8;
        // If too close to the viewport bottom, open upward; otherwise keep it nearby.
        if (top + h > innerHeight - 8 && anchor.top - h - gap >= 8)
            top = anchor.top - h - gap;
        else
            top = Math.min(top, Math.max(8, innerHeight - h - 8));
        pop.style.left = Math.round(left) + 'px';
        pop.style.top = Math.round(Math.max(8, top)) + 'px';
    }
    function closeQuickAugPicker() {
        quickAugComboId = null;
        const host = document.getElementById('quickAugHost');
        if (host)
            host.innerHTML = '';
    }
    function openQuickAugPicker(comboId) {
        const b = build(), combo = b && comboById(ensureBuildV7(b), comboId);
        if (!combo)
            return;
        if (quickAugComboId === comboId && document.querySelector('#quickAugHost .quick-aug-picker')) {
            closeQuickAugPicker();
            return;
        }
        quickAugComboId = comboId;
        quickAugQuery = '';
        quickAugRarity = 'all';
        const host = document.getElementById('quickAugHost');
        host.innerHTML = `<section class="quick-aug-picker" role="dialog" aria-label="Quick add augments to ${escapeHtml(combo.name)}"><div class="quick-aug-header"><div class="quick-aug-heading"><strong>+ Add to ${escapeHtml(combo.name)}</strong><small>Select augments to add instantly</small></div><button class="quick-aug-close" type="button" data-quick-aug-close title="Close" aria-label="Close quick augment picker">×</button></div><div class="quick-aug-tools"><input type="search" data-quick-aug-search placeholder="Search augments…" aria-label="Search augments" autocomplete="off"><select data-quick-aug-rarity aria-label="Filter augment rarity"><option value="all">All rarities</option><option value="silver">Silver</option><option value="gold">Gold</option><option value="prismatic">Prismatic</option></select></div><div class="quick-aug-result-summary" data-quick-aug-count></div><div class="quick-aug-results" data-quick-aug-results></div><div class="quick-aug-footer"><span data-quick-aug-added></span><button type="button" class="btn smallbtn" data-quick-aug-done>Done</button></div></section>`;
        host.querySelector('[data-quick-aug-close]').onclick = closeQuickAugPicker;
        host.querySelector('[data-quick-aug-done]').onclick = closeQuickAugPicker;
        const input = host.querySelector('[data-quick-aug-search]');
        input.oninput = () => {
            quickAugQuery = input.value;
            refreshQuickAugPickerResults();
            host.querySelector('[data-quick-aug-results]').scrollTop = 0;
        };
        input.onkeydown = e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const first = host.querySelector('[data-quick-aug-add]:not(:disabled)');
                if (first)
                    first.click();
            }
        };
        host.querySelector('[data-quick-aug-rarity]').onchange = e => {
            quickAugRarity = e.target.value;
            refreshQuickAugPickerResults();
        };
        refreshQuickAugPickerResults();
        positionQuickAugPicker();
        input.focus({ preventScroll: true });
    }
    document.addEventListener('pointerdown', e => {
        if (!quickAugComboId || e.target.closest('#quickAugHost') || e.target.closest('[data-combo-target]'))
            return;
        closeQuickAugPicker();
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && quickAugComboId)
            closeQuickAugPicker();
    });
    window.addEventListener('resize', positionQuickAugPicker);
    window.addEventListener('scroll', positionQuickAugPicker, true);
    function bindAugLinks(root = document) {
        root.querySelectorAll('[data-augpick],[data-aug-info],[data-edit-aug]').forEach(x => x.onclick = () => detailOpenAug(x.dataset.augpick || x.dataset.augInfo || x.dataset.editAug));
        root.querySelectorAll('[data-item-info]').forEach(x => x.onclick = () => detailOpenItem(x.dataset.itemInfo));
    }
    function renderBuildView() {
        const raw = build();
        if (!raw)
            return `<div class="section-head"><h1>My ARAM Mayhem Builds</h1><button class="btn primary" id="newMain">+ Create build</button></div><div class="panel"><div class="empty"><h2>No builds yet</h2><p>Create your first build and save your items, augment combos and Headliners.</p><button class="btn primary" id="newEmpty">Create build</button></div></div>`;
        const b = ensureBuildV7(raw);
        return `<div class="editor-back"><button class="btn ghost" id="backToChampion">← Champion builds</button><button class="btn ghost" data-go-view="library">All saved builds</button></div><div class="hero"><img class="avatar large" src="${champImg(b.champion)}" alt=""><div style="flex:1"><div class="row"><span class="tag">${draftBuild?.id === b.id ? 'UNSAVED DRAFT · SELECT CHAMPION' : 'PERSONAL BUILD'}</span><span class="small">Updated ${escapeHtml(b.updated || 'today')}</span></div><h1>${escapeHtml(b.championName || 'Choose champion')} — ${escapeHtml(b.title || 'Untitled')}</h1><p>${escapeHtml(b.style || 'Custom ARAM Mayhem build')}</p>${buildAttribution(b)}</div><button class="btn primary" id="saveBuild" title="Confirm this build is saved to your browser">✓ Save build</button><button class="btn share-build-btn" data-share-build="${escapeHtml(b.id)}" ${draftBuild?.id === b.id ? 'disabled title="Choose a champion before sharing"' : 'title="Share this build as a link"'}>↗ Share build</button><button class="btn" id="duplicateBuild">Duplicate</button><button class="btn danger" id="deleteBuild">${draftBuild?.id === b.id ? 'Discard' : 'Delete'}</button></div>
<div class="panel editor-detail-panel"><h2>Build details</h2><div class="grid2"><div class="field"><label>Champion</label><input id="champInput" list="champList" placeholder="Search champion" value="${escapeHtml(b.championName || '')}"><datalist id="champList">${state.champions.map(x => `<option value="${escapeHtml(x.name)}"></option>`).join('')}</datalist></div><div class="field"><label>Build title</label><input data-field="title" value="${escapeHtml(b.title)}" placeholder="e.g. AP On-Hit"></div><div class="field"><label>Playstyle / category</label><input data-field="style" value="${escapeHtml(b.style || '')}" placeholder="Tank / AP / Support / etc."></div><div class="field"><label>Summoner spells</label><input data-field="spells" value="${escapeHtml(b.spells || 'Mark, Flash')}"></div><div class="field"><label>Skill priority</label><select data-field="skill">${['Q > W > E', 'Q > E > W', 'W > Q > E', 'W > E > Q', 'E > Q > W', 'E > W > Q'].map(x => `<option value="${x}" ${b.skill === x ? 'selected' : ''}>${x.replaceAll('>', '→')}</option>`).join('')}</select></div></div><details class="editor-intro"><summary>Build introduction (optional)</summary><textarea data-field="intro" placeholder="Why this build works…">${escapeHtml(b.intro || '')}</textarea></details></div>
<div class="panel"><div class="section-head"><div><h2 style="margin:0">Items</h2><p class="hint">Use Browse items to add to a group, or drag the dotted handles to reorder items or move them between groups.</p></div><button class="btn smallbtn browse-editor-control" id="toggleItemPicker" aria-expanded="${state.itemPickerOpen}">${state.itemPickerOpen ? '− Hide item catalog' : '+ Browse items'}</button></div><div class="items-selected">${['start', 'boots', 'core', 'options', 'pool'].map(s => itemBucket(b, s)).join('')}</div><div id="itemPickerWrap" class="collapsible-picker ${state.itemPickerOpen ? '' : 'hidden'}"><hr class="divider"><p class="item-status" id="itemStatus">${escapeHtml(state.itemSource)} · ${state.items.length} unique items</p><div class="picker"><input id="itemSearch" placeholder="Search all items…" value="${escapeHtml(state.itemSearch)}"><select id="itemCategory" aria-label="Filter item types"><option value="all" ${state.itemCategory === 'all' ? 'selected' : ''}>All items</option><option value="complete" ${state.itemCategory === 'complete' ? 'selected' : ''}>Finished items</option><option value="boots" ${state.itemCategory === 'boots' ? 'selected' : ''}>Boots</option><option value="components" ${state.itemCategory === 'components' ? 'selected' : ''}>Components</option><option value="starter" ${state.itemCategory === 'starter' ? 'selected' : ''}>Starting / Consumables</option></select></div><p class="hint">Click an item to choose a group and add it, or drag the item directly into a group.</p><div class="itemcatalog" id="itemCatalog">${renderItemCatalog()}</div></div></div>
<div class="panel"><div class="section-head"><div><h2 style="margin:0">Augment combos</h2><p class="hint">Each combo can have multiple Headliners. Drag augments by the dotted handle to reorder within a combo or move between combos.</p></div><div class="row"><button class="btn smallbtn" id="addCombo">+ Add combo</button><button class="btn smallbtn browse-editor-control" id="toggleAugPicker" aria-expanded="${state.augPickerOpen}">${state.augPickerOpen ? '− Hide augment catalog' : '+ Browse augments'}</button></div></div>${renderComboRows(b)}<div id="augPickerWrap" class="collapsible-picker ${state.augPickerOpen ? '' : 'hidden'}"><hr class="divider"><div class="picker"><input id="augSearch" placeholder="Search augments…" value="${escapeHtml(state.augSearch)}"><select id="augRarity"><option value="all" ${state.augRarity === 'all' ? 'selected' : ''}>All rarities</option>${['silver', 'gold', 'prismatic'].map(r => `<option value="${r}" ${state.augRarity === r ? 'selected' : ''}>${r[0].toUpperCase() + r.slice(1)}</option>`).join('')}</select></div><div class="row" style="margin:11px 0"><span class="hint">Click an augment to inspect and add to a combo. Drag from the catalog onto a combo row to add directly.</span><label style="margin:0"><input type="checkbox" id="newOnly" style="width:auto" ${state.newOnly ? 'checked' : ''}> New in 26.21+</label></div><div class="catalog" id="buildAugCatalog">${renderAugCatalog(b)}</div></div></div>
<div class="panel"><h2>Strategy & notes</h2><textarea data-field="notes" placeholder="Combos, synergies, alternates, matchups…">${escapeHtml(b.notes || '')}</textarea><div class="row between" style="margin-top:10px"><span class="hint" data-save-status>Changes are autosaved to this browser.</span><div class="row"><button class="btn primary" id="saveBuildBottom">✓ Save build</button><button class="btn" id="exportCurrent">Export this build</button><button class="btn share-build-btn" data-share-build="${escapeHtml(b.id)}" ${draftBuild?.id === b.id ? 'disabled title="Choose a champion before sharing"' : 'title="Share this build as a link"'}>↗ Share build</button></div></div></div>`;
    }
    function itemCategoryMatch(i) {
        const c = (i.category || '').toLowerCase();
        if (state.itemCategory === 'all')
            return true;
        if (state.itemCategory === 'extras')
            return ['custom', 'riot-extra'].includes(i.source);
        if (state.itemCategory === 'complete')
            return ['legendary', 'boots_tier2', 'mythic'].includes(c);
        if (state.itemCategory === 'boots')
            return c.startsWith('boots');
        if (state.itemCategory === 'components')
            return ['basic', 'epic'].includes(c);
        if (state.itemCategory === 'starter')
            return ['starter', 'consumable', 'trinket', 'vision'].includes(c);
        return true;
    }
    function itemVisual(item) {
        const src = itemImg(item.id), numeric = String(item.imageId || item.id);
        const fallbacks = [src];
        if (/^\d+$/.test(numeric))
            fallbacks.push(`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/item-icons/${numeric}.png`);
        return `<span class="item-picture"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M15 52L49 14l-4-4L11 46l-2 9zM30 10l24 24M33 9l22 22" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>${src ? `<img class="item-art-image" src="${escapeHtml(src)}" data-imgs="${escapeHtml([...new Set(fallbacks)].join('|'))}" data-pos="0" alt="" loading="lazy">` : ''}</span>`;
    }
    function renderItemCatalog() {
        const q = slug(state.itemSearch);
        return state.items.filter(x => itemCategoryMatch(x) && slug(x.name).includes(q)).map(x => `<button class="itemoption" draggable="true" data-drag-catalog-item="${escapeHtml(x.id)}" data-item-info="${escapeHtml(x.id)}" title="${escapeHtml(x.name)} — click for details, or drag to a category">${itemVisual(x)}<span class="item-option-text"><strong>${escapeHtml(x.name)}</strong><small>${escapeHtml((x.category || 'item').replace(/_/g, ' '))}${x.cost != null ? ' · ' + Number(x.cost) + 'g' : ''}</small></span></button>`).join('') || '<p class="hint">No items match.</p>';
    }
    function renderAugCatalog(b) {
        const chosen = new Set(chosenAugmentIds(ensureBuildV7(b)));
        return allAugments().filter(a => (state.augRarity === 'all' || a.rarity === state.augRarity) && a.name.toLowerCase().includes(state.augSearch.toLowerCase()) && (!state.newOnly || parseFloat(a.introducedPatch) >= 26.21)).map(a => `<button class="augcard ${chosen.has(a.id) ? 'selected' : ''}" draggable="true" data-drag-catalog-aug="${escapeHtml(a.id)}" data-augpick="${escapeHtml(a.id)}">${augVisual(a)}<span style="min-width:0;flex:1"><span class="augname">${escapeHtml(a.name)}</span><span class="item-meta">${rarityLabel(a)}${a.pickRate != null ? `<span class="small">${Number(a.pickRate).toFixed(1)}% picked</span>` : ''}</span><span class="summary">${escapeHtml(augDescription(a) || 'Click for details & add to a combo')}</span></span><span class="info-hint">ⓘ</span></button>`).join('') || '<p class="hint">No matching augments.</p>';
    }
    function filteredDatabaseAugments() {
        const search = keyName(state.augSearch), words = state.augSearch.toLowerCase().trim();
        const list = allAugments().filter(a => (state.augRarity === 'all' || a.rarity === state.augRarity) && (!search || keyName(a.name).includes(search) || augDescription(a).toLowerCase().includes(words)));
        return list.sort((a, b) => state.augSort === 'az' ? a.name.localeCompare(b.name) : (Number(a.pickRateRank) || 9999) - (Number(b.pickRateRank) || 9999) || a.name.localeCompare(b.name));
    }
    function renderDatabaseCatalog() {
        return filteredDatabaseAugments().map(a => `<button class="augcard" data-edit-aug="${escapeHtml(a.id)}">${augVisual(a)}<span style="min-width:0;flex:1"><span class="augname">${escapeHtml(a.name)}</span><span class="item-meta">${rarityLabel(a)}${a.pickRate != null ? `<span class="small">${Number(a.pickRate).toFixed(1)}% pick rate</span>` : ''}${a.pickRateRank != null ? `<span class="small">#${escapeHtml(a.pickRateRank)}</span>` : ''}</span><span class="summary">${escapeHtml(augDescription(a) || 'Open for details')}</span></span><span class="info-hint">ⓘ</span></button>`).join('') || '<div class="empty">No augments match this search.</div>';
    }
    function renderAugmentsView() {
        const all = allAugments();
        return `<div class="section-head"><h1>Augment Database</h1><button class="btn primary" id="customAug">+ Custom augment</button></div><p class="srctext">Current pick rates and rankings come from ARAMMayhem.com’s public data. Verified Mayhem effects appear where checked; others use labeled CommunityDragon descriptions or a link to current details. Your personal overrides are preserved.</p><p class="srctext">Supplemental descriptions currently bundled with the site: ${Object.values(MAYHEM_DETAIL_PACK).filter(x => x?.description).length}. If no pack has been generated, verified effects and CommunityDragon fallbacks remain available.</p><div class="panel"><div class="picker"><input id="augSearch" value="${escapeHtml(state.augSearch)}" aria-label="Search augments" autocomplete="off" placeholder="Search ${all.length} augments or effect text…"><select id="augRarity" aria-label="Rarity filter"><option value="all" ${state.augRarity === 'all' ? 'selected' : ''}>All rarities</option>${['silver', 'gold', 'prismatic'].map(r => `<option value="${r}" ${state.augRarity === r ? 'selected' : ''}>${r}</option>`).join('')}</select><select id="augSort" aria-label="Sort augments"><option value="rank" ${state.augSort !== 'az' ? 'selected' : ''}>Pick-rate rank</option><option value="az" ${state.augSort === 'az' ? 'selected' : ''}>A–Z</option></select></div><div class="stats" style="margin:13px 0">${['silver', 'gold', 'prismatic'].map(r => `<div class="stat"><strong>${all.filter(a => a.rarity === r && !a.retiredPatch).length}</strong><span>${r}</span></div>`).join('')}<div class="stat"><strong>${all.filter(a => a.retiredPatch).length}</strong><span>Retired</span></div></div><div id="databaseResultsCount" class="aug-database-count">${filteredDatabaseAugments().length} matching augments</div><div class="catalog" id="databaseCatalog" style="max-height:none">${renderDatabaseCatalog()}</div></div>`;
    }
    function renderHeadlinersView() {
        return `<div class="section-head"><h1>Headliners & Bands</h1><span class="tag">Introduced patch 26.21</span></div><div class="banner">Each match features one Headliner, changing its rules. Band progression can also unlock augments. Track which bands complement your builds; progression unlocks aren't automatically inferred from match statistics.</div><div class="bandgrid">${HEADLINERS.map(([name, desc]) => `<div class="band"><strong>${escapeHtml(name)}</strong><p>${escapeHtml(desc)}</p></div>`).join('')}</div><div class="panel" style="margin-top:18px"><h2>HEARTSTEEL member bonuses</h2><p class="hint">A sticker adds the member's bonus to whichever augment carries it. Open a saved build to plan the combinations.</p><div class="sticker-pairs">${HEARTSTEEL_BONUSES.map(m => `<div class="sticker-pair"><img class="member" src="${champImg(m.member.replace(/[^a-zA-Z]/g, ''))}" alt=""><div class="pair-text"><div class="pair-title">${escapeHtml(m.member)}</div><div class="pair-effect">${escapeHtml(m.effect)}</div></div></div>`).join('')}</div></div><div class="panel"><h2>Personal band notes</h2><p class="hint">Select a build under My Builds and click its best Headliners. Notes are saved per build.</p><p>Official details: <a href="https://www.leagueoflegends.com/en-au/news/game-updates/league-of-legends-patch-26-21-notes/" target="_blank" rel="noopener">Riot patch 26.21 notes</a>.</p></div>`;
    }
    function touch() {
        const b = build();
        if (b)
            b.updated = new Date().toLocaleDateString();
        persist();
        renderSidebar();
    }
    function saveCurrentBuild() {
        const b = build();
        if (!b)
            return;
        if (draftBuild && b.id === draftBuild.id && !commitDraft()) {
            document.getElementById('champInput')?.focus();
            return;
        }
        if (!persist())
            return;
        const at = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        document.querySelectorAll('[data-save-status]').forEach(x => x.textContent = '✓ Saved to this browser at ' + at);
        toast('Build saved successfully');
    }
    // A floating insertion guide keeps drag targets stationary. Moving an actual DOM
    // placeholder on every dragover changes row positions and causes flickering.
    function dragPreview() {
        const indicator = document.createElement('div');
        indicator.className = 'drop-insertion-marker';
        indicator.setAttribute('aria-hidden', 'true');
        let zone = null, before = null;
        const clear = () => {
            indicator.remove();
            zone?.classList.remove('drop-ready');
            zone = null;
            before = null;
        };
        function itemTarget(entries, x, y) {
            if (!entries.length)
                return { before: null, edge: null };
            // Item chips wrap horizontally. Group by visual row, then find the nearest
            // insertion boundary in that row instead of using an unstable hover target.
            const rows = [];
            for (const item of entries) {
                const rect = item.getBoundingClientRect();
                let row = rows.find(r => Math.abs(r.top - rect.top) < 8);
                if (!row) {
                    row = { top: rect.top, bottom: rect.bottom, items: [] };
                    rows.push(row);
                }
                row.bottom = Math.max(row.bottom, rect.bottom);
                row.items.push({ item, rect });
            }
            rows.sort((a, b) => a.top - b.top);
            const row = rows.reduce((a, b) => Math.abs((a.top + a.bottom) / 2 - y) <= Math.abs((b.top + b.bottom) / 2 - y) ? a : b);
            row.items.sort((a, b) => a.rect.left - b.rect.left);
            const next = row.items.find(({ rect }) => x < rect.left + rect.width / 2);
            if (next)
                return { before: next.item, edge: { x: next.rect.left - 4, y: next.rect.top, height: next.rect.height } };
            const last = row.items[row.items.length - 1];
            const rowIndex = rows.indexOf(row);
            const nextRow = rows[rowIndex + 1];
            return { before: nextRow?.items[0]?.item || null, edge: { x: last.rect.right + 4, y: last.rect.top, height: last.rect.height } };
        }
        function augmentTarget(entries, y) {
            if (!entries.length)
                return { before: null, edge: null };
            const next = entries.find(node => y < node.getBoundingClientRect().top + node.getBoundingClientRect().height / 2);
            return { before: next || null, edge: next ? next.getBoundingClientRect().top : entries[entries.length - 1].getBoundingClientRect().bottom };
        }
        return {
            show(targetZone, e, containerSelector, childSelector, type = 'augment') {
                const list = targetZone.querySelector(containerSelector);
                if (!list)
                    return;
                const entries = [...list.children].filter(node => node.matches(childSelector));
                const rect = list.getBoundingClientRect();
                indicator.classList.toggle('item-insert', type === 'item');
                if (type === 'item') {
                    const pos = itemTarget(entries, e.clientX, e.clientY);
                    before = pos.before;
                    // An empty group still gets a stable visible landing indicator.
                    const left = pos.edge?.x ?? rect.left + 10;
                    const top = pos.edge?.y ?? rect.top + 3;
                    indicator.style.left = Math.round(left) + 'px';
                    indicator.style.top = Math.round(top) + 'px';
                    indicator.style.height = Math.round(pos.edge?.height || 49) + 'px';
                    indicator.style.width = '5px';
                }
                else {
                    const pos = augmentTarget(entries, e.clientY);
                    before = pos.before;
                    indicator.style.left = Math.round(rect.left + 3) + 'px';
                    indicator.style.top = Math.round(pos.edge ?? rect.top + 4) - 2 + 'px';
                    indicator.style.width = Math.round(Math.max(32, rect.width - 6)) + 'px';
                    indicator.style.height = '5px';
                }
                if (zone !== targetZone) {
                    zone?.classList.remove('drop-ready');
                    zone = targetZone;
                }
                zone.classList.add('drop-ready');
                if (!indicator.isConnected)
                    document.body.appendChild(indicator);
            },
            next() {
                return before;
            },
            clear
        };
    }
    function bindBuildDragDrop(c) {
        if (c.dataset.dragBound === 'yes')
            return;
        c.dataset.dragBound = 'yes';
        let payload = null;
        const preview = dragPreview();
        c.addEventListener('dragstart', e => {
            const item = e.target.closest('[data-drag-selected-item],[data-drag-catalog-item],[data-drag-combo],[data-drag-catalog-aug]');
            if (!item)
                return;
            if (item.hasAttribute('data-drag-selected-item')) {
                const [slot, index] = item.dataset.dragSelectedItem.split(':');
                payload = { type: 'selected-item', slot, index: Number(index) };
            }
            else if (item.hasAttribute('data-drag-catalog-item'))
                payload = { type: 'catalog-item', id: item.dataset.dragCatalogItem };
            else if (item.hasAttribute('data-drag-catalog-aug'))
                payload = { type: 'catalog-aug', id: item.dataset.dragCatalogAug };
            else if (item.hasAttribute('data-drag-combo'))
                payload = { type: 'selected-aug', combo: item.dataset.dragCombo, id: item.dataset.dragAug };
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', JSON.stringify(payload));
            item.closest('.chosen-item,.combo-aug,.itemoption,.augcard')?.classList.add('dragging');
        });
        c.addEventListener('dragover', e => {
            const zone = e.target.closest('[data-drop-item-slot],[data-combo-drop]');
            if (!zone || !payload)
                return;
            const item = zone.hasAttribute('data-drop-item-slot');
            if (item ? !['selected-item', 'catalog-item'].includes(payload.type) : !['selected-aug', 'catalog-aug'].includes(payload.type))
                return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            preview.show(zone, e, item ? '.item-bucket-chips' : '.combo-picks', item ? '[data-item-target-index]' : '[data-combo-target-aug]', 'augment');
        });
        c.addEventListener('drop', e => {
            const zone = e.target.closest('[data-drop-item-slot],[data-combo-drop]');
            if (!zone || !payload)
                return;
            e.preventDefault();
            e.stopPropagation();
            const next = preview.next(), data = payload;
            preview.clear();
            payload = null;
            if (zone.hasAttribute('data-drop-item-slot')) {
                const slot = zone.dataset.dropItemSlot, index = next?.dataset.itemTargetIndex;
                if (data.type === 'catalog-item')
                    addItemToSlot(data.id, slot, index == null ? undefined : Number(index));
                else if (data.type === 'selected-item')
                    moveItem(data.slot, data.index, slot, index == null ? undefined : Number(index));
            }
            else {
                const combo = zone.dataset.comboDrop, before = next?.dataset.comboTargetAug || null;
                if (data.type === 'catalog-aug')
                    addToCombo(data.id, combo);
                else if (data.type === 'selected-aug')
                    moveAugment(data.combo, data.id, combo, before);
            }
        });
        c.addEventListener('dragend', () => {
            payload = null;
            preview.clear();
            c.querySelectorAll('.dragging,.drop-ready').forEach(el => el.classList.remove('dragging', 'drop-ready'));
        });
    }
    function bindView() {
        const c = document.getElementById('content');
        c.querySelector('#backToChampion')?.addEventListener('click', () => {
            if (draftBuild) {
                abandonDraft();
                state.view = 'home';
            }
            else {
                const b = build();
                state.championFocus = b?.champion || b?.championName;
                state.view = 'champion';
            }
            render();
        });
        c.querySelectorAll('#newMain,#newEmpty').forEach(x => x.onclick = createBuild);
        c.querySelectorAll('[data-field]').forEach(x => x.addEventListener('input', () => {
            const b = build();
            if (!b)
                return;
            b[x.dataset.field] = x.value;
            touch();
            if (['title', 'style'].includes(x.dataset.field))
                renderSidebar();
        }));
        const ch = c.querySelector('#champInput');
        if (ch)
            ch.addEventListener('change', () => {
                const b = build(), found = state.champions.find(x => x.name.toLowerCase() === ch.value.trim().toLowerCase());
                b.champion = found?.id || '';
                b.championName = found?.name || ch.value.trim();
                if (draftBuild && b.id === draftBuild.id) {
                    if (!found) {
                        toast('Choose a champion from the list to save your draft');
                        return;
                    }
                    commitDraft();
                }
                touch();
                render();
            });
        c.querySelectorAll('#saveBuild,#saveBuildBottom').forEach(x => x.addEventListener('click', saveCurrentBuild));
        c.querySelectorAll('[data-share-build]').forEach(x => x.onclick = e => {
            e.stopPropagation();
            openShareBuildDialog(x.dataset.shareBuild);
        });
        c.querySelector('#duplicateBuild')?.addEventListener('click', () => {
            const b = build();
            if (draftBuild?.id === b?.id) {
                toast('Select a champion first');
                return;
            }
            const copy = JSON.parse(JSON.stringify(b));
            copy.id = newid();
            copy.title = (b.title || 'Build') + ' (copy)';
            state.builds.unshift(copy);
            state.selected = copy.id;
            persist();
            render();
            toast('Build duplicated');
        });
        c.querySelector('#deleteBuild')?.addEventListener('click', () => {
            if (draftBuild?.id === state.selected) {
                draftBuild = null;
                state.selected = state.builds[0]?.id || null;
                state.view = 'library';
                render();
                return;
            }
            if (!confirm('Delete this build? You can restore it only from a backup.'))
                return;
            state.builds = state.builds.filter(x => x.id !== state.selected);
            state.selected = state.builds[0]?.id || null;
            persist();
            render();
        });
        c.querySelectorAll('[data-remove-item]').forEach(x => x.onclick = () => {
            const [slot, index] = x.dataset.removeItem.split(':');
            build().items[slot].splice(Number(index), 1);
            touch();
            render();
        });
        c.querySelectorAll('[data-open-item-slot]').forEach(button => button.addEventListener('click', () => {
            preferredItemSlot = button.dataset.openItemSlot;
            state.itemPickerOpen = true;
            render();
            document.getElementById('itemSearch')?.focus();
        }));
        c.querySelector('#toggleItemPicker')?.addEventListener('click', () => {
            state.itemPickerOpen = !state.itemPickerOpen;
            render();
        });
        c.querySelector('#itemCategory')?.addEventListener('change', e => {
            state.itemCategory = e.target.value;
            c.querySelector('#itemCatalog').innerHTML = renderItemCatalog();
            bindAugLinks(c.querySelector('#itemCatalog'));
        });
        c.querySelector('#itemSearch')?.addEventListener('input', e => {
            state.itemSearch = e.target.value;
            const el = c.querySelector('#itemCatalog');
            if (el) {
                el.innerHTML = renderItemCatalog();
                bindAugLinks(el);
            }
        });
        c.querySelector('#addCombo')?.addEventListener('click', () => {
            const b = ensureBuildV7(build());
            const id = 'combo-' + newid();
            b.augmentCombos.push({ id, name: 'Combo ' + (b.augmentCombos.length + 1), augments: [], headliner: '', headliners: [], stickers: {}, pentakill: { first: '', second: '' } });
            b.activeComboId = id;
            touch();
            render();
        });
        c.querySelectorAll('[data-combo-rename]').forEach(x => x.addEventListener('input', () => {
            const combo = comboById(build(), x.dataset.comboRename);
            if (combo) {
                combo.name = x.value;
                touch();
            }
        }));
        c.querySelectorAll('[data-remove-combo]').forEach(x => x.onclick = () => {
            const b = build();
            const combo = comboById(b, x.dataset.removeCombo);
            if (!combo || !confirm('Remove ' + combo.name + ' and its augment row?'))
                return;
            b.augmentCombos = b.augmentCombos.filter(c => c !== combo);
            b.activeComboId = b.augmentCombos[0].id;
            for (const id of combo.augments)
                if (!chosenAugmentIds(b).includes(id))
                    delete b.heartsteelStickers[id];
            touch();
            render();
        });
        c.querySelectorAll('[data-combo-target]').forEach(x => x.onclick = () => openQuickAugPicker(x.dataset.comboTarget));
        c.querySelectorAll('[data-remove-combo-aug]').forEach(x => x.onclick = () => {
            const [combo, id] = x.dataset.removeComboAug.split('|');
            removeFromCombo(combo, id);
        });
        c.querySelector('#toggleAugPicker')?.addEventListener('click', () => {
            state.augPickerOpen = !state.augPickerOpen;
            render();
        });
        c.querySelector('#newOnly')?.addEventListener('change', e => {
            state.newOnly = e.target.checked;
            render();
        });
        c.querySelector('#augSearch')?.addEventListener('input', e => {
            state.augSearch = e.target.value;
            const el = c.querySelector('#buildAugCatalog');
            if (el) {
                el.innerHTML = renderAugCatalog(build());
                bindAugLinks(el);
            }
        });
        c.querySelector('#augRarity')?.addEventListener('change', e => {
            state.augRarity = e.target.value;
            render();
        });
        if (state.view === 'augments') {
            const updateDatabase = () => {
                const el = c.querySelector('#databaseCatalog');
                if (!el)
                    return;
                el.innerHTML = renderDatabaseCatalog();
                c.querySelector('#databaseResultsCount').textContent = filteredDatabaseAugments().length + ' matching augments';
                bindAugLinks(el);
            };
            c.querySelector('#augSearch')?.addEventListener('input', updateDatabase);
            c.querySelector('#augSort')?.addEventListener('change', e => {
                state.augSort = e.target.value;
                updateDatabase();
            });
        }
        bindHeadlinerPickers(c, 'data-combo-headliner-choice', () => {
            touch();
            render();
        });
        for (const k of ['first', 'second'])
            c.querySelectorAll(`[data-combo-penta-${k}]`).forEach(x => x.addEventListener('change', () => {
                const id = x.dataset['comboPenta' + k[0].toUpperCase() + k.slice(1)], combo = comboById(build(), id);
                if (!combo)
                    return;
                if (x.value && x.value === combo.pentakill[k === 'first' ? 'second' : 'first'])
                    return toast('Choose two different abilities');
                combo.pentakill[k] = x.value;
                touch();
                render();
            }));
        bindAugLinks(c);
        if (state.view === 'builds' && build()) {
            c.querySelectorAll('[data-core-details]').forEach(el => el.addEventListener('toggle', () => {
                const id = el.dataset.coreDetails;
                if (el.open)
                    comboCorePanelsOpen.add(id);
                else
                    comboCorePanelsOpen.delete(id);
            }));
            bindComboCoreControls(c, build());
        }
        if (c.querySelector('.items-selected'))
            bindBuildDragDrop(c);
        c.querySelector('#customAug')?.addEventListener('click', () => editAug(null));
        c.querySelector('#exportCurrent')?.addEventListener('click', () => {
            const b = build();
            if (!b || draftBuild?.id === b.id) {
                toast('Save the build before exporting.');
                return;
            }
            download(makeShareData(b), 'mayhem-' + slug(b.championName || 'build') + '-' + slug(b.title || 'build') + '.json');
        });
    }
    function editAug(id) {
        const base = id ? getAug(id) : { name: '', rarity: 'silver', description: '', introducedPatch: state.patch };
        const name = prompt('Augment name:', base.name);
        if (name === null || !name.trim())
            return;
        const rarity = prompt('Rarity: silver, gold, or prismatic', base.rarity) || base.rarity;
        if (!['silver', 'gold', 'prismatic'].includes(rarity.toLowerCase()))
            return toast('Invalid rarity');
        const desc = prompt('Personal effect description / notes (optional)', base.description || augDescription(base) || '');
        if (desc === null)
            return;
        const key = id || 'custom-' + slug(name);
        const icon = prompt('Augment icon URL (optional; leave blank to use public sources):', base.imageUrl || '');
        if (icon === null)
            return;
        state.overrides[key] = {
            id: key, name: name.trim(), rarity: rarity.toLowerCase(), description: desc, retiredPatch: base.retiredPatch || null, introducedPatch: base.introducedPatch || state.patch, source: 'custom', imageUrl: icon.trim()
        };
        persist();
        render();
        toast('Augment saved');
    }
    function createBuild() {
        draftBuild = ensureBuildV7({
            id: newid(), champion: '', championName: '', title: 'New build', style: '', spells: 'Mark, Flash', skill: 'Q > W > E', intro: '', notes: '', items: { pool: [], start: [], boots: [], core: [], options: [] }, augments: { top: [], great: [], good: [] }, augmentCombos: [{ id: 'combo-main', name: 'Combo 1', augments: [] }], bands: [], heartsteelStickers: {}, pentakill: { first: '', second: '' }, updated: new Date().toLocaleDateString()
        });
        state.selected = draftBuild.id;
        state.view = 'builds';
        render();
        document.getElementById('champInput')?.focus();
        toast('New draft: choose a champion to save it');
    }
    function commitDraft() {
        if (!draftBuild)
            return true;
        const champion = resolvedChampion(draftBuild.champion);
        if (!champion) {
            toast('Select a champion from the list before saving');
            return false;
        }
        draftBuild.champion = champion.id;
        draftBuild.championName = champion.name;
        if (draftBuild.title === 'New build')
            draftBuild.title = 'New ' + champion.name + ' build';
        if (!draftBuild.style)
            draftBuild.style = roleOf(champion);
        state.builds.unshift(draftBuild);
        draftBuild = null;
        persist();
        return true;
    }
    function exportAllData() {
        download({ schema: 1, exportedAt: new Date().toISOString(), builds: state.builds, overrides: state.overrides, itemNotes: state.itemNotes, manualItems: state.manualItems, focusLayout }, 'mayhem-library-all.json');
    }
    // Opt-in single-build sharing. Links encode one build in a URL fragment.
    // A link represents a snapshot; it does not synchronize later edits.
    const SHARE_FORMAT = 'mayhem-single-build';
    const SHARE_HASH = 'mlbuild=';
    const SHARE_MAX_JSON = 450000; // Reject excessively large imported payloads.
    const SHARE_MAX_HASH = 20000; // Very long URLs are unreliable across messaging apps.
    let pendingShare = null;
    let lastShareHash = '';
    function shareHost() {
        return document.getElementById('shareDialogHost');
    }
    function showShareDialog(title, description, body) {
        const host = shareHost();
        host.innerHTML = `<div class="share-overlay"><div class="share-dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"><div class="share-dialog-head"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div><button class="share-close" data-close-share aria-label="Close sharing dialog">✕</button></div>${body}<div class="share-message hidden" role="status" aria-live="polite"></div></div></div>`;
        host.querySelector('[data-close-share]').onclick = () => closeShareDialog(true);
        host.querySelector('.share-overlay').addEventListener('click', e => {
            if (e.target === host.querySelector('.share-overlay'))
                closeShareDialog(true);
        });
        host.querySelector('[data-close-share]').focus();
        return host;
    }
    function shareMessage(message, error = false) {
        const box = shareHost().querySelector('.share-message');
        if (!box)
            return;
        box.textContent = message;
        box.className = 'share-message ' + (error ? 'is-error' : 'is-success');
    }
    function clearShareFragment() {
        lastShareHash = '';
        if (!location.hash.startsWith('#' + SHARE_HASH))
            return;
        try {
            history.replaceState(null, '', location.pathname + location.search);
        }
        catch {
            location.hash = '';
        }
    }
    function closeShareDialog(clearFragment = false) {
        pendingShare = null;
        shareHost().innerHTML = '';
        if (clearFragment)
            clearShareFragment();
    }
    function shareSelectedExtras(b) {
        const ids = new Set([...(b.augments?.top || []), ...(b.augments?.great || []), ...(b.augments?.good || []), ...(b.augmentCombos || []).flatMap(c => c.augments || [])].map(String));
        const itemIds = new Set([...(Object.values(b.items || {}).flat() || []), ...(b.augmentCombos || []).flatMap(c => c.coreItems || [])].map(String));
        const overrides = {}, itemNotes = {}, manualItems = {}, augmentNames = {}, itemNames = {};
        for (const id of ids) {
            const a = getAug(id);
            if (a?.name)
                augmentNames[id] = a.name;
            if (Object.hasOwn(state.overrides, id) && state.overrides[id])
                overrides[id] = state.overrides[id];
        }
        for (const id of itemIds) {
            itemNames[id] = itemName(id);
            if (Object.hasOwn(state.itemNotes, id))
                itemNotes[id] = state.itemNotes[id];
        }
        for (const [key, entry] of Object.entries(state.manualItems)) {
            if (entry && itemIds.has(String(entry.id)))
                manualItems[key] = entry;
        }
        return { overrides, itemNotes, manualItems, augmentNames, itemNames };
    }
    function makeShareData(b) {
        const clone = JSON.parse(JSON.stringify(b));
        return {
            format: SHARE_FORMAT, version: 1, createdAt: new Date().toISOString(), creator: String(b.createdBy || ''), sharer: String(b.sharedBy || ''), build: clone, extras: shareSelectedExtras(b)
        };
    }
    function validShareData(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw))
            throw Error('This is not a supported Mayhem build.');
        let data = raw;
        // Compatibility with the existing one-build export from earlier versions.
        if (raw.format !== SHARE_FORMAT) {
            if (Array.isArray(raw.builds) && raw.builds.length === 1) {
                data = {
                    format: SHARE_FORMAT, version: 1, creator: raw.builds[0]?.createdBy || '', sharer: '', build: raw.builds[0], extras: { overrides: raw.overrides, itemNotes: raw.itemNotes, manualItems: raw.manualItems }
                };
            }
            else
                throw Error('Choose a single-build JSON file. Use Import All for full-library backups.');
        }
        if (data.version !== 1 || !data.build || typeof data.build !== 'object' || Array.isArray(data.build))
            throw Error('Invalid or unsupported shared build version.');
        const b = data.build;
        if (typeof b.champion !== 'string' || !b.champion.trim() || typeof b.title !== 'string' || !b.items || typeof b.items !== 'object')
            throw Error('The shared build is missing required champion, title, or item data.');
        if (b.augmentCombos !== undefined && !Array.isArray(b.augmentCombos))
            throw Error('The augment combinations in this build are invalid.');
        if (JSON.stringify(data).length > SHARE_MAX_JSON)
            throw Error('This build is too large to import.');
        return {
            format: SHARE_FORMAT, version: 1, createdAt: String(data.createdAt || ''), creator: String(data.creator || b.createdBy || '').slice(0, 70), sharer: String(data.sharer || '').slice(0, 70), build: b, extras: data.extras && typeof data.extras === 'object' && !Array.isArray(data.extras) ? data.extras : {}
        };
    }
    function base64url(bytes) {
        let binary = '';
        for (let i = 0; i < bytes.length; i += 8192)
            binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    function fromBase64url(str) {
        if (!/^[A-Za-z0-9_-]+$/.test(str))
            throw Error('Invalid share link encoding.');
        const binary = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - str.length % 4) % 4));
        return Uint8Array.from(binary, c => c.charCodeAt(0));
    }
    async function shareEncode(data) {
        const input = new TextEncoder().encode(JSON.stringify(data));
        if (input.length > SHARE_MAX_JSON)
            throw Error('Build is too large to share in a link. Export its JSON file instead.');
        if (typeof CompressionStream === 'function') {
            const zipped = await new Response(new Blob([input]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
            return 'g' + base64url(new Uint8Array(zipped));
        }
        return 'u' + base64url(input);
    }
    async function streamTextLimited(stream, maxBytes) {
        const reader = stream.getReader();
        const decoder = new TextDecoder('utf-8', { fatal: true });
        let count = 0, result = '';
        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done)
                    break;
                count += value.byteLength;
                if (count > maxBytes)
                    throw Error('This shared build exceeds the import size limit.');
                result += decoder.decode(value, { stream: true });
            }
            return result + decoder.decode();
        }
        finally {
            reader.releaseLock();
        }
    }
    async function shareDecode(payload) {
        if (!payload || payload.length > SHARE_MAX_HASH)
            throw Error('Share link is too large or missing. Ask for the JSON file instead.');
        const mode = payload[0], bytes = fromBase64url(payload.slice(1));
        let json;
        if (mode === 'g') {
            if (typeof DecompressionStream !== 'function')
                throw Error('This browser cannot read compressed links. Ask for a JSON export instead.');
            json = await streamTextLimited(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')), SHARE_MAX_JSON);
        }
        else if (mode === 'u') {
            if (bytes.byteLength > SHARE_MAX_JSON)
                throw Error('Shared build exceeds the import size limit.');
            json = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        }
        else
            throw Error('Unknown share link format.');
        return validShareData(JSON.parse(json));
    }
    function buildShareUrl(payload) {
        const base = location.href.split('#')[0];
        return base + '#' + SHARE_HASH + payload;
    }
    async function copyTextForShare(value) {
        if (navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(value);
                return true;
            }
            catch {
            }
        }
        const input = document.createElement('textarea');
        input.value = value;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.focus();
        input.select();
        let ok = false;
        try {
            ok = document.execCommand('copy');
        }
        catch {
        }
        input.remove();
        return ok;
    }
    function openShareBuildDialog(id) {
        const b = state.builds.find(x => x.id === id);
        if (!b) {
            toast('Save this build before sharing it.');
            return;
        }
        const host = showShareDialog('Share build', 'Copy a link or download the build to send it to a friend.', `<div class="share-preview-summary share-compact-summary"><strong>${escapeHtml(b.championName || 'Champion')} — ${escapeHtml(b.title || 'Build')}</strong><span>${(b.augmentCombos || []).length} augment combinations</span></div><div class="share-actions"><button class="btn share-build-btn" id="copyBuildLink">Copy share link</button><button class="btn" id="exportOneBuild">Download JSON</button></div><p class="share-help">A shared build is a copy. Updates won't sync automatically.</p><input id="manualShareLink" class="share-input" aria-label="Select and copy share URL" readonly hidden>`);
        host.querySelector('#copyBuildLink').onclick = async () => {
            const button = host.querySelector('#copyBuildLink');
            button.disabled = true;
            try {
                const encoded = await shareEncode(makeShareData(b)), url = buildShareUrl(encoded);
                if (url.length > SHARE_MAX_HASH)
                    throw Error('This link is too long for reliable sharing. Download its JSON file instead.');
                if (!await copyTextForShare(url)) {
                    const input = host.querySelector('#manualShareLink');
                    input.hidden = false;
                    input.value = url;
                    input.focus();
                    input.select();
                    shareMessage('Copy the link above and send it to your friend.');
                    return;
                }
                shareMessage('Link copied!');
            }
            catch (error) {
                shareMessage(error.message, true);
            }
            finally {
                button.disabled = false;
            }
        };
        host.querySelector('#exportOneBuild').onclick = () => {
            download(makeShareData(b), 'mayhem-share-' + slug(b.championName || 'build') + '-' + slug(b.title || 'build') + '.json');
            shareMessage('Build downloaded.');
        };
    }
    function previewItemName(id, data) {
        return data.extras?.itemNames?.[id] || itemName(id) || id;
    }
    function previewAugName(id, data) {
        return data.extras?.augmentNames?.[id] || getAug(id).name || id;
    }
    function sharePreviewContent(data) {
        const b = data.build, items = b.items || {}, combos = b.augmentCombos || [];
        const itemRows = ITEM_SLOTS.map(key => {
            const list = Array.isArray(items[key]) ? items[key] : [];
            return list.length ? `<p><b>${escapeHtml(ITEM_LABELS[key])}:</b> ${list.map(id => escapeHtml(previewItemName(String(id), data))).join(' · ')}</p>` : '';
        }).filter(Boolean).join('') || '<p>No items assigned.</p>';
        const comboRows = combos.map((combo, i) => `<div class="share-preview-picks"><b>${escapeHtml(combo.name || 'Combo ' + (i + 1))}</b>${comboHeadlinerNames(combo).length ? ' · ' + comboHeadlinerNames(combo).map(escapeHtml).join(' + ') : ''}<p>${(combo.augments || []).map(id => escapeHtml(previewAugName(String(id), data))).join(' · ') || 'No augments'}${combo.coreItems?.length ? '<br>Core: ' + combo.coreItems.map(id => escapeHtml(previewItemName(String(id), data))).join(' · ') : ''}${hasComboHeadliner(combo, 'Pentakill') ? ' · ' + escapeHtml([combo.pentakill?.first, combo.pentakill?.second].filter(Boolean).join(' + ')) : ''}${Object.keys(combo.stickers || {}).length ? '<br>HEARTSTEEL: ' + Object.entries(combo.stickers).map(([id, member]) => escapeHtml(previewAugName(id, data) + ' → ' + member)).join(' · ') : ''}</p></div>`).join('') || '<p>No combos added.</p>';
        return `<div class="share-preview-summary"><h3>${escapeHtml(b.championName || b.champion || 'Champion')} — ${escapeHtml(b.title || 'Build')}</h3><div class="share-metadata">${escapeHtml(b.style || 'Custom playstyle')}${data.creator ? ' · Created by ' + escapeHtml(data.creator) : ''}${data.sharer && data.sharer !== data.creator ? ' · Shared by ' + escapeHtml(data.sharer) : ''}<br>Skill priority: ${escapeHtml(b.skill || 'Not set')} · Spells: ${escapeHtml(b.spells || 'Not set')}</div></div><div class="share-preview-grid"><div class="share-preview-block"><strong>Items</strong>${itemRows}</div><div class="share-preview-block"><strong>Augment combinations · ${combos.length}</strong>${comboRows}</div>${b.notes || b.intro ? `<div class="share-preview-block"><strong>Build notes</strong><p>${escapeHtml([b.intro, b.notes].filter(Boolean).join('\n\n'))}</p></div>` : ''}</div>`;
    }
    function showSharePreview(raw) {
        try {
            pendingShare = validShareData(raw);
        }
        catch (e) {
            openShareImportDialog();
            shareMessage(e.message, true);
            return;
        }
        const data = pendingShare;
        const host = showShareDialog('Preview shared build', 'Review this copy before choosing to import it. Nothing has been saved yet.', sharePreviewContent(data) + `<p class="share-notice">Importing adds a NEW build. Existing builds, custom layouts, and shared source data are not overwritten.</p><div class="share-actions"><button class="btn primary" id="saveSharedCopy">✓ Save to My Builds</button><button class="btn" id="downloadSharedCopy">↓ Download JSON</button><button class="btn ghost" id="cancelSharedCopy">Cancel</button></div>`);
        host.querySelector('#saveSharedCopy').onclick = () => {
            try {
                importOneSharedBuild(data);
                closeShareDialog(true);
                toast('Imported ' + data.build.championName + ' as a new build');
            }
            catch (e) {
                shareMessage(e.message, true);
            }
        };
        host.querySelector('#downloadSharedCopy').onclick = () => download(data, 'mayhem-share-' + slug(data.build.championName || 'build') + '.json');
        host.querySelector('#cancelSharedCopy').onclick = () => closeShareDialog(true);
    }
    function importOneSharedBuild(raw) {
        const data = validShareData(raw), copy = JSON.parse(JSON.stringify(data.build));
        copy.id = newid(); // Import always creates a distinct build; never overwrites an ID.
        copy.createdBy = data.creator || copy.createdBy || '';
        copy.importedFrom = data.sharer || data.creator || '';
        ensureBuildV7(copy);
        // Only include related custom entries not already set locally. No whole-library merge.
        for (const [section, target] of [['overrides', state.overrides], ['itemNotes', state.itemNotes], ['manualItems', state.manualItems]]) {
            const entries = data.extras?.[section];
            if (!entries || typeof entries !== 'object' || Array.isArray(entries))
                continue;
            for (const [key, value] of Object.entries(entries)) {
                if (['__proto__', 'constructor', 'prototype'].includes(key) || key.length > 200 || Object.hasOwn(target, key))
                    continue;
                if (section === 'overrides' && (!value || typeof value !== 'object'))
                    continue;
                if (section === 'manualItems' && (!value || typeof value !== 'object'))
                    continue;
                if (section === 'itemNotes' && typeof value !== 'string')
                    continue;
                target[key] = value;
            }
        }
        state.items = mergeItemSources();
        state.builds.unshift(copy);
        state.selected = copy.id;
        if (!persist()) {
            state.builds.shift();
            throw Error('Could not save the imported build. Export a backup and free browser storage.');
        }
        abandonDraft();
        libraryFocusedId = copy.id;
        libraryQuickEdit = false;
        focusLayoutEditing = false;
        state.view = 'library';
        render();
    }
    function openShareImportDialog() {
        const host = showShareDialog('Import a shared build', 'Paste a Share Build link or choose a single-build JSON file.', `<label for="pasteShareUrl">Share link</label><input class="share-input" id="pasteShareUrl" placeholder="Paste a build link" autocomplete="off"><div class="share-actions"><button class="btn primary" id="previewPastedLink">Preview link</button><button class="btn" id="chooseShareJson">↑ Choose JSON file</button></div><p class="share-help">You can also open a shared URL directly. Full-library backups still use Import All.</p>`);
        host.querySelector('#previewPastedLink').onclick = async () => {
            try {
                const url = new URL(host.querySelector('#pasteShareUrl').value.trim(), location.href);
                if (!url.hash.startsWith('#' + SHARE_HASH))
                    throw Error('This is not a Mayhem Share Build link.');
                const data = await shareDecode(url.hash.slice(1 + SHARE_HASH.length));
                showSharePreview(data);
            }
            catch (e) {
                shareMessage(e.message, true);
            }
        };
        host.querySelector('#chooseShareJson').onclick = () => document.getElementById('shareImportFile').click();
    }
    async function handleIncomingShare() {
        const hash = location.hash;
        if (!hash.startsWith('#' + SHARE_HASH) || hash === lastShareHash)
            return;
        lastShareHash = hash;
        try {
            showSharePreview(await shareDecode(hash.slice(1 + SHARE_HASH.length)));
        }
        catch (e) {
            openShareImportDialog();
            shareMessage('Unable to read shared link: ' + e.message, true);
        }
    }
    function openImportAll() {
        document.getElementById('importFile').click();
    }
    function download(data, name) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function importData(obj) {
        if (!obj || !Array.isArray(obj.builds))
            throw Error('Not a valid Mayhem Library export');
        let n = 0;
        for (const b of obj.builds) {
            if (!b || typeof b !== 'object')
                continue;
            const clone = JSON.parse(JSON.stringify(b));
            if (!clone.id || state.builds.some(x => x.id === clone.id))
                clone.id = newid();
            ensureBuildV7(clone);
            state.builds.push(clone);
            n++;
        }
        if (obj.overrides && typeof obj.overrides === 'object')
            Object.assign(state.overrides, obj.overrides);
        if (obj.itemNotes && typeof obj.itemNotes === 'object')
            Object.assign(state.itemNotes, obj.itemNotes);
        if (obj.manualItems && typeof obj.manualItems === 'object')
            Object.assign(state.manualItems, obj.manualItems);
        state.items = mergeItemSources();
        if (obj.focusLayout) {
            focusLayout = normalizeFocusLayout(obj.focusLayout);
            saveFocusLayout();
        }
        state.selected = state.builds.at(-n)?.id || state.selected;
        persist();
        render();
        toast('Imported ' + n + ' builds');
    }
    async function loadAugmentArtwork() {
        try {
            const r = await fetch(CDRAGON_ARENA, { cache: 'no-store' });
            if (!r.ok)
                throw Error('HTTP ' + r.status);
            const json = await r.json();
            if (!Array.isArray(json.augments))
                throw Error('Unknown format');
            const mapped = new Map();
            for (const a of json.augments) {
                if (!a.name)
                    continue;
                const key = slug(a.name);
                if (!mapped.has(key) || a.iconLarge)
                    mapped.set(key, a);
                mapped.set(keyName(a.name), a);
                if (a.apiName)
                    mapped.set(keyName(a.apiName), a);
                if (a.id)
                    mapped.set(String(a.id), a);
            }
            state.arenaInfo = mapped;
            render();
        }
        catch (e) {
            console.warn('CommunityDragon artwork and effects are unavailable', e);
            render();
        }
    }
    async function loadRemote() {
        state.status = 'Fetching public augment database…';
        render();
        try {
            const r = await fetch(DATA_URL, { cache: 'no-store' });
            if (!r.ok)
                throw Error('HTTP ' + r.status);
            const raw = await r.json();
            if (!Array.isArray(raw.rows) || raw.rows.length < 100)
                throw Error('Unexpected augment format');
            state.augments = mergeNewReleaseAugments(raw.rows.map(x => ({
                id: String(x.augmentId), legacyId: String(x.augmentId), name: String(x.name?.en || x.slug || x.augmentId), rarity: x.rarity || 'silver', description: '', introducedPatch: x.introducedPatch || '', retiredPatch: x.retiredPatch || null, pickRate: x.pickRate, source: 'public', url: x.url, pickRateRank: x.pickRateRank, previousPickRateRank: x.previousPickRateRank, pickRateChange: x.pickRateChange, previousPickRate: x.previousPickRate
            })));
            state.patch = raw.meta?.patch || raw.rows?.[0]?.patch || state.patch;
            reconcileAugmentIds();
            if (state.itemSource.startsWith('ARAMMayhem.com'))
                state.itemSource = `ARAMMayhem.com current item catalog · patch ${state.patch}`;
            const pending = state.augments.filter(a => a.source === 'new-release').length;
            state.status = pending
                ? `${state.augments.length} augments available · stats patch ${state.patch} + ${pending} new from patch 26.23 · source: arammayhem.com`
                : `${state.augments.length} augments loaded · stats patch ${state.patch} · source: arammayhem.com`;
            toast('Augment data refreshed');
            render();
        }
        catch (e) {
            state.status = `Offline starter list (${state.augments.length} entries). Public update unavailable: ${e.message}. You can import data or retry.`;
            render();
        }
    }
    function dedupeItems(items) {
        const unique = new Map();
        for (const item of items) {
            if (!item || !item.name)
                continue;
            const key = keyName(item.name);
            if (!key)
                continue;
            const prior = unique.get(key);
            const priority = x => x.source === 'mayhem' ? 4 : x.source === 'custom' ? 3 : x.source === 'riot-extra' ? 2 : 1;
            if (!prior || priority(item) > priority(prior))
                unique.set(key, item);
        }
        return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
    }
    function addRiotDetails(items) {
        return items.map(i => {
            const r = state.riotItems.get(String(i.id)) || {};
            return { ...i, description: i.description || r.description || '', gold: { total: i.cost ?? r.gold?.total ?? null }, imageId: i.imageId || i.id };
        });
    }
    function riotExtraItems() {
        return [...state.riotItems.entries()].filter(([id, x]) => x.inStore !== false && x.gold?.purchasable !== false && x.maps?.['12'] === true && !x.requiredAlly && !x.hideFromAll && !x.specialRecipe && Number(x.gold?.total) > 0).map(([id, x]) => ({ id, name: x.name, category: (!x.into?.length ? 'legendary' : x.gold?.total < 1500 ? 'basic' : 'epic'), cost: x.gold.total, description: x.description || '', source: 'riot-extra' }));
    }
    function mergeItemSources() {
        const base = state.mayhemItems.length ? state.mayhemItems : state.items.filter(x => x.source === 'mayhem' || x.source === 'starter');
        return addRiotDetails(dedupeItems([...base, ...riotExtraItems(), ...Object.values(state.manualItems)]));
    }
    function createCustomItem() {
        const name = prompt('Missing item name:');
        if (!name?.trim())
            return;
        const id = prompt('Riot numeric item ID (if known, optional):', '') || '';
        const category = prompt('Category: legendary, boots_tier2, epic, basic, starter', 'legendary') || 'legendary';
        const imageUrl = prompt('Custom image URL (optional, https://):', '') || '';
        const clean = {
            id: id.trim() || 'custom-' + slug(name), name: name.trim(), category: category.trim(), imageId: id.trim(), imageUrl: imageUrl.trim(), cost: null, description: '', source: 'custom'
        };
        state.manualItems[keyName(name)] = clean;
        state.items = mergeItemSources();
        persist();
        render();
        toast('Added ' + name);
    }
    function reconcileAugmentIds() {
        const alias = new Map();
        for (const a of state.augments) {
            alias.set(slug(a.name), a.id);
            if (a.legacyId)
                alias.set(a.legacyId, a.id);
        }
        for (const provisional of RELEASED_AUGMENTS) {
            const current = state.augments.find(a => slug(a.name) === slug(provisional.name));
            if (current) alias.set(provisional.id, current.id);
        }
        for (const b of state.builds) {
            if (!b.augments)
                continue;
            for (const tier of ['top', 'great', 'good'])
                b.augments[tier] = [...new Set((b.augments[tier] || []).map(id => alias.get(String(id)) || id))];
            ensureBuildV7(b);
            for (const combo of b.augmentCombos) {
                combo.augments = [...new Set(combo.augments.map(id => alias.get(String(id)) || id))];
                combo.stickers = Object.fromEntries(Object.entries(combo.stickers || {}).map(([id, m]) => [alias.get(String(id)) || id, m]));
            }
            ;
            const original = b.heartsteelStickers || {};
            b.heartsteelStickers = {};
            for (const [id, member] of Object.entries(original))
                b.heartsteelStickers[alias.get(String(id)) || id] = member;
        }
        persist();
    }
    async function loadMayhemItems() {
        try {
            const r = await fetch(MAYHEM_ITEMS_URL, { cache: 'no-store' });
            if (!r.ok)
                throw Error('HTTP ' + r.status);
            const json = await r.json();
            if (!Array.isArray(json.rows) || json.rows.length < 60)
                throw Error('Unexpected Mayhem item format');
            state.mayhemItems = json.rows.filter(x => x && x.name?.en).map(x => ({
                id: String(x.gameItemId || 'custom-' + x.itemId), imageId: String(x.gameItemId || ''), name: String(x.name.en), category: String(x.category || 'other'), cost: x.cost == null ? null : Number(x.cost), source: 'mayhem'
            }));
            state.hasMayhemItems = true;
            state.items = mergeItemSources();
            state.itemSource = `ARAMMayhem.com patch ${state.patch} (${state.mayhemItems.length} Mayhem entries) + ${Math.max(0, state.items.length - state.mayhemItems.length - Object.keys(state.manualItems).length)} additional Riot/custom entries`;
            try {
                localStorage.setItem(ITEM_CACHE, JSON.stringify({ patch: state.patch, items: state.mayhemItems, cachedAt: new Date().toISOString() }));
            }
            catch (e) {
                console.warn('Could not cache items', e);
            }
            render();
        }
        catch (e) {
            console.warn('Mayhem item feed unavailable', e);
            state.items = mergeItemSources();
            if (!state.hasMayhemItems)
                state.itemSource = 'Public Mayhem catalog not reachable — cached, Riot ARAM and personal entries available';
            render();
        }
    }
    async function loadRiot() {
        try {
            const versions = await (await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json();
            state.ddver = versions[0] || state.ddver;
            const [c, i] = await Promise.all([fetch(DD + state.ddver + '/data/en_US/champion.json').then(r => r.json()), fetch(DD + state.ddver + '/data/en_US/item.json').then(r => r.json())]);
            const champs = Object.values(c.data || {}).map(x => ({ id: x.id, name: x.name, tags: x.tags || [] })).sort((a, b) => a.name.localeCompare(b.name));
            if (champs.length > 160)
                state.champions = champs;
            state.riotItems = new Map(Object.entries(i.data || {}));
            state.items = mergeItemSources();
            if (!state.hasMayhemItems)
                state.itemSource = `Riot Data Dragon ARAM catalog (${state.items.length}) — Mayhem-only availability not verified`;
            render();
        }
        catch (e) {
            console.warn('Data Dragon unavailable', e);
        }
    }
    document.addEventListener('error', e => {
        if (e.target.matches?.('.aug-art-image,.item-art-image'))
            advanceArtwork(e.target);
    }, true);
    document.addEventListener('load', e => {
        if (e.target.matches?.('.aug-art-image'))
            artLoaded(e.target);
        else if (e.target.matches?.('.item-art-image'))
            itemArtLoaded(e.target);
    }, true);
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape')
            closeDetail();
    });
    document.getElementById('createBtn').onclick = createBuild;
    document.getElementById('sideSearch').oninput = renderSidebar;
    document.getElementById('sidebarList').onclick = e => {
        const el = e.target.closest('[data-bid]');
        if (el) {
            abandonDraft();
            state.selected = el.dataset.bid;
            state.view = 'builds';
            persist();
            render();
        }
    };
    document.querySelectorAll('[data-view]').forEach(x => x.onclick = () => {
        abandonDraft();
        if (x.dataset.view === 'library') {
            libraryFocusedId = null;
            libraryQuickEdit = false;
        }
        state.view = x.dataset.view;
        render();
        window.scrollTo(0, 0);
    });
    document.getElementById('exportBtn').onclick = exportAllData;
    document.getElementById('importBtn').onclick = openImportAll;
    document.getElementById('importFile').onchange = async (e) => {
        const f = e.target.files[0];
        if (!f)
            return;
        try {
            const obj = JSON.parse(await f.text());
            if (Array.isArray(obj.rows)) {
                state.augments = mergeNewReleaseAugments(obj.rows.map(x => ({
                    id: String(x.augmentId), name: String(x.name?.en || x.slug), rarity: x.rarity || 'silver', introducedPatch: x.introducedPatch || '', retiredPatch: x.retiredPatch || null, pickRate: x.pickRate, pickRateRank: x.pickRateRank, pickRateChange: x.pickRateChange, previousPickRateRank: x.previousPickRateRank, url: x.url, source: 'import'
                })));
                state.patch = obj.meta?.patch || state.patch;
                const pending = state.augments.filter(a => a.source === 'new-release').length;
                state.status = `Imported ${state.augments.length} augments · stats ${state.patch}${pending ? ` + ${pending} new from 26.23` : ''}`;
                render();
                toast('Augment database imported');
            }
            else
                importData(obj);
        }
        catch (err) {
            alert('Could not import file: ' + err.message);
        }
        e.target.value = '';
    };
    document.getElementById('shareImportFile').onchange = async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f)
            return;
        try {
            if (f.size > SHARE_MAX_JSON)
                throw Error('This JSON file is too large for one build. Use Import All for library backups.');
            showSharePreview(JSON.parse(await f.text()));
        }
        catch (error) {
            openShareImportDialog();
            shareMessage('Could not open build: ' + error.message, true);
        }
    };
    window.addEventListener('hashchange', handleIncomingShare);
    document.getElementById('refreshBtn').onclick = () => {
        loadRemote();
        loadRiot();
        loadMayhemItems();
        loadAugmentArtwork();
    };
    render();
    void handleIncomingShare();
    loadRemote();
    loadRiot();
    loadMayhemItems();
    loadAugmentArtwork();
})();
