import redraw from '../../../utils/redraw';
import * as xhr from '../userXhr';
import { handleXhrError } from '../../../utils';
import helper from '../../helper';
import IScroll from 'iscroll/build/iscroll-probe';
import { throttle } from 'lodash/function';
import socket from '../../../socket';
import challengeForm from '../../challengeForm';
import * as m from 'mithril';

var scroller;

export default function oninit(vnode) {

  helper.analyticsTrackView('User following');

  socket.createDefault();

  const userId = vnode.attrs.id;
  const following = m.prop([]);
  const paginator = m.prop(null);
  const isLoadingNextPage = m.prop(false);

  function onScroll() {
    if (this.y + this.distY <= this.maxScrollY) {
      // lichess doesn't allow for more than 39 pages
      if (!isLoadingNextPage() && paginator().nextPage && paginator().nextPage < 40) {
        loadNextPage(paginator().nextPage);
      }
    }
  }

  function scrollerConfig(vn) {
    const el = vn.dom;
    scroller = new IScroll(el, {
      probeType: 2
    });
    scroller.on('scroll', throttle(onScroll, 150));
  }

  function scrollerOnUpdate() {
    scroller.refresh();
  }

  function loadNextPage(page) {
    isLoadingNextPage(true);
    xhr.following(userId, page)
    .then(data => {
      isLoadingNextPage(false);
      paginator(data.paginator);
      following(following().concat(data.paginator.currentPageResults));
      redraw();
    })
    .catch(handleXhrError);
    redraw();
  }

  xhr.following(userId, 1, true)
  .then(data => {
    paginator(data.paginator);
    following(data.paginator.currentPageResults);
  })
  .then(() => setTimeout(() => {
    if (scroller) scroller.scrollTo(0, 0, 0);
  }, 50))
  .catch(handleXhrError);

  function setNewUserState(obj, newData) {
    obj.relation = newData.following;
  }

  vnode.state = {
    following,
    scrollerConfig,
    scrollerOnUpdate,
    isLoadingNextPage,
    toggleFollowing: obj => {
      if (obj.relation) xhr.unfollow(obj.user).then(setNewUserState.bind(undefined, obj));
      else xhr.follow(obj.user).then(setNewUserState.bind(undefined, obj));
    },
    challenge(id) {
      challengeForm.open(id);
    }
  };
}
