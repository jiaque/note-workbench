import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pdfHtml} from '../src/pdf/export';
import {findBrowser} from '../src/pdf/browser';

test('PDF wrapper escapes metadata and uses rendering assets without editor controls',()=>{
  const html=pdfHtml('<unsafe title>','<h1>正文</h1>',['report" onclick="bad'],['resource/0']);
  assert.match(html,/<title>&lt;unsafe title&gt;<\/title>/);
  assert.match(html,/report&quot; onclick=&quot;bad/);
  assert.match(html,/assets\/editor.css/);assert.match(html,/assets\/export.js/);
  assert.match(html,/<h1>正文<\/h1>/);assert.doesNotMatch(html,/id="app"|document-menu|block-preview/);
});
test('an invalid configured browser reports how to fix it instead of silently selecting another',async()=>{
  await assert.rejects(findBrowser('Z:/nonexistent-note-workbench-browser'),/pdf.browserPath/);
});
