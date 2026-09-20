export const effects = ['breathe','pulse','glow','shine','gradient-flow','border-flow','ripple','float','spin','swing','bounce','shake','highlight','progress','progress-striped','progress-ring','loading-bar','loading-dots','spinner','skeleton'] as const;
export const entrances = ['fade','slide-up','slide-down','slide-left','slide-right','zoom','reveal','blur-in'] as const;
export const hovers = ['lift','zoom','glow','tint','underline','tilt'] as const;
export const effectAttributes:Record<string,readonly string[]> = {dataNwEffect:effects,dataNwEnter:entrances,dataNwHover:hovers,dataNwTrigger:['auto','hover','click','visible'],dataNwPlay:['running','paused'],dataNwDirection:['normal','reverse','alternate','alternate-reverse']};
export function effectParameter(name:string,value:string):boolean {
  if(['--nw-color','--nw-color-end','--nw-track-color'].includes(name))return /^(#[\da-f]{3,8}|[a-z]+|(?:rgb|rgba|hsl|hsla)\([\d\s.,%/+-]+\))$/i.test(value);
  if(name==='--nw-easing'){
    if(/^(linear|ease|ease-in|ease-out|ease-in-out)$/.test(value))return true;
    const bezier=/^cubic-bezier\(([^)]+)\)$/.exec(value);if(bezier){const p=bezier[1].split(',').map(Number);return p.length===4&&p.every(Number.isFinite)&&p[0]>=0&&p[0]<=1&&p[2]>=0&&p[2]<=1;}
    return /^steps\([1-9]\d{0,2}(?:,\s*(?:start|end))?\)$/.test(value);
  }
  const m=/^(\d+(?:\.\d+)?)(ms|s|px|%|deg)?$/.exec(value);if(!m)return false;
  const n=Number(m[1]),unit=m[2]??'';
  if(/duration$|delay$/.test(name)&&/^--nw-(duration|delay|enter-duration|hover-duration|fold-duration)$/.test(name)){const ms=n*(unit==='s'?1000:1),max:Record<string,number>={'--nw-delay':30000,'--nw-enter-duration':3000,'--nw-hover-duration':1000,'--nw-fold-duration':500};return ['s','ms'].includes(unit)&&ms>=(name==='--nw-delay'?0:100)&&ms<= (max[name]??60000);}
  const rules:Record<string,[string,number,number]>={'--nw-intensity':['',0,1],'--nw-distance':['px',0,64],'--nw-scale':['',.8,1.2],'--nw-angle':['deg',0,30],'--nw-glow-size':['px',0,32],'--nw-progress':['%',0,100],'--nw-track-size':['px',2,24],'--nw-ring-size':['px',24,200]};
  const r=rules[name];return !!r&&unit===r[0]&&n>=r[1]&&n<=r[2];
}
