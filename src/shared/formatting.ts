/** Return a reversible inline-format edit without changing surrounding whitespace. */
export function inlineFormatEdit(source:string,from:number,to:number,mark:string){
  const tag=mark==='**'?'strong':mark==='*'?'em':undefined;
  const pairs:[string,string][]=[[mark,mark],...(tag?[[`<${tag}>`,`</${tag}>`] as [string,string]]:[])];
  const selected=source.slice(from,to);
  for(const [open,close] of pairs){
    if(selected.startsWith(open)&&selected.endsWith(close)&&selected.length>=open.length+close.length){
      const insert=selected.slice(open.length,-close.length);return {from,to,insert,anchor:from,head:from+insert.length};
    }
    if(from>=open.length&&source.slice(from-open.length,from)===open&&source.slice(to,to+close.length)===close){
      return {from:from-open.length,to:to+close.length,insert:selected,anchor:from-open.length,head:to-open.length};
    }
  }
  // Spaces inside emphasis delimiters prevent them from opening/closing.
  if(from!==to){const leading=/^\s*/u.exec(selected)![0].length,trailing=/\s*$/u.exec(selected)![0].length;if(leading===selected.length)return;
    from+=leading;to-=trailing;}
  const text=source.slice(from,to);
  let open=mark,close=mark;
  if(tag&&text){
    const before=[...source.slice(0,from)].at(-1)??'',after=[...source.slice(to)][0]??'';
    const first=[...text][0],last=[...text].at(-1)!;
    const whitespace=(char:string)=>!char||/\s/u.test(char),punctuation=(char:string)=>/[\p{P}\p{S}]/u.test(char);
    const canOpen=!whitespace(first)&&(!punctuation(first)||whitespace(before)||punctuation(before));
    const canClose=!whitespace(last)&&(!punctuation(last)||whitespace(after)||punctuation(after));
    // CommonMark cannot express these punctuation-adjacent boundaries with **.
    // Inline HTML preserves the exact text and needs no inserted visible spaces.
    if(!canOpen||!canClose){open=`<${tag}>`;close=`</${tag}>`;}
  }
  return {from,to,insert:open+text+close,anchor:from+open.length,head:to+open.length};
}
