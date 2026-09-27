import { supabase } from './supabaseClient.js';

let channelSeq = 0;

/**
 * Subscribe to any INSERT/UPDATE/DELETE on a public table (Supabase Realtime).
 * Returns an unsubscribe function.
 */
export function onTableChange(table, callback) {
    let channel = null;
    try {
        channel = supabase
            .channel(`rt-${table}-${++channelSeq}`)
            .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
                try { callback(payload); } catch (e) { console.error(`Realtime callback error (${table}):`, e); }
            })
            .subscribe();
    } catch (e) {
        console.error(`Failed to subscribe to realtime for ${table}:`, e);
    }
    return () => {
        if (channel) {
            try { supabase.removeChannel(channel); } catch (e) { console.error(e); }
            channel = null;
        }
    };
}

// One live subscription set per view key, so re-rendering a view never stacks subscriptions.
const liveViews = new Map();

/**
 * Keep a view fresh when any of `tables` changes on another device.
 * - key: unique per view (e.g. 'ops-assigned'); a new call replaces the previous subscription.
 * - rootEl: the view's root element; once it leaves the DOM, the subscription tears itself down.
 * - refreshFn: async function that reloads the view's data.
 * Refreshes are debounced (~300ms) and postponed while the user is typing inside the view.
 */
export function liveRefresh(key, tables, rootEl, refreshFn) {
    const prev = liveViews.get(key);
    if (prev) prev.stop();

    let timer = null;
    let unsubs = [];
    const stop = () => {
        clearTimeout(timer);
        unsubs.forEach(u => u());
        unsubs = [];
        if (liveViews.get(key) === entry) liveViews.delete(key);
    };

    const schedule = () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
            if (!rootEl.isConnected) { stop(); return; }
            const active = document.activeElement;
            if (active && rootEl.contains(active) && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) {
                schedule(); // user is typing; try again shortly
                return;
            }
            try { await refreshFn(); } catch (e) { console.error(`Live refresh failed (${key}):`, e); }
        }, 300);
    };

    const entry = { stop };
    liveViews.set(key, entry);
    unsubs = tables.map(t => onTableChange(t, schedule));
    return stop;
}
