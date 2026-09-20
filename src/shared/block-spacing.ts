// A separator newline ends the previous block; the rest are empty source lines.
// Matches the 10px empty lines used by Live Preview without changing source.
export function blankLinesBetween(source:string,from:number,to:number,leading=false):number {
  const gap=source.slice(from,to);
  if(!/^\s*$/.test(gap))return 0;
  return Math.max(0,(gap.match(/\r\n|\n|\r/g)?.length??0)-(leading?0:1));
}
