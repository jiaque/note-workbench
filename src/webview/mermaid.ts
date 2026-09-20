let loading:Promise<typeof import('mermaid')['default']>|undefined;
export function loadMermaid(dark=false){
  loading??=Promise.all([import('mermaid'),import('@mermaid-js/mermaid-zenuml')]).then(async([module,zen])=>{
    const mermaid=module.default;
    await mermaid.registerExternalDiagrams([zen.default]);
    mermaid.initialize({startOnLoad:false,securityLevel:'strict',suppressErrorRendering:true,theme:dark?'dark':'default'});
    return mermaid;
  });return loading;
}
