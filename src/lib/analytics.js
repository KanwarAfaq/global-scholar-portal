import { supabase } from './supabase';

function sessionId() {
  const key = 'scholarportal_session_id';
  let id = sessionStorage.getItem(key);
  if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(key, id); }
  return id;
}

export async function track(eventName, { userId = null, entityType = null, entityId = null, properties = {} } = {}) {
  try {
    await supabase.from('analytics_events').insert({ user_id: userId, session_id: sessionId(), event_name: eventName, entity_type: entityType, entity_id: entityId ? String(entityId) : null, properties });
  } catch { /* analytics must never break the product */ }
}
