import helper from '../../helper';
import spinner from '../../../spinner';
import i18n from '../../../i18n';
import backbutton from '../../../backbutton';
import { debounce }  from 'lodash/function';
import { readNote, syncNote } from './roundXhr';
import * as m from 'mithril';

export function notesCtrl(root) {

  this.syncing = true;

  readNote(root.data.game.id)
  .then(note => {
    root.data.note = note;
    this.syncing = false;
  })
  .catch(() => {
    this.syncing = false;
    window.plugins.toast.show('Could not read notes from server.', 'short', 'center');
  });

  let notesHeight;

  this.root = root;
  this.showing = false;
  this.inputValue = '';

  this.open = function() {
    backbutton.stack.push(helper.slidesOutDown(this.close, 'notes'));
    this.showing = true;
  }.bind(this);

  this.close = function(fromBB) {
    window.cordova.plugins.Keyboard.close();
    if (fromBB !== 'backbutton' && this.showing) backbutton.stack.pop();
    this.showing = false;
  }.bind(this);

  function onKeyboardShow(e) {
    if (window.cordova.platformId === 'ios') {
      let ta = document.getElementById('notesTextarea');
      if (!ta) return;
      notesHeight = ta.offsetHeight;
      ta.style.height = (notesHeight - e.keyboardHeight) + 'px';
    }
  }

  function onKeyboardHide() {
    let ta = document.getElementById('notesTextarea');
    if (window.cordova.platformId === 'ios') {
      if (ta) ta.style.height = notesHeight + 'px';
    }
    if (ta) ta.blur();
  }

  this.syncNotes = debounce(e => {
    const text = e.target.value;
    if (this.root.data.note !== text) {
      syncNote(this.root.data.game.id, text)
      .then(() => {
        this.root.data.note = text;
      });
    }
  }, 1000);

  window.addEventListener('native.keyboardhide', onKeyboardHide);
  window.addEventListener('native.keyboardshow', onKeyboardShow);

  this.unload = function() {
    document.removeEventListener('native.keyboardhide', onKeyboardHide);
    document.removeEventListener('native.keyboardshow', onKeyboardShow);
  };
}

export function notesView(ctrl) {

  if (!ctrl.showing) return null;

  return m('div#notes.modal', { oncreate: helper.slidesInUp }, [
    m('header', [
      m('button.modal_close[data-icon=L]', {
        oncreate: helper.ontouch(helper.slidesOutDown(ctrl.close, 'notes'))
      }),
      m('h2', i18n('notes'))
    ]),
    m('div.modal_content', [
      ctrl.syncing ?
      m('div.notesTextarea.loading', spinner.getVdom()) :
      m('textarea#notesTextarea.native_scroller', {
        placeholder: i18n('typePrivateNotesHere'),
        oninput: ctrl.syncNotes
      }, ctrl.root.data.note)
    ])
  ]);
}
