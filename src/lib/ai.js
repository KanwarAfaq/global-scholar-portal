import { invokeFunction } from './functions';
export async function runAiAction(action, options={}) { return invokeFunction('ai-gateway',{body:{action,...options}}); }
