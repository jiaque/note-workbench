import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkFrontmatter from 'remark-frontmatter';
import {parseFragment} from 'parse5';
import {obsidianSyntax,maskComments} from './obsidian';
import {noteCandidates,type NoteEntry} from './note-links';

const parser=unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkFrontmatter,['yaml']).use(obsidianSyntax);
export interface Rename {oldId:string;newId:string}
export interface LinkEdit {from:number;to:number;insert:string}
export function renamedId(id:string,renames:Rename[]):string {
  const match=[...renames].sort((a,b)=>b.oldId.length-a.oldId.length).find(r=>id===r.oldId||id.startsWith(r.oldId.replace(/\/$/,'')+'/'));
  return match?match.newId+id.slice(match.oldId.length):id;
}
function relative(from:string,to:string){
  const a=new URL(from),b=new URL(to);if(a.protocol!==b.protocol||a.host!==b.host)return to;
  const parts=a.pathname.split('/').slice(0,-1),target=b.pathname.split('/');let same=0;while(same<parts.length&&parts[same]===target[same])same++;
  return '../'.repeat(parts.length-same)+target.slice(same).join('/');
}
/** Only actual parsed links are changed. Code, YAML examples and comments stay byte-identical. */
export function renameLinkEdits(note:NoteEntry,notes:NoteEntry[],renames:Rename[]):{edits:LinkEdit[];ambiguous:number}{
  const edits:LinkEdit[]=[],source=note.source,newOrigin=renamedId(note.id,renames);let ambiguous=0;
  const future=notes.map(n=>{const id=renamedId(n.id,renames);return {...n,id,name:decodeURIComponent(new URL(id).pathname.split('/').pop()!),path:decodeURIComponent(new URL(id).pathname).replace(/^\//,'')};});
  const rewrite=(target:string,wiki:boolean)=>{
    if(!target||target.startsWith('#')||/^(?!file:|[a-z]:[\\/])(?:[a-z][\w+.-]*:|\/\/)/i.test(target))return;
    const split=target.search(/[#?]/),file=split<0?target:target.slice(0,split),suffix=split<0?'':target.slice(split);
    if(!file)return;
    let normalized=file;try{normalized=decodeURIComponent(file);}catch{return;}
    if(/^[a-z]:[\\/]/i.test(normalized))normalized='file:///'+normalized.replace(/\\/g,'/');
    const candidates=noteCandidates(notes,note.id,normalized);
    if(candidates.length>1){if(candidates.some(n=>renamedId(n.id,renames)!==n.id)||newOrigin!==note.id)ambiguous++;return;}
    const found=candidates[0];
    let oldTarget=found?.id;
    // Moving a note must also keep relative image/attachment links usable.
    if(!oldTarget&&newOrigin!==note.id&&!wiki&&/\.[^/]+$/.test(file))try{oldTarget=new URL(normalized,note.id).href;}catch{}
    if(!oldTarget)return;
    const nextTarget=renamedId(oldTarget,renames);if(nextTarget===oldTarget&&newOrigin===note.id)return;
    let result=relative(newOrigin,nextTarget);
    if(/^file:/i.test(file))result=nextTarget;
    else if(/^[a-z]:[\\/]/i.test(file))result=decodeURIComponent(new URL(nextTarget).pathname).replace(/^\//,'');
    else if(file.startsWith('/'))result=new URL(nextTarget).pathname;
    else if(wiki){
      result=decodeURIComponent(result);
      if(!/\.md$/i.test(file))result=result.replace(/\.md$/i,'');
      // Preserve a short name or alias only if it still resolves to the intended note.
      const oldMatches=noteCandidates(future,newOrigin,file);
      if(oldMatches.length===1&&oldMatches[0].id===nextTarget)return;
      if(!/[\\/]/.test(file)){
        const short=decodeURIComponent(new URL(nextTarget).pathname.split('/').pop()!).replace(/\.md$/i,/\.md$/i.test(file)?'.md':'');
        const matches=noteCandidates(future,newOrigin,short);if(matches.length===1&&matches[0].id===nextTarget)result=short;
      }
    }
    if(wiki)result=result.replace(/%/g,'%25').replace(/#/g,'%23').replace(/\?/g,'%3F').replace(/\|/g,'%7C').replace(/\]/g,'%5D');
    return result+suffix;
  };
  const add=(from:number,to:number,target:string,wiki=false,html=false)=>{
    const replacement=rewrite(target,wiki);if(replacement===undefined||replacement===source.slice(from,to))return;
    let insert=replacement;
    if(html)insert=insert.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    else if(!wiki)insert=insert.replace(/\(/g,'%28').replace(/\)/g,'%29').replace(/ /g,'%20');
    edits.push({from,to,insert});
  };
  const tree:any=parser.parse(maskComments(source,parser.parse(source)));
  const visit=(node:any)=>{
    const start=node.position?.start.offset??0,end=node.position?.end.offset??0,raw=source.slice(start,end);
    if(node.type==='obsidianInline'&&/^!?\[\[/.test(raw)){
      const prefix=raw.startsWith('!')?3:2,body=raw.slice(prefix,-2),pipe=body.indexOf('|');let length=pipe<0?body.length:pipe;if(body[length-1]==='\\')length--;
      add(start+prefix,start+prefix+length,body.slice(0,length),true);
    }
    if(['link','image','definition'].includes(node.type)){
      // Locate the destination after the label, preserving titles and surrounding syntax.
      const offset=node.type==='definition'?(/^\s{0,3}\[(?:\\.|[^\]\\])*\]:\s*/.exec(raw)?.[0].length??-1):(()=>{
        const last=node.children?.at(-1)?.position?.end?.offset;
        if(last!==undefined){let i=last-start;if(raw[i]===']'){i++;while(i<raw.length&&/\s/.test(raw[i]))i++;if(raw[i]==='(')return i+1;}}
        let depth=0;for(let i=raw.startsWith('!')?1:0;i<raw.length;i++){if(raw[i]==='\\'){i++;continue;}if(raw[i]==='[')depth++;if(raw[i]===']'&&--depth===0){let j=i+1;while(j<raw.length&&/\s/.test(raw[j]))j++;return raw[j]==='('?j+1:-1;}}return -1;
      })();
      if(offset>=0){let a=offset;while(a<raw.length&&/\s/.test(raw[a]))a++;const angle=raw[a]==='<';if(angle)a++;let b=a,depth=0;
        while(b<raw.length){const c=raw[b];if(c==='\\'){b+=2;continue;}if(angle?c==='>':/\s/.test(c)||c===')'&&depth===0)break;if(c==='(')depth++;if(c===')')depth--;b++;}
        if(b>a)add(start+a,start+b,node.url);
      }
    }
    if(node.type==='html'){
      const walk=(n:any)=>{
        if(['a','img','source','video','audio'].includes(n.tagName))for(const key of ['href','src','poster']){
          const value=n.attrs?.find((a:any)=>a.name===key)?.value,loc=n.sourceCodeLocation?.attrs?.[key];if(!value||!loc)continue;
          const attribute=raw.slice(loc.startOffset,loc.endOffset),m=/^[^=]+\s*=\s*(["']?)([\s\S]*?)\1$/.exec(attribute);if(!m)continue;
          const a=attribute.indexOf('=')+1,leading=attribute.slice(a).search(/\S/),from=loc.startOffset+a+leading+(m[1]?1:0);add(start+from,start+loc.endOffset-(m[1]?1:0),value,false,true);
        }
        for(const child of n.childNodes??[])walk(child);
      };walk(parseFragment(raw,{sourceCodeLocationInfo:true}));
    }
    for(const child of node.children??[])visit(child);
  };visit(tree);return {edits:edits.sort((a,b)=>a.from-b.from),ambiguous};
}
