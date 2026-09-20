export interface TextMatch { from:number; to:number }
/** Literal, non-overlapping matches. RegExp preserves original UTF-16 offsets. */
export function findText(text:string,query:string,matchCase=false):TextMatch[] {
  if(!query)return [];
  const expression=new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),matchCase?'gu':'giu');
  return [...text.matchAll(expression)].map(match=>({from:match.index!,to:match.index!+match[0].length}));
}
