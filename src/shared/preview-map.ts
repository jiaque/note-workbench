/** Generated after sanitizing: authored attributes cannot forge source locations. */
export function annotatePreview(node:any){
  const start=node.position?.start?.offset,end=node.position?.end?.offset;
  if(node.type==='element'&&Number.isInteger(start)&&Number.isInteger(end))node.properties={...node.properties,dataNwFrom:start,dataNwTo:end};
  if(node.type==='text'&&Number.isInteger(start)&&Number.isInteger(end))return {type:'element',tagName:'span',properties:{dataNwText:start,dataNwEnd:end},children:[node]};
  if(node.children&&!['svg','mjx-container','code','pre'].includes(node.tagName))node.children=node.children.map(annotatePreview);
  return node;
}
