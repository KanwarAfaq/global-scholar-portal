export function notify(message){window.dispatchEvent(new CustomEvent('portal-notice',{detail:String(message)}));}
