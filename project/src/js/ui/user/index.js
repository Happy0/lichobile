import helper from '../helper';
import oninit from './userCtrl';
import view from './userView';

export default {
  oninit: oninit,
  oncreate: helper.viewFadeIn,
  onbeforeremove: helper.viewFadeOut,
  view
};
