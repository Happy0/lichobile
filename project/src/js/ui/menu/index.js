import * as m from 'mithril';
import * as Zanimo from 'zanimo';
import redraw from '../../utils/redraw';
import router from '../../router';
import backbutton from '../../backbutton';

const menu = {};

/* properties */
menu.isOpen = false;
menu.headerOpen = m.prop(false);

menu.route = function(route) {
  return function() {
    return menu.close().then(router.set.bind(undefined, route));
  };
};

menu.popup = function(action) {
  return function() {
    return menu.close().then(() => {
      action();
      redraw();
    });
  };
};

menu.toggle = function() {
  if (menu.isOpen) menu.close();
  else menu.open();
};

menu.open = function() {
  backbutton.stack.push(menu.close);
  menu.isOpen = true;
};

menu.close = function(fromBB) {
  if (fromBB !== 'backbutton' && menu.isOpen) backbutton.stack.pop();
  return Zanimo(
    document.getElementById('side_menu'),
    'transform',
    'translate3d(-100%,0,0)', 250, 'ease-out'
  )
  .then(() => {
    menu.headerOpen(false);
    menu.isOpen = false;
    redraw();
  })
  .catch(console.log.bind(console));
};

menu.toggleHeader = function() {
  return menu.headerOpen() ? menu.headerOpen(false) : menu.headerOpen(true);
};

export default menu;
