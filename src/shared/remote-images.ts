import {t} from './i18n';
import {parseFragment,serialize} from 'parse5';
import type {Rendered} from './render';

export function blockRemoteImages(rendered:Rendered){
  for(const block of rendered.blocks){
    const fragment:any=parseFragment(block.html);
    const walk=(node:any)=>{
      const src=node.attrs?.find((attr:any)=>attr.name==='src')?.value;
      if(node.tagName==='img'&&/^https?:/i.test(src??'')){
        const alt=node.attrs?.find((attr:any)=>attr.name==='alt')?.value??t("远程图片");
        node.nodeName=node.tagName='span';node.attrs=[{name:'class',value:'remote-image-placeholder'}];
        node.childNodes=[{nodeName:'#text',value:t('[已关闭远程图片：{alt}]',{alt}),parentNode:node}];return;
      }
      for(const child of node.childNodes??[])walk(child);
    };walk(fragment);block.html=serialize(fragment);
  }
}
