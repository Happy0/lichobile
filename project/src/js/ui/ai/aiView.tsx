import * as chessground from 'chessground-mobile';
import i18n from '../../i18n';
import { getBoardBounds } from '../../utils';

import layout from '../layout';
import { gameTitle, header as renderHeader, viewOnlyBoardContent } from '../shared/common';
import Board, { Attrs as BoardAttrs } from '../shared/Board';
import {
  renderAntagonist,
  renderGameActionsBar,
  renderReplayTable
} from '../shared/offlineRound/view';
import { view as renderPromotion } from '../shared/offlineRound/promotion';
import helper from '../helper';
import actions from './actions';
import newGameMenu from './newAiGame';
import AiRound from './AiRound';

export default function view() {
  let content: any, header: any;

  if (this.round.data && this.round.chessground) {
    header = () => renderHeader(gameTitle(this.round.data));
    content = () => renderContent(this.round);
  } else {
    header = () => renderHeader(i18n('playOfflineComputer'));
    content = viewOnlyBoardContent;
  }

  return layout.board(
    header,
    content,
    () => overlay(this.round)
  );
}

function renderContent(ctrl: AiRound) {

  const material = chessground.board.getMaterialDiff(ctrl.chessground.data);
  const isPortrait = helper.isPortrait();
  const bounds = getBoardBounds(helper.viewportDim(), isPortrait, helper.isIpadLike(), helper.isLandscapeSmall(), 'game');
  const replayTable = renderReplayTable(ctrl.replay);

  const aiName = (
    <h2>
      {ctrl.getOpponent().name}
      { ctrl.vm.engineSearching ?
        <span className="engineSpinner fa fa-hourglass-half" /> :
        null
      }
    </h2>
  );

  const board = m<BoardAttrs>(Board, {
    data: ctrl.data,
    chessgroundCtrl: ctrl.chessground,
    bounds,
    isPortrait
  });

  if (isPortrait) {
    return [
      renderAntagonist(ctrl, aiName, material[ctrl.data.opponent.color], 'opponent', isPortrait),
      board,
      renderAntagonist(ctrl, ctrl.playerName(), material[ctrl.data.player.color], 'player', isPortrait),
      renderGameActionsBar(ctrl, 'ai')
    ];
  } else {
    return [
      board,
      <section key="table" className="table">
        <section className="playersTable offline">
          {renderAntagonist(ctrl, aiName, material[ctrl.data.opponent.color], 'opponent', isPortrait)}
          {replayTable}
          {renderAntagonist(ctrl, '', material[ctrl.data.player.color], 'player', isPortrait)}
        </section>
        {renderGameActionsBar(ctrl, 'ai')}
      </section>
    ];
  }
}

function overlay(ctrl: AiRound) {
  return [
    actions.view(ctrl.actions),
    newGameMenu.view(ctrl.newGameMenu),
    renderPromotion(ctrl)
  ];
}

