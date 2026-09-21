import * as vscode from 'vscode';
import {NoteIndex} from './note-index';
import {groupTags,type TagGroup} from './shared/tags';
import type {NoteEntry} from './shared/note-links';
import {t} from './shared/i18n';
type Item=TagGroup|NoteEntry;
export class TagsProvider implements vscode.TreeDataProvider<Item>,vscode.Disposable {
  private events=new vscode.EventEmitter<Item|undefined>();
  readonly onDidChangeTreeData=this.events.event;
  private subscription:vscode.Disposable;
  private filter='';
  constructor(private index:NoteIndex){this.subscription=index.onDidChange(()=>this.events.fire(undefined));}
  show(tag:string){this.filter=tag.replace(/^#/,'').trim().toLocaleLowerCase();this.events.fire(undefined);}
  async search(){const value=await vscode.window.showInputBox({prompt:t('筛选标签（留空显示全部）'),value:this.filter});if(value!==undefined){this.filter=value.replace(/^#/,'').trim().toLocaleLowerCase();this.events.fire(undefined);}}
  async getChildren(element?:Item):Promise<Item[]>{
    if(element)return 'tag'in element?element.notes:[];
    await this.index.ensure();return groupTags(this.index.notes).filter(group=>group.tag.includes(this.filter));
  }
  getTreeItem(element:Item):vscode.TreeItem{
    if('tag'in element){const item=new vscode.TreeItem('#'+element.tag,vscode.TreeItemCollapsibleState.Collapsed);item.id='tag:'+element.tag;item.description=String(element.notes.length);item.iconPath=new vscode.ThemeIcon('tag');return item;}
    const item=new vscode.TreeItem(element.name.replace(/\.md$/i,''));item.description=element.path;item.tooltip=element.path;item.resourceUri=vscode.Uri.parse(element.id);item.command={command:'noteWorkbench.openEditor',title:t('打开笔记'),arguments:[item.resourceUri]};return item;
  }
  dispose(){this.subscription.dispose();this.events.dispose();}
}
