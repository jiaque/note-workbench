import {autocompletion,type CompletionContext,type CompletionResult} from '@codemirror/autocomplete';
import type {WikiCompletion} from '../shared/note-links';

let sequence=0;
const pending=new Map<number,(options:WikiCompletion[])=>void>();
window.addEventListener('message',event=>{const message=event.data;if(message?.type==='completions'){pending.get(message.requestId)?.(message.options);pending.delete(message.requestId);}});
export function wikiCompletion(post:(message:unknown)=>void){
  return autocompletion({override:[(context:CompletionContext):Promise<CompletionResult|null>|null=>{
    const wiki=context.matchBefore(/\[\[[^\]\n]*/),path=context.matchBefore(/!?\[[^\]\n]*\]\(<?[^)\n>]*/);
    const match=wiki??path;if(!match)return null;
    const start=wiki?2:match.text.indexOf('(')+1+(match.text.includes('(<')?1:0);
    const query=match.text.slice(start);if(wiki&&query.includes('|'))return null;
    return new Promise(resolve=>{
      const requestId=++sequence,timer=setTimeout(()=>{pending.delete(requestId);resolve(null);},5000);
      pending.set(requestId,options=>{clearTimeout(timer);if(context.aborted){resolve(null);return;}resolve({from:match.from+start,options:options.map(option=>({label:option.label,detail:option.detail,type:'text',apply:option.insert+(wiki&&context.state.sliceDoc(context.pos,context.pos+2)!==']]'?']]':'' )}))});});
      context.addEventListener('abort',()=>{clearTimeout(timer);pending.delete(requestId);resolve(null);});
      post({type:wiki?'complete':'completePath',requestId,query,images:match.text.startsWith('!')});
    });
  }]});
}
