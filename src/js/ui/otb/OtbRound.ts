import sound from '../../sound';
import router from '../../router';
import * as chess from '../../chess';
import * as chessFormat from '../../utils/chessFormat';
import settings from '../../settings';
import gameStatusApi from '../../lichess/status';
import * as gameApi from '../../lichess/game';
import { specialFenVariants } from '../../lichess/variant';
import { oppositeColor } from '../../utils';
import { setCurrentOTBGame } from '../../utils/offlineGames';
import redraw from '../../utils/redraw';

import promotion from '../shared/offlineRound/promotion';
import ground from '../shared/offlineRound/ground';
import makeData from '../shared/offlineRound/data';
import { setResult } from '../shared/offlineRound';
import atomic from '../shared/round/atomic';
import crazyValid from '../shared/round/crazy/crazyValid';
import { OtbRoundInterface, OtbVM, PromotingInterface } from '../shared/round';
import Replay from '../shared/offlineRound/Replay';

import actions from './actions';
import * as helper from '../helper';
import newGameMenu, { NewOtbGameCtrl } from './newOtbGame';

import clockCtrl from '../shared/round/clock/ClockCtrl';

interface InitPayload {
  variant: VariantKey
  fen?: string
}

export default class OtbRound implements OtbRoundInterface, PromotingInterface {
  public setupFen: string;
  public data: OfflineGameData;
  public actions: any;
  public newGameMenu: NewOtbGameCtrl;
  public chessground: Chessground.Controller;
  public replay: Replay;
  public vm: OtbVM;
  public clock: any;
  private clockIntervId: number;

  public constructor(saved?: StoredOfflineGame, setupFen?: string) {
    this.setupFen = setupFen;
    this.actions = actions.controller(this);
    this.newGameMenu = newGameMenu.controller(this);

    this.vm = {
      flip: false,
      setupFen,
      savedFen: saved && saved.data.game.fen
    };

    if (setupFen) {
      this.newGameMenu.isOpen(true);
    }

    const currentVariant = <VariantKey>settings.otb.variant();
    const currentTime = <VariantKey>settings.otb.time();
    const currentIncrement = <VariantKey>settings.otb.increment();

    const clockSettings: ClockData = {
      initial: +currentTime,
      increment: +currentIncrement,
      black: +currentTime,
      white: +currentTime,
      emerg: 60,
      running: false
    }

    console.info("current time is: " + currentTime);
    console.info("current increment is: " + currentIncrement);

    if (!setupFen) {
      if (saved) {
        try {
          this.init(saved.data, saved.situations, saved.ply);
        } catch (e) {
          this.startNewGame(currentVariant, clockSettings);
        }
      } else {
        this.startNewGame(currentVariant, clockSettings);
      }
    }
  }

  public isClockRunning(): boolean {
    return this.data.clock && gameApi.playable(this.data) &&
      ((this.data.game.turns - this.data.game.startedAtTurn) > 1 || this.data.clock.running);
  }

  private clockTick = () => {
    if (this.isClockRunning()) {
      this.clock.tick(this.data.game.player);
    }
  }

  public init(data: OfflineGameData, situations: Array<GameSituation>, ply: number) {
    this.actions.close();
    this.newGameMenu.close();
    this.data = data;

    const variant = this.data.game.variant.key;
    const initialFen = this.data.game.initialFen;

    if (!this.replay) {

      this.data.game.turns = 0;
      this.data.game.startedAtTurn = 0;

      this.replay = new Replay(
        variant,
        initialFen,
        situations,
        ply,
        this.onReplayAdded,
        this.onThreefoldRepetition
      );
    } else {
      this.data.game.turns = ply;
      this.data.game.startedAtTurn = ply;

      this.replay.init(variant, initialFen, situations, ply);
    }

    if (!this.chessground) {
      this.chessground = ground.make(this.data, this.replay.situation(), this.userMove, this.onUserNewPiece, this.onMove, this.onNewPiece);
    } else {
      ground.reload(this.chessground, this.data, this.replay.situation());
    }

    redraw();
  }

  public startNewGame(variant: VariantKey, clockSettings: ClockData, setupFen?: string) {
    const payload: InitPayload = {
      variant
    };
    if (setupFen && !specialFenVariants.includes(variant)) {
      payload.fen = setupFen;
    }

    this.clock = this.data.clock ? new (<any>clockCtrl)(
      this.data.clock,
      this.onClockTimeout,
      this.data.player.color
    ) : false;

    if (this.clock) this.clockIntervId = setInterval(this.clockTick, 100);
    console.info("On init, clock interv id is: " + this.clockIntervId);

    helper.analyticsTrackEvent('Offline OTB Game', `New game ${variant}`);

    chess.init(payload)
    .then((data: chess.InitResponse) => {
      this.init(makeData({
        id: 'offline_otb',
        variant: data.variant,
        clock: clockSettings,
        initialFen: data.setup.fen,
        fen: data.setup.fen,
        player: data.setup.player,
        color: this.data && oppositeColor(this.data.player.color) || data.setup.player,
        pref: {
          centerPiece: true
        }
      }), [data.setup], 0);
    })
    .then(() => {
      if (setupFen) {
        this.vm.setupFen = null;
        router.replaceState('/otb');
      }
    });
  }

  public save() {
    setCurrentOTBGame({
      data: this.data,
      situations: this.replay.situations,
      ply: this.replay.ply
    });
  }

  private onClockTimeout = ()  => {
    console.info(this.clockIntervId);
    clearInterval(this.clockIntervId);
    console.info("Clock timed out...");
  }

  private onPromotion = (orig: Pos, dest: Pos, role: Role) => {
    this.replay.addMove(orig, dest, role);
  }

  private userMove = (orig: Pos, dest: Pos) => {
    if (!promotion.start(this.chessground, orig, dest, this.onPromotion)) {
      this.replay.addMove(orig, dest);
    }
  }

  private onMove = (orig: Pos, dest: Pos, capturedPiece: Piece) => {
    if (capturedPiece) {
      if (this.data.game.variant.key === 'atomic') {
        atomic.capture(this.chessground, dest);
        sound.explosion();
      }
      else sound.capture();
    } else sound.move();

    this.data.game.turns++;
  }

  private onUserNewPiece = (role: Role, key: Pos) => {
    const sit = this.replay.situation();
    if (crazyValid.drop(this.chessground, this.data, role, key, sit.drops)) {
      this.replay.addDrop(role, key);
    } else {
      this.apply(this.replay.situation());
    }
  }

  private onNewPiece = () => {
    sound.move();
  }

  public apply(sit: GameSituation) {
    if (sit) {
      const lastUci = sit.uciMoves.length ? sit.uciMoves[sit.uciMoves.length - 1] : null;
      this.chessground.set({
        fen: sit.fen,
        turnColor: sit.player,
        lastMove: lastUci ? chessFormat.uciToMoveOrDrop(lastUci) : null,
        dests: sit.dests,
        movableColor: sit.player,
        check: sit.check
      });
    }
  }

  public onReplayAdded = (sit: GameSituation) => {
    this.data.game.fen = sit.fen;
    this.apply(sit);
    setResult(this, sit.status);
    if (gameStatusApi.finished(this.data)) {
      this.onGameEnd();
    }
    this.save();
    redraw();
  }

  public onThreefoldRepetition = (newStatus: GameStatus) => {
    setResult(this, newStatus);
    this.save();
    this.onGameEnd();
  }

  public onGameEnd = () => {
    this.chessground.stop();
    setTimeout(() => {
      this.actions.open();
      redraw();
    }, 500);
  }

  public player = () => {
    return this.replay.situation().player
  }

  public jump = (ply: number) => {
    this.chessground.cancelMove();
    if (ply < 0 || ply >= this.replay.situations.length) return;
    this.replay.ply = ply;
    this.apply(this.replay.situation());
    return false;
  }

  public jumpNext = () => this.jump(this.replay.ply + 1);
  public jumpPrev = () => this.jump(this.replay.ply - 1);
  public jumpFirst = () => this.jump(this.firstPly());
  public jumpLast = () => this.jump(this.lastPly());

  public firstPly = () => 0;
  public lastPly = () => this.replay.situations.length - 1;

  public replaying = () => {
    return this.replay.ply !== this.lastPly();
  }

  public canDrop = () => true;
}
