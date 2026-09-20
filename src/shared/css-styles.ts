import {parse,walk,generate,lexer} from 'css-tree';
import {effectParameter} from './effects';
const properties=new Set(('color background-color background padding padding-left padding-right padding-top padding-bottom margin margin-top margin-bottom margin-left margin-right border border-left border-right border-top border-bottom border-radius display font-family font-size font-weight font-style text-align text-decoration text-indent letter-spacing word-spacing white-space overflow-wrap list-style-type line-height width height max-width min-width vertical-align paint-order stroke stroke-width stroke-linejoin fill opacity transform transform-origin translate rotate scale box-shadow text-shadow filter background-size background-position transition-property transition-duration transition-delay transition-timing-function').split(' '));
const svgProperties=new Set(('animation animation-name animation-duration animation-delay animation-timing-function animation-iteration-count animation-direction animation-fill-mode animation-play-state stroke-dasharray stroke-dashoffset stroke-linecap fill-opacity stroke-opacity clip-path mask stop-color stop-opacity visibility cx cy r x y offset-path offset-distance').split(' '));
export function cleanStyle(source:string,svg=false):string {
  if(source.length>30000)return '';
  try {const ast=parse(source,{context:'declarationList'});const accepted:string[]=[];
    ast.type==='DeclarationList'&&ast.children.forEach(node=>{
      if(node.type!=='Declaration'||node.important)return;
      const key=node.property.toLowerCase(),value=generate(node.value);
      if(/[\\<>]/.test(key+value))return;
      if(key.startsWith('--')){if(!svg&&effectParameter(key,value)&&(!['--nw-color','--nw-color-end','--nw-track-color'].includes(key)||lexer.matchProperty('color',value).matched))accepted.push(`${key}:${value}`);return;}
      if(!properties.has(key)&&!(svg&&svgProperties.has(key)))return;
      let safe=true,hasVar=false;
      walk(node.value,item=>{
        if(item.type==='Raw')safe=false;
        if(item.type==='Url'&&(!svg||!/^#[a-zA-Z_][\w.-]*$/.test(item.value)))safe=false;
        if(item.type==='Function'){
          if(item.name==='var'){hasVar=true;if(svg||!/^var\(--nw-(?:color|color-end|track-color|distance|scale|angle|intensity|duration|delay|progress|track-size|ring-size|glow-size|easing|enter-duration|hover-duration|fold-duration)\)$/.test(generate(item)))safe=false;}
          else if(!/^(rgb|rgba|hsl|hsla|linear-gradient|radial-gradient|conic-gradient|repeating-linear-gradient|repeating-radial-gradient|translate|translateX|translateY|translateZ|translate3d|rotate|rotateX|rotateY|rotateZ|rotate3d|scale|scaleX|scaleY|scaleZ|scale3d|skew|skewX|skewY|matrix|matrix3d|perspective|blur|brightness|contrast|grayscale|saturate|sepia|hue-rotate|opacity|drop-shadow|cubic-bezier|steps|calc|min|max|clamp)$/i.test(item.name))safe=false;
        }
      });
      if(!safe)return;
      if(key==='transition-property'&&value.split(',').some(v=>!['color','background-color','opacity','transform','box-shadow','filter'].includes(v.trim())))return;
      if(!hasVar&&!lexer.matchProperty(key,node.value).matched)return;
      accepted.push(`${key}:${value}`);
    });return accepted.join(';');
  }catch{return '';}
}
export function cleanSvgSheet(source:string,staticMode=false):string {
  if(source.length>30000||/[\\<>]/.test(source))return '';
  try{const ast=parse(source);if(ast.type!=='StyleSheet')return '';const result:string[]=[];
    ast.children.forEach(node=>{
      if(node.type==='Rule'){const selector=generate(node.prelude);if(/[:@]/.test(selector))return;const style=cleanStyle(generate(node.block).slice(1,-1),true);if(style)result.push(`${selector}{${style}}`);}
      if(!staticMode&&node.type==='Atrule'&&node.name==='keyframes'&&node.prelude&&node.block){const name=generate(node.prelude);if(!/^[a-zA-Z_][\w-]*$/.test(name))return;const frames:string[]=[];node.block.children.forEach(frame=>{if(frame.type!=='Rule')return;const selector=generate(frame.prelude);if(!/^(?:(?:from|to|\d+(?:\.\d+)?%)(?:,|$))+$/.test(selector))return;const style=cleanStyle(generate(frame.block).slice(1,-1),true);frames.push(`${selector}{${style}}`);});result.push(`@keyframes ${name}{${frames.join('')}}`);}
    });return result.join('');
  }catch{return '';}
}
