/* Deuce Card Room · cloud layer (GitHub Pages version only)
 *
 * Adds Supabase accounts on top of the offline app:
 *  - email + password sign-in
 *  - cloud saves: every dcr_* setting in localStorage is backed up to the
 *    `saves` table and restored on other devices
 *  - the friends features (leaderboard, brag wall, live Hold'em table) run on
 *    the same small interface the app uses inside Claude (`window.claude.use`),
 *    backed here by Supabase tables and Realtime presence.
 *
 * Signed out, or offline, the app keeps working exactly as before.
 */
(() => {
  const SUPABASE_URL = 'https://cahjbfjdvlhgxcrgyqka.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_BI57VQMS7p7qN5Al36wUng_Jpm82bID'; // publishable: safe in client code

  window.DCR_CLOUD = true;
  const $ = (id) => document.getElementById(id);
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  const sb = window.supabase && window.supabase.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'dcr-auth' } })
    : null;

  let session = null;
  const ready = (async () => {
    if (!sb) return;
    try { session = (await sb.auth.getSession()).data.session; } catch (e) { session = null; }
  })();
  const uid = () => session && session.user.id;
  const myName = () => (session && session.user.user_metadata && session.user.user_metadata.name) || (session && session.user.email.split('@')[0]) || 'Player';

  /* ---------- cloud saves ---------- */
  const SYNC_KEY = 'dcr_cloud_sync';
  function snapshot() {
    const out = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('dcr_') && k !== SYNC_KEY) out[k] = localStorage.getItem(k);
      }
    } catch (e) {}
    return out;
  }
  function applySave(data) {
    try {
      Object.keys(snapshot()).forEach((k) => localStorage.removeItem(k));
      Object.entries(data || {}).forEach(([k, v]) => { if (k.startsWith('dcr_') && typeof v === 'string') localStorage.setItem(k, v); });
    } catch (e) {}
  }
  const bankOf = (data) => { const v = Number(data && data.dcr_bank); return Number.isFinite(v) ? v : null; };
  const levelOf = (data) => { try { return JSON.parse(data.dcr_prof || '{}').xp || 0; } catch (e) { return 0; } };

  let lastUploaded = null, uploading = false, lastSyncAt = null, syncError = '';
  async function upload(force) {
    if (!sb || !uid() || uploading) return;
    const snap = snapshot(), json = JSON.stringify(snap);
    if (!force && json === lastUploaded) return;
    uploading = true;
    const at = new Date().toISOString();
    const { error } = await sb.from('saves').upsert({ user_id: uid(), data: snap, updated_at: at });
    uploading = false;
    if (error) { syncError = 'Couldn’t reach the cloud. Your progress is safe on this device and will sync when you’re back online.'; renderAccount(); return; }
    syncError = ''; lastUploaded = json; lastSyncAt = Date.now(); lsSet(SYNC_KEY, at); renderAccount();
  }
  async function fetchSave() {
    const { data, error } = await sb.from('saves').select('data,updated_at').eq('user_id', uid()).maybeSingle();
    if (error) throw error;
    return data;
  }

  // On load while signed in: pull a newer save made on another device, then keep this one backed up.
  async function startSync() {
    if (!uid()) return;
    try {
      const cloud = await fetchSave();
      const local = lsGet(SYNC_KEY);
      if (cloud && cloud.data && (!local || new Date(cloud.updated_at) > new Date(local))) {
        if (JSON.stringify(cloud.data) !== JSON.stringify(snapshot())) {
          applySave(cloud.data); lsSet(SYNC_KEY, cloud.updated_at); location.reload(); return;
        }
        lsSet(SYNC_KEY, cloud.updated_at);
      }
      lastUploaded = cloud ? JSON.stringify(cloud.data) : null;
    } catch (e) { /* offline: keep playing locally */ }
    setInterval(() => upload(false), 5000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') upload(false); });
  }

  /* ---------- the interface the app's friends features use ---------- */
  const names = {};
  const userApi = {
    isOwner: async () => false,
    canEdit: async () => false,
    can: async () => true,
    id: async () => uid(),
    me: async () => ({ id: uid(), name: myName(), avatarUrl: '', color: '#cdd5d8', email: null, isOwner: false, canEdit: false }),
    profiles: async (ids) => {
      ids = [].concat(ids).filter(Boolean);
      const missing = ids.filter((id) => !(id in names));
      if (missing.length) {
        const { data } = await sb.from('players').select('user_id,name').in('user_id', missing);
        (data || []).forEach((r) => { names[r.user_id] = r.name; });
        missing.forEach((id) => { if (!(id in names)) names[id] = ''; });
      }
      return Object.fromEntries(ids.map((id) => [id, { id, name: id === uid() ? myName() : names[id] || '', avatarUrl: '', color: '#cdd5d8', email: null, isMe: id === uid(), guest: false }]));
    },
  };

  const refreshers = new Set();
  const dbApi = {
    collection(path) {
      if (path !== 'players') throw new Error('unknown collection ' + path);
      const q = {
        orderBy: () => q,
        limit: () => q,
        onSnapshot(next, onError) {
          let timer = null, alive = true;
          const load = async () => {
            const { data, error } = await sb.from('players').select('user_id,name,stats,updated_at').order('updated_at', { ascending: false }).limit(100);
            if (!alive) return;
            if (error) { onError && onError(error); return; }
            data.forEach((r) => { names[r.user_id] = r.name; });
            next({ docs: data.map((r) => ({ id: r.user_id, exists: true, data: () => ({ ...(r.stats || {}) }) })) });
          };
          const soon = () => { clearTimeout(timer); timer = setTimeout(load, 400); };
          load();
          const ch = sb.channel('players-feed').on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, soon).subscribe();
          const poll = setInterval(load, 60000);
          refreshers.add(soon);
          return () => { alive = false; refreshers.delete(soon); clearInterval(poll); sb.removeChannel(ch); };
        },
      };
      return q;
    },
    doc(path) {
      const [col, id] = path.split('/');
      if (col !== 'players' || id !== uid()) throw new Error('can only write your own player row');
      return {
        set: async (stats) => {
          const { error } = await sb.from('players').upsert({ user_id: id, name: myName(), stats, updated_at: new Date().toISOString() });
          if (error) throw Object.assign(new Error(error.message), { code: 'upstream_error' });
          refreshers.forEach((f) => f());
        },
      };
    },
  };

  // Realtime presence shaped like the app's room: everyone's presence object, ours marked sameTab.
  const roomApi = {
    async join(name) {
      const tab = 't' + Math.random().toString(36).slice(2, 10);
      const ch = sb.channel('room-' + name, { config: { presence: { key: tab } } });
      let mine = {}, peersNow = [], connected = false, trackTimer = null;
      const handlers = [];
      const build = () => {
        const st = ch.presenceState();
        peersNow = Object.entries(st).map(([key, metas]) => {
          const m = metas[metas.length - 1] || {};
          return { peer: key, by: typeof m.by === 'string' ? m.by : null, kind: 'viewer', isMe: key === tab, sameTab: key === tab, guest: false, presence: (m.p && typeof m.p === 'object') ? m.p : {}, updatedAt: Date.now() };
        });
        if (!peersNow.some((p) => p.sameTab)) peersNow.push({ peer: tab, by: uid(), kind: 'viewer', isMe: true, sameTab: true, guest: false, presence: mine, updatedAt: Date.now() });
        handlers.forEach((h) => h({ peers: peersNow, joined: [], left: [], updated: [] }));
      };
      const track = () => { clearTimeout(trackTimer); trackTimer = setTimeout(() => { if (connected) ch.track({ by: uid(), p: mine }); }, 40); };
      ch.on('presence', { event: 'sync' }, build);
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'upstream_error' })), 10000);
        ch.subscribe((status) => {
          if (status === 'SUBSCRIBED') { connected = true; clearTimeout(t); ch.track({ by: uid(), p: mine }); resolve(); }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { connected = false; }
        });
      });
      return {
        name,
        presence: async (patch) => {
          mine = { ...mine };
          for (const k in patch) { if (patch[k] === null) delete mine[k]; else mine[k] = patch[k]; }
          // show our own change at once, then share it
          const me = peersNow.find((p) => p.sameTab); if (me) { me.presence = mine; handlers.forEach((h) => h({ peers: peersNow.slice(), joined: [], left: [], updated: [] })); }
          track();
        },
        peers: () => peersNow,
        onPeers: (h) => { handlers.push(h); setTimeout(build, 0); return () => { const i = handlers.indexOf(h); if (i >= 0) handlers.splice(i, 1); }; },
        connected: () => connected,
        onConnection: (h) => { setTimeout(() => h(connected), 0); return () => {}; },
        leave: async () => { await sb.removeChannel(ch); },
        emit: async () => {}, on: () => () => {},
      };
    },
  };

  window.claude = {
    use: async (name) => {
      await ready;
      if (!sb || !session) return null;
      if (name === 'user') return userApi;
      if (name === 'db') return dbApi;
      if (name === 'room') return roomApi;
      return null;
    },
  };

  /* ---------- Deuce Pro (entitlements table) ----------
   Pro is granted per account in the `entitlements` table, which players can
   read but never write (owner and testers are added from the Supabase SQL
   editor; store purchases will be written there by the server later). */
  function sendPro(src) {
    window.DCR_PRO_STATE = src;
    window.dispatchEvent(new CustomEvent('dcr-pro', { detail: { src } }));
  }
  async function checkPro() {
    if (!sb) return;                      // offline: keep whatever the app cached
    if (!session) { sendPro(null); return; }
    const { data, error } = await sb.from('entitlements').select('pro,source').eq('user_id', uid()).maybeSingle();
    if (error) return;                    // table missing or network trouble: keep the cache
    sendPro(data && data.pro ? data.source || 'purchase' : null);
  }

  /* ---------- account panel (top of the Lounge) ---------- */
  let mode = 'signin', busy = false, msg = '', choice = null, confirmDelete = false;
  function panel() {
    let el = $('acct');
    if (!el) {
      const lo = $('lo'); if (!lo) return null;
      el = document.createElement('div'); el.className = 'panel'; el.id = 'acct';
      lo.insertBefore(el, lo.firstChild);
    }
    return el;
  }
  const ago = (t) => { const s = Math.round((Date.now() - t) / 1000); return s < 10 ? 'just now' : s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`; };
  function renderAccount() {
    const el = panel(); if (!el) return;
    if (!sb) { el.innerHTML = '<h2>Your account</h2><p class="sub">Cloud saves aren’t available right now (you may be offline). Your progress is saved on this device.</p>'; return; }
    if (choice) {
      const { cloud, local } = choice;
      el.innerHTML = `<h2>Which progress do you want?</h2>
        <p class="sub">Your account already has a save, and this device has its own progress.</p>
        <div class="row" style="justify-content:flex-start">
          <button class="btn primary" id="acUseCloud">Use my account’s save · bank ${Number(bankOf(cloud.data) || 0).toLocaleString('en-US')}</button>
          <button class="btn ghost" id="acUseLocal">Keep this device · bank ${Number(bankOf(local) || 0).toLocaleString('en-US')}</button>
        </div>
        <p class="sub">The one you don’t pick is replaced.</p>`;
      $('acUseCloud').onclick = () => { applySave(cloud.data); lsSet(SYNC_KEY, cloud.updated_at); location.reload(); };
      $('acUseLocal').onclick = async () => { choice = null; await upload(true); location.reload(); };
      return;
    }
    if (session) {
      el.innerHTML = `<h2>Your account</h2>
        <p class="sub" style="color:var(--ivory)">Signed in as <b>${esc(myName())}</b> · ${esc(session.user.email)}</p>
        <p class="sub">${syncError ? esc(syncError) : lastSyncAt ? 'Progress backed up to the cloud · ' + ago(lastSyncAt) : 'Your progress backs up to the cloud automatically.'}</p>
        <div class="row" style="justify-content:flex-start"><button class="btn ghost preset" id="acOut">Sign out</button><button class="btn ghost preset" id="acDel">Delete account</button></div>
        ${confirmDelete ? `<div class="acdanger">
          <p><b>Delete your account for good?</b> This removes your account, your cloud save and your leaderboard card and brags. It can’t be undone. Progress already on this device stays here.</p>
          ${msg ? `<p class="acmsg">${esc(msg)}</p>` : ''}
          <div class="row" style="justify-content:flex-start"><button class="btn primary" id="acDelYes" ${busy ? 'disabled' : ''}>${busy ? 'Deleting…' : 'Delete my account'}</button><button class="btn ghost" id="acDelNo">Keep my account</button></div>
        </div>` : ''}
        <p class="sub"><a href="privacy.html" class="aclink">Privacy policy</a></p>`;
      $('acOut').onclick = async () => { await upload(true); await sb.auth.signOut(); sendPro(null); location.reload(); };
      $('acDel').onclick = () => { confirmDelete = true; msg = ''; renderAccount(); };
      if (confirmDelete) {
        $('acDelNo').onclick = () => { confirmDelete = false; msg = ''; renderAccount(); };
        $('acDelYes').onclick = deleteAccount;
      }
      return;
    }
    const up = mode === 'signup';
    el.innerHTML = `<h2>${up ? 'Create your account' : 'Sign in'}</h2>
      <p class="sub">Back up your bank and progress, play on any device, and join your friends on the leaderboard and the live Hold’em table.</p>
      <form id="acForm" class="acform" novalidate>
        ${up ? '<label>Name at the table<input id="acName" maxlength="24" autocomplete="nickname" required></label>' : ''}
        <label>Email<input id="acEmail" type="email" autocomplete="email" required></label>
        <label>Password<input id="acPass" type="password" minlength="6" autocomplete="${up ? 'new-password' : 'current-password'}" required></label>
        ${msg ? `<p class="acmsg">${esc(msg)}</p>` : ''}
        <div class="row" style="justify-content:flex-start">
          <button class="btn primary" type="submit" ${busy ? 'disabled' : ''}>${busy ? 'One moment…' : up ? 'Create account' : 'Sign in'}</button>
          <button class="btn ghost preset" type="button" id="acSwap">${up ? 'I have an account' : 'New here? Create an account'}</button>
        </div>
        <p class="sub">${up ? 'By creating an account you agree to the ' : ''}<a href="privacy.html" class="aclink">${up ? 'privacy policy' : 'Privacy policy'}</a>${up ? '. Deuce is play money only, for adults 18+.' : ''}</p>
      </form>`;
    $('acSwap').onclick = () => { mode = up ? 'signin' : 'signup'; msg = ''; renderAccount(); };
    $('acForm').onsubmit = (e) => { e.preventDefault(); submit(up); };
  }
  async function deleteAccount() {
    busy = true; msg = ''; renderAccount();
    const { error } = await sb.rpc('delete_my_account');
    busy = false;
    if (error) { msg = 'Couldn’t delete your account right now. Check your connection and try again.'; renderAccount(); return; }
    try { localStorage.removeItem(SYNC_KEY); } catch (e) {}
    await sb.auth.signOut().catch(() => {});
    confirmDelete = false; session = null; sendPro(null); msg = 'Your account was deleted.'; location.reload();
  }
  async function submit(up) {
    const email = $('acEmail').value.trim(), pass = $('acPass').value, name = up ? $('acName').value.trim() : '';
    if (up && !name) { msg = 'Pick a name for the table.'; renderAccount(); return; }
    if (!email || pass.length < 6) { msg = 'Enter your email and a password of at least 6 characters.'; renderAccount(); return; }
    busy = true; msg = ''; renderAccount();
    const res = up
      ? await sb.auth.signUp({ email, password: pass, options: { data: { name } } })
      : await sb.auth.signInWithPassword({ email, password: pass });
    busy = false;
    if (res.error) { msg = res.error.message.includes('Invalid login') ? 'That email and password don’t match.' : res.error.message; renderAccount(); return; }
    if (!res.data.session) { msg = 'Check your email to confirm your account, then sign in here.'; mode = 'signin'; renderAccount(); return; }
    session = res.data.session;
    // Decide which progress to keep.
    let cloud = null;
    try { cloud = await fetchSave(); } catch (e) {}
    const local = snapshot();
    if (cloud && cloud.data && Object.keys(cloud.data).length && JSON.stringify(cloud.data) !== JSON.stringify(local)) { choice = { cloud, local }; renderAccount(); return; }
    await upload(true);
    location.reload();
  }

  ready.then(() => { renderAccount(); startSync(); checkPro(); });
})();
