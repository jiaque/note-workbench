export function findHeading<T>(nodes:T[],fragment:string,label:(node:T)=>string,level:(node:T)=>number):T|undefined {
  let start=0,end=nodes.length,target:T|undefined;
  for(const part of fragment.split('#')){
    let index=-1;
    for(let i=start;i<end;i++)if(label(nodes[i]).trim().toLowerCase()===part.trim().toLowerCase()){index=i;break;}
    if(index<0)return undefined;
    target=nodes[index];start=index+1;
    for(let i=start;i<end;i++)if(level(nodes[i])<=level(target)){end=i;break;}
  }
  return target;
}
