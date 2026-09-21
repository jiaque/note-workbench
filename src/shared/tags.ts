import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkFrontmatter from 'remark-frontmatter';
import {parse} from 'yaml';
import {obsidianSyntax,maskComments} from './obsidian';
import type {NoteEntry} from './note-links';
const parser=unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkFrontmatter,['yaml']).use(obsidianSyntax);
export function noteTags(source:string):string[]{
  const tags=new Set<string>();
  const add=(value:unknown)=>{if(typeof value!=='string')return;const tag=value.replace(/^#/,'').trim().toLocaleLowerCase();if(tag&&!/^\d+$/.test(tag)&&/^[\p{L}\p{N}_\-/]+$/u.test(tag)&&!tag.split('/').includes(''))tags.add(tag);};
  const tree:any=parser.parse(maskComments(source,parser.parse(source)));
  const visit=(node:any)=>{
    if(node.type==='yaml')try{const value=parse(node.value)?.tags;if(Array.isArray(value))value.forEach(add);else if(typeof value==='string')value.split(/[\s,]+/).forEach(add);}catch{}
    if(node.type==='obsidianInline'&&node.value.startsWith('#'))add(node.value.slice(1));
    for(const child of node.children??[])visit(child);
  };visit(tree);return [...tags].sort((a,b)=>a.localeCompare(b));
}
export interface TagGroup {tag:string;notes:NoteEntry[]}
const cachedTags=new WeakMap<NoteEntry,string[]>();
export function groupTags(notes:NoteEntry[]):TagGroup[]{
  const groups=new Map<string,NoteEntry[]>();
  for(const note of notes){let tags=cachedTags.get(note);if(!tags){tags=noteTags(note.source);cachedTags.set(note,tags);}for(const tag of tags){const list=groups.get(tag)??[];list.push(note);groups.set(tag,list);}}
  return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([tag,notes])=>({tag,notes:notes.sort((a,b)=>a.path.localeCompare(b.path))}));
}
