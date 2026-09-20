import {autocompletion,type CompletionContext,type CompletionResult} from '@codemirror/autocomplete';
import type {WikiCompletion} from '../shared/note-links';

let sequence=0;
const pending=new Map<number,(options:WikiCompletion[])=>void>();
window.addEventListener('message',event=>{const message=event.data;if(message?.type==='completions'){pending.get(message.requestId)?.(message.options);pending.delete(message.requestId);}});
export function wikiCompletion(post:(message:unknown)=>void){
  return autocompletion({override:[(context:CompletionContext):Promise<CompletionResult|null>|null=>{
    const match=context.matchBefore(/\[\[[^\]\n]*/);if(!match)return null;
    const query=match.text.slice(2);if(query.includes('|'))return null;
    return new Promise(resolve=>{
      const requestId=++sequence,timer=setTimeout(()=>{pending.delete(requestId);resolve(null);},5000);
      pending.set(requestId,options=>{clearTimeout(timer);if(context.aborted){resolve(null);return;}resolve({from:match.from+2,options:options.map(option=>({label:option.label,detail:option.detail,type:'text',apply:option.insert+(context.state.sliceDoc(context.pos,context.pos+2)===']]'?'':']]')}))});});
      context.addEventListener('abort',()=>{clearTimeout(timer);pending.delete(requestId);resolve(null);});
      post({type:'complete',requestId,query});
    });
  }]});
}
