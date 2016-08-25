import helper from '../helper';
import oninit from './correspondenceCtrl';
import view from './correspondenceView';

export default {
  oninit,
  oncreate: helper.viewFadeIn,
  onbeforeremove: helper.viewFadeOut,
  view
};
