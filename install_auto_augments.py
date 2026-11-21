#!/usr/bin/env python3
"""One-time, non-destructive integration of automatic ARAM Mayhem augment updates.

Run beside the CURRENT app.js in the Mayhem repo. Writes app.js.bak once and
adds the live-pool loader without replacing any editor/layout/sharing code.
"""
from pathlib import Path
import sys

app = Path(__file__).resolve().with_name('app.js')
if not app.exists():
    sys.exit('Missing app.js. Extract the ZIP into the root of your Mayhem repository.')
s = app.read_text(encoding='utf-8')
MARKER = 'MAYHEM_AUTO_KIWI_V1'
if MARKER in s:
    print('Automatic KIWI augments are already installed. No changes necessary.')
    sys.exit(0)

begin = '    async function loadRemote() {'
end = '    function dedupeItems(items) {'
if s.count(begin) != 1 or s.count(end) != 1:
    sys.exit('Your version of app.js differs from the expected Mayhem layout. No files changed.')
i, j = s.index(begin), s.index(end)
if j <= i:
    sys.exit('Could not locate the complete remote loader. No files changed.')
old_loader = s[i:j]
if 'DATA_URL' not in old_loader or 'reconcileAugmentIds()' not in old_loader:
    sys.exit('Cannot verify your existing augment loader. No files changed.')

new_loader = r'''    // MAYHEM_AUTO_KIWI_V1 — Source of truth: the live KIWI pool in Riot game data.
    // No manual patch-by-patch additions or pick-rate dependence.
    const AUTO_POOL_CACHE = 'mayhem-auto-kiwi-pool-v1';
    const AUTO_POOL_JSON = 'data/live-augments.json';
    const AUTO_GAME_DATA = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default';
    const AUTO_KIWI_LISTS = AUTO_GAME_DATA + '/v1/augment-lists.json';
    const AUTO_CHERRY_AUGMENTS = AUTO_GAME_DATA + '/v1/cherry-augments.json';
    let autoPoolRows = [];
    let autoPoolPatch = '';
    function autoPoolKey(s) { return keyName(s); }
    function autoValidRoster(rows) {
        if (!Array.isArray(rows) || rows.length < 150 || rows.length > 550) return false;
        const unique = new Set();
        for (const row of rows) {
            if (!row || typeof row.name !== 'string' || !row.name.trim() ||
                !['silver', 'gold', 'prismatic'].includes(String(row.rarity || '').toLowerCase())) return false;
            unique.add(autoPoolKey(row.name));
        }
        return unique.size >= rows.length * 0.95;
    }
    function autoRiotIcon(value) {
        const v = String(value || '').replace(/^\/lol-game-data\/assets\//i, '').replace(/^assets\//i, '');
        return v ? `${AUTO_GAME_DATA}/${v.toLowerCase()}` : '';
    }
    function autoReadKiwiPool(lists, cherry) {
        if (!Array.isArray(lists) || !Array.isArray(cherry)) throw Error('Unexpected CommunityDragon format');
        const pool = lists.find(x => String(x.modeName || '').toUpperCase() === 'KIWI');
        if (!Array.isArray(pool?.augmentList)) throw Error('KIWI mode augment list missing');
        const index = new Map(cherry.filter(x => x?.augmentNameId).map(x => [String(x.augmentNameId).toLowerCase(), x]));
        const rarities = { ksilver: 'silver', kgold: 'gold', kprismatic: 'prismatic' };
        const map = new Map();
        for (const ref of pool.augmentList) {
            const a = index.get(String(ref).split('/').pop().toLowerCase());
            if (!a?.nameTRA) continue;
            const rarity = rarities[String(a.rarity || '').toLowerCase()];
            if (!rarity) continue;
            const name = String(a.nameTRA).trim();
            if (!name) continue;
            map.set(autoPoolKey(name), {
                id: slug(name), name, rarity,
                imageUrl: autoRiotIcon(a.augmentSmallIconPath),
                source: 'kiwi-game-data'
            });
        }
        const rows = [...map.values()];
        if (!autoValidRoster(rows) || rows.length < pool.augmentList.length * 0.85)
            throw Error('KIWI data incomplete; preserving last working pool');
        return rows;
    }
    async function autoFetchJson(url) {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw Error(`${url} -> HTTP ${response.status}`);
        return response.json();
    }
    async function autoLoadPool() {
        const results = await Promise.allSettled([
            autoFetchJson(AUTO_POOL_JSON),
            Promise.all([autoFetchJson(AUTO_KIWI_LISTS), autoFetchJson(AUTO_CHERRY_AUGMENTS)])
                .then(([lists, cherry]) => autoReadKiwiPool(lists, cherry)),
            autoFetchJson('https://ddragon.leagueoflegends.com/api/versions.json')
        ]);
        const snapshot = results[0].status === 'fulfilled' ? results[0].value : null;
        const direct = results[1].status === 'fulfilled' ? results[1].value : null;
        let cached = null;
        try { cached = JSON.parse(localStorage.getItem(AUTO_POOL_CACHE) || 'null'); } catch (_) {}
        // Live Riot game data takes precedence. The static snapshot and browser
        // cache keep the site working when CommunityDragon is temporarily down.
        const selected = autoValidRoster(direct) ? direct :
            autoValidRoster(snapshot?.augments) ? snapshot.augments :
            autoValidRoster(cached?.augments) ? cached.augments : [];
        autoPoolRows = selected;
        if (snapshot?.patch) autoPoolPatch = String(snapshot.patch);
        else if (cached?.patch) autoPoolPatch = String(cached.patch);
        // Riot 16.23.x corresponds to the public 26.23 patch label.
        const versions = results[2].status === 'fulfilled' ? results[2].value : [];
        if (autoValidRoster(direct) && Array.isArray(versions) && versions[0]) {
            const [major, minor] = String(versions[0]).split('.').map(Number);
            if (major >= 15 && major <= 19 && minor >= 0 && minor <= 30)
                autoPoolPatch = `${major + 10}.${String(minor).padStart(2, '0')}`;
        }
        if (selected.length && autoValidRoster(direct)) {
            try { localStorage.setItem(AUTO_POOL_CACHE, JSON.stringify({ augments: selected, patch: autoPoolPatch })); }
            catch (_) { /* quota or private browsing — no persistent cache */ }
        }
        return { complete: selected.length > 0, count: selected.length, direct: autoValidRoster(direct) };
    }
    function mergeAutoPoolWithStats(rows) {
        if (!autoValidRoster(autoPoolRows)) return rows;
        // Rebuild from the current KIWI pool, not from the last stats snapshot.
        // Match by name to preserve the stats ID used in existing saved builds.
        const byName = new Map(rows.map(a => [autoPoolKey(a.name), a]));
        const final = [];
        for (const r of autoPoolRows) {
            const existing = byName.get(autoPoolKey(r.name));
            const combined = {
                ...(existing || {}), ...r,
                id: existing?.id || String(r.id || slug(r.name)),
                legacyId: existing?.legacyId || existing?.id || r.id || slug(r.name),
                retiredPatch: null,
                pickRate: existing?.pickRate ?? null,
                pickRateRank: existing?.pickRateRank ?? null,
                introducedPatch: existing?.introducedPatch || r.introducedPatch || '',
                description: existing?.description || r.description || '',
                url: existing?.url || r.url || '',
                imageUrl: r.imageUrl || existing?.imageUrl || ''
            };
            final.push(combined);
        }
        return final;
    }
    async function loadRemote() {
        state.status = 'Loading current ARAM Mayhem augment pool…';
        render();
        let stats = [];
        let statsPatch = '';
        try {
            const raw = await autoFetchJson(DATA_URL);
            if (!Array.isArray(raw.rows) || raw.rows.length < 100) throw Error('Unexpected stats format');
            stats = raw.rows.map(x => ({
                id: String(x.augmentId), legacyId: String(x.augmentId),
                name: String(x.name?.en || x.slug || x.augmentId), rarity: x.rarity || 'silver',
                description: '', introducedPatch: x.introducedPatch || '', retiredPatch: x.retiredPatch || null,
                pickRate: x.pickRate, source: 'public', url: x.url,
                pickRateRank: x.pickRateRank, previousPickRateRank: x.previousPickRateRank,
                pickRateChange: x.pickRateChange, previousPickRate: x.previousPickRate
            }));
            statsPatch = String(raw.meta?.patch || raw.rows?.[0]?.patch || '');
        } catch (error) {
            console.warn('Optional augment statistics unavailable', error);
        }
        let roster;
        try { roster = await autoLoadPool(); }
        catch (error) { console.warn('Live augment pool unavailable', error); roster = { complete: false, count: 0 }; }
        if (roster.complete) {
            state.augments = mergeAutoPoolWithStats(stats);
            state.status = `${state.augments.length} KIWI (ARAM Mayhem) augments · ` +
                (roster.direct ? 'live Riot game data' : 'cached game-data roster') +
                (statsPatch ? ` · optional stats: ${statsPatch}` : '');
        } else {
            // Only fall back to the old stats list and bundled released augments
            // if neither the live pool nor a previous good snapshot is available.
            state.augments = typeof mergeNewReleaseAugments === 'function'
                ? mergeNewReleaseAugments(stats.length ? stats : fallbackData())
                : (stats.length ? stats : fallbackData());
            state.status = `${state.augments.length} fallback augments · live pool unavailable; will retry on reload`;
        }
        state.patch = autoPoolPatch || statsPatch || state.patch;
        reconcileAugmentIds();
        if (state.itemSource.startsWith('ARAMMayhem.com'))
            state.itemSource = `ARAMMayhem.com item catalog · patch ${state.patch}`;
        render();
    }
'''

# This is a replacement for ONLY the remote augment-loading function.
# All other code (sharing, custom layout, build models, buttons) remains intact.
new_source = s[:i] + new_loader + s[j:]

# An imported older stats file should not drop the automatic current pool.
import_patch = '                state.patch = obj.meta?.patch || state.patch;'
if new_source.count(import_patch) == 1:
    new_source = new_source.replace(import_patch,
        '                state.augments = mergeAutoPoolWithStats(state.augments);\n' + import_patch)

backup = app.with_suffix('.js.bak')
if not backup.exists():
    backup.write_text(s, encoding='utf-8')
app.write_text(new_source, encoding='utf-8')
print('Installed automatic KIWI augment loading into app.js (backup: app.js.bak).')
print('This will refresh at page load; GitHub Actions also maintains data/live-augments.json.')
