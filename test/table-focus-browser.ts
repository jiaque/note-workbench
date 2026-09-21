export {};
const output=document.querySelector('output')!,frame=document.querySelector('iframe')!;
const tick=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
const check=(value:unknown,message:string)=>{if(!value)throw Error(message);};
try{
  for(let i=0;i<300&&!frame.contentDocument?.querySelector('td code');i++)await tick();
  const doc=frame.contentDocument!,win=frame.contentWindow!;
  check(doc.querySelector('td code'),'fixture rendered');
  // Click the nested node itself, not the containing cell. Replacing it during
  // mousedown used to fool the outer widget's target.closest() check.
  for(const needle of ['## <span','### <span','#### <span','#953734']){
    const code=[...doc.querySelectorAll('td code')].find(node=>node.textContent?.includes(needle))!;
    check(code,`code fixture ${needle}`);code.scrollIntoView();await tick();
    const rect=code.getBoundingClientRect();
    code.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0,clientX:rect.left+4,clientY:rect.top+4}));
    await tick();await tick();
    check(doc.activeElement?.closest('.cell-editor'),`code click retains cell focus: ${needle}`);
    check(doc.querySelectorAll('.cell-editor').length===1,'exactly one cell editor');
    check(doc.activeElement?.textContent?.includes(needle),'code stays literal while editing');
  }
  check((win as any).testEditCount===0,'entering cells does not change source');
  output.textContent='PASS: direct nested-code clicks retain focus across four cell switches; code remains literal; no source edits.';
}catch(error){output.textContent='FAIL: '+String(error);console.error(error);}
